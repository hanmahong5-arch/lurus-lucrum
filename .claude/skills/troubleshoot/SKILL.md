---
name: troubleshoot
description: "Lucrum 产品排障技能。覆盖页面不可达、登录失败、API 超时、数据库连接等生产问题。每个故障模式包含：现象→排查命令→根因→修复。使用 /troubleshoot 触发或当用户报告线上问题时自动启用。"
---

# Troubleshoot Skill — Lucrum Production Debugging

**Purpose**: 快速定位和修复 lucrum.lurus.cn 的生产问题。基于实战经验提炼的决策树，不需要从头排查。

## When to Use

- 用户说"打不开"、"加载不出来"、"报错"、"登录不了"、"很卡"
- 部署后验证失败
- `/troubleshoot` 手动触发

---

## Cluster Context（**先确认在哪个集群**）

Lucrum 生产 **2026-04-25 起在 R6**（不是 R1）。其他 lurus 服务仍在 R1。所有命令都要先确认目标集群：

| 集群 | 入口 | 用于 | CNPG pod | lucrum 状态 |
|------|------|------|----------|-------------|
| **R1** (PROD) | `ssh root@100.98.57.55` | 已交付商业服务（auth/api/admin/zitadel...） | `lurus-pg-1` | ❌ 已迁出，namespace 已清空 |
| **R6** (STAGE) | `ssh root@100.122.83.20` (Tailscale) | lucrum + 测试服务 | `lurus-pg-0` | ✅ 当前生产 |

**判断规则**：
- 用户说 "lucrum 打不开 / lucrum.lurus.cn ..." → 默认 R6
- 用户说 "auth 登录失败 / api.lurus.cn / admin.lurus.cn ..." → R1
- 用户说 "数据库" → 区分是哪个集群的 CNPG（pod 名不同）
- R6 公网 22 关，**只能** 走 Tailscale；用户名必须显式 `root@`，否则报 "failed to look up local user"

**R6 = 单节点 K3s + 无 ArgoCD**（vs R1 多节点 + ArgoCD）：
- 部署 = 改 `deploy/k8s/*.yaml` → ssh root@100.122.83.20 → `kubectl apply -f` → `kubectl rollout restart`
- 镜像 tag 是 `:main`（mutable），`imagePullPolicy: Always` + `rollout restart` 才会重拉
- 公网入口是 host nginx (`/etc/nginx/sites-enabled/lurus-stage`) → NodePort 30300。**没有** K8s Ingress 对象、**没有** Traefik 在 lucrum ns 里
- 单节点 → R1 老 playbook 里关于 `cross-node overlay broken` / `nodeSelector to master` / `hostAliases for hairpin NAT` 全部 **N/A**。Pod 跨节点路由问题不存在。

**禁止**把 lucrum 加回 R1 ApplicationSet 除非 R6 K3s 注册成多集群目的地。

---

## In-Pod E2E Probe Pattern（**2026-05-01 加固**）

**问题**：要从外部模拟用户行为去探 API（不带 NextAuth session），但 pod 是 distroless-ish + readOnlyRootFilesystem：
- 没有 `curl`（只有 `wget`）；有 `bun` + `node`
- 容器只有 `/tmp` 可写
- `kubectl exec -i` 把大文件喂进来时**stdin 偶发被截断到 0 字节**（`cat | ssh | kubectl exec -i 'cat > x'` 不可靠）
- pod 里 `localhost:3000` **不通** — Next.js standalone 只 bind IPv4 0.0.0.0，busybox wget 把 localhost 解析成 ::1。用 **`127.0.0.1:3000`** 或 **ClusterIP**

**产品化的探针模式**：

```bash
# 1) 写探针脚本（本地）
cat > /tmp/probe-magic.ts <<'EOF'
const BASE = 'http://10.43.197.40:3000';   // ClusterIP, 用 `kubectl get svc lucrum-web -o jsonpath='{.spec.clusterIP}'` 拿
const r = await fetch(`${BASE}/api/strategy/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: '...' }),
});
console.log(r.status, await r.text());
EOF

# 2) base64 round-trip 进 pod (避开 stdin truncation)，用 bun 跑
base64 -w0 /tmp/probe-magic.ts | ssh root@100.122.83.20 \
  "kubectl -n lucrum exec -i deploy/lucrum-web -- sh -c \
   'cat > /tmp/p.b64 && base64 -d /tmp/p.b64 > /tmp/probe.ts && rm /tmp/p.b64 && \
    HOME=/tmp XDG_CACHE_HOME=/tmp BUN_INSTALL_CACHE_DIR=/tmp BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 \
    bun /tmp/probe.ts'"
```

**为什么 base64**：纯 stdin pipe `cat file | ssh ... 'cat > x'` 在长一些的脚本（>5KB）会偶发被截 0 — kubectl exec stdin flush 竞态。base64 round-trip 同样 pipeline、~33% 带宽代价、**可靠**。`ingest-curated.sh` / `ingest-csi300.sh` 都用这个模式。

**Bun env 套装**：pod 里 runAsUser=65534 + readOnlyRootFilesystem，bun 默认 HOME 不可写。`HOME=/tmp XDG_CACHE_HOME=/tmp BUN_INSTALL_CACHE_DIR=/tmp BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` 全套指 /tmp 才不抛 EROFS。

**临时 SQL 探针**：

```bash
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- bun -e \
  \"const { Pool } = require('pg'); const p = new Pool({ connectionString: process.env.DATABASE_URL }); \
    p.query('SELECT count(*) FROM stocks').then(r => { console.log(r.rows); p.end(); });\""
# 注意：用裸表名 stocks（不要 lucrum.stocks），search_path 默认是 public
# kline_daily.date 列是 TEXT 不是 DATE → 不要用 to_char()，YYYY-MM-DD 字符串排序就够
```

---

## 排障决策树

先从用户描述判断进入哪条路径：

```
用户报告问题
 ├─ 页面白屏/一直转圈 ─────→ Path A: 不可达
 ├─ 登录报错/OAuthSignin ──→ Path B: 认证链路
 ├─ 页面能打开但功能报错 ──→ Path C: API 层
 ├─ 数据不显示/为空 ────────→ Path D: 数据库
 ├─ 很卡/超时 ──────────────→ Path E: 性能
 ├─ 用户创建失败 500 ───────→ Path F: 用户创建
 ├─ 监控 α 列显示 — ────────→ Path G: 监控数据缺失
 ├─ 监控不刷新/无新点 ──────→ Path H: 定时调度器
 ├─ 回测落 sina/eastmoney ──→ Path I: stocks.symbol 格式漂移
 └─ AI 策略生成 ≥ 30s ──────→ Path J: LLM CoT 陷阱
```

---

## Path A: 页面不可达（白屏/挂起/ERR_CONNECTION）

### Step 1: Pod 状态（R6）

```bash
ssh root@100.122.83.20 "kubectl -n lucrum get pods -o wide -l app=lucrum-web"
```

| 现象 | 原因 | 修复 |
|------|------|------|
| No pods | Deployment 被删或 replicas=0 | `kubectl -n lucrum scale deploy/lucrum-web --replicas=1` |
| `ImagePullBackOff` | GHCR 拉不到镜像 | 检查 secret/网络；R6 上 Tailscale 偶发拉不动公网 |
| `CrashLoopBackOff` | 启动崩溃 | `kubectl -n lucrum logs <pod> --previous` 看 crash 原因 |
| `ContainerCreating` 超过 2min | pause 容器或镜像拉取问题 | `kubectl describe pod <pod>` 看 Events |
| `1/1 Running` 但页面不通 | **→ 进入 Step 2** | |

### Step 2: 集群内 + 边缘连通性

R6 单节点 → **没有跨节点 overlay 问题**。直接拿 ClusterIP 探：

```bash
# ClusterIP（lucrum-web Service）
ssh root@100.122.83.20 "kubectl -n lucrum get svc lucrum-web -o jsonpath='{.spec.clusterIP}'"
# wget 直接探（pod 自己 wget 也行，见 §In-Pod E2E Probe）
ssh root@100.122.83.20 "wget -qS -O /dev/null --timeout=5 http://<ClusterIP>:3000/ 2>&1 | head -5"
```

| 结果 | 原因 | 修复 |
|------|------|------|
| `HTTP/1.1 200 OK` | Service/Pod OK，问题在边缘 | 进 Step 3 |
| 超时 | Pod 没监听 / probe failing | 看 `kubectl describe pod` 的 conditions + livenessProbe 状态 |
| `Connection refused` | Pod 进程没起来 / 还在 start phase | 看 logs |

### Step 3: 边缘 nginx → NodePort 路径（R6 专属）

R6 **不用** K8s Ingress / Traefik。公网入口是 host-level nginx：

```bash
# 1) NodePort 是 30300（lucrum-web Service 类型 NodePort）
ssh root@100.122.83.20 "kubectl -n lucrum get svc lucrum-web -o jsonpath='{.spec.ports[0].nodePort}'"

# 2) host nginx vhost
ssh root@100.122.83.20 "cat /etc/nginx/sites-enabled/lurus-stage | grep -A3 'lucrum'"
# 期望: server_name lucrum.lurus.cn; proxy_pass http://127.0.0.1:30300

# 3) 改 nodePort 必须 同步改 nginx config + reload
ssh root@100.122.83.20 "nginx -t && systemctl reload nginx"
```

R1 上的 IngressRoute / Traefik / overlay 路径在 R6 **N/A**。如果用户报告"lucrum 打不开"且 pod healthy + ClusterIP 200，永远是 nginx vhost 或 NodePort 配错。

---

## Path B: 登录失败（OAuthSignin / 400 Bad Request / redirect_uri）

### 决策树

```
登录页面能打开吗？
 ├─ 否 → Path A（不可达）
 └─ 是 → 点击"Lurus 登录"后发生什么？
     ├─ URL 里出现 error=OAuthSignin → Step 1
     ├─ 跳到 auth.lurus.cn 但返回 400 → Step 2
     ├─ 跳到 auth.lurus.cn 但页面加载不出 → Step 3
     └─ 登录后跳回但还是未登录 → Step 4
```

### Step 1: OAuthSignin 错误

NextAuth.js 无法初始化 OIDC 流程。通常是 **Pod 内部访问不了 auth.lurus.cn**。

```bash
# R6 验证：从 Pod 内部访问 Zitadel OIDC discovery
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=5 --no-check-certificate \
  https://auth.lurus.cn/.well-known/openid-configuration 2>&1 | head -1"
```

| 结果 | 原因 | 修复 |
|------|------|------|
| `can't connect (43.226.46.164): Connection refused` | **R1 hairpin NAT 不通**（仅 R1 时代）；R6 上**不应**出现，因为 R6 走公网 egress 解析到 R1 公网 IP，没回环 | 见下面「R6 vs R1 注意」|
| OIDC JSON 正常输出 | Pod 能访问 | 检查 NEXTAUTH_URL / NEXTAUTH_SECRET / Step 2 |
| TLS / DNS 错 | 上游 Zitadel 不健康 | 直接看 R1 上的 Zitadel pod |

**R6 vs R1 注意**：
- **R6**（当前 lucrum 生产）**没有 Traefik、没有 hairpin NAT 问题**。删了 `hostAliases` 之后 pod 通过 DNS 解析 auth.lurus.cn → R1 公网 IP，走公网 egress，没问题。如果 R6 上 pod 还配着指向 R1 Traefik ClusterIP（10.43.175.138）的 hostAliases，会黑洞 OIDC（IP 在 R6 上不可达）。**Lucrum on R6 不要加 hostAliases。**
- **R1**（其他服务）：hairpin NAT 是真问题，`hostAliases` 指向 R1 Traefik ClusterIP `10.43.175.138`，Traefik 在 pod 内监听 8443 但 Service 做了 443→8443。
- 任何"OIDC discovery 不通"的工单都先确认在哪个集群再选 playbook。

### Step 2: Zitadel 返回 400 (redirect_uri invalid)

错误信息：`"The requested redirect_uri is missing in the client configuration"`

**根因**: Zitadel OIDC 应用没注册当前域名的回调地址。

```bash
# 查看当前注册的 redirect URIs
ssh root@100.98.57.55 "kubectl exec -n database lurus-pg-1 -- psql -U postgres -d zitadel -c \
  \"SELECT a.name, o.redirect_uris, o.client_id \
   FROM projections.apps7 a \
   JOIN projections.apps7_oidc_configs o ON a.id=o.app_id AND a.instance_id=o.instance_id \
   WHERE o.client_id LIKE '%358400%';\""
```

修复 — 添加 `lucrum.lurus.cn` 的回调地址：

```bash
# 1. 更新 redirect_uris（保留旧的，追加新的）
ssh root@100.98.57.55 "kubectl exec -n database lurus-pg-1 -- psql -U postgres -d zitadel -c \
  \"UPDATE projections.apps7_oidc_configs \
   SET redirect_uris = array_append(redirect_uris, 'https://lucrum.lurus.cn/api/auth/callback/zitadel') \
   WHERE app_id = '358400000000000001' \
   AND NOT 'https://lucrum.lurus.cn/api/auth/callback/zitadel' = ANY(redirect_uris);\""

# 2. 重启 Zitadel 刷新 projection 缓存
ssh root@100.98.57.55 "kubectl -n lurus-platform rollout restart deployment/zitadel && \
  kubectl -n lurus-platform rollout status deployment/zitadel --timeout=120s"
```

**Zitadel 应用注册表**（当前有效）:

| App Name | Client ID | 已注册的域名 |
|---|---|---|
| gushen-web (lucrum) | `358400000000065537@lurus-api` | localhost:3000, gushen.lurus.cn, lucrum.lurus.cn |
| lurus-api-backend | `358371335178617311@lurus-api` | api.lurus.cn, localhost:3000 |
| lurus-www | `361700588037146440@lurus-api` | www.lurus.cn, lurus.cn |
| lurus-admin | `364461298307565392` | admin.lurus.cn |

**如果改了域名**，务必更新这张表（DB 直接改 + 重启 Zitadel）。

### Step 3: auth.lurus.cn 页面加载不出来

Zitadel Pod 也受 overlay 网络问题影响。

```bash
# 检查 Zitadel pod 在哪个节点
ssh root@100.98.57.55 "kubectl -n lurus-platform get pods -l app.kubernetes.io/name=zitadel -o wide"
```

如果不在 master，Traefik 路由不过去。解决方案同 Path A — pin to master 或等 overlay 修复。

### Step 4: 登录后仍未认证

```bash
# 检查 NEXTAUTH_SECRET 是否一致（多 Pod 间必须相同）
ssh root@100.98.57.55 "kubectl -n lucrum exec deploy/lucrum-web -- sh -c 'echo \$NEXTAUTH_SECRET | head -c 10'"
# 检查 NEXTAUTH_URL 是否正确
ssh root@100.98.57.55 "kubectl -n lucrum exec deploy/lucrum-web -- sh -c 'echo \$NEXTAUTH_URL'"
# 必须是 https://lucrum.lurus.cn（不能是 http 或 localhost）
```

---

## Path C: API 报错（功能异常）

```bash
# 从 Pod 内部测试 API
ssh root@100.98.57.55 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=5 http://127.0.0.1:3000/api/team 2>&1"
# 预期: {"error":"Unauthorized",...} (401 = API 正常，只是没认证)

# 看最近错误日志
ssh root@100.98.57.55 "kubectl -n lucrum logs deploy/lucrum-web --tail=50 | grep -i error"
```

| API 错误 | 原因 | 修复 |
|---|---|---|
| 401 Unauthorized | 未登录 | 先解决登录问题 (Path B) |
| 500 + DB connection error | PostgreSQL 不可达 | 检查 DATABASE_URL、网络策略 |
| 500 + Redis error | Redis 不可达 | 检查 REDIS_HOST、网络策略 |
| 504 Gateway Timeout | Pod 在错误节点 | Path A Step 2 |

---

## Path D: 数据库连接

**先确定集群与 CNPG pod 名**：

| 集群 | CNPG pod | psql 入口（peer-auth） |
|------|----------|------------------------|
| R1 | `lurus-pg-1` | `kubectl exec -n database lurus-pg-1 -- psql -U postgres -d <db>` |
| R6 | `lurus-pg-0` | `kubectl exec -n database lurus-pg-0 -- psql -U postgres -d <db>` |

**关键经验**：CNPG 应用账号（如 `lurus-pg-app` / `lurus`）的密码走 **TCP 不一定通**（pg_hba.conf 只放本地 unix）。**永远用 peer-auth**：`exec ... psql -U postgres`，不要在 `psql` 命令里写密码。

```bash
# R6 — 从 Pod 内部测试 DB 连接（生产）
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- sh -c 'echo \$DATABASE_URL | sed \"s/:.*@/:***@/\"'"
ssh root@100.122.83.20 "kubectl exec -n database lurus-pg-0 -- psql -U postgres -d lucrum -c 'SELECT count(*) FROM users;'"

# R1 — 仅用于 lurus-api / zitadel 等非 lucrum 服务
ssh root@100.98.57.55 "kubectl exec -n database lurus-pg-1 -- psql -U postgres -d lurusapi -c 'SELECT count(*) FROM users;'"
```

**Drizzle migration apply 模式**（peer-auth 不能 `kubectl cp` 到只读 fs）：

```bash
# 把本地 SQL 通过 stdin 喂进去；ON_ERROR_STOP=1 以便失败立即退出
cat lucrum-web/drizzle/0008_pack_run_alpha.sql | \
  ssh root@100.122.83.20 "kubectl exec -i -n database lurus-pg-0 -- \
    psql -U postgres -d lucrum -v ON_ERROR_STOP=1"
```

**已知问题**:
- 生产 DATABASE_URL 用 `lurus-pg-rw.database.svc.cluster.local:5432`，从 R1 master 跨节点 overlay 不通时需要 `nodeSelector` 同节点。R6 单节点不存在该问题。
- 全新集群 lucrum DB 是空的，需要按序应用 0000-NNNN 迁移。用 `lucrum-web/scripts/bootstrap-prod-db.sh`。

---

## Path E: 性能问题（慢/卡）

```bash
# 检查 Pod 资源使用
ssh root@100.98.57.55 "kubectl -n lucrum top pod"

# 检查 Node 资源
ssh root@100.98.57.55 "kubectl top node"

# 检查是否在频繁重启
ssh root@100.98.57.55 "kubectl -n lucrum get pods -l app=lucrum-web -o wide"
# RESTARTS 列 > 0 说明有 crash
```

---

## 环境变量速查

```bash
# 一键查看所有关键环境变量
ssh root@100.98.57.55 "kubectl -n lucrum exec deploy/lucrum-web -- sh -c '
  echo NEXTAUTH_URL=\$NEXTAUTH_URL
  echo ZITADEL_ISSUER=\$ZITADEL_ISSUER
  echo ZITADEL_CLIENT_ID=\$ZITADEL_CLIENT_ID
  echo DATABASE_URL=\$(echo \$DATABASE_URL | sed \"s/:.*@/:***@/\")
  echo REDIS_ENABLED=\$REDIS_ENABLED
  echo REDIS_HOST=\$REDIS_HOST
  echo NODE_ENV=\$NODE_ENV
'"
```

## NetworkPolicy 速查

```bash
# 查看 lucrum namespace 的网络策略
ssh root@100.98.57.55 "kubectl get networkpolicy -n lucrum"

# 当前策略:
# - default-deny-all: 默认拒绝所有 ingress + egress
# - allow-dns-egress: 放行 DNS(53) + DB(5432) + platform(18104) + observability(4317) + kube-system(8443,8000) + 公网 443
# - lucrum-ingress: 允许 Traefik 进入

# 如果新增了跨 namespace 的依赖，需要加 egress 规则
```

## Path F: 用户创建失败（500 "Failed to create user account"）

OIDC 回调到 `api.lurus.cn` 后 lurus-api 创建本地用户报错。

```bash
# 查看 lurus-api 日志
ssh root@100.98.57.55 "kubectl -n lurus-system logs deploy/lurus-api --tail=50 | grep -i 'create user\|Zitadel claims'"
```

| 错误信息 | 原因 | 修复 |
|---|---|---|
| `null value in column "password" violates not-null constraint` | password 列 NOT NULL 无默认值，OIDC 用户没密码 | `ALTER TABLE users ALTER COLUMN password SET DEFAULT '';` |
| `tenant has reached maximum user limit` | 租户用户数上限 | 管理后台调整 tenant quota |
| `unique constraint "users_username_key"` | 用户名重复 | 代码已有 ensureUniqueUsername 逻辑，不应出现；检查并发竞争 |

```bash
# 修复 password 默认值（在 lurusapi 库）
ssh root@100.98.57.55 "kubectl exec -n database lurus-pg-1 -- psql -U postgres -d lurusapi -c \
  \"ALTER TABLE users ALTER COLUMN password SET DEFAULT '';\""
```

## Zitadel 管理速查

```bash
# 管理员: zitadel-admin@zitadel.auth.lurus.cn / Lurus@ops
# Console UI: https://auth.lurus.cn/ui/console

# 查看所有 OIDC 应用及其 redirect URIs
ssh root@100.98.57.55 "kubectl exec -n database lurus-pg-1 -- psql -U postgres -d zitadel -c \
  \"SELECT a.name, o.redirect_uris, o.client_id \
   FROM projections.apps7 a \
   JOIN projections.apps7_oidc_configs o ON a.id=o.app_id AND a.instance_id=o.instance_id \
   WHERE a.state=1;\""

# 添加新的 redirect URI
ssh root@100.98.57.55 "kubectl exec -n database lurus-pg-1 -- psql -U postgres -d zitadel -c \
  \"UPDATE projections.apps7_oidc_configs \
   SET redirect_uris = array_append(redirect_uris, 'https://NEW_DOMAIN/api/auth/callback/zitadel') \
   WHERE app_id = '358400000000000001';\""
# 改完后必须重启 Zitadel:
ssh root@100.98.57.55 "kubectl -n lurus-platform rollout restart deployment/zitadel"
```

## hostAliases 清单（仅 R1）

R6 lucrum-web deployment **不应**有 hostAliases（hairpin NAT 不存在 → 强加 hostAliases 反而黑洞 OIDC）。

R1 上仍部署的服务可能需要：

```yaml
# R1 ONLY
hostAliases:
  - ip: "10.43.175.138"  # R1 Traefik ClusterIP (kube-system)
    hostnames:
      - "auth.lurus.cn"
```

如果 R1 Traefik 被重建，ClusterIP 可能变化：
```bash
ssh root@100.98.57.55 "kubectl get svc -n kube-system traefik -o jsonpath='{.spec.clusterIP}'"
```

---

## Path G: 监控页 α(超额) 列显示 —

**现象**: `/dashboard/monitoring` 表格 `基准` 和 `α(超额)` 列空白；趋势 sparkline 显示 0 baseline；DB 中 `pack_run_performance.benchmark_return IS NULL`。

**根因决策树**:

```bash
# 1) 看 DB 是否有 CSI300 行情
ssh root@100.122.83.20 "kubectl exec -n database lurus-pg-0 -- psql -U postgres -d lucrum -c \
  \"SELECT count(*) FROM kline_daily WHERE symbol='000300';\""
```

| 返回 | 原因 | 修复 |
|------|------|------|
| `0` | **CSI300 未入库** — 这是设计内的优雅降级 | 见 `lucrum-monitoring` skill §CSI300 ingest playbook |
| `>0` 但只覆盖最近几天 | 历史回填不全 | 同上，扩 lookback 重跑 |
| `>0` 历史完整 | 计算逻辑有 bug | 看 Path G2 |

**Path G2 — CSI300 已入库但 alpha 还是 NULL**:

```bash
# 2) 看 stocks 表 CSI300 状态（survivorship 过滤 status='active'，但 fetchBenchmarkSeries 不过滤）
ssh root@100.122.83.20 "kubectl exec -n database lurus-pg-0 -- psql -U postgres -d lucrum -c \
  \"SELECT symbol,name,status FROM stocks WHERE symbol='000300';\""

# 3) 触发一次手动重算（让 scheduler 立刻跑）
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=30 http://127.0.0.1:3000/api/cron/init"
# 等几分钟，再看 pack_run_performance.benchmark_return 是否填上
```

**优雅降级原则**：CSI300 缺失时，UI 显示 `—` 而非 `0` 或假值。这是**正确行为**，不是 bug。

---

## Path H: 监控数据停止刷新（无新点）

**现象**: 趋势 sparkline 几天没有新点；最新 pack_run 已成功但 `pack_run_performance.computed_at` 还停在更早时间。

```bash
# 1) 看 cron init 是否调用过（重启后必须 GET 一次）
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=10 http://127.0.0.1:3000/api/cron/init 2>&1 | grep -oE 'packRunPerformanceScheduler.{0,80}'"
# 期望: "packRunPerformanceScheduler":{"enabled":true,"schedule":"07:00 CST (Mon-Fri)",...}

# 2) 看进程内调度器的日志（singleton 启动时打 [Scheduler] 字样）
ssh root@100.122.83.20 "kubectl -n lucrum logs deploy/lucrum-web --tail=200 | grep -i 'scheduler\\|cron'"
```

| 现象 | 原因 | 修复 |
|------|------|------|
| `enabled:false` | `NODE_ENV != 'production'` | 检查 deployment env，确保 `NODE_ENV=production` |
| 日志无 Scheduler 痕迹 | Pod 启动后没人调过 `/api/cron/init` | `wget http://127.0.0.1:3000/api/cron/init` 主动触发；考虑加 readinessProbe 或 startup hook |
| Pod 内 `wget http://localhost:3000/...` 返回 `Connection refused`，但 `ss -tln` 显示在监听 0.0.0.0:3000 | busybox wget 把 `localhost` 解析成 `::1`（IPv6），但 Next.js standalone server 只 bind IPv4 0.0.0.0 | 改用 `http://127.0.0.1:3000/...` |
| 日志显示 cron tick 但没写 DB | computePackRunPerformance 报错 | grep `pack-run-performance` 错误日志 |
| 多个 replica 各跑一份 | singleton 是进程内的；副本数 > 1 时会重复跑（幂等 upsert 不影响正确性，浪费 CPU） | 改 cron 为单 leader 选举 / 改用 K8s CronJob |

**关键经验**: Next.js App Router 没有 server-startup hook，cron 必须靠**外部第一次调用** `/api/cron/init` 触发 singleton。生产建议在 deploy 脚本里加一行 `kubectl exec ... wget /api/cron/init` 收尾。

---

## Path I: 回测落到 sina/eastmoney 而非数据库（**2026-05-01**）

**现象**: `/api/backtest` 响应里 `meta.dataSource.provider = "sina"` 或 `"eastmoney-api"`，`dbCoverage = undefined`。本应是 `"postgresql-database"` + 0.95+ 覆盖率。每次回测多 1-2s + 触发 sina/EM rate-limit。

**根因决策树**:

```bash
# 1) 看股票在 stocks 表的 symbol 怎么存的
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- bun -e \
  \"const { Pool } = require('pg'); const p = new Pool({ connectionString: process.env.DATABASE_URL }); \
    p.query(\\\"SELECT id, symbol, exchange, name FROM stocks WHERE symbol LIKE '%600519%' OR symbol = '600519'\\\").then(r => { console.log(r.rows); p.end(); });\""
```

| 现象 | 原因 | 修复 |
|------|------|------|
| `symbol = "600519.SH"` | **格式漂移** — canonical 是 bare `"600519"` + `exchange = "SH"`。kline-persister/db-kline-provider 都用 normalizeSymbol 剥后缀；带后缀的行查不到 → fallback API | `UPDATE stocks SET symbol = regexp_replace(symbol, '\.(SH\|SZ\|BJ)$', '') WHERE symbol ~ '\.(SH\|SZ\|BJ)$';` 一次性修复 |
| `symbol = "600519"`，但 stocks 行里 `name = symbol` | **stub 孤儿** — kline-persister auto-persist 路径在 API fallback 时建了占位行 | 比较 stub 的 kline 范围与 curated 行；如果是子集就 `DELETE FROM kline_daily WHERE stock_id = <stub>; DELETE FROM stocks WHERE id = <stub>;` |
| `symbol = "600519"` 一行，但 kline_daily 没数据 | 真未入库 | 跑 `lucrum-web/scripts/ingest-curated.sh`，curated-symbols.ts 列表里有的 56 只一遍过 |

**预防**：写 ingest 脚本之前先 grep `normalizeSymbol`/`kline-persister` 看 canonical 格式，别假设 `symbol` 列形态。`lucrum-web/scripts/curated-symbols.ts` 用人类可读的 `"600519.SH"`，但 `dbSymbol()` helper 在 INSERT 前把后缀剥掉。这是 ingest 与 read path 之间唯一的 contract。

**前端 round-trip 验证**: `/api/stocks/list` 返回的 `{symbol, exchange}` 应该是 `{"symbol":"600519","exchange":"SH"}`。如果 `symbol` 字段里出现 `.SH` 后缀，说明 stocks 表又漂移了。

---

## Path J: AI 策略生成 ≥ 30s（CoT 陷阱）

**现象**: `/api/strategy/generate` 冷调用 30-60s。用户感觉"卡死"。日志里 `latencyMs > 30000` 频繁。

**根因**: 调用方传了 `taskClass='analytic'`（→ deepseek-v4-pro），v4-pro 是 CoT 模型，对模板化代码生成会烧大量 reasoning_content。**模板填充式任务（VeighNa CtaTemplate / SQL / 配置文件）应该用 `routine`**，不是 analytic。

**实测对比（2026-05-01，同一 prompt）**:
| Class | Model | Latency | 输出 |
|-------|-------|---------|------|
| analytic | deepseek-v4-pro | 65s | 1.4K 字符（被 maxTokens=2000 截断）|
| routine | deepseek-chat → v4-flash | 25s | 6.4K 字符（完整）|

**修法**: 改一行 `chatComplete('analytic', ...)` → `chatComplete('routine', ...)`。详见 `llm-router` skill §1 / §4 / §4.x（如何选 task class）。

**判断准则**:
- 输出**长度有上限**且**结构固定**（≤ 5K 字符代码 / SQL / JSON）→ routine
- 需要**多步推理 + 散文解释 + 领域权衡**（投资分析 / 长文章 / 调研 + 决策） → analytic
- 显式 chain-of-thought 必要（数学证明 / 反事实推理） → reasoning

不知道选哪个，先 routine。analytic/reasoning 都是 CoT-heavy，错位了立刻表现为慢 + 截断。

---
