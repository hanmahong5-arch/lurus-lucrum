# lurus-gushen SSO + 计费集成 - Phase 1 实现报告

**实施日期**: 2026-02-11
**状态**: ✅ 代码完成，待测试验证

## 实现概览

已完成 lurus-gushen 与 lurus-api 的 SSO 单点登录和计费 API 集成的核心代码实现。用户将能够通过 api.lurus.cn 进行统一认证，并在古神平台使用 lurus-api 的计费功能。

## 已完成的核心文件

### 1. 环境配置
**文件**: `lucrum-web/.env.local`
- 配置 LURUS_API_URL、TENANT_SLUG 等环境变量
- 设置 NEXTAUTH_URL 和 NEXTAUTH_SECRET

### 2. SSO 认证层

#### 2.1 NextAuth 配置增强
**文件**: `src/lib/auth/auth.ts`
**改动**:
- 添加 "lurus-sso" Credentials Provider（主要认证方式）
- 调用 lurus-api `/api/v1/auth/session` 验证 Cookie
- 实现 JWT 自动刷新机制（30 分钟周期）
- 保留原有 "credentials" Provider 作为本地开发备用

**关键特性**:
- Session Cookie Fallback：从 lurus-api 设置的 Domain=.lurus.cn Cookie 读取 Session
- 自动刷新：JWT token 每 30 分钟从 lurus-api 刷新一次
- 降级兼容：保留本地 credentials 登录方式

#### 2.2 登录跳转工具
**文件**: `src/lib/auth/login-redirect.ts`
**功能**:
- `redirectToLurusLogin()` 函数跳转到 lurus-api OAuth 登录页
- 携带 redirect_url 参数，登录成功后返回当前页

#### 2.3 OAuth 回调页面
**文件**: `src/app/auth/callback/page.tsx`
**功能**:
- 接收 lurus-api OAuth 回调
- 触发 NextAuth `signIn("lurus-sso")` 验证 Cookie
- 成功后跳转 /dashboard，失败跳转 /auth/login

### 3. 计费 API 集成层

#### 3.1 通用 API 代理
**文件**: `src/app/api/lurus/[...path]/route.ts`
**功能**:
- 实现 GET/POST/PUT/DELETE 路由处理
- 验证 NextAuth session（未登录返回 401）
- 代理请求到 `api.lurus.cn/api/v2/gushen/{path}`
- 转发 Cookies 和查询参数
- 错误处理：503 Service Unavailable

#### 3.2 计费管理 Hooks
**文件**: `src/hooks/useBilling.ts`
**功能**:
- `plans`: 获取订阅计划列表
- `topups`: 获取充值历史
- `createTopup`: 创建充值订单
- `initiatePayment`: 发起支付流程

#### 3.3 API Keys 管理 Hooks
**文件**: `src/hooks/useApiKeys.ts`
**功能**:
- `tokens`: 获取 API Keys 列表
- `totalQuota`: 计算总剩余配额
- `createKey`: 创建新 API Key
- `deleteKey`: 删除 API Key
- `updateKey`: 更新 API Key 配置

## 数据流设计

### SSO 登录流程

```
用户点击登录
    ↓
redirectToLurusLogin() → api.lurus.cn/api/v2/gushen/auth/login
    ↓
Zitadel OAuth 认证
    ↓
lurus-api 设置 Session Cookie (Domain=.lurus.cn)
    ↓
302 重定向到 gushen.lurus.cn/auth/callback
    ↓
NextAuth signIn("lurus-sso")
    ├─ 调用 lurus-api /api/v1/auth/session
    └─ 从 Cookie 验证 Session
    ↓
创建 NextAuth JWT Session
    ↓
用户登录到 Dashboard
```

### 计费 API 调用流程

```
前端调用 /api/lurus/billing/tokens
    ↓
Next.js API Route (验证 NextAuth Session)
    ↓
代理请求到 api.lurus.cn/api/v2/gushen/billing/tokens
    ├─ 携带 Cookie (Domain=.lurus.cn)
    └─ 转发查询参数
    ↓
lurus-api ZitadelAuth 中间件
    ├─ 从 Cookie 读取 Session (Session Fallback)
    └─ 验证用户身份
    ↓
返回计费数据 → 前端展示
```

## 技术亮点

### 1. Cookie-Based SSO
- 使用 Domain=.lurus.cn 的 Session Cookie 实现跨子域共享
- 无需复杂的 JWT 传递和刷新逻辑
- lurus-api 已配置 CORS + AllowCredentials

### 2. NextAuth.js 集成
- 新增 "lurus-sso" Provider，调用 lurus-api 验证 Session
- JWT 自动刷新机制（30 分钟），保持 Session 同步
- 保留本地 credentials Provider 作为备用方案

### 3. 统一代理架构
- `/api/lurus/*` 路由统一代理所有 lurus-api 请求
- 服务端验证 NextAuth Session，避免前端暴露凭证
- 自动转发 Cookies，利用 lurus-api Session Fallback 机制

### 4. React Query 集成
- useBilling 和 useApiKeys Hooks 封装 API 调用
- 自动缓存和失效管理
- Mutation 成功后自动刷新相关查询

## 待完成任务

### Phase 1 收尾（本次实现）

- [x] 环境配置
- [x] NextAuth SSO Provider
- [x] 登录跳转工具
- [x] OAuth 回调页面
- [x] API 代理路由
- [x] 计费 Hooks
- [x] API Keys Hooks
- [ ] **SSO 登录流程测试**（Task #8）
- [ ] **计费 API 集成测试**（Task #9）

### Phase 2: UI 集成（下一步）

1. **修改登录页面**:
   - 将主要登录按钮改为"使用 Lurus 账户登录"
   - 调用 `redirectToLurusLogin()`
   - 保留本地账户登录作为备用（仅演示）

2. **订阅设置页面**:
   - 使用 `useApiKeys()` 显示配额信息
   - 使用 `useBilling()` 显示订阅计划
   - 集成充值（Topup）功能

3. **API Keys 管理页面**:
   - 创建 `src/components/settings/api-keys-settings.tsx`
   - 实现创建、列表、删除功能
   - 显示配额使用情况

4. **Navbar 用户菜单**:
   - 显示 lurus-api 用户信息
   - 添加"账户设置"入口

### Phase 3: 降级与容错（后续优化）

1. **lurus-api 不可用处理**:
   - 实现本地缓存（localStorage）
   - 显示友好的错误提示
   - 自动重试机制

2. **Session 同步失败处理**:
   - Middleware 检测 Session 失效
   - 自动重定向到登录页
   - 保存当前页面 URL（returnUrl）

3. **监控与日志**:
   - 记录 SSO 登录成功/失败事件
   - API 代理错误日志
   - Session 刷新失败告警

## 验证清单

### SSO 功能
- [ ] 用户点击登录跳转到 api.lurus.cn
- [ ] Zitadel 登录成功后回调到 gushen.lurus.cn/auth/callback
- [ ] NextAuth Session 正确显示用户信息（id、email、name、lurusUserId）
- [ ] Cookie (Domain=.lurus.cn) 在浏览器开发工具中可见
- [ ] 登出后清除 Session 和 Cookie
- [ ] Session 过期（30 天后）自动跳转登录

### 计费 API
- [ ] `/api/lurus/billing/plans` 返回订阅计划列表
- [ ] `/api/lurus/tokens` 返回 API Keys 列表
- [ ] `/api/lurus/tokens` (POST) 创建 API Key 成功
- [ ] `/api/lurus/tokens/:id` (DELETE) 删除 API Key 成功
- [ ] `/api/lurus/billing/topup` (POST) 创建充值订单
- [ ] 未登录时调用 API 返回 401
- [ ] lurus-api 不可用时返回 503 并显示友好提示

### 降级功能
- [ ] lurus-api 超时（5 秒）返回缓存数据或默认值
- [ ] Session 失效时自动重登录
- [ ] JWT 过期自动刷新（检查 lastRefresh 时间戳）
- [ ] 网络错误显示 Toast 提示

## 部署准备

### 环境变量（生产环境）
```bash
# .env.production
LURUS_API_URL=https://api.lurus.cn
TENANT_SLUG=gushen
NEXT_PUBLIC_LURUS_API_URL=https://api.lurus.cn
NEXT_PUBLIC_TENANT_SLUG=gushen
NEXTAUTH_URL=https://gushen.lurus.cn
NEXTAUTH_SECRET=<生产环境随机密钥>
```

### DNS 配置
- 确认 `gushen.lurus.cn` 和 `api.lurus.cn` 的 SSL 证书有效
- 验证 Zitadel OAuth 回调 URL 已配置为 `https://api.lurus.cn/api/v2/gushen/auth/callback`

### Zitadel 租户配置
- 在 Zitadel 中为 gushen 创建 Organization
- 配置 OrgID → TenantID 映射（lurus-api 自动处理）

## 文件清单

```
lucrum-web/
├── .env.local                          # 新增：环境变量配置
├── src/
│   ├── lib/
│   │   └── auth/
│   │       ├── auth.ts                 # 修改：添加 lurus-sso Provider
│   │       └── login-redirect.ts       # 新增：登录跳转工具
│   ├── app/
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── page.tsx            # 新增：OAuth 回调页面
│   │   └── api/
│   │       └── lurus/
│   │           └── [...path]/
│   │               └── route.ts        # 新增：API 代理路由
│   └── hooks/
│       ├── useBilling.ts               # 新增：计费管理 Hooks
│       └── useApiKeys.ts               # 新增：API Keys 管理 Hooks
└── doc/
    └── sso-phase1-implementation.md    # 新增：实施报告（本文件）
```

## 后续步骤

1. **运行类型检查**:
   ```bash
   cd gushen-web
   bun run typecheck
   ```

2. **启动开发服务器测试**:
   ```bash
   bun run dev
   ```

3. **手动测试 SSO 流程**:
   - 访问 http://localhost:3000
   - 点击登录按钮（需先修改登录页面 UI）
   - 验证跳转和回调流程

4. **测试 API 代理**:
   - 登录后访问 /api/lurus/tokens
   - 检查返回的 API Keys 数据

5. **实现 UI 集成**（Phase 2）:
   - 修改登录页面
   - 实现订阅设置页面
   - 创建 API Keys 管理界面

## 风险与注意事项

### 1. CORS 配置
- 确保 lurus-api CORS AllowOrigins 包含 `gushen.lurus.cn`
- 验证 AllowCredentials = true

### 2. Cookie 域名
- 确认 lurus-api Session Cookie 的 Domain 设置为 `.lurus.cn`
- 测试 Cookie 在 gushen.lurus.cn 和 api.lurus.cn 间共享

### 3. NextAuth Session 策略
- 使用 JWT 策略（不是 database 策略）
- maxAge 设置为 30 天，与 lurus-api 保持一致

### 4. 生产环境 Secret
- 生成强随机 NEXTAUTH_SECRET
- 不要在代码中硬编码敏感信息

## 技术债务

1. **错误处理增强**:
   - API 代理需要更详细的错误分类
   - 区分网络错误、认证错误、业务错误

2. **缓存策略**:
   - 考虑添加 localStorage 缓存
   - 实现离线模式支持

3. **监控埋点**:
   - 添加 SSO 登录成功/失败埋点
   - API 调用性能监控

4. **单元测试**:
   - 为 useBilling 和 useApiKeys 添加单元测试
   - API 代理路由的集成测试

## 总结

Phase 1 核心代码已全部完成，实现了：
- ✅ NextAuth + lurus-api SSO 集成
- ✅ Cookie-based 跨域认证
- ✅ 计费 API 统一代理
- ✅ React Hooks 封装

**下一步**: 执行 Task #8 和 #9 的功能测试，验证 SSO 和 API 集成是否正常工作。测试通过后进入 Phase 2 UI 集成阶段。
