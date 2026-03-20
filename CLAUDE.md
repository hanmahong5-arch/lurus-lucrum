# lurus-lucrum

AI 量化交易平台，包含两个子项目：

| 子项目 | 技术栈 | 职责 |
|--------|--------|------|
| `lucrum-web/` | Next.js 14 + TypeScript + Bun | 前端 + API 路由层 + 回测引擎 |
| `lurus-ai-qtrd/` | Python 3.11 + FastAPI + vnpy | 量化引擎后端（vnpy 框架） |

- 域名：`https://lucrum.lurus.cn`
- 命名空间：`lucrum`
- Web image：`ghcr.io/hanmahong5-arch/lucrum-web:main`（GitOps，推 main 自动同步）
- API image：`ghcr.io/hanmahong5-arch/lurus-ai-qtrd:main`（GitOps，推 main 自动同步）

---

## lucrum-web 目录结构

```
lucrum-web/
├── src/
│   ├── app/
│   │   ├── api/                # Next.js API routes（advisor/agent/backtest/data/lurus/stocks）
│   │   ├── dashboard/          # 主交易 UI（策略编辑器、顾问、历史、扫描器）
│   │   └── backtest-agent/     # AI 回测 Agent 页面
│   ├── components/             # React 组件（agent/advisor/charts/strategy-editor/ui）
│   ├── hooks/                  # useBilling / use-quota-status / use-user-workspace
│   └── lib/
│       ├── agent/              # LangGraph Agent（backtest-agent / scanner-agent）
│       ├── backtest/           # 回测引擎（core/parallel/engine/statistics）
│       ├── advisor/            # 多 Agent 投资顾问（11 agents / 7 schools）
│       ├── db/                 # Drizzle ORM（schema / queries / index）
│       ├── redis/              # IORedis 客户端
│       ├── stores/             # Zustand（strategy-workspace-store）
│       └── middleware/         # quota-check.ts（AI token 配额拦截）
├── drizzle/                    # Drizzle 生成的 SQL migrations
├── tests/e2e/                  # Playwright E2E 测试（4 viewport）
├── Dockerfile                  # 三阶段 Bun 构建
├── deploy/k8s/                 # K8s manifests（ArgoCD 管理）
└── drizzle.config.ts
```

### 关键子系统说明

- **回测引擎** (`src/lib/backtest/`)：金融级精度，Decimal.js，30+ 指标，BT1XX-BT9XX 错误码
- **多 Agent 顾问** (`src/lib/advisor/`)：11 专项 Agent，7 大投资流派，Token 预算管理
- **策略工作区** (`src/lib/stores/strategy-workspace-store.ts`)：三级持久化（3s 草稿 → Zustand → localStorage）
- **数据库** (`src/lib/db/`)：PostgreSQL + Drizzle ORM；表：users / stocks / klines / strategies / backtest_results

---

## lurus-ai-qtrd 目录结构

```
lurus-ai-qtrd/
├── vnpy/                   # vnpy 4.x 框架源码（修改版）
├── vnpy_ai_trader/
│   ├── src/
│   │   ├── ai_core/        # LLM 集成（DeepSeek）
│   │   ├── datafeed/       # 行情数据（adata A股）
│   │   ├── gateway/        # 交易网关
│   │   ├── strategy/       # 量化策略
│   │   ├── utils/
│   │   └── web/            # FastAPI app（端口 8000）
│   ├── config/
│   └── requirements.txt
├── k8s/ai-qtrd/            # K8s manifests（本地镜像，非 GitOps）
└── Dockerfile
```

---

## 常用命令

### lucrum-web（在 `lucrum-web/` 目录执行）

```bash
# 开发
bun run dev              # localhost:3000
bun run typecheck        # 提交前必跑
bun run lint

# 测试
bun run test                          # Vitest 单元测试
bun run test -- -t "pattern"          # 按名称过滤
bun run test -- src/lib/backtest      # 指定目录
bun run test:coverage                 # 覆盖率报告（目标：语句≥85%，函数≥90%）
bun run test:e2e                      # Playwright E2E（4 viewports）
bun run test:e2e:headed               # 有头模式（可见浏览器）

# 数据库
bun run db:generate      # 从 schema.ts 生成 migration
bun run db:push          # 推送 schema 变更到 PostgreSQL
bun run db:studio        # Drizzle Studio GUI
bun run db:import        # 导入初始数据（stocks + klines）

# 构建
bun run build
```

### lurus-ai-qtrd（在 `lurus-ai-qtrd/` 目录执行）

```bash
# 本地运行
python -m uvicorn src.web.app:app --host 0.0.0.0 --port 8000 --reload

# 构建镜像（GitOps: push to main triggers CI/CD automatically）
docker build -t lurus-ai-qtrd:latest .
```

### K8s 运维

```bash
ssh root@100.98.57.55 "kubectl -n lucrum get pods"
ssh root@100.98.57.55 "kubectl -n lucrum logs -l app=lucrum-web --tail=100"
ssh root@100.98.57.55 "kubectl -n lucrum rollout restart deployment/lucrum-web"
ssh root@100.98.57.55 "kubectl -n lucrum rollout restart deployment/lucrum-api"
```

---

## 环境变量

### lucrum-web（`.env.local`）

| 变量 | 说明 | 示例 |
|------|------|------|
| `LURUS_API_URL` | lurus-api 服务地址 | `https://api.lurus.cn` |
| `NEXT_PUBLIC_LURUS_API_URL` | 客户端可见的 API URL | `https://api.lurus.cn` |
| `TENANT_SLUG` | 租户标识 | `lurus` |
| `NEXTAUTH_URL` | NextAuth 回调基础 URL | `https://lucrum.lurus.cn` |
| `NEXTAUTH_SECRET` | NextAuth 签名密钥 | `openssl rand -hex 32` |
| `ZITADEL_ISSUER` | Zitadel OIDC issuer | `https://auth.lurus.cn` |
| `ZITADEL_CLIENT_ID` | Zitadel 应用 Client ID | `358400000000065537@lurus-api` |
| `ZITADEL_CLIENT_SECRET` | PKCE 模式留空 | （留空） |
| `DATABASE_URL` | PostgreSQL DSN | `postgresql://user:pass@host/lucrum` |
| `REDIS_ENABLED` | 是否启用 Redis | `true` |
| `REDIS_HOST` | Redis 主机 | `redis-service.lucrum.svc.cluster.local` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `REDIS_PASSWORD` | Redis 密码 | （见 K8s Secret） |
| `REDIS_DB` | Redis 数据库索引 | `0` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（Agent 功能） | （见凭证文件） |
| `DEEPSEEK_API_BASE` | DeepSeek API Base URL | `https://api.deepseek.com/v1` |
| `USE_MOCK_DATA` | 是否使用模拟数据 | `false` |

### lurus-ai-qtrd（K8s ConfigMap + Secret）

| 变量 | 说明 |
|------|------|
| `WEB_HOST` / `WEB_PORT` | FastAPI 监听地址（`0.0.0.0:8000`） |
| `DEEPSEEK_API_KEY` | DeepSeek Key（K8s Secret: `lucrum-secrets`） |
| `DEEPSEEK_API_BASE` | `https://api.lurus.cn/v1`（通过 lurus-api 网关） |
| `DEEPSEEK_MODEL` | `deepseek-chat` |
| `DATA_DIR` / `LOG_DIR` | `/app/data` / `/app/logs` |

---

## UI 开发规范（lucrum-web 专属）

读取 `lucrum-web/docs/DESIGN_SYSTEM.md` 后再写任何 UI。关键规则：

- 暗色优先：背景用 `bg-void`（非 black）和 `bg-surface`
- 金融数字：必须用 `font-mono tabular-nums`
- 语义色：用 `text-profit` / `text-loss`，不用原始颜色
- 金融计算：必须用 `FinancialAmount`（Decimal.js 封装），禁止浮点运算

---

## BMAD

| Resource | Path |
|----------|------|
| PRD | `./_bmad-output/planning-artifacts/prd.md` |
| Epics | `./_bmad-output/planning-artifacts/epics.md` |
| Architecture | `./_bmad-output/planning-artifacts/architecture.md` |
| UX Design | `./_bmad-output/planning-artifacts/ux-design-specification.md` |
| Sprint Status | `./_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Dev Stories | `./_bmad-output/implementation-artifacts/<story-id>.md` |
