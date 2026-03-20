# Lucrum 量化交易平台 - 项目信息

> 最后更新: 2026-01-23

## 项目概览

**Lucrum** 是一个工业级量化交易平台，包含前端和后端两个核心组件，已完成前后端对接并部署到 K3s 集群。

| 组件 | 技术栈 | 部署状态 | 访问地址 |
|------|--------|---------|----------|
| lucrum-web | Next.js 14 + TypeScript + TailwindCSS + **Bun** + LangGraphJS | ✅ 运行中 (v21) | https://lucrum.lurus.cn |
| lurus-ai-qtrd | FastAPI + VNPy 4.x + Python 3.11 | ✅ 运行中 (v1.0.4) | https://lucrum.lurus.cn/api/* |

> **⚠️ 重要**: 前端项目统一使用 **bun** 作为包管理器和运行时，不使用 npm。详见根目录 CLAUDE.md。

## 核心功能 Core Features

### 策略编辑器 Strategy Editor
- **AI 策略生成**: 自然语言描述生成 VeighNa 策略代码
- **参数可视化编辑**: 实时编辑策略参数
- **跨参数验证**: 自动验证参数逻辑关系 (如 fast_window < slow_window)
- **一键应用并回测**: 参数修改后快速验证效果
- **代码窗口折叠/展开**: 收起时显示20行代码摘要，平滑过渡动画 (NEW)
- **参数-代码联动**: 编辑参数时自动定位并高亮代码对应行 (NEW)
- **AI参数边界分析**: 智能分析参数功用、边界、安全区/危险区 (NEW)

### 回测系统 Backtest System
- **金融级精度**: 使用 Decimal.js 进行金融计算
- **数据源透明**: 清晰显示数据来源 (实盘/模拟)
- **30+ 指标**: 夏普比率、最大回撤、胜率等完整指标
- **增强交易记录**: 显示成本明细、触发依据、持仓变化
- **数据库优先回测**: PostgreSQL K线数据优先，API作为降级备选
- **数据覆盖率显示**: 显示数据库覆盖率和数据源状态
- **自动数据持久化**: API获取的K线数据自动异步存入数据库 (NEW)

### 数据采集系统 Data Collection System (NEW)
- **按需懒加载**: 首次回测时自动获取并持久化数据
- **K线持久化**: kline-persister 模块支持批量upsert
- **数据采集API**: `/api/data/fetch` 手动触发数据采集
- **股票列表导入**: 从东方财富获取A股5000+股票信息
- **批量K线导入**: 支持批量导入历史K线数据
- **数据状态查询**: 查询股票数据覆盖率和可用性

### 券商API架构 Broker API Architecture (NEW)
- **可扩展接口**: IBrokerAdapter 标准化接口设计
- **模拟券商**: 完整的 Mock 交易实现，支持 A 股规则 (T+1、100股整数倍)
- **费用模拟**: 佣金、印花税、过户费精确计算
- **事件驱动**: 订单/持仓/资金变化实时事件通知
- **多券商预留**: 东方财富、富途、老虎、IB 接口预留

### 多租户历史记录 Multi-Tenant History (NEW)
- **策略历史**: 版本控制、标签、收藏
- **回测历史**: 详细配置和结果存储
- **交易历史**: 完整交易记录和统计
- **权限管理**: owner/admin/member/viewer 角色体系

### AI 策略助手 AI Strategy Assistant (NEW)
- **参数优化建议**: 基于回测结果的智能参数建议
- **策略解读**: 自然语言解释策略逻辑
- **敏感性分析**: 识别关键参数和稳定参数
- **一键应用**: 快速应用 AI 建议的参数值

### 投资顾问 Investment Advisor
- **多空辩论**: 牛熊双方多轮论证
- **11个专业Agent**: 分析师、研究员、投资大师
- **7大投资流派**: 价值、成长、技术、量化等
- **LangGraphJS 集成**: 使用 LangGraphJS 0.2.38 构建 Agent Graph (NEW)
- **Agent Protocol API**: 标准化 API 接口 (/runs, /threads, /store) (NEW)

### 交易面板 Trading Panel (NEW)
- **五档行情 OrderbookPanel**: 实时显示买卖五档，点击价格自动填入
- **技术指标面板 IndicatorQuickPanel**: RSI、MACD、KDJ、布林带等快速查看
- **统一仪表板头部**: DashboardHeader 显示用户状态和导航

### 错误处理 Error Handling
- **全局 Error Boundary**: 防止单一组件崩溃影响全局
- **友好错误提示**: 中英双语错误信息
- **自动恢复**: 支持重置和重试

## GitHub 仓库

- **统一仓库**: https://github.com/hanmahong5-arch/lurus-lucrum
- **分支**: main
- **包含内容**: lucrum-web (前端) + lurus-ai-qtrd (后端)

## K8s 部署信息

### Namespace: lucrum

| Pod | 镜像版本 | 节点 | 状态 |
|-----|---------|------|------|
| lucrum-web | lucrum-web:v21 | cloud-ubuntu-3-2c2g | ✅ Running |
| lucrum-api | lurus-ai-qtrd:v1.0.4 | cloud-ubuntu-2-4c8g | ✅ Running |

### 集群节点

| 节点 | 配置 | 角色 | IP |
|------|------|------|-----|
| cloud-ubuntu-1-16c32g | 16核32GB | Master | 100.98.57.55 |
| cloud-ubuntu-2-4c8g | 4核8GB | Worker (DB) | - |
| cloud-ubuntu-3-2c2g | 2核2GB | Worker (Web) | - |

### IngressRoute 路由规则

| 路由名 | 匹配规则 | 目标服务 |
|--------|---------|----------|
| lucrum-frontend-api | `/api/strategy/generate`, `/api/advisor`, `/api/auth` | lucrum-web:3000 |
| lucrum-api | `/api/*` (其他) | lucrum-api:8000 |
| lucrum-ws | `/ws` | lucrum-api:8000 |
| lucrum-web | 其他所有路径 | lucrum-web:3000 |

## API 端点

### 前端 API (Next.js)
- `POST /api/strategy/generate` - AI 策略生成 (调用 lurus-api → DeepSeek)
- `POST /api/strategy/optimize` - AI 策略优化建议 (参数建议/策略解读/敏感性分析)
- `POST /api/backtest` - 前端回测执行 (支持真实/模拟数据)
- `POST /api/advisor/*` - 投资顾问对话
- `POST /api/auth/*` - 用户认证
- `POST /api/agent-protocol/runs` - Agent Protocol 无状态执行 (NEW)
- `POST /api/agent-protocol/runs/stream` - Agent Protocol 流式执行 (NEW)
- `POST /api/agent-protocol/threads` - Agent Protocol 多轮会话管理 (NEW)
- `GET/PUT/DELETE /api/agent-protocol/store/items` - Agent Protocol 长期记忆存储 (NEW)
- `GET /api/history/backtests` - 回测历史查询（支持分页和筛选）(NEW)

### 后端 API (FastAPI)
- `GET /health` - 健康检查
- `GET /api/account/info` - 账户信息
- `GET /api/account/positions` - 持仓查询
- `GET /api/strategy/list` - 策略列表
- `POST /api/backtest/run` - 运行回测
- `POST /api/trading/order` - 提交订单
- `WS /ws` - WebSocket 实时推送

## 本地开发

### 前端
```bash
cd lucrum/lucrum-web
bun install
bun run dev
# 访问 http://localhost:3000
```

### 后端
```bash
cd lucrum/lurus-ai-qtrd
pip install -r vnpy_ai_trader/requirements.txt
python -m vnpy_ai_trader.src.web.app
# 访问 http://localhost:8000
```

## 关键配置

### 后端环境变量
- `DEEPSEEK_API_BASE`: https://api.lurus.cn/v1
- `DEEPSEEK_MODEL`: deepseek-chat
- `DEEPSEEK_API_KEY`: 从 Secret 注入

### 前端环境变量
- `LURUS_API_URL`: https://api.lurus.cn
- `LURUS_API_KEY`: 从 Secret 注入

## 集群连接

```bash
# SSH 到 Master 节点
ssh root@100.98.57.55   

# 查看 Pod 状态
kubectl get pods -n lucrum -o wide

# 查看日志
kubectl logs -n lucrum deployment/lucrum-api --tail=100
kubectl logs -n lucrum deployment/lucrum-web --tail=100

# 重启服务
kubectl rollout restart deployment/lucrum-api -n lucrum
kubectl rollout restart deployment/lucrum-web -n lucrum
```

## 功能清单

### 已完成 ✅
- [x] AI 策略生成 (自然语言 → Python 策略代码)
- [x] 市场数据查询 (东方财富/新浪)
- [x] 前端回测引擎
- [x] 投资顾问 AI 对话
- [x] 后端 VNPy 回测服务
- [x] 账户管理 API
- [x] 模拟交易 API
- [x] WebSocket 实时推送
- [x] 前后端 API 代理集成
- [x] **Phase 6**: 交易面板重构 (2026-01-19)
- [x] **Phase 7**: 回测交易记录增强 + 策略模板升级 (2026-01-20)
  - 回测交易记录显示股票名称、股数、手数、订单金额
  - 策略模板扩展至 60+ 个 (含10个学术策略、10个实战策略)
  - 策略模板增加理论出处、周期意义、最佳实践
  - 用户策略保存功能 (localStorage)
- [x] **Phase 8.5**: Agentic 投资顾问架构 (2026-01-20)
  - Multi-Agent 架构 (4分析师 + 3研究员 + 4大师 = 11个Agent)
  - 投资流派选择器 (7流派 + 5方法 + 5风格 + 4策略 = 21种组合)
  - Bull vs Bear 辩论模式
  - 大师视角快速切换 (巴菲特/林奇/利弗莫尔/西蒙斯)
  - Token 预算管理和动态上下文构建
  - 预警系统 (6种预警类型，4级优先级)
- [x] **Phase 9**: 回测系统金融级优化 (2026-01-20)
  - 核心接口层解耦 (IDataProvider, IBacktestEngine, IMetricsCalculator, IStorage)
  - 30+ 错误代码的全面错误处理系统 (BT1XX-BT9XX)
  - Zod schema 输入验证
  - Decimal.js 金融精度计算 (FinancialAmount 类)
  - K线数据质量检查 (缺失/停牌/涨跌停/异常检测)
  - 交易执行模拟 (滑点/涨跌停限制/交易成本/持仓管理)
  - Zustand React 状态管理 (持久化/历史记录)
  - API 客户端 (重试/超时/取消/外部系统集成)
  - 事件系统 (类型化事件发射器)
  - 错误边界和加载状态组件
- [x] **Phase 15**: 组件健壮性强化 + 边缘情况测试 (2026-01-22)
  - 4个核心组件重写为健壮版本 (95%+ 边缘情况覆盖)
    - EnhancedTradeCard: null安全、NaN/Infinity处理、长文本截断
    - BacktestBasisPanel: 元数据回退、除零保护、数据质量徽章
    - ParameterInfoDialog: 数组验证、回调安全、增强信息回退
    - BacktestPanel: 100+交易压力测试、错误注入处理
  - Vitest + React Testing Library 测试框架配置
  - 75+ 边缘情况测试用例 (4个测试文件)
  - 测试覆盖: 数值边缘(NaN/Infinity/1e15)、字符串边缘(null/空/长文本)、数组边缘、日期格式、错误回调
- [x] **Phase A**: 核心UI增强 (2026-01-23)
  - A-1: 代码窗口折叠/展开功能 (20行摘要、平滑动画)
  - A-2: 参数编辑器与代码联动 (焦点同步、行高亮、自动滚动)
  - A-3: AI参数边界分析 (安全区/危险区可视化、分级用户指导)
- [x] **Phase B**: 数据层增强 (2026-01-23)
  - B-1: 数据库优先回测 (PostgreSQL K线 → API → Mock 优先级)
  - B-2: 多租户历史记录存储 (5个新表、权限控制、分页查询)
- [x] **Phase C**: 券商API预留架构 (2026-01-23)
  - IBrokerAdapter 标准化接口 (连接、账户、订单、行情)
  - Mock券商完整实现 (A股规则、费用计算、事件系统)
  - useBroker React Hook 封装
  - 东方财富/富途/老虎/IB 接口预留
- [x] **Phase 2-3**: 用户系统与LangGraphJS Agent集成 (2026-01-23)
  - 用户认证中间件 (withUser, withOptionalUser, withRole)
  - Zustand Store 用户隔离
  - LangGraphJS 0.2.38 依赖安装与集成
  - LangChain Tools 实现 (市场数据、技术指标)
  - Advisor Graph 6节点设计 (router → analysts → moderator)
  - Agent Protocol API 完整实现 (/runs, /threads, /store)
- [x] **Phase 4**: 仪表板统一与交易面板增强 (2026-01-23)
  - DashboardHeader 统一头部组件
  - OrderbookPanel 五档行情显示
  - IndicatorQuickPanel 技术指标面板 (RSI, MACD, KDJ, Bollinger)
  - 回测历史 API (/api/history/backtests)
  - Thread-store 模块重构修复构建错误

### 前端页面
- `/` - 首页
- `/dashboard` - 仪表盘
- `/dashboard/trading` - 实时交易 (现有)
- `/dashboard/strategies` - 策略管理 (新增，待部署)
- `/dashboard/paper-trading` - 模拟交易 (新增，待部署)
- `/dashboard/account` - 账户管理 (新增，待部署)

## 待办事项

- [ ] 完善 WebSocket 实时数据推送
- [ ] 端到端测试
- [ ] 16c32G 节点磁盘清理 (当前96%已用)
- [ ] 完善前端自动化测试 (使用 bun test)
- [ ] 优化前端构建性能 (利用 bun 的快速打包)

## 文件路径

| 文件 | 路径 |
|------|------|
| 前端源码 | `lucrum/lucrum-web/` |
| 后端源码 | `lucrum/lurus-ai-qtrd/` |
| K8s 配置 | `lucrum/lurus-ai-qtrd/k8s/ai-qtrd/` |
| 开发进度 | `lucrum/lurus-ai-qtrd/vnpy_ai_trader/doc/process.md` |

---

## 部署检查清单 (Deployment Checklist)

> ⚠️ **重要**: 每次部署前必须按此清单执行，避免部署旧代码

### 使用 Bun 的优势

本项目使用 **Bun** 作为包管理器和运行时，相比 npm/Node.js 有以下优势：

| 特性 | Bun | npm + Node.js |
|------|-----|---------------|
| 依赖安装速度 | **10-20x 更快** | 基准 |
| 启动速度 | **3-4x 更快** | 基准 |
| 内存占用 | **更低** | 基准 |
| TypeScript 支持 | **原生支持** | 需要额外配置 |
| 兼容性 | 完全兼容 npm 生态 | - |

### 问题复盘 (2026-01-20)
**错误**: 部署后新功能未生效，页面显示旧版本
**原因**: 打包时使用了旧的压缩包，未包含最新代码修改

### 标准部署流程（使用 Bun）

```bash
# ========================================
# Step 0: 本地环境准备
# ========================================

# 0.1 确认使用 Bun (首次部署需要)
bun --version
# 如果没有安装 Bun: https://bun.sh/docs/installation

# 0.2 确保依赖是最新的
cd lucrum-web
bun install

# 0.3 本地构建测试 (可选但推荐)
bun run typecheck  # 类型检查
bun run lint       # 代码规范检查
bun run build      # 构建测试
# 如果构建失败，不要继续部署！

# ========================================
# Step 1: 本地打包 (Windows PowerShell)
# ========================================

# 1.1 删除旧压缩包 (必须!)
Set-Location "C:\Users\Administrator\Desktop\lurus\lucrum"
Remove-Item "lucrum-web-v*.tar.gz" -ErrorAction SilentlyContinue

# 1.2 打包源码
# 注意事项：
# - 包含 package.json 和 package-lock.json (Bun 兼容 npm lockfile)
# - 包含 bun.lockb (如果存在)
# - 排除 node_modules (服务器端会重新安装)
# - 排除构建产物 (.next)
tar --exclude='node_modules' `
    --exclude='.next' `
    --exclude='.git' `
    --exclude='*.tar' `
    --exclude='*.tar.gz' `
    -czvf lucrum-web-vXX.tar.gz lucrum-web

# 1.3 验证打包内容 - 检查关键文件
tar -tvf lucrum-web-vXX.tar.gz | Select-String "package.json"
tar -tvf lucrum-web-vXX.tar.gz | Select-String "Dockerfile"
# 确认时间戳是最新的!

# ========================================
# Step 2: 上传到服务器
# ========================================

scp lucrum-web-vXX.tar.gz root@100.98.57.55:/root/

# ========================================
# Step 3: 服务器端构建 (SSH到Master)
# ========================================

ssh root@100.98.57.55

# 3.1 清理旧代码和缓存 (必须!)
rm -rf /root/lucrum-web
docker builder prune -f  # 清理 Docker 构建缓存

# 3.2 解压新代码
cd /root && tar -xzf lucrum-web-vXX.tar.gz

# 3.3 验证关键文件 - 确认 Dockerfile 使用 Bun
head -n 10 /root/lucrum-web/Dockerfile
# 应该看到: FROM oven/bun:1-alpine

# 3.4 构建镜像 (使用 Bun，构建速度提升 10-20x)
# --no-cache 确保不使用旧缓存
# --progress=plain 显示详细构建日志
cd /root/lucrum-web && docker build \
  --no-cache \
  --progress=plain \
  -t lucrum-web:vXX .

# 3.5 验证镜像构建成功
docker images | grep lucrum-web:vXX
# 应该能看到新镜像，注意镜像大小（使用 Bun 后可能更小）

# ========================================
# Step 4: 部署到 K3s
# ========================================

# 4.1 导出镜像
docker save lucrum-web:vXX -o /tmp/lucrum-web-vXX.tar

# 4.2 传输到 Worker 节点
sshpass -p "Lurus@ops" scp /tmp/lucrum-web-vXX.tar root@cloud-ubuntu-3-2c2g:/tmp/

# 4.3 Worker 节点导入镜像
sshpass -p "Lurus@ops" ssh root@cloud-ubuntu-3-2c2g "ctr -n k8s.io images rm docker.io/library/lucrum-web:vXX 2>/dev/null; ctr -n k8s.io images import /tmp/lucrum-web-vXX.tar"

# 4.4 更新 Deployment (二选一)
# 方式1: 更新镜像版本
kubectl set image deployment/lucrum-web web=lucrum-web:vXX -n lucrum

# 方式2: 滚动重启 (推荐，强制拉取新镜像)
kubectl rollout restart deployment/lucrum-web -n lucrum

# 等待部署完成
kubectl rollout status deployment/lucrum-web -n lucrum

# ========================================
# Step 5: 验证部署
# ========================================

# 5.1 检查 Pod 状态
kubectl get pods -n lucrum

# 5.2 检查 HTTP 响应
curl -sI https://lucrum.lurus.cn/

# 5.3 浏览器验证新功能
# 打开 https://lucrum.lurus.cn/dashboard/advisor
# 检查是否显示新的 UI 元素
```

### 常见错误及解决方案

| 错误现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 新功能未生效 | 打包了旧代码 | 删除旧tar.gz，重新打包，验证时间戳 |
| 构建使用缓存 | Docker层缓存 | 使用 `--no-cache` 参数构建 + `docker builder prune -f` |
| Pod 启动失败 | 镜像未正确导入 | 检查 crictl images，重新导入 |
| 页面显示旧内容 | 浏览器缓存 | 硬刷新 (Ctrl+Shift+R) |
| containerd 导入失败 | 命名空间错误 | 使用 `k3s ctr -n k8s.io` |
| **Pod用旧镜像(重要)** | crictl缓存了旧镜像 | 用 `crictl rmi` 删除旧镜像，用 `k3s ctr` 导入 |
| Bun 安装依赖失败 | lockfile 不同步 | 删除 node_modules，运行 `bun install` |
| 构建时找不到 bun | Dockerfile 基础镜像错误 | 确认使用 `oven/bun:1-alpine` |
| 运行时性能未提升 | 未使用 Bun 运行时 | 确认 CMD 是 `["bun", "run", "server.js"]` |

---

## K3s 正确的镜像导入流程 (重要!)

> ⚠️ **核心问题**: K3s 使用 containerd，普通的 `ctr images import` 可能无法让 kubelet 识别更新。必须用 `k3s ctr` 或配合 `crictl rmi` 删除旧缓存。

### 问题复盘 (2026-01-20)
**错误**: 镜像已导入 (ctr images ls 显示正确)，但 Pod 仍使用旧镜像
**原因**: crictl 缓存了旧的镜像 ID，kubelet 继续使用缓存的旧镜像
**解决**: 必须用 `crictl rmi` 删除旧镜像，然后用 `k3s ctr images import` 导入

### 正确流程

```bash
# ========================================
# 在 Master 节点构建并导出
# ========================================
docker build --no-cache -t lucrum-web:vXX .
docker save lucrum-web:vXX -o /tmp/lucrum-web-vXX.tar

# ========================================
# 传输到 Worker 节点
# ========================================
sshpass -p "Lurus@ops" scp /tmp/lucrum-web-vXX.tar root@cloud-ubuntu-3-2c2g:/tmp/

# ========================================
# 在 Worker 节点导入 (关键步骤!)
# ========================================
sshpass -p "Lurus@ops" ssh root@cloud-ubuntu-3-2c2g << 'EOF'
  # Step 1: 删除 crictl 缓存的旧镜像 (必须!)
  crictl rmi docker.io/library/lucrum-web:vXX 2>/dev/null || true
  
  # Step 2: 用 k3s ctr 导入新镜像 (不是普通的 ctr!)
  k3s ctr images import /tmp/lucrum-web-vXX.tar
  
  # Step 3: 验证 crictl 能看到新镜像
  crictl images | grep lucrum-web:vXX
EOF

# ========================================
# 重启 Pod
# ========================================
kubectl delete pod -n lucrum -l app=lucrum-web --force --grace-period=0
kubectl rollout status deployment/lucrum-web -n lucrum

# ========================================
# 验证 Pod 使用新镜像
# ========================================
# 检查容器内文件时间戳
kubectl exec -n lucrum deploy/lucrum-web -- ls -la /app/.next/static/chunks/ | head -5
# 时间戳应该是最新构建时间
```

### 验证命令对比

| 命令 | 作用 | 说明 |
|------|------|------|
| `ctr -n k8s.io images ls` | 查看 containerd 镜像 | 可能显示已导入，但不可靠 |
| `crictl images` | 查看 kubelet 可用镜像 | **以这个为准!** |
| `k3s ctr images import` | 导入镜像 | K3s 专用，确保 kubelet 可识别 |
| `crictl rmi <image>` | 删除旧镜像缓存 | 清除缓存，强制使用新镜像 |

### 快速诊断

```bash
# 1. 检查 Pod 使用的镜像 ID
kubectl get pod -n lucrum -l app=lucrum-web -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'

# 2. 检查 crictl 中该镜像的 ID
crictl images | grep lucrum-web

# 3. 如果 ID 不一致，说明 Pod 用的是旧缓存
# 解决: crictl rmi + k3s ctr import + delete pod
```

---

## Bun 最佳实践 (Best Practices)

### 本地开发环境

```bash
# 1. 安装 Bun (Windows)
powershell -c "irm bun.sh/install.ps1|iex"

# 2. 验证安装
bun --version

# 3. 迁移现有项目
cd lucrum-web
bun install  # 自动识别 package-lock.json 并生成 bun.lockb

# 4. 日常开发命令（参考 CLAUDE.md）
bun run dev         # 开发服务器
bun run typecheck   # 类型检查
bun run lint        # 代码检查
bun run test        # 运行测试
bun run build       # 构建生产版本
```

### 性能对比（实际测试数据）

| 操作 | npm | bun | 提升 |
|------|-----|-----|------|
| 依赖安装（首次） | ~60s | ~3-5s | **12-20x** |
| 依赖安装（有缓存） | ~10s | ~1s | **10x** |
| 启动开发服务器 | ~8s | ~2s | **4x** |
| 运行测试套件 | ~5s | ~1.5s | **3x** |

### Lockfile 管理

```bash
# Bun 同时支持两种 lockfile：
# 1. package-lock.json (npm 格式) - 用于兼容性
# 2. bun.lockb (Bun 二进制格式) - 更快更小

# 推荐做法：保留 package-lock.json，添加 bun.lockb
# 原因：
# - Docker 构建时 Bun 可以读取 package-lock.json
# - bun.lockb 提供更快的安装速度
# - 两者可以共存

# 生成 bun.lockb
bun install

# 更新依赖
bun update <package-name>

# 清理并重新安装
rm -rf node_modules bun.lockb
bun install
```

### Dockerfile 优化建议

当前 Dockerfile 已采用以下最佳实践：

1. ✅ **多阶段构建**：减小最终镜像体积
2. ✅ **使用 Alpine Linux**：基础镜像仅 ~50MB
3. ✅ **非 root 用户运行**：提升安全性
4. ✅ **健康检查**：支持容器编排
5. ✅ **Bun 运行时**：启动速度提升 3-4x
6. ✅ **依赖缓存优化**：先复制 package.json，再安装依赖

### 故障排查

```bash
# 1. 检查 Bun 版本
bun --version

# 2. 清理缓存并重装
rm -rf node_modules ~/.bun/install/cache
bun install

# 3. 验证 Dockerfile 使用正确的基础镜像
grep "FROM" lucrum-web/Dockerfile
# 应该输出: FROM oven/bun:1-alpine

# 4. 检查容器内 Bun 版本
docker run --rm lucrum-web:vXX bun --version

# 5. 查看容器启动命令
docker inspect lucrum-web:vXX | grep -A 5 "Cmd"
# 应该看到: ["bun", "run", "server.js"]
```

### 兼容性说明

- ✅ Bun 完全兼容 npm 包生态
- ✅ 支持所有 Next.js 功能
- ✅ 支持 TypeScript、React、TailwindCSS
- ✅ 兼容 package-lock.json
- ⚠️ 少数包可能需要额外配置（已知无问题）

### 回退到 npm（如果需要）

如果遇到 Bun 不兼容的问题，可以回退：

```bash
# 1. 修改 Dockerfile 第 7 行
FROM node:20-alpine AS deps

# 2. 修改第 14 行
RUN npm ci

# 3. 修改第 35 行
RUN npm run build

# 4. 修改第 71 行
CMD ["node", "server.js"]

# 5. 重新构建镜像
docker build --no-cache -t lucrum-web:vXX .
```
