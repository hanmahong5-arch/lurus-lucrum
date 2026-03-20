# Lucrum K3s集群架构文档 | K3s Cluster Architecture

## 1. 概览 | Overview

### 1.1 集群基本信息 | Cluster Information

**集群类型**: K3s (Lightweight Kubernetes)
**主域名**: lucrum.lurus.cn
**网络方案**: Tailscale VPN + K3s 内部网络
**Ingress控制器**: Traefik v2 (使用IngressRoute CRD)
**证书管理**: cert-manager + Let's Encrypt

### 1.2 业务系统 | Business System

**系统名称**: Lucrum (股神) - AI量化交易平台
**核心功能**:
- AI策略生成与回测
- 多Agent投资顾问系统
- 实时行情监控
- 策略参数优化

---

## 2. 集群拓扑 | Cluster Topology

### 2.1 节点分布 | Node Distribution

```
K3s集群节点架构图
┌─────────────────────────────────────────────────────────┐
│                    Master Node                          │
│                 (Control Plane)                         │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌──────▼───────┐  ┌──────▼───────┐
│ Worker Node 1│  │Worker Node 2 │  │Worker Node 3 │
│              │  │              │  │              │
│ 16C / 32GB   │  │  4C / 8GB    │  │  2C / 4GB    │
│              │  │              │  │              │
│ PostgreSQL   │  │ FastAPI      │  │ Next.js      │
│ Redis Master │  │ Backend      │  │ Frontend     │
│ (redis-0)    │  │              │  │              │
│              │  │              │  │              │
│ Redis Slave  │  │              │  │              │
│ (redis-1)    │  │              │  │              │
│              │  │              │  │              │
│ Redis Slave  │  │              │  │              │
│ (redis-2)    │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
cloud-ubuntu-1    cloud-ubuntu-2    cloud-ubuntu-3
   -16c32g           -4c8g             -2c2g
```

**节点详细信息**:

| 节点名称 | 规格 | 主要负载 | 资源分配策略 |
|---------|------|---------|------------|
| cloud-ubuntu-1-16c32g | 16C/32GB | PostgreSQL数据库<br>Redis主从集群 | 数据密集型服务 |
| cloud-ubuntu-2-4c8g | 4C/8GB | FastAPI后端服务 | CPU密集型计算 |
| cloud-ubuntu-3-2c2g | 2C/4GB | Next.js前端服务 | 轻量级Web服务 |

### 2.2 命名空间划分 | Namespace Organization

```
Kubernetes Namespaces
├── ai-qtrd               # Lucrum业务主命名空间
│   ├── Deployments
│   │   ├── ai-qtrd-api   (FastAPI Backend)
│   │   └── ai-qtrd-web   (Next.js Frontend)
│   ├── StatefulSets
│   │   └── redis         (3 replicas: master + 2 slaves)
│   ├── Services
│   │   ├── ai-qtrd-api   (ClusterIP:8000)
│   │   ├── ai-qtrd-web   (ClusterIP:3000)
│   │   ├── redis-service (ClusterIP:6379)
│   │   └── redis-headless (Headless for StatefulSet DNS)
│   └── ConfigMaps & Secrets
│       ├── ai-qtrd-secrets
│       ├── ai-qtrd-config
│       └── redis-config
├── cert-manager          # 证书管理
├── kube-system           # 系统组件
└── traefik               # Ingress控制器
```

---

## 3. 服务架构 | Service Architecture

### 3.1 前端服务 | Frontend Service

**组件名称**: ai-qtrd-web
**技术栈**: Next.js 14 + Bun Runtime
**镜像版本**: `lucrum-web:v18` (当前生产版本)
**容器配置**:
```yaml
Resources:
  Requests: CPU 100m, Memory 256Mi
  Limits:   CPU 500m, Memory 512Mi

Ports:
  - containerPort: 3000 (HTTP)

Environment Variables:
  - REDIS_HOST: redis-service.ai-qtrd.svc.cluster.local
  - REDIS_PORT: 6379
  - REDIS_PASSWORD: <from secret>
  - REDIS_DB: 0
  - REDIS_ENABLED: true

Node Selector:
  kubernetes.io/hostname: cloud-ubuntu-3-2c2g (固定节点)

Image Pull Policy: Never (本地镜像)

Health Checks:
  Liveness Probe:  HTTP GET /api/health (delay 30s, period 10s)
  Readiness Probe: HTTP GET /api/health (delay 10s, period 5s)
```

**核心功能**:
- 策略编辑器UI
- 回测结果可视化
- AI顾问聊天界面
- 参数优化工具
- 实时K线图表

**API路由归属**:
- `/api/strategy/generate` - 策略生成（前端处理）
- `/api/auth/*` - 身份认证（NextAuth.js）
- `/api/advisor/*` - AI顾问（前端AI逻辑）
- `/api/stocks/*` - 股票数据查询（前端数据库查询）

### 3.2 后端服务 | Backend Service

**组件名称**: ai-qtrd-api
**技术栈**: FastAPI + VNPy 4.x
**镜像版本**: `lurus-ai-qtrd:v1.0.4`
**容器配置**:
```yaml
Resources:
  Requests: CPU 200m, Memory 512Mi
  Limits:   CPU 1000m, Memory 2Gi

Ports:
  - containerPort: 8000 (HTTP)

Environment Variables:
  - WEB_HOST: 0.0.0.0
  - WEB_PORT: 8000
  - DEEPSEEK_API_BASE: https://api.lurus.cn/v1
  - DEEPSEEK_MODEL: deepseek-chat
  - DEEPSEEK_API_KEY: <from secret>
  - DATABASE_PASSWORD: <from secret>
  - REDIS_PASSWORD: <from secret>
  - CORS_ORIGINS: ["https://lucrum.lurus.cn"]

Node Affinity:
  Prefers: cloud-ubuntu-2-4c8g (8GB节点，适合计算密集型任务)

Image Pull Policy: Never

Health Checks:
  Liveness Probe:  HTTP GET /health (delay 30s, period 10s)
  Readiness Probe: HTTP GET /health (delay 10s, period 5s)
```

**核心功能**:
- 回测引擎执行
- 策略代码执行沙箱
- 实盘交易接口（预留）
- 行情数据代理

**API路由归属**:
- `/api/backtest/run` - 回测执行
- `/api/strategy/*` (除了 `/api/strategy/generate`) - 策略管理
- `/api/data/*` - 市场数据代理
- `/ws/*` - WebSocket实时推送
- `/docs` - API文档（Swagger UI）

### 3.3 Redis缓存服务 | Redis Cache Service

**组件类型**: StatefulSet (有状态服务)
**镜像版本**: `redis:7.2-alpine`
**副本数量**: 3 (1 master + 2 replicas)

**主从架构**:
```yaml
Master:
  Pod Name: redis-0
  Role: Read/Write
  Command: redis-server --requirepass ${REDIS_PASSWORD}

Replicas:
  Pod Name: redis-1, redis-2
  Role: Read-only
  Command: redis-server --requirepass ${REDIS_PASSWORD} \
           --masterauth ${REDIS_PASSWORD} \
           --replicaof redis-0.redis-headless.ai-qtrd.svc.cluster.local 6379
```

**持久化配置**:
```
RDB快照:
  - save 900 1     (900秒内至少1次修改)
  - save 300 10    (300秒内至少10次修改)
  - save 60 10000  (60秒内至少10000次修改)

AOF持久化:
  - appendonly yes
  - appendfsync everysec (每秒刷盘)

内存管理:
  - maxmemory 1536mb
  - maxmemory-policy allkeys-lru (LRU淘汰策略)
```

**存储**:
```yaml
Volume Claim Template:
  Storage Class: local-path
  Size: 10Gi per pod
  Access Mode: ReadWriteOnce

Mount Path: /data (持久化数据目录)
```

**Service暴露**:
```yaml
# Headless Service (用于StatefulSet DNS解析)
redis-headless.ai-qtrd.svc.cluster.local
  - redis-0.redis-headless.ai-qtrd.svc.cluster.local (Master)
  - redis-1.redis-headless.ai-qtrd.svc.cluster.local (Replica)
  - redis-2.redis-headless.ai-qtrd.svc.cluster.local (Replica)

# Client Service (应用连接入口)
redis-service.ai-qtrd.svc.cluster.local:6379
  Session Affinity: ClientIP (保持会话亲和性)
  Timeout: 10800s (3小时)
```

**缓存用途**:
- K线数据缓存 (1小时TTL)
- 回测结果缓存 (避免重复计算)
- 用户会话状态
- 实时行情快照

---

## 4. 网关与路由 | Gateway and Routing

### 4.1 Traefik Ingress架构 | Traefik Architecture

**核心组件**:
- **IngressRoute**: Traefik的CRD资源，比原生Ingress更灵活
- **Middleware**: 中间件（如HTTPS重定向、CORS、限流）
- **TLS Certificate**: 自动化证书管理

**配置文件**: `lurus-ai-qtrd/k8s/ai-qtrd/06-ingress-routes.yaml` (189行)

### 4.2 智能路由规则 | Intelligent Routing Rules

Traefik根据请求路径将流量分发到前端或后端服务：

```yaml
# 路由规则优先级顺序 (数字越大优先级越高)

# 规则1: 前端UI路由 (优先级: 10)
Match: Host(`lucrum.lurus.cn`) &&
       !PathPrefix(`/api`) &&
       !PathPrefix(`/ws`) &&
       !PathPrefix(`/docs`)
Target: ai-qtrd-web:3000
Purpose: 所有非API请求由Next.js处理（页面、静态资源）

# 规则2: 前端API路由 (优先级: 30)
Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/api/strategy/generate`)
Target: ai-qtrd-web:3000
Purpose: 策略生成API由前端处理（调用AI服务）

Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/api/auth`)
Target: ai-qtrd-web:3000
Purpose: 身份认证由NextAuth.js处理

Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/api/advisor`)
Target: ai-qtrd-web:3000
Purpose: AI顾问逻辑在前端实现

Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/api/stocks`)
Target: ai-qtrd-web:3000
Purpose: 股票数据查询由前端数据库查询

# 规则3: 后端API路由 (优先级: 20)
Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/api/strategy`) &&
       !PathPrefix(`/api/strategy/generate`)
Target: ai-qtrd-api:8000
Purpose: 策略管理API由后端处理

Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/api/backtest`)
Target: ai-qtrd-api:8000
Purpose: 回测执行由后端VNPy引擎处理

Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/api/data`)
Target: ai-qtrd-api:8000
Purpose: 行情数据代理

Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/api`) && !PathPrefix(`/api/strategy/generate`)
Target: ai-qtrd-api:8000
Purpose: 其他所有/api/*请求默认由后端处理

# 规则4: WebSocket路由 (优先级: 40)
Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/ws`)
Target: ai-qtrd-api:8000
Purpose: WebSocket实时推送

# 规则5: API文档路由 (优先级: 50)
Match: Host(`lucrum.lurus.cn`) && PathPrefix(`/docs`)
Target: ai-qtrd-api:8000
Purpose: Swagger UI文档界面
```

**路由决策流程图**:
```
Request: https://lucrum.lurus.cn/xxx
           │
           ▼
    ┌──────────────┐
    │ Traefik      │
    │ IngressRoute │
    └──────┬───────┘
           │
    ┌──────▼───────────────────────────────┐
    │ 检查路径 (按优先级匹配)               │
    └──────┬───────────────────────────────┘
           │
    ┌──────▼──────┐
    │ /docs ?     ├─YES─► Backend:8000 (API Docs)
    └──────┬──────┘
           NO
           │
    ┌──────▼──────┐
    │ /ws/* ?     ├─YES─► Backend:8000 (WebSocket)
    └──────┬──────┘
           NO
           │
    ┌──────▼─────────────────────┐
    │ /api/strategy/generate ?   ├─YES─► Frontend:3000
    └──────┬─────────────────────┘
           NO
           │
    ┌──────▼──────────┐
    │ /api/auth/* ?   ├─YES─► Frontend:3000 (NextAuth)
    └──────┬──────────┘
           NO
           │
    ┌──────▼──────────┐
    │ /api/advisor/* ?├─YES─► Frontend:3000 (AI Logic)
    └──────┬──────────┘
           NO
           │
    ┌──────▼──────────┐
    │ /api/stocks/* ? ├─YES─► Frontend:3000 (DB Query)
    └──────┬──────────┘
           NO
           │
    ┌──────▼──────────┐
    │ /api/* ?        ├─YES─► Backend:8000 (Default API)
    └──────┬──────────┘
           NO
           │
    ┌──────▼──────┐
    │ 其他所有请求  ├────► Frontend:3000 (UI & Static)
    └──────────────┘
```

### 4.3 HTTPS与证书管理 | HTTPS and Certificate Management

**证书类型**: Let's Encrypt 免费证书
**自动续期**: cert-manager自动管理
**配置文件**: `lurus-ai-qtrd/k8s/ai-qtrd/07-certificate.yaml`

```yaml
Certificate Specification:
  Domain: lucrum.lurus.cn
  Issuer: letsencrypt-prod (ClusterIssuer)
  Secret Name: lucrum-lurus-cn-tls

  ACME Challenge: HTTP-01
  Renewal: 30天前自动续期
  Validity: 90天
```

**HTTP到HTTPS重定向**:
```yaml
Middleware: redirect-https
  Scheme: https
  Permanent: true (301重定向)
```

**TLS配置**:
```yaml
TLS Termination: 在Traefik层终止
Cipher Suites: 默认安全套件
Protocol Versions: TLS 1.2+
```

---

## 5. 数据持久化 | Data Persistence

### 5.1 存储策略 | Storage Strategy

**存储类型**: local-path (本地路径存储)
**提供者**: K3s默认的local-path-provisioner

**持久化组件**:

```yaml
Redis StatefulSet:
  Volume Claim Template:
    Storage Class: local-path
    Size: 10Gi per pod
    Access Mode: ReadWriteOnce
  Mount Path: /data
  Data:
    - RDB快照文件 (dump.rdb)
    - AOF日志文件 (appendonly.aof)

PostgreSQL (外部):
  由独立的PostgreSQL服务提供
  连接方式: DATABASE_URL环境变量
  备份策略: 定期pg_dump备份
```

### 5.2 数据备份与恢复 | Backup and Recovery

**Redis数据备份**:
```bash
# 手动触发RDB快照
kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} BGSAVE

# 复制快照文件到本地
kubectl cp ai-qtrd/redis-0:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

**Redis数据恢复**:
```bash
# 复制备份文件到Pod
kubectl cp ./redis-backup.rdb ai-qtrd/redis-0:/data/dump.rdb

# 重启Redis加载数据
kubectl rollout restart statefulset/redis -n ai-qtrd
```

**PostgreSQL备份** (外部服务):
```bash
# 数据库备份
pg_dump -h <db-host> -U postgres -d lucrum > backup.sql

# 数据库恢复
psql -h <db-host> -U postgres -d lucrum < backup.sql
```

---

## 6. 服务发现与内部通信 | Service Discovery

### 6.1 Kubernetes DNS | Internal DNS

K3s自动为每个Service创建DNS记录：

```
服务内DNS解析规则:
<service-name>.<namespace>.svc.cluster.local

实际DNS记录:
- ai-qtrd-api.ai-qtrd.svc.cluster.local:8000
- ai-qtrd-web.ai-qtrd.svc.cluster.local:3000
- redis-service.ai-qtrd.svc.cluster.local:6379
- redis-0.redis-headless.ai-qtrd.svc.cluster.local:6379
- redis-1.redis-headless.ai-qtrd.svc.cluster.local:6379
- redis-2.redis-headless.ai-qtrd.svc.cluster.local:6379
```

**简化访问**:
```
同命名空间内可以省略后缀:
- ai-qtrd-api:8000
- ai-qtrd-web:3000
- redis-service:6379
```

### 6.2 服务间通信示例 | Inter-Service Communication

**前端 → Redis**:
```typescript
// lucrum-web/src/lib/redis/client.ts
const redis = new Redis({
  host: "redis-service.ai-qtrd.svc.cluster.local", // 或简化为 "redis-service"
  port: 6379,
  password: process.env.REDIS_PASSWORD,
});
```

**前端 → 后端** (通过Ingress):
```typescript
// 前端调用后端API时使用外部域名（经过Traefik路由）
const response = await fetch("https://lucrum.lurus.cn/api/backtest/run", {
  method: "POST",
  body: JSON.stringify(backtestParams),
});
```

**后端 → Redis**:
```python
# lurus-ai-qtrd backend
import redis
r = redis.Redis(
    host="redis-service",  # 同命名空间简化形式
    port=6379,
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True
)
```

---

## 7. 镜像管理 | Image Management

### 7.1 镜像构建与导入 | Image Build and Import

**策略**: `imagePullPolicy: Never` (不从远程拉取，使用本地镜像)

**原因**:
- 内部私有部署，无镜像仓库
- 避免外网依赖
- 加速部署速度

**镜像版本**:
```
当前生产版本:
- lucrum-web:v18        (Next.js Frontend)
- lurus-ai-qtrd:v1.0.4  (FastAPI Backend)
- redis:7.2-alpine      (官方Redis镜像)
```

### 7.2 跨节点镜像分发 | Cross-Node Image Distribution

**挑战**: K3s集群中每个节点独立维护本地镜像，需手动分发

**解决方案** (已实施):
```bash
# 步骤1: 在构建节点导出镜像
docker save lucrum-web:v18 -o lucrum-web-v18.tar

# 步骤2: 启动临时HTTP服务器
cd /tmp
python3 -m http.server 8765 &
# URL: http://<node-ip>:8765/lucrum-web-v18.tar

# 步骤3: 其他节点下载并导入
ssh user@<target-node>
wget http://<source-node-ip>:8765/lucrum-web-v18.tar
ctr -n k8s.io images import lucrum-web-v18.tar

# 步骤4: 验证
ctr -n k8s.io images ls | grep lucrum-web
```

**自动化脚本** (示例):
```bash
#!/bin/bash
# distribute-image.sh

IMAGE_NAME="lucrum-web"
IMAGE_TAG="v18"
TAR_FILE="${IMAGE_NAME}-${IMAGE_TAG}.tar"

# 所有worker节点IP
NODES=("10.42.1.1" "10.42.1.2" "10.42.1.3")

# 导出镜像
echo "导出镜像..."
docker save ${IMAGE_NAME}:${IMAGE_TAG} -o /tmp/${TAR_FILE}

# 启动HTTP服务器
echo "启动HTTP服务器..."
cd /tmp
python3 -m http.server 8765 &
HTTP_PID=$!
sleep 2

# 分发到所有节点
MASTER_IP=$(hostname -I | awk '{print $1}')
for NODE in "${NODES[@]}"; do
  echo "分发镜像到节点 ${NODE}..."
  ssh root@${NODE} "wget -q http://${MASTER_IP}:8765/${TAR_FILE} -O /tmp/${TAR_FILE} && \
                     ctr -n k8s.io images import /tmp/${TAR_FILE} && \
                     rm /tmp/${TAR_FILE}"
done

# 清理
kill $HTTP_PID
rm /tmp/${TAR_FILE}

echo "镜像分发完成！"
```

---

## 8. 资源管理与调度 | Resource Management

### 8.1 资源配额 | Resource Quotas

**前端服务**:
```yaml
ai-qtrd-web:
  Requests: CPU 100m,  Memory 256Mi  (最低保证)
  Limits:   CPU 500m,  Memory 512Mi  (上限)

  典型使用率:
    - CPU: 50-150m (空闲-正常)
    - Memory: 200-400Mi
```

**后端服务**:
```yaml
ai-qtrd-api:
  Requests: CPU 200m,  Memory 512Mi
  Limits:   CPU 1000m, Memory 2Gi

  典型使用率:
    - CPU: 100-500m (空闲-回测中)
    - Memory: 600Mi-1.5Gi

  峰值场景:
    - 多股票回测: CPU 800-1000m, Memory 1.8-2Gi
```

**Redis服务**:
```yaml
redis (per pod):
  Requests: CPU 100m,  Memory 256Mi
  Limits:   CPU 500m,  Memory 2Gi

  配置限制:
    - maxmemory 1536mb (Redis配置)
    - 实际使用: 100-800Mi (根据缓存数据量)
```

### 8.2 节点亲和性与反亲和性 | Node Affinity

**前端固定节点**:
```yaml
ai-qtrd-web:
  nodeSelector:
    kubernetes.io/hostname: cloud-ubuntu-3-2c2g

  原因: 轻量级服务，固定在小规格节点
```

**后端偏好节点**:
```yaml
ai-qtrd-api:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
          - key: kubernetes.io/hostname
            operator: In
            values:
            - cloud-ubuntu-2-4c8g

  原因: 计算密集型，偏好中等规格节点
```

**Redis分散调度**:
```yaml
redis StatefulSet:
  无特殊亲和性配置

  实际分布: 由K3s调度器自动分配
    - redis-0: cloud-ubuntu-1-16c32g
    - redis-1: cloud-ubuntu-1-16c32g
    - redis-2: cloud-ubuntu-1-16c32g
```

### 8.3 自动扩缩容 | Auto Scaling

**当前状态**: 所有服务为固定副本数（无HPA）

**未来优化**:
```yaml
# Horizontal Pod Autoscaler (HPA) 示例
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-qtrd-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-qtrd-api
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # CPU超过70%时扩容
```

---

## 9. 高可用性设计 | High Availability Design

### 9.1 组件可用性分析 | Component Availability

| 组件 | 副本数 | 可用性级别 | 故障影响 | 恢复方式 |
|-----|-------|----------|---------|---------|
| ai-qtrd-web | 1 | 单点 | 前端完全不可用 | K8s自动重启Pod |
| ai-qtrd-api | 1 | 单点 | 后端API不可用 | K8s自动重启Pod |
| Redis | 3 (1M+2S) | 高可用 | 主节点故障需手动切换 | 提升从节点为主节点 |
| PostgreSQL | 1 (外部) | 单点 | 数据库不可用 | 依赖外部服务恢复 |
| Traefik | 1 | 单点 | 所有外部访问不可用 | K8s自动重启 |

### 9.2 健康检查配置 | Health Check Configuration

**前端健康检查**:
```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

**后端健康检查**:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

**Redis健康检查**:
```yaml
livenessProbe:
  exec:
    command:
    - redis-cli
    - -a
    - ${REDIS_PASSWORD}
    - ping
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  exec:
    command:
    - redis-cli
    - -a
    - ${REDIS_PASSWORD}
    - ping
  initialDelaySeconds: 5
  periodSeconds: 5
```

### 9.3 故障恢复流程 | Disaster Recovery

**场景1: Pod异常退出**
```
1. K8s检测到Pod状态为Failed/CrashLoopBackOff
2. 根据Deployment/StatefulSet配置自动重启Pod
3. 健康检查通过后恢复服务
4. 平均恢复时间: 1-2分钟
```

**场景2: Redis主节点故障**
```
1. 检测主节点状态:
   kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} ping

2. 查看从节点复制状态:
   kubectl exec -n ai-qtrd redis-1 -- redis-cli -a ${REDIS_PASSWORD} info replication

3. 手动提升从节点为主节点:
   kubectl exec -n ai-qtrd redis-1 -- redis-cli -a ${REDIS_PASSWORD} SLAVEOF NO ONE

4. 更新应用配置指向新主节点 (或使用Sentinel自动切换)
```

**场景3: 节点宕机**
```
1. K8s检测到节点NotReady
2. 5分钟后开始驱逐该节点上的Pod
3. 在其他健康节点上重新调度Pod
4. StatefulSet的Pod保持PV绑定，数据不丢失
```

---

## 10. 监控与日志 | Monitoring and Logging

### 10.1 日志查看 | Log Viewing

**查看实时日志**:
```bash
# 前端日志
kubectl logs -f -n ai-qtrd deployment/ai-qtrd-web

# 后端日志
kubectl logs -f -n ai-qtrd deployment/ai-qtrd-api

# Redis主节点日志
kubectl logs -f -n ai-qtrd redis-0

# Traefik日志
kubectl logs -f -n kube-system deployment/traefik
```

**查看历史日志**:
```bash
# 查看前一个Pod的日志（Pod崩溃后）
kubectl logs -n ai-qtrd deployment/ai-qtrd-web --previous

# 查看最近100行日志
kubectl logs -n ai-qtrd deployment/ai-qtrd-api --tail=100
```

### 10.2 资源监控 | Resource Monitoring

**实时资源使用**:
```bash
# 查看节点资源使用
kubectl top nodes

# 查看Pod资源使用
kubectl top pods -n ai-qtrd

# 查看特定Pod详细信息
kubectl describe pod -n ai-qtrd <pod-name>
```

**示例输出**:
```
NAME                           CPU(cores)   MEMORY(bytes)
ai-qtrd-api-7d8c9b5f6d-abcde   120m         850Mi
ai-qtrd-web-6f5d4c3b2a-xyz12   50m          320Mi
redis-0                        30m          420Mi
redis-1                        20m          380Mi
redis-2                        20m          380Mi
```

### 10.3 事件监控 | Event Monitoring

**查看集群事件**:
```bash
# 查看所有命名空间事件
kubectl get events -A --sort-by='.lastTimestamp'

# 查看ai-qtrd命名空间事件
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp'

# 持续监控事件
kubectl get events -n ai-qtrd -w
```

**常见事件类型**:
```
Normal  Scheduled     Pod已被调度到节点
Normal  Pulling       正在拉取镜像（本地镜像则跳过）
Normal  Pulled        镜像拉取成功
Normal  Created       容器已创建
Normal  Started       容器已启动
Warning FailedMount   挂载卷失败
Warning Unhealthy     健康检查失败
Warning BackOff       容器重启回退
```

---

## 11. 安全配置 | Security Configuration

### 11.1 密钥管理 | Secret Management

**敏感信息存储**:
```yaml
Kubernetes Secret: ai-qtrd-secrets
  Type: Opaque (base64编码)

  Keys:
    - DEEPSEEK_API_KEY:    AI模型API密钥
    - DATABASE_PASSWORD:   PostgreSQL数据库密码
    - REDIS_PASSWORD:      Redis访问密码
```

**Secret注入方式**:
```yaml
# 环境变量注入
env:
- name: DEEPSEEK_API_KEY
  valueFrom:
    secretKeyRef:
      name: ai-qtrd-secrets
      key: DEEPSEEK_API_KEY
```

**查看Secret** (需要管理员权限):
```bash
# 查看Secret列表
kubectl get secrets -n ai-qtrd

# 查看Secret内容（base64编码）
kubectl get secret ai-qtrd-secrets -n ai-qtrd -o yaml

# 解码Secret值
kubectl get secret ai-qtrd-secrets -n ai-qtrd -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d
```

### 11.2 网络隔离 | Network Isolation

**命名空间隔离**:
```
ai-qtrd命名空间中的服务默认可以互相通信
跨命名空间通信需要使用FQDN:
  <service>.<namespace>.svc.cluster.local
```

**Service类型**:
```yaml
所有业务服务使用 ClusterIP (集群内部访问)
不使用 NodePort / LoadBalancer (不对外直接暴露)
外部访问统一通过 Traefik Ingress
```

**防火墙规则** (Tailscale层面):
```
只有特定IP可以访问K3s API Server (6443端口)
集群节点间通信走Tailscale VPN隧道
```

### 11.3 RBAC权限控制 | RBAC Access Control

**ServiceAccount**:
```yaml
ai-qtrd命名空间使用默认的ServiceAccount
权限范围: 仅限该命名空间内资源访问
```

**最小权限原则**:
```
应用Pod不需要访问K8s API
不挂载ServiceAccount token (automountServiceAccountToken: false)
```

---

## 12. 部署与更新流程 | Deployment and Update

### 12.1 滚动更新策略 | Rolling Update Strategy

**Deployment更新**:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0   # 保证至少有1个Pod运行
    maxSurge: 1         # 允许额外创建1个Pod
```

**更新流程**:
```bash
# 步骤1: 构建新版本镜像
cd lucrum-web
docker build --no-cache -t lucrum-web:v19 .

# 步骤2: 分发镜像到所有节点
./distribute-image.sh lucrum-web v19

# 步骤3: 更新Deployment镜像
kubectl set image deployment/ai-qtrd-web -n ai-qtrd \
  web=lucrum-web:v19

# 步骤4: 监控更新进度
kubectl rollout status deployment/ai-qtrd-web -n ai-qtrd

# 步骤5: 验证新版本
kubectl get pods -n ai-qtrd -w
curl -I https://lucrum.lurus.cn
```

**回滚操作**:
```bash
# 查看历史版本
kubectl rollout history deployment/ai-qtrd-web -n ai-qtrd

# 回滚到上一个版本
kubectl rollout undo deployment/ai-qtrd-web -n ai-qtrd

# 回滚到指定版本
kubectl rollout undo deployment/ai-qtrd-web -n ai-qtrd --to-revision=3
```

### 12.2 StatefulSet更新 | StatefulSet Update

**Redis更新策略**:
```yaml
updateStrategy:
  type: RollingUpdate
  rollingUpdate:
    partition: 0  # 从pod-0开始更新
```

**更新流程** (需谨慎):
```bash
# 步骤1: 更新ConfigMap
kubectl apply -f 10-redis-configmap.yaml

# 步骤2: 逐个重启Pod（保持主从复制）
kubectl delete pod redis-2 -n ai-qtrd  # 先删从节点
kubectl wait --for=condition=ready pod/redis-2 -n ai-qtrd
kubectl delete pod redis-1 -n ai-qtrd
kubectl wait --for=condition=ready pod/redis-1 -n ai-qtrd
kubectl delete pod redis-0 -n ai-qtrd  # 最后删主节点

# 步骤3: 验证主从状态
kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} info replication
```

### 12.3 零停机部署 | Zero-Downtime Deployment

**关键配置**:
```yaml
# 1. 健康检查配置
readinessProbe:
  初始延迟: 10秒
  检查周期: 5秒
  失败阈值: 2次

# 2. 优雅终止
terminationGracePeriodSeconds: 30

# 3. 滚动更新参数
maxUnavailable: 0  # 确保始终有Pod运行
maxSurge: 1        # 先创建新Pod，再删旧Pod

# 4. PreStop Hook
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]
```

**验证流程**:
```bash
# 1. 更新前检查
kubectl get pods -n ai-qtrd
curl https://lucrum.lurus.cn/api/health

# 2. 触发更新
kubectl set image deployment/ai-qtrd-web -n ai-qtrd web=lucrum-web:v19

# 3. 监控更新过程
watch kubectl get pods -n ai-qtrd

# 4. 持续访问测试（另一个终端）
while true; do
  curl -s -o /dev/null -w "%{http_code}\n" https://lucrum.lurus.cn/api/health
  sleep 1
done
# 预期输出: 持续200状态码，无中断
```

---

## 13. 常见运维操作 | Common Operations

### 13.1 重启服务 | Restart Services

```bash
# 重启前端
kubectl rollout restart deployment/ai-qtrd-web -n ai-qtrd

# 重启后端
kubectl rollout restart deployment/ai-qtrd-api -n ai-qtrd

# 重启Redis（逐个重启避免主节点先宕）
kubectl delete pod redis-2 -n ai-qtrd && sleep 10
kubectl delete pod redis-1 -n ai-qtrd && sleep 10
kubectl delete pod redis-0 -n ai-qtrd
```

### 13.2 扩缩容 | Scale

```bash
# 扩容前端到3个副本
kubectl scale deployment/ai-qtrd-web -n ai-qtrd --replicas=3

# 缩容后端到1个副本
kubectl scale deployment/ai-qtrd-api -n ai-qtrd --replicas=1

# 注意: StatefulSet扩缩容会影响PV绑定
kubectl scale statefulset/redis -n ai-qtrd --replicas=5
```

### 13.3 进入容器调试 | Debug in Container

```bash
# 进入前端容器
kubectl exec -it -n ai-qtrd deployment/ai-qtrd-web -- /bin/sh

# 进入后端容器
kubectl exec -it -n ai-qtrd deployment/ai-qtrd-api -- /bin/bash

# 进入Redis主节点
kubectl exec -it -n ai-qtrd redis-0 -- /bin/sh

# 在容器内执行单个命令
kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} INFO
```

### 13.4 配置更新 | Configuration Update

```bash
# 更新ConfigMap
kubectl apply -f 02-configmap.yaml

# 更新Secret
kubectl apply -f 01-secrets.yaml

# 重启Pod使配置生效
kubectl rollout restart deployment/ai-qtrd-api -n ai-qtrd
```

### 13.5 清理缓存 | Cache Cleanup

```bash
# 清空Redis所有缓存
kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} FLUSHALL

# 清空特定Key前缀的缓存
kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} --scan --pattern "gw:kline:*" | xargs -L 1 kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} DEL
```

---

## 14. 故障排查指南 | Troubleshooting Guide

### 14.1 Pod无法启动 | Pod Not Starting

**症状**: Pod状态为 `CrashLoopBackOff` 或 `ImagePullBackOff`

**排查步骤**:
```bash
# 1. 查看Pod状态
kubectl describe pod -n ai-qtrd <pod-name>

# 2. 查看容器日志
kubectl logs -n ai-qtrd <pod-name>
kubectl logs -n ai-qtrd <pod-name> --previous  # 查看崩溃前的日志

# 3. 检查镜像是否存在
kubectl get pods -n ai-qtrd <pod-name> -o jsonpath='{.spec.containers[*].image}'
ctr -n k8s.io images ls | grep <image-name>

# 4. 检查资源限制
kubectl top pods -n ai-qtrd
kubectl describe node <node-name>  # 查看节点资源

# 5. 检查Event事件
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp' | grep <pod-name>
```

**常见原因**:
- 镜像不存在本地（需导入镜像）
- 健康检查失败（调整initialDelaySeconds）
- 资源不足（OOMKilled）
- Secret/ConfigMap不存在

### 14.2 服务无法访问 | Service Unreachable

**症状**: 外部访问 `https://lucrum.lurus.cn` 返回 502/503/504

**排查步骤**:
```bash
# 1. 检查Pod状态
kubectl get pods -n ai-qtrd
# 确认所有Pod都是Running且Ready (1/1)

# 2. 检查Service
kubectl get svc -n ai-qtrd
kubectl describe svc ai-qtrd-web -n ai-qtrd
# 确认Endpoints不为空

# 3. 测试内部访问
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://ai-qtrd-web.ai-qtrd.svc.cluster.local:3000/api/health

# 4. 检查Ingress路由
kubectl get ingressroute -n ai-qtrd
kubectl describe ingressroute lucrum-web-https -n ai-qtrd

# 5. 检查TLS证书
kubectl get certificate -n ai-qtrd
kubectl describe certificate lucrum-lurus-cn-tls -n ai-qtrd

# 6. 查看Traefik日志
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=100
```

**常见原因**:
- Pod未Ready（健康检查失败）
- Service Selector不匹配
- IngressRoute配置错误
- TLS证书未就绪
- DNS解析问题

### 14.3 Redis连接失败 | Redis Connection Failed

**症状**: 应用日志显示 `ECONNREFUSED` 或 `AUTH failed`

**排查步骤**:
```bash
# 1. 检查Redis Pod状态
kubectl get pods -n ai-qtrd -l app=redis

# 2. 测试Redis连接
kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} ping
# 预期输出: PONG

# 3. 检查主从状态
kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} info replication

# 4. 检查Service
kubectl get svc -n ai-qtrd redis-service
kubectl get endpoints -n ai-qtrd redis-service

# 5. 从应用Pod测试连接
kubectl exec -n ai-qtrd deployment/ai-qtrd-web -- /bin/sh -c \
  "nc -zv redis-service 6379"

# 6. 检查密码是否正确
kubectl get secret ai-qtrd-secrets -n ai-qtrd -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d
```

**常见原因**:
- Redis密码错误
- 主节点故障（需手动切换）
- Service DNS解析失败
- 网络策略阻止连接

### 14.4 回测执行失败 | Backtest Execution Failed

**症状**: 前端提交回测请求后长时间无响应或返回错误

**排查步骤**:
```bash
# 1. 检查后端API日志
kubectl logs -n ai-qtrd deployment/ai-qtrd-api --tail=200 | grep -i error

# 2. 检查后端资源使用
kubectl top pod -n ai-qtrd -l app.kubernetes.io/component=api
# 查看是否达到CPU/Memory限制

# 3. 测试后端API健康状态
curl https://lucrum.lurus.cn/api/health
curl https://lucrum.lurus.cn/docs  # Swagger UI

# 4. 检查数据库连接
kubectl exec -n ai-qtrd deployment/ai-qtrd-api -- python3 -c \
  "import psycopg2; psycopg2.connect('$DATABASE_URL'); print('OK')"

# 5. 查看Traefik路由
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik | grep "/api/backtest"
```

**常见原因**:
- 后端资源不足（回测占用大量CPU/内存）
- 数据库连接超时
- 请求路由到前端而非后端
- AI API调用失败（DEEPSEEK_API_KEY问题）

---

## 15. 性能优化建议 | Performance Optimization

### 15.1 缓存策略优化 | Cache Strategy

**当前问题**:
- Redis缓存TTL固定为1小时
- 高频访问数据可能重复查询

**优化方案**:
```typescript
// 差异化TTL策略
const CACHE_TTL = {
  KLINE_1MIN: 60,           // 1分钟K线: 1分钟
  KLINE_5MIN: 300,          // 5分钟K线: 5分钟
  KLINE_DAY: 3600,          // 日K线: 1小时
  BACKTEST_RESULT: 86400,   // 回测结果: 24小时
  STOCK_INFO: 604800,       // 股票信息: 7天
};

// 缓存预热
async function warmupCache() {
  const hotStocks = ['600519', '000001', '601318'];  // 热门股票
  for (const symbol of hotStocks) {
    await fetchKlineData(symbol, '1d', { preload: true });
  }
}
```

### 15.2 数据库查询优化 | Database Query Optimization

**索引优化**:
```sql
-- 确保关键字段有索引
CREATE INDEX idx_klines_symbol_date ON klines(stock_code, date);
CREATE INDEX idx_stocks_code ON stocks(code);
CREATE INDEX idx_backtest_results_user_id ON backtest_results(user_id);

-- 分析查询计划
EXPLAIN ANALYZE SELECT * FROM klines WHERE stock_code='600519' AND date >= '2024-01-01';
```

**连接池调优**:
```typescript
// lucrum-web/src/lib/db/index.ts
const pool = new Pool({
  max: 20,                    // 增加到20（当前值）
  min: 5,                     // 保持最少5个连接
  idleTimeoutMillis: 30000,   // 空闲30秒释放
  connectionTimeoutMillis: 5000,
  acquireTimeoutMillis: 10000,  // 获取连接超时时间
});
```

### 15.3 服务扩容建议 | Scaling Recommendations

**前端扩容**:
```yaml
# 高并发场景下扩容到3副本
kubectl scale deployment/ai-qtrd-web -n ai-qtrd --replicas=3

# 配置HPA自动扩缩容
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-qtrd-web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-qtrd-web
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**后端扩容**:
```yaml
# 回测高峰期扩容
kubectl scale deployment/ai-qtrd-api -n ai-qtrd --replicas=3

# 注意: 需要确保所有节点都有足够资源
# 建议资源配置: 每副本 1CPU/2Gi内存
```

---

## 16. 安全加固建议 | Security Hardening

### 16.1 Secret加密 | Secret Encryption

**当前问题**: Secret仅base64编码，不是真正加密

**改进方案**:
```yaml
# 启用K3s etcd数据加密
# 在K3s启动参数中添加
--secrets-encryption-config=/etc/rancher/k3s/secrets-encryption.yaml

# secrets-encryption.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
    - secrets
    providers:
    - aescbc:
        keys:
        - name: key1
          secret: <base64-encoded-32-byte-key>
    - identity: {}
```

### 16.2 网络策略 | Network Policy

**限制Pod间通信**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ai-qtrd-network-policy
  namespace: ai-qtrd
spec:
  podSelector:
    matchLabels:
      app: ai-qtrd-web
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: kube-system  # 只允许Traefik访问
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis  # 允许访问Redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - podSelector:
        matchLabels:
          app.kubernetes.io/component: api  # 允许访问后端
    ports:
    - protocol: TCP
      port: 8000
```

### 16.3 Pod安全策略 | Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-qtrd
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

**容器安全加固**:
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  readOnlyRootFilesystem: true  # 只读根文件系统
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
```

---

## 17. 监控告警方案 | Monitoring and Alerting

### 17.1 Prometheus监控 | Prometheus Monitoring

**部署Prometheus** (可选):
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring

---
# Prometheus Deployment (简化版)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
      volumes:
      - name: config
        configMap:
          name: prometheus-config
```

**监控指标**:
```yaml
# prometheus-config.yaml
scrape_configs:
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
    - role: pod
      namespaces:
        names:
        - ai-qtrd
    relabel_configs:
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
      action: keep
      regex: true
```

### 17.2 Grafana仪表盘 | Grafana Dashboard

**部署Grafana**:
```bash
kubectl create namespace monitoring
helm install grafana grafana/grafana -n monitoring
```

**关键面板**:
- CPU/Memory使用率
- Pod重启次数
- Redis命中率
- API响应时间
- 回测任务队列长度

### 17.3 告警规则 | Alert Rules

```yaml
# prometheus-alerts.yaml
groups:
- name: ai-qtrd-alerts
  rules:
  - alert: PodDown
    expr: up{namespace="ai-qtrd"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Pod {{ $labels.pod }} is down"

  - alert: HighMemoryUsage
    expr: container_memory_usage_bytes{namespace="ai-qtrd"} / container_spec_memory_limit_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Pod {{ $labels.pod }} memory usage > 90%"

  - alert: RedisDown
    expr: redis_up{namespace="ai-qtrd"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Redis instance {{ $labels.instance }} is down"
```

---

## 18. 备份与恢复方案 | Backup and Restore

### 18.1 配置备份 | Configuration Backup

```bash
#!/bin/bash
# backup-k8s-configs.sh

BACKUP_DIR="./k8s-backup-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 备份所有K8s资源
kubectl get all -n ai-qtrd -o yaml > $BACKUP_DIR/all-resources.yaml
kubectl get configmap -n ai-qtrd -o yaml > $BACKUP_DIR/configmaps.yaml
kubectl get secret -n ai-qtrd -o yaml > $BACKUP_DIR/secrets.yaml
kubectl get ingressroute -n ai-qtrd -o yaml > $BACKUP_DIR/ingressroutes.yaml
kubectl get certificate -n ai-qtrd -o yaml > $BACKUP_DIR/certificates.yaml

# 打包压缩
tar -czf k8s-backup-$(date +%Y%m%d).tar.gz $BACKUP_DIR
echo "备份完成: k8s-backup-$(date +%Y%m%d).tar.gz"
```

### 18.2 数据备份 | Data Backup

**Redis数据备份**:
```bash
#!/bin/bash
# backup-redis.sh

BACKUP_DIR="./redis-backup-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 触发RDB快照
kubectl exec -n ai-qtrd redis-0 -- redis-cli -a ${REDIS_PASSWORD} BGSAVE

# 等待快照完成
sleep 5

# 复制快照文件
kubectl cp ai-qtrd/redis-0:/data/dump.rdb $BACKUP_DIR/dump.rdb

echo "Redis备份完成: $BACKUP_DIR/dump.rdb"
```

**数据库备份**:
```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="./db-backup-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# PostgreSQL备份
pg_dump -h <db-host> -U postgres -d lucrum -F c -f $BACKUP_DIR/lucrum.dump

echo "数据库备份完成: $BACKUP_DIR/lucrum.dump"
```

### 18.3 完整恢复流程 | Full Recovery

```bash
#!/bin/bash
# restore-full.sh

# 步骤1: 恢复K8s配置
kubectl apply -f k8s-backup-20260122/all-resources.yaml

# 步骤2: 恢复Redis数据
kubectl cp redis-backup-20260122/dump.rdb ai-qtrd/redis-0:/data/dump.rdb
kubectl rollout restart statefulset/redis -n ai-qtrd

# 步骤3: 恢复数据库
pg_restore -h <db-host> -U postgres -d lucrum db-backup-20260122/lucrum.dump

# 步骤4: 验证
kubectl get pods -n ai-qtrd
curl https://lucrum.lurus.cn/api/health
```

---

## 19. 灾难恢复计划 | Disaster Recovery Plan

### 19.1 RTO/RPO目标 | Recovery Objectives

| 场景 | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|-----|-------------------------------|-------------------------------|
| Pod故障 | 2分钟 | 0 (无数据丢失) |
| 节点故障 | 5分钟 | 0 |
| Redis主节点故障 | 10分钟 | < 1秒 (AOF持久化) |
| 集群完全故障 | 1小时 | < 1小时 (取决于备份频率) |
| 数据库损坏 | 2小时 | < 24小时 (每日备份) |

### 19.2 故障场景应对 | Failure Scenarios

**场景1: 单节点故障**
```
影响: 该节点上的Pod不可用
恢复步骤:
  1. K8s自动在其他节点重新调度Pod
  2. StatefulSet的Pod保持PV绑定
  3. 5分钟内完成迁移
  4. 修复故障节点后重新加入集群
```

**场景2: Redis主节点故障**
```
影响: Redis写入不可用（读取可从从节点）
恢复步骤:
  1. 检测故障: kubectl get pods -n ai-qtrd | grep redis
  2. 提升从节点: kubectl exec redis-1 -- redis-cli SLAVEOF NO ONE
  3. 更新应用配置指向新主节点
  4. 恢复故障节点后配置为从节点
```

**场景3: Traefik故障**
```
影响: 所有外部访问不可用
恢复步骤:
  1. K8s自动重启Traefik Pod
  2. 预期恢复时间: 2-3分钟
  3. 如果IngressRoute配置损坏: kubectl apply -f 06-ingress-routes.yaml
```

### 19.3 灾难恢复演练 | DR Drill

**月度演练清单**:
```
□ 模拟Pod故障并验证自动恢复
□ 模拟节点宕机并验证调度迁移
□ 执行Redis主从切换演练
□ 测试备份恢复流程
□ 验证监控告警是否生效
□ 更新灾难恢复文档
```

---

## 20. 未来规划与改进 | Future Improvements

### 20.1 短期优化 (1-3个月) | Short-term

1. **引入HPA自动扩缩容**
   - 前端/后端根据CPU使用率自动扩容
   - 降低成本，提高弹性

2. **完善监控体系**
   - 部署Prometheus + Grafana
   - 配置告警规则（钉钉/企业微信）
   - 建立SLA监控

3. **优化Redis高可用**
   - 引入Redis Sentinel自动故障切换
   - 或迁移到Redis Cluster模式

4. **增强安全性**
   - 启用Secret加密
   - 配置NetworkPolicy
   - 实施Pod安全策略

### 20.2 中期优化 (3-6个月) | Mid-term

1. **引入CI/CD流水线**
   - GitHub Actions自动构建镜像
   - 自动化测试
   - 自动部署到K3s集群

2. **服务网格Istio**
   - 流量管理（灰度发布）
   - 服务间加密通信
   - 可观测性增强

3. **数据库高可用**
   - PostgreSQL主从复制
   - 自动故障切换
   - 读写分离

4. **多环境部署**
   - 开发环境 (dev)
   - 测试环境 (staging)
   - 生产环境 (production)

### 20.3 长期规划 (6-12个月) | Long-term

1. **多集群架构**
   - 跨区域多K3s集群
   - 全局负载均衡
   - 灾备集群

2. **微服务拆分**
   - 策略生成服务独立
   - 回测服务独立
   - AI顾问服务独立

3. **存储升级**
   - 引入Ceph/Longhorn分布式存储
   - 跨节点数据复制
   - 快照与备份自动化

4. **可观测性完善**
   - 分布式追踪 (Jaeger)
   - 日志聚合 (ELK/Loki)
   - APM监控 (Skywalking)

---

## 附录 A: 快速命令参考 | Quick Command Reference

### Pod操作
```bash
# 查看所有Pod
kubectl get pods -n ai-qtrd

# 查看Pod详情
kubectl describe pod <pod-name> -n ai-qtrd

# 查看Pod日志
kubectl logs -f <pod-name> -n ai-qtrd

# 进入Pod
kubectl exec -it <pod-name> -n ai-qtrd -- /bin/sh

# 重启Deployment
kubectl rollout restart deployment/<name> -n ai-qtrd

# 删除Pod（会自动重建）
kubectl delete pod <pod-name> -n ai-qtrd
```

### Service操作
```bash
# 查看所有Service
kubectl get svc -n ai-qtrd

# 查看Service详情
kubectl describe svc <service-name> -n ai-qtrd

# 查看Endpoints
kubectl get endpoints <service-name> -n ai-qtrd
```

### 镜像操作
```bash
# 查看节点上的镜像
ctr -n k8s.io images ls

# 导入镜像
ctr -n k8s.io images import <image.tar>

# 删除镜像
ctr -n k8s.io images rm <image-name>:<tag>
```

### 配置操作
```bash
# 查看ConfigMap
kubectl get configmap -n ai-qtrd
kubectl describe configmap <name> -n ai-qtrd

# 查看Secret
kubectl get secret -n ai-qtrd
kubectl get secret <name> -n ai-qtrd -o yaml

# 更新配置
kubectl apply -f <config-file>.yaml
```

### 监控操作
```bash
# 查看节点资源
kubectl top nodes

# 查看Pod资源
kubectl top pods -n ai-qtrd

# 查看事件
kubectl get events -n ai-qtrd --sort-by='.lastTimestamp'

# 查看Pod状态变化
kubectl get pods -n ai-qtrd -w
```

---

## 附录 B: 端口映射表 | Port Mapping

| 服务名称 | 容器端口 | Service端口 | 外部访问 | 用途 |
|---------|---------|-----------|---------|------|
| ai-qtrd-web | 3000 | 3000 | https://lucrum.lurus.cn | Next.js前端 |
| ai-qtrd-api | 8000 | 8000 | https://lucrum.lurus.cn/api | FastAPI后端 |
| redis-service | 6379 | 6379 | 集群内部 | Redis缓存 |
| redis-headless | 6379 | 6379 | StatefulSet内部 | Redis主从通信 |
| traefik | 80/443 | 80/443 | 0.0.0.0:80/443 | Ingress入口 |

---

## 附录 C: 环境变量清单 | Environment Variables

### 前端环境变量
```yaml
REDIS_HOST: redis-service.ai-qtrd.svc.cluster.local
REDIS_PORT: 6379
REDIS_PASSWORD: <from secret>
REDIS_DB: 0
REDIS_ENABLED: true
NEXTAUTH_URL: https://lucrum.lurus.cn
NEXTAUTH_SECRET: <from secret>
BACKEND_API_URL: http://ai-qtrd-api:8000
LURUS_API_URL: https://api.lurus.cn
LURUS_API_KEY: <from secret>
```

### 后端环境变量
```yaml
WEB_HOST: 0.0.0.0
WEB_PORT: 8000
DEEPSEEK_API_BASE: https://api.lurus.cn/v1
DEEPSEEK_MODEL: deepseek-chat
DEEPSEEK_API_KEY: <from secret>
DATABASE_URL: postgresql://user:pass@host/db
DATABASE_PASSWORD: <from secret>
REDIS_HOST: redis-service
REDIS_PORT: 6379
REDIS_PASSWORD: <from secret>
CORS_ORIGINS: ["https://lucrum.lurus.cn"]
WEB_URL: https://lucrum.lurus.cn
API_URL: https://lucrum.lurus.cn/api
```

---

**文档版本**: v1.0
**最后更新**: 2026-01-22
**维护者**: Lucrum DevOps Team
