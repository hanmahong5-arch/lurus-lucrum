# Lucrum K3s集群运维手册 | K3s Cluster Operations Guide

## 快速开始 | Quick Start

### 访问地址 | Access URLs

**主服务** | **Main Service**
- **URL**: https://lucrum.lurus.cn
- **用途**: Lucrum AI量化交易平台
- **协议**: HTTPS (自动跳转)

**API文档** | **API Documentation**
- **URL**: https://lucrum.lurus.cn/docs
- **用途**: FastAPI Swagger UI
- **协议**: HTTPS

**健康检查** | **Health Check**
```bash
# 前端健康检查
curl https://lucrum.lurus.cn/api/health

# 后端健康检查
curl https://lucrum.lurus.cn/api/health

# 预期返回: HTTP 200 OK
```

---

## 系统概览 | System Overview

### 核心组件 | Core Components

```
┌─────────────────────────────────────────────────────────┐
│             Lucrum量化交易平台架构                        │
│         Lucrum Quantitative Trading Platform             │
└─────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   Traefik    │
                    │   Ingress    │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼─────┐      ┌────▼─────┐      ┌────▼─────┐
   │Next.js   │      │FastAPI   │      │Redis     │
   │Frontend  │◄─────┤Backend   │◄─────┤Cache     │
   │          │      │          │      │(3 nodes) │
   │Port:3000 │      │Port:8000 │      │Port:6379 │
   └──────────┘      └─────┬────┘      └──────────┘
                           │
                    ┌──────▼───────┐
                    │ PostgreSQL   │
                    │   Database   │
                    └──────────────┘
```

### 技术栈 | Technology Stack

| 层级 | 技术 | 版本 | 用途 |
|-----|------|------|------|
| **运行时** | Bun | latest | JavaScript运行时 (10-20x faster than Node.js) |
| **前端框架** | Next.js | 14 | React SSR框架 (App Router) |
| **后端框架** | FastAPI | latest | Python异步Web框架 |
| **量化引擎** | VNPy | 4.x | 专业量化交易框架 |
| **缓存** | Redis | 7.2-alpine | 内存数据库 (主从架构) |
| **数据库** | PostgreSQL | latest | 关系型数据库 |
| **Ingress** | Traefik | v2 | 反向代理和负载均衡 |
| **容器** | K3s | latest | 轻量级Kubernetes |
| **证书管理** | cert-manager | latest | 自动化TLS证书 |

---

## 服务说明 | Service Description

### 1. ai-qtrd-web (前端服务)

**镜像**: `lucrum-web:v18`
**端口**: 3000
**节点**: cloud-ubuntu-3-2c2g (固定)
**资源**: CPU 100m-500m, Memory 256Mi-512Mi

**功能模块**:
- ✅ 策略编辑器 - 可视化编辑交易策略
- ✅ 回测系统 - 历史数据回测验证
- ✅ AI顾问 - 多Agent投资顾问系统
- ✅ 参数优化 - 策略参数调优工具
- ✅ 实时图表 - K线图表与技术指标

**前端处理的API路由**:
```
/api/strategy/generate   # AI策略生成
/api/auth/*              # 身份认证 (NextAuth.js)
/api/advisor/*           # AI投资顾问
/api/stocks/*            # 股票数据查询
```

**健康检查**:
```bash
curl https://lucrum.lurus.cn/api/health
# 返回: {"status":"ok","timestamp":"..."}
```

### 2. ai-qtrd-api (后端服务)

**镜像**: `lurus-ai-qtrd:v1.0.4`
**端口**: 8000
**节点**: cloud-ubuntu-2-4c8g (偏好)
**资源**: CPU 200m-1000m, Memory 512Mi-2Gi

**功能模块**:
- ✅ 回测引擎 - 基于VNPy的金融级回测
- ✅ 策略执行 - 沙箱化代码执行环境
- ✅ 数据代理 - 行情数据获取与缓存
- ✅ WebSocket - 实时数据推送
- ✅ API文档 - Swagger UI

**后端处理的API路由**:
```
/api/backtest/*          # 回测执行
/api/strategy/*          # 策略管理 (除generate外)
/api/data/*              # 市场数据
/ws/*                    # WebSocket推送
/docs                    # API文档
```

**API文档访问**:
```bash
# 浏览器访问
https://lucrum.lurus.cn/docs
```

### 3. Redis缓存集群

**镜像**: `redis:7.2-alpine`
**架构**: 1 Master + 2 Replicas
**端口**: 6379
**持久化**: RDB + AOF

**Redis节点**:
```
redis-0: Master节点 (读写)
  - DNS: redis-0.redis-headless.ai-qtrd.svc.cluster.local
  - 角色: 主节点，处理所有写入请求

redis-1: Replica节点 (只读)
  - DNS: redis-1.redis-headless.ai-qtrd.svc.cluster.local
  - 角色: 从节点，同步主节点数据

redis-2: Replica节点 (只读)
  - DNS: redis-2.redis-headless.ai-qtrd.svc.cluster.local
  - 角色: 从节点，同步主节点数据
```

**应用连接方式**:
```typescript
// 使用ClusterIP Service连接（推荐）
const redis = new Redis({
  host: "redis-service.ai-qtrd.svc.cluster.local",
  port: 6379,
  password: process.env.REDIS_PASSWORD,
});
```

**缓存策略**:
```
K线数据: TTL 1小时
回测结果: TTL 24小时
用户会话: TTL 3小时
实时行情: TTL 1分钟
```

---

## 常用操作 | Common Operations

### 查看服务状态 | Check Service Status

```bash
# 查看所有Pod状态
kubectl get pods -n ai-qtrd

# 预期输出:
# NAME                           READY   STATUS    RESTARTS   AGE
# ai-qtrd-api-xxxxx-xxxxx        1/1     Running   0          5d
# ai-qtrd-web-xxxxx-xxxxx        1/1     Running   0          5d
# redis-0                        1/1     Running   0          10d
# redis-1                        1/1     Running   0          10d
# redis-2                        1/1     Running   0          10d

# 查看Service
kubectl get svc -n ai-qtrd

# 查看Ingress路由
kubectl get ingressroute -n ai-qtrd
```

### 查看日志 | View Logs

```bash
# 前端日志
kubectl logs -f deployment/ai-qtrd-web -n ai-qtrd

# 后端日志
kubectl logs -f deployment/ai-qtrd-api -n ai-qtrd

# Redis主节点日志
kubectl logs -f redis-0 -n ai-qtrd

# 查看最近100行日志
kubectl logs --tail=100 deployment/ai-qtrd-api -n ai-qtrd

# 查看前一个崩溃Pod的日志
kubectl logs deployment/ai-qtrd-web -n ai-qtrd --previous
```

### 重启服务 | Restart Services

```bash
# 重启前端服务
kubectl rollout restart deployment/ai-qtrd-web -n ai-qtrd

# 重启后端服务
kubectl rollout restart deployment/ai-qtrd-api -n ai-qtrd

# 重启Redis (按顺序，先从节点后主节点)
kubectl delete pod redis-2 -n ai-qtrd && sleep 10
kubectl delete pod redis-1 -n ai-qtrd && sleep 10
kubectl delete pod redis-0 -n ai-qtrd

# 查看重启进度
kubectl get pods -n ai-qtrd -w
```

### 进入容器调试 | Debug in Container

```bash
# 进入前端容器
kubectl exec -it deployment/ai-qtrd-web -n ai-qtrd -- /bin/sh

# 进入后端容器
kubectl exec -it deployment/ai-qtrd-api -n ai-qtrd -- /bin/bash

# 进入Redis主节点
kubectl exec -it redis-0 -n ai-qtrd -- /bin/sh

# 执行单个命令
kubectl exec deployment/ai-qtrd-web -n ai-qtrd -- ls -la /app
kubectl exec redis-0 -n ai-qtrd -- redis-cli -a ${REDIS_PASSWORD} INFO
```

### 扩缩容 | Scale Services

```bash
# 扩容前端到3个副本（提升并发能力）
kubectl scale deployment/ai-qtrd-web -n ai-qtrd --replicas=3

# 扩容后端到2个副本（处理更多回测任务）
kubectl scale deployment/ai-qtrd-api -n ai-qtrd --replicas=2

# 缩容回1个副本（节省资源）
kubectl scale deployment/ai-qtrd-web -n ai-qtrd --replicas=1

# 查看扩容进度
kubectl get pods -n ai-qtrd -w
```

### 查看资源使用 | Resource Usage

```bash
# 查看节点资源
kubectl top nodes

# 查看Pod资源使用
kubectl top pods -n ai-qtrd

# 查看Pod详细信息
kubectl describe pod <pod-name> -n ai-qtrd

# 查看节点上的所有Pod
kubectl get pods -A -o wide --field-selector spec.nodeName=cloud-ubuntu-3-2c2g
```

---

## 部署与更新 | Deployment and Updates

### 构建新版本镜像 | Build New Image

```bash
# 步骤1: 进入项目目录
cd /path/to/lucrum-web

# 步骤2: 确保代码已提交
git status
git add .
git commit -m "feat: 新功能描述"

# 步骤3: 构建Docker镜像（使用--no-cache确保最新代码）
docker build --no-cache -t lucrum-web:v19 .

# 步骤4: 验证镜像
docker images | grep lucrum-web
```

### 分发镜像到集群节点 | Distribute Image

```bash
# 方法1: 使用tar包分发（推荐）

# 导出镜像
docker save lucrum-web:v19 -o /tmp/lucrum-web-v19.tar

# 启动临时HTTP服务器
cd /tmp
python3 -m http.server 8765 &
HTTP_PID=$!

# 获取主节点IP
MASTER_IP=$(hostname -I | awk '{print $1}')
echo "HTTP服务器: http://${MASTER_IP}:8765/lucrum-web-v19.tar"

# 在每个worker节点上执行
ssh root@<node-ip> "wget http://${MASTER_IP}:8765/lucrum-web-v19.tar -O /tmp/lucrum-web-v19.tar && \
                     ctr -n k8s.io images import /tmp/lucrum-web-v19.tar && \
                     rm /tmp/lucrum-web-v19.tar"

# 清理HTTP服务器
kill $HTTP_PID
rm /tmp/lucrum-web-v19.tar

# 方法2: 使用SCP直接传输
for NODE in 10.42.1.1 10.42.1.2 10.42.1.3; do
  scp /tmp/lucrum-web-v19.tar root@${NODE}:/tmp/
  ssh root@${NODE} "ctr -n k8s.io images import /tmp/lucrum-web-v19.tar && rm /tmp/lucrum-web-v19.tar"
done
```

### 更新Deployment | Update Deployment

```bash
# 步骤1: 更新镜像版本
kubectl set image deployment/ai-qtrd-web -n ai-qtrd \
  web=lucrum-web:v19

# 步骤2: 监控滚动更新进度
kubectl rollout status deployment/ai-qtrd-web -n ai-qtrd

# 预期输出:
# Waiting for deployment "ai-qtrd-web" rollout to finish: 1 old replicas are pending termination...
# deployment "ai-qtrd-web" successfully rolled out

# 步骤3: 验证新版本
kubectl get pods -n ai-qtrd
kubectl describe pod <new-pod-name> -n ai-qtrd | grep Image

# 步骤4: 测试服务
curl -I https://lucrum.lurus.cn
curl https://lucrum.lurus.cn/api/health
```

### 回滚版本 | Rollback

```bash
# 查看历史版本
kubectl rollout history deployment/ai-qtrd-web -n ai-qtrd

# 回滚到上一个版本
kubectl rollout undo deployment/ai-qtrd-web -n ai-qtrd

# 回滚到指定版本
kubectl rollout undo deployment/ai-qtrd-web -n ai-qtrd --to-revision=3

# 验证回滚
kubectl get pods -n ai-qtrd
curl https://lucrum.lurus.cn/api/health
```

### 更新配置 | Update Configuration

```bash
# 步骤1: 编辑ConfigMap或Secret
vim lurus-ai-qtrd/k8s/ai-qtrd/02-configmap.yaml

# 步骤2: 应用更新
kubectl apply -f lurus-ai-qtrd/k8s/ai-qtrd/02-configmap.yaml

# 步骤3: 重启服务使配置生效
kubectl rollout restart deployment/ai-qtrd-api -n ai-qtrd

# 查看新配置
kubectl get configmap ai-qtrd-config -n ai-qtrd -o yaml
```

---

## 故障排查 | Troubleshooting

### 问题1: 服务无法访问 (502/503)

**症状**: 浏览器访问 https://lucrum.lurus.cn 返回502或503错误

**排查步骤**:

```bash
# 1. 检查Pod状态
kubectl get pods -n ai-qtrd
# 确保所有Pod都是 Running 且 READY=1/1

# 2. 查看Pod日志
kubectl logs deployment/ai-qtrd-web -n ai-qtrd --tail=50
kubectl logs deployment/ai-qtrd-api -n ai-qtrd --tail=50

# 3. 检查Service和Endpoints
kubectl get svc -n ai-qtrd
kubectl get endpoints -n ai-qtrd
# 确保Endpoints不为空

# 4. 测试内部访问
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://ai-qtrd-web.ai-qtrd.svc.cluster.local:3000/api/health

# 5. 检查Traefik日志
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=100
```

**常见原因**:
- Pod未启动或健康检查失败
- Service Selector配置错误
- IngressRoute路由规则错误
- TLS证书未就绪

### 问题2: Pod反复重启 (CrashLoopBackOff)

**症状**: Pod状态显示 `CrashLoopBackOff` 或 `Error`

**排查步骤**:

```bash
# 1. 查看Pod详情
kubectl describe pod <pod-name> -n ai-qtrd

# 2. 查看容器日志
kubectl logs <pod-name> -n ai-qtrd
kubectl logs <pod-name> -n ai-qtrd --previous  # 崩溃前的日志

# 3. 检查镜像是否存在
ssh <node-ip>
ctr -n k8s.io images ls | grep lucrum-web

# 4. 检查资源限制
kubectl top pods -n ai-qtrd
kubectl describe node <node-name> | grep -A 5 "Allocated resources"

# 5. 查看Event事件
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp' | grep <pod-name>
```

**常见原因**:
- 应用启动失败（代码错误）
- 健康检查配置不当（`initialDelaySeconds`太短）
- 资源不足（OOMKilled）
- 依赖服务不可用（Redis/数据库连接失败）

### 问题3: Redis连接失败

**症状**: 应用日志显示 `ECONNREFUSED redis-service:6379`

**排查步骤**:

```bash
# 1. 检查Redis Pod状态
kubectl get pods -n ai-qtrd -l app=redis

# 2. 测试Redis连接
kubectl exec redis-0 -n ai-qtrd -- redis-cli -a ${REDIS_PASSWORD} ping
# 预期输出: PONG

# 3. 检查主从状态
kubectl exec redis-0 -n ai-qtrd -- redis-cli -a ${REDIS_PASSWORD} info replication

# 4. 检查Service
kubectl get svc redis-service -n ai-qtrd
kubectl get endpoints redis-service -n ai-qtrd

# 5. 从应用Pod测试连接
kubectl exec deployment/ai-qtrd-web -n ai-qtrd -- /bin/sh -c "nc -zv redis-service 6379"

# 6. 检查密码
kubectl get secret ai-qtrd-secrets -n ai-qtrd -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d
```

**常见原因**:
- Redis Pod未启动
- 密码错误
- Service DNS解析失败
- Redis主节点故障

### 问题4: 回测任务执行失败

**症状**: 前端提交回测后一直加载或返回错误

**排查步骤**:

```bash
# 1. 检查后端日志
kubectl logs deployment/ai-qtrd-api -n ai-qtrd --tail=200 | grep -i "backtest\|error"

# 2. 检查后端资源使用
kubectl top pod -n ai-qtrd -l app.kubernetes.io/component=api

# 3. 测试后端API
curl -X POST https://lucrum.lurus.cn/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{"strategy":"test","symbol":"600519",...}'

# 4. 检查数据库连接
kubectl exec deployment/ai-qtrd-api -n ai-qtrd -- python3 -c \
  "import psycopg2; psycopg2.connect('postgresql://...'); print('OK')"

# 5. 查看Traefik路由
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik | grep "/api/backtest"
```

**常见原因**:
- 后端资源不足（CPU/内存达到上限）
- 数据库连接超时
- 请求路由到前端而非后端
- AI API调用失败

### 问题5: 镜像更新后Pod未使用新版本

**症状**: 更新镜像后Pod仍使用旧版本

**排查步骤**:

```bash
# 1. 查看Pod使用的镜像
kubectl get pod <pod-name> -n ai-qtrd -o jsonpath='{.spec.containers[0].image}'

# 2. 检查节点上的镜像
ssh <node-ip>
ctr -n k8s.io images ls | grep lucrum-web

# 3. 强制删除Pod重建
kubectl delete pod <pod-name> -n ai-qtrd

# 4. 检查Deployment的镜像配置
kubectl get deployment ai-qtrd-web -n ai-qtrd -o yaml | grep image

# 5. 触发滚动更新
kubectl rollout restart deployment/ai-qtrd-web -n ai-qtrd
```

**常见原因**:
- `imagePullPolicy: Never` 时节点上无新镜像
- Deployment配置未更新
- Pod缓存了旧版本

---

## 维护任务 | Maintenance Tasks

### 每日检查 | Daily Checks

```bash
# 1. 检查所有服务状态
kubectl get pods -n ai-qtrd
kubectl get nodes

# 2. 检查资源使用
kubectl top nodes
kubectl top pods -n ai-qtrd

# 3. 检查最近的事件
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp' | tail -20

# 4. 检查服务可用性
curl -I https://lucrum.lurus.cn
```

### 每周检查 | Weekly Checks

```bash
# 1. 查看Pod重启次数
kubectl get pods -n ai-qtrd -o custom-columns=NAME:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount

# 2. 检查磁盘使用
kubectl exec redis-0 -n ai-qtrd -- df -h /data

# 3. 查看Redis内存使用
kubectl exec redis-0 -n ai-qtrd -- redis-cli -a ${REDIS_PASSWORD} info memory

# 4. 检查TLS证书有效期
kubectl get certificate -n ai-qtrd
kubectl describe certificate lucrum-lurus-cn-tls -n ai-qtrd
```

### 每月任务 | Monthly Tasks

```bash
# 1. 备份配置
mkdir -p ~/k8s-backup-$(date +%Y%m)
kubectl get all -n ai-qtrd -o yaml > ~/k8s-backup-$(date +%Y%m)/all-resources.yaml
kubectl get configmap,secret -n ai-qtrd -o yaml > ~/k8s-backup-$(date +%Y%m)/configs.yaml

# 2. 备份Redis数据
kubectl exec redis-0 -n ai-qtrd -- redis-cli -a ${REDIS_PASSWORD} BGSAVE
sleep 10
kubectl cp ai-qtrd/redis-0:/data/dump.rdb ~/redis-backup-$(date +%Y%m).rdb

# 3. 清理旧镜像
for NODE in <node-ips>; do
  ssh root@${NODE} "ctr -n k8s.io images ls | grep '<none>' | awk '{print \$1}' | xargs -r ctr -n k8s.io images rm"
done

# 4. 查看日志大小
kubectl exec deployment/ai-qtrd-web -n ai-qtrd -- du -sh /var/log
kubectl exec deployment/ai-qtrd-api -n ai-qtrd -- du -sh /var/log
```

---

## 监控与告警 | Monitoring and Alerting

### 实时监控 | Real-time Monitoring

```bash
# 持续监控Pod状态
watch kubectl get pods -n ai-qtrd

# 持续监控资源使用
watch kubectl top pods -n ai-qtrd

# 持续监控事件
kubectl get events -n ai-qtrd -w

# 实时查看日志
kubectl logs -f deployment/ai-qtrd-web -n ai-qtrd
```

### 关键指标 | Key Metrics

**服务可用性**:
```bash
# 每分钟检查一次
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://lucrum.lurus.cn/api/health)
  echo "$(date) - Status: $STATUS"
  sleep 60
done
```

**Redis性能**:
```bash
kubectl exec redis-0 -n ai-qtrd -- redis-cli -a ${REDIS_PASSWORD} INFO stats | grep -E "instantaneous|hits|misses"
```

**数据库连接数**:
```bash
# 在数据库服务器上执行
psql -U postgres -d lucrum -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## 安全最佳实践 | Security Best Practices

### 1. 定期更新密码

```bash
# 更新Redis密码
NEW_REDIS_PWD=$(openssl rand -base64 32)
kubectl patch secret ai-qtrd-secrets -n ai-qtrd \
  -p "{\"data\":{\"REDIS_PASSWORD\":\"$(echo -n $NEW_REDIS_PWD | base64)\"}}"

# 重启所有使用Redis的服务
kubectl rollout restart deployment/ai-qtrd-web -n ai-qtrd
kubectl rollout restart deployment/ai-qtrd-api -n ai-qtrd
kubectl rollout restart statefulset/redis -n ai-qtrd
```

### 2. 限制访问权限

```bash
# 确保只有特定IP可以访问K3s API
# 在防火墙或Tailscale中配置ACL规则

# 限制kubectl访问
# 为不同用户创建不同的ServiceAccount和Role
```

### 3. 定期审计

```bash
# 查看最近的API调用
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp'

# 查看Pod的资源访问
kubectl auth can-i --list --namespace=ai-qtrd
```

### 4. 备份恢复测试

```bash
# 每季度进行一次完整恢复演练
# 1. 备份当前配置
# 2. 删除所有资源
# 3. 从备份恢复
# 4. 验证服务正常
```

---

## 联系方式 | Contact

**技术支持** | **Technical Support**
- 邮箱: support@lurus.cn
- 企业微信: Lucrum运维群

**紧急联系** | **Emergency Contact**
- 24/7热线: [待补充]
- On-call工程师: [待补充]

**文档更新** | **Documentation Updates**
- 最后更新: 2026-01-22
- 维护者: Lucrum DevOps Team
- 版本: v1.0

---

## 附录: 快速命令参考 | Quick Command Reference

### 常用kubectl命令

```bash
# 查看资源
kubectl get pods/svc/deploy -n ai-qtrd
kubectl describe pod <name> -n ai-qtrd
kubectl logs -f <pod-name> -n ai-qtrd

# 操作Pod
kubectl exec -it <pod-name> -n ai-qtrd -- /bin/sh
kubectl delete pod <pod-name> -n ai-qtrd
kubectl rollout restart deployment/<name> -n ai-qtrd

# 扩缩容
kubectl scale deployment/<name> -n ai-qtrd --replicas=3

# 更新镜像
kubectl set image deployment/<name> -n ai-qtrd <container>=<image>:<tag>

# 查看事件
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp'

# 查看资源使用
kubectl top nodes
kubectl top pods -n ai-qtrd
```

### 常用镜像操作

```bash
# 查看镜像
ctr -n k8s.io images ls

# 导入镜像
ctr -n k8s.io images import <image.tar>

# 删除镜像
ctr -n k8s.io images rm <image>:<tag>
```

### 常用Redis命令

```bash
# 连接Redis
kubectl exec -it redis-0 -n ai-qtrd -- redis-cli -a ${REDIS_PASSWORD}

# 查看信息
INFO
INFO replication
INFO memory
INFO stats

# 查看Key
KEYS *
SCAN 0 MATCH gw:* COUNT 100

# 清空缓存
FLUSHALL

# 保存快照
BGSAVE
```

---

**祝您运维顺利！| Happy Operating!**
