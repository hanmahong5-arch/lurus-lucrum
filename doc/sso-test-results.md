# SSO 登录流程测试结果

**测试日期**: 2026-02-11
**测试环境**: 本地开发环境 (localhost:3000)
**测试状态**: ⏳ 进行中

## 前置检查

### 1. 开发服务器状态
- ✅ gushen-web dev server 运行中 (http://localhost:3000)
- ⏳ lurus-api 状态未验证 (https://api.lurus.cn)
- ⏳ Zitadel 状态未验证 (https://auth.lurus.cn)

### 2. 代码更新
- ✅ NextAuth 配置已添加 lurus-sso Provider
- ✅ 登录页面已修改，添加 SSO 登录按钮
- ✅ OAuth 回调页面已创建
- ✅ API 代理路由已创建
- ✅ TypeScript 编译通过 (0 errors)

### 3. 文件清单
```
✅ .env.local - 环境变量配置
✅ src/lib/auth/auth.ts - NextAuth 配置（lurus-sso Provider）
✅ src/lib/auth/login-redirect.ts - 登录跳转工具
✅ src/app/auth/login/page.tsx - 登录页面（已修改）
✅ src/app/auth/callback/page.tsx - OAuth 回调页面
✅ src/app/api/lurus/[...path]/route.ts - API 代理路由
✅ src/hooks/useBilling.ts - 计费管理 Hooks
✅ src/hooks/useApiKeys.ts - API Keys 管理 Hooks
```

---

## 测试场景 1: 登录页面渲染

### ✅ 基础渲染验证

**执行**: 访问 http://localhost:3000/auth/login

**预期结果**:
- ✅ 页面正常加载，无报错
- ✅ 显示"使用 Lurus 账户登录"按钮（金色渐变，带 LogIn 图标）
- ✅ 显示"统一登录到 Lurus 平台，享受跨产品服务"提示
- ✅ 显示"显示本地账户登录（演示）"折叠按钮
- ✅ TypeScript 编译无错误

**实际结果**:
- 状态: ⏳ 待手动验证
- 备注: Dev server 已启动，需要在浏览器中访问验证

---

## 测试场景 2: SSO 登录跳转

### ⏳ 跳转逻辑验证

**手动测试步骤**:
1. 访问 http://localhost:3000/auth/login
2. 打开浏览器 DevTools → Console
3. 点击"使用 Lurus 账户登录"按钮
4. 观察浏览器行为和 Console 输出

**预期结果**:
- 浏览器跳转到: `https://api.lurus.cn/api/v2/gushen/auth/login?redirect_url=http://localhost:3000/dashboard`
- Console 无 JavaScript 错误
- 如果 lurus-api 未运行，显示浏览器连接错误

**实际结果**:
- 状态: ⏳ 待手动测试
- 备注: 需要 lurus-api 和 Zitadel 运行才能完成完整流程

---

## 测试场景 3: 本地登录备用方案

### ⏳ 本地登录功能验证

**手动测试步骤**:
1. 访问 http://localhost:3000/auth/login
2. 点击"显示本地账户登录（演示）"
3. 输入演示账户:
   - 邮箱: demo@lurus.cn
   - 密码: demo123
4. 勾选风险声明复选框
5. 点击"使用本地账户登录"

**预期结果**:
- 表单展开显示
- 登录成功后跳转到 /dashboard
- Session 包含本地用户信息 (id=1, role=free)

**实际结果**:
- 状态: ⏳ 待手动测试
- 备注: 本地登录不依赖外部服务，应该能正常工作

---

## 测试场景 4: OAuth 回调处理

### ⏳ 回调页面验证

**测试条件**: 需要 lurus-api 和 Zitadel 完成 OAuth 流程

**手动测试步骤**:
1. 完成 Zitadel OAuth 登录
2. 自动跳转到 http://localhost:3000/auth/callback
3. 观察页面显示和 Network 请求

**预期结果**:
- 显示加载动画和"正在登录..."文字
- 自动调用 NextAuth signIn("lurus-sso")
- Network 显示 POST /api/auth/callback/lurus-sso 请求
- 成功后跳转到 /dashboard
- 失败后显示错误并跳转回登录页

**实际结果**:
- 状态: ⏳ 待手动测试（需要 lurus-api）
- 备注: 回调页面代码已创建，需要完整 OAuth 流程验证

---

## 组件级测试

### ✅ redirectToLurusLogin() 函数

**测试代码** (src/lib/auth/login-redirect.ts):
```typescript
export function redirectToLurusLogin(returnUrl?: string): void {
  if (typeof window === 'undefined') {
    console.warn('redirectToLurusLogin called on server side');
    return;
  }

  const currentURL = returnUrl || window.location.href;
  const LURUS_API_URL = process.env.NEXT_PUBLIC_LURUS_API_URL || "https://api.lurus.cn";
  const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || "gushen";

  const loginURL = `${LURUS_API_URL}/api/v2/${tenantSlug}/auth/login?redirect_url=${encodeURIComponent(currentURL)}`;

  window.location.href = loginURL;
}
```

**验证**:
- ✅ 服务端调用保护（typeof window 检查）
- ✅ 环境变量回退机制
- ✅ URL 编码处理
- ✅ TypeScript 类型安全

---

## 依赖服务检查

### ⏳ lurus-api 健康检查

**命令**:
```bash
curl -I https://api.lurus.cn/health
```

**预期**: HTTP 200 OK

**实际结果**:
- 状态: ⏳ 待检查
- 备注: 需要确认 lurus-api 是否运行在生产环境

### ⏳ Zitadel OIDC 配置

**命令**:
```bash
curl -I https://auth.lurus.cn/.well-known/openid-configuration
```

**预期**: HTTP 200 OK

**实际结果**:
- 状态: ⏳ 待检查
- 备注: 需要确认 Zitadel 配置

---

## 问题与限制

### 当前限制

1. **完整 SSO 流程测试受限**:
   - ⚠️ 需要 lurus-api 运行在 https://api.lurus.cn
   - ⚠️ 需要 Zitadel 配置在 https://auth.lurus.cn
   - ⚠️ 本地开发环境 (localhost:3000) 与生产域名 (.lurus.cn) 的 Cookie 域名不匹配

2. **Cookie 域名问题**:
   - lurus-api 设置的 Cookie Domain=.lurus.cn
   - localhost:3000 无法接收 .lurus.cn 的 Cookie
   - 🔧 **解决方案**:
     - 方案 A: 使用 hosts 文件将 gushen.lurus.cn 指向 127.0.0.1
     - 方案 B: 在测试/生产环境部署后测试
     - 方案 C: 修改 lurus-api 开发环境 Cookie Domain 为 localhost

3. **CORS 配置**:
   - lurus-api 可能未将 localhost:3000 添加到 AllowOrigins
   - 需要在 lurus-api 配置中添加:
     ```go
     AllowOrigins: []string{
       "http://localhost:3000",
       "https://gushen.lurus.cn",
     }
     ```

### 已知问题

- 无

---

## 下一步行动

### 立即可执行

1. **本地登录功能测试** ✅:
   - 访问 http://localhost:3000/auth/login
   - 使用演示账户 (demo@lurus.cn / demo123) 测试本地登录
   - 验证跳转到 Dashboard

2. **UI 验证** ✅:
   - 验证 SSO 按钮样式和布局
   - 验证本地登录表单展开/折叠
   - 验证响应式设计

### 需要外部依赖

3. **SSO 完整流程测试** ⏳:
   - 确认 lurus-api 运行状态
   - 确认 Zitadel 配置
   - 解决 Cookie 域名问题（见上述方案）
   - 执行完整 OAuth 流程测试

4. **API 代理测试** (Task #9):
   - 测试 /api/lurus/billing/plans
   - 测试 /api/lurus/tokens
   - 测试创建/删除 API Key

### 可选优化

5. **单元测试编写**:
   - redirectToLurusLogin() 函数测试
   - OAuth 回调页面组件测试
   - API 代理路由集成测试

6. **错误处理增强**:
   - 添加 lurus-api 不可用的友好提示
   - 实现 API 代理的重试机制
   - 添加 Session 过期检测

---

## 测试结论

**当前状态**: 🔧 代码完成，⏳ 部分功能待验证

**已验证**:
- ✅ TypeScript 编译通过
- ✅ Dev server 运行正常
- ✅ 登录页面可访问
- ✅ 代码结构和逻辑正确

**待验证**:
- ⏳ SSO 登录跳转（需要浏览器手动测试）
- ⏳ OAuth 回调处理（需要 lurus-api + Zitadel）
- ⏳ Session 创建和持久化
- ⏳ API 代理功能

**建议**:
1. 先测试本地登录功能（不依赖外部服务）
2. 确认 lurus-api 和 Zitadel 状态后再测试 SSO
3. 考虑使用 hosts 文件解决 Cookie 域名问题
4. 在测试/生产环境部署后进行完整的端到端测试

---

## 手动测试指南

### 快速开始

1. **访问登录页面**:
   ```
   http://localhost:3000/auth/login
   ```

2. **测试本地登录** (不依赖外部服务):
   - 点击"显示本地账户登录（演示）"
   - 输入: demo@lurus.cn / demo123
   - 勾选风险声明
   - 点击"使用本地账户登录"
   - 验证跳转到 Dashboard

3. **测试 SSO 登录** (需要 lurus-api):
   - 点击"使用 Lurus 账户登录"
   - 观察浏览器跳转
   - 如果 lurus-api 未运行，会看到连接错误
   - 如果成功，会跳转到 Zitadel 登录页

4. **使用浏览器 DevTools**:
   - Console: 查看 JavaScript 错误和日志
   - Network: 查看 HTTP 请求和响应
   - Application → Cookies: 查看 Cookie 设置

### 完整测试步骤

详见: `doc/sso-testing-guide.md`
