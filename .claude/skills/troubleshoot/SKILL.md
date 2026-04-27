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

**R6 K3s 是独立集群**：不在 R1 ArgoCD 的 ApplicationSet 里（`deploy/argocd/appset-services.yaml:47` 注释明确排除 lucrum）。R6 没有 ArgoCD，直接 `kubectl apply -f deploy/k8s/`。**禁止**把 lucrum 加回 R1 ApplicationSet 除非 R6 K3s 注册成多集群目的地。

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
 └─ 监控不刷新/无新点 ──────→ Path H: 定时调度器
```

---

## Path A: 页面不可达（白屏/挂起/ERR_CONNECTION）

### Step 1: Pod 状态

```bash
ssh root@100.98.57.55 "kubectl -n lucrum get pods -o wide -l app=lucrum-web"
```

| 现象 | 原因 | 修复 |
|------|------|------|
| No pods | Deployment 被删或 replicas=0 | `kubectl -n lucrum scale deploy/lucrum-web --replicas=1` |
| `ImagePullBackOff` | GHCR 拉不到镜像 | 见 deploy skill Step 6 |
| `CrashLoopBackOff` | 启动崩溃 | `kubectl -n lucrum logs <pod> --previous` 看 crash 原因 |
| `ContainerCreating` 超过 2min | pause 容器或镜像拉取问题 | `kubectl describe pod <pod>` 看 Events |
| `1/1 Running` 但页面不通 | **→ 进入 Step 2** | |

### Step 2: Pod 在哪个节点？

```bash
ssh root@100.98.57.55 "kubectl -n lucrum get pods -o wide -l app=lucrum-web"
# 看 NODE 列
```

| Pod 所在节点 | 能否访问？ | 原因 | 修复 |
|---|---|---|---|
| `cloud-ubuntu-1-16c32g` (master) | ✅ 应该可以 | Traefik 同节点 | 进 Step 3 |
| `cloud-ubuntu-3-2c2g` (worker) | ❌ 不通 | **跨节点 overlay 断裂** | `nodeSelector: kubernetes.io/hostname: cloud-ubuntu-1-16c32g` |
| `office-debian-2` (messaging) | ❌ 不通 | overlay 断 + 镜像拉取问题 | 改 nodeSelector 到 master |
| `cloud-ubuntu-2-4c8g` (database) | ❌ 不通 | overlay 断 | 改 nodeSelector 到 master |

**关键经验**: 当前集群 flannel/WireGuard overlay 网络在 master↔其他节点 之间断裂。**所有需要被 Traefik 路由到的服务都必须调度到 master 节点**。

修复命令：
```bash
# 方法 1: patch deployment 加 nodeSelector（立即生效，但 ArgoCD 会覆盖）
ssh root@100.98.57.55 "kubectl -n lucrum patch deployment lucrum-web -p '{\"spec\":{\"template\":{\"spec\":{\"nodeSelector\":{\"kubernetes.io/hostname\":\"cloud-ubuntu-1-16c32g\"}}}}}'"

# 方法 2: 改 git manifest（持久化，推荐）
# 编辑 deploy/k8s/web-deployment.yaml，在 spec.template.spec 加：
#   nodeSelector:
#     kubernetes.io/hostname: cloud-ubuntu-1-16c32g
```

### Step 3: 集群内连通性

```bash
# 从 master 直接访问 Pod IP
ssh root@100.98.57.55 "curl -s -o /dev/null -w 'HTTP %{http_code} in %{time_total}s' --max-time 10 http://<POD_IP>:3000/"

# 从 master 访问 ClusterIP
ssh root@100.98.57.55 "curl -s -o /dev/null -w 'HTTP %{http_code} in %{time_total}s' --max-time 10 http://10.43.225.213:3000/"
```

| 结果 | 原因 | 修复 |
|------|------|------|
| `HTTP 200 in 0.02s` | 连通正常，问题在 Traefik/Ingress | 检查 IngressRoute |
| `HTTP 000` 超时 | overlay 不通 | 改 nodeSelector 到 master |
| `Connection refused` | Pod 没在监听 3000 | 看 Pod 日志 |

### Step 4: Traefik IngressRoute

```bash
ssh root@100.98.57.55 "kubectl get ingressroute -n lucrum -o yaml | grep -A5 'match:'"
# 确保 Host(`lucrum.lurus.cn`) 正确
```

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
# 验证：从 Pod 内部访问 Zitadel OIDC discovery
ssh root@100.98.57.55 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=5 --no-check-certificate \
  https://auth.lurus.cn/.well-known/openid-configuration 2>&1 | head -1"
```

| 结果 | 原因 | 修复 |
|------|------|------|
| `can't connect (43.226.46.164): Connection refused` | **Hairpin NAT 不通** — Pod DNS 解析到公网 IP，但从 Pod 内部走公网回环被拒 | 加 `hostAliases` 指向 Traefik ClusterIP |
| `can't connect (10.43.x.x): Connection refused` | Traefik ClusterIP 不通 | 检查 NetworkPolicy egress 规则 |
| OIDC JSON 正常输出 | Pod 能访问，问题在别处 | 检查环境变量 |

**Hairpin NAT 修复（最常见）**:

```bash
# 1. 获取 Traefik ClusterIP
ssh root@100.98.57.55 "kubectl get svc -n kube-system traefik -o jsonpath='{.spec.clusterIP}'"
# 当前: 10.43.175.138

# 2. 检查 NetworkPolicy 是否允许 Pod 访问 kube-system
ssh root@100.98.57.55 "kubectl get networkpolicy -n lucrum -o yaml | grep -A3 'kube-system'"
# 如果没有，添加 egress 规则：
ssh root@100.98.57.55 'kubectl -n lucrum patch networkpolicy allow-dns-egress --type=json \
  -p '\''[{"op":"add","path":"/spec/egress/-","value":{"ports":[{"port":8443,"protocol":"TCP"},{"port":8000,"protocol":"TCP"}],"to":[{"namespaceSelector":{"matchLabels":{"kubernetes.io/metadata.name":"kube-system"}}}]}}]'\'''

# 3. 验证通过 Traefik ClusterIP 能访问
ssh root@100.98.57.55 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=5 --no-check-certificate \
  --header='Host: auth.lurus.cn' \
  https://10.43.175.138:443/.well-known/openid-configuration 2>&1 | head -1"

# 4. 在 deployment 加 hostAliases（让 auth.lurus.cn 走集群内部）
# deploy/k8s/web-deployment.yaml spec.template.spec:
#   hostAliases:
#     - ip: "10.43.175.138"
#       hostnames:
#         - "auth.lurus.cn"
```

**关键经验**: Traefik 在 Pod 内部监听 **8443**（不是 443），但 K8s Service 做了 443→8443 映射。`hostAliases` 指向 ClusterIP 即可，不需要改端口。

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
  wget -q -O- --timeout=5 http://localhost:3000/api/team 2>&1"
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

## hostAliases 清单

当前 lucrum-web deployment 需要的 hostAliases（因为 hairpin NAT 不通）:

```yaml
hostAliases:
  - ip: "10.43.175.138"  # Traefik ClusterIP (kube-system)
    hostnames:
      - "auth.lurus.cn"  # Zitadel OIDC
      # 如果未来还有其他 *.lurus.cn 服务需要从 Pod 内部访问，加到这里
```

**注意**: 如果 Traefik 被重建，ClusterIP 可能变化。验证命令：
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
  wget -q -O- --timeout=30 http://localhost:3000/api/cron/init"
# 等几分钟，再看 pack_run_performance.benchmark_return 是否填上
```

**优雅降级原则**：CSI300 缺失时，UI 显示 `—` 而非 `0` 或假值。这是**正确行为**，不是 bug。

---

## Path H: 监控数据停止刷新（无新点）

**现象**: 趋势 sparkline 几天没有新点；最新 pack_run 已成功但 `pack_run_performance.computed_at` 还停在更早时间。

```bash
# 1) 看 cron init 是否调用过（重启后必须 GET 一次）
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=10 http://localhost:3000/api/cron/init 2>&1 | grep -oE 'packRunPerformanceScheduler.{0,80}'"
# 期望: "packRunPerformanceScheduler":{"enabled":true,"schedule":"07:00 CST (Mon-Fri)",...}

# 2) 看进程内调度器的日志（singleton 启动时打 [Scheduler] 字样）
ssh root@100.122.83.20 "kubectl -n lucrum logs deploy/lucrum-web --tail=200 | grep -i 'scheduler\\|cron'"
```

| 现象 | 原因 | 修复 |
|------|------|------|
| `enabled:false` | `NODE_ENV != 'production'` | 检查 deployment env，确保 `NODE_ENV=production` |
| 日志无 Scheduler 痕迹 | Pod 启动后没人调过 `/api/cron/init` | `wget http://localhost:3000/api/cron/init` 主动触发；考虑加 readinessProbe 或 startup hook |
| 日志显示 cron tick 但没写 DB | computePackRunPerformance 报错 | grep `pack-run-performance` 错误日志 |
| 多个 replica 各跑一份 | singleton 是进程内的；副本数 > 1 时会重复跑（幂等 upsert 不影响正确性，浪费 CPU） | 改 cron 为单 leader 选举 / 改用 K8s CronJob |

**关键经验**: Next.js App Router 没有 server-startup hook，cron 必须靠**外部第一次调用** `/api/cron/init` 触发 singleton。生产建议在 deploy 脚本里加一行 `kubectl exec ... wget /api/cron/init` 收尾。

---
