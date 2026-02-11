# SSO 登录流程测试指南

**测试日期**: 2026-02-11
**测试环境**: 本地开发环境

## 前置条件

### 1. 服务依赖检查

**必须运行的服务**:
- ✅ gushen-web dev server (http://localhost:3000)
- ⚠️ lurus-api (https://api.lurus.cn)
- ⚠️ Zitadel OAuth (https://auth.lurus.cn)

**检查命令**:
```bash
# 检查 lurus-api 健康状态
curl -I https://api.lurus.cn/health

# 检查 Zitadel
curl -I https://auth.lurus.cn/.well-known/openid-configuration
```

### 2. 环境变量验证

**检查 .env.local**:
```bash
cd /c/Users/Anita/Desktop/lurus/lurus-gushen/gushen-web
cat .env.local
```

应该包含:
```env
LURUS_API_URL=https://api.lurus.cn
TENANT_SLUG=gushen
NEXT_PUBLIC_LURUS_API_URL=https://api.lurus.cn
NEXT_PUBLIC_TENANT_SLUG=gushen
NEXTAUTH_URL=https://gushen.lurus.cn
NEXTAUTH_SECRET=gushen_sso_secret_key_2026_change_in_production_use_openssl_rand
```

### 3. 启动开发服务器

```bash
cd /c/Users/Anita/Desktop/lurus/lurus-gushen/gushen-web
bun run dev
```

访问: http://localhost:3000/auth/login

---

## 测试场景 1: SSO 登录流程（主流程）

### 步骤 1: 访问登录页面

1. 打开浏览器（推荐 Chrome DevTools）
2. 访问: http://localhost:3000/auth/login
3. 打开 DevTools → Network 标签页
4. 打开 DevTools → Application → Cookies

**预期结果**:
- ✅ 页面显示"使用 Lurus 账户登录"按钮（金色渐变）
- ✅ 下方有"显示本地账户登录（演示）"按钮
- ✅ 无报错信息

### 步骤 2: 点击 SSO 登录按钮

1. 点击"使用 Lurus 账户登录"按钮
2. 观察 Network 标签页的请求

**预期行为**:
- ✅ 浏览器跳转到 `https://api.lurus.cn/api/v2/gushen/auth/login?redirect_url=...`
- ✅ URL 中包含正确的 redirect_url（当前页面或 /dashboard）

**如果 lurus-api 未运行**:
- ❌ 浏览器显示连接错误或 502/503
- 🔧 **解决方案**: 启动 lurus-api 服务

### 步骤 3: Zitadel OAuth 登录

**场景 A: lurus-api 和 Zitadel 正常运行**

1. 自动跳转到 Zitadel 登录页面 (https://auth.lurus.cn)
2. 输入 Zitadel 用户凭证
3. 点击"登录"

**预期结果**:
- ✅ Zitadel 验证成功
- ✅ 跳转回 lurus-api 回调 URL
- ✅ lurus-api 设置 Session Cookie (Domain=.lurus.cn)
- ✅ lurus-api 302 重定向到 `http://localhost:3000/auth/callback`

**场景 B: Zitadel 未配置或凭证错误**

- ❌ 显示 Zitadel 错误页面
- 🔧 **解决方案**: 检查 Zitadel 配置和用户凭证

### 步骤 4: OAuth 回调处理

**预期行为**:
1. 浏览器跳转到 http://localhost:3000/auth/callback
2. 页面显示加载动画和"正在登录..."文字
3. 自动调用 NextAuth `signIn("lurus-sso")`
4. NextAuth 向 lurus-api 发送请求验证 Cookie

**验证 Cookie**:
- 打开 DevTools → Application → Cookies → http://localhost:3000
- 查找 Cookie 名称（如 `lurus_session`）
- **关键检查**: Domain 应该是 `.lurus.cn`（带前导点）

**Network 请求验证**:
- 查找请求: `POST /api/auth/callback/lurus-sso`
- 请求头应包含 Cookie
- 响应应该是 200 OK

**预期结果**:
- ✅ NextAuth Session 创建成功
- ✅ 自动跳转到 /dashboard
- ✅ DevTools Cookies 中存在 `next-auth.session-token` (HttpOnly)

**如果失败**:
- ❌ 页面显示红色警告"登录失败"
- ❌ 2 秒后跳转到 /auth/login?error=callback_failed
- 🔧 **排查**:
  - 检查 Network 标签页的 /api/auth/callback 请求
  - 检查浏览器 Console 的错误日志
  - 验证 Cookie Domain 是否正确

### 步骤 5: 验证登录状态

1. 跳转到 /dashboard 后，打开 DevTools Console
2. 运行以下代码验证 Session:

```javascript
// 方法 1: 检查 NextAuth Session
fetch('/api/auth/session')
  .then(res => res.json())
  .then(data => console.log('Session:', data));

// 方法 2: 使用 next-auth/react (如果页面已引入)
// import { useSession } from 'next-auth/react';
// const { data: session } = useSession();
```

**预期输出**:
```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "name": "Test User",
    "lurusUserId": 123,
    "role": "free"
  },
  "expires": "2026-03-13T..."
}
```

**验证清单**:
- ✅ `user.id` 存在
- ✅ `user.email` 正确
- ✅ `user.lurusUserId` 是 lurus-api 的用户 ID
- ✅ `expires` 是未来时间（30 天后）

---

## 测试场景 2: 本地账户登录（备用方案）

### 步骤 1: 展开本地登录表单

1. 访问 http://localhost:3000/auth/login
2. 点击"显示本地账户登录（演示）"
3. 表单展开显示邮箱、密码输入框

**预期结果**:
- ✅ 显示邮箱和密码输入框
- ✅ 显示风险声明复选框
- ✅ 显示演示账户信息 (demo@lurus.cn / demo123)

### 步骤 2: 使用本地账户登录

1. 输入邮箱: `demo@lurus.cn`
2. 输入密码: `demo123`
3. 勾选"我已阅读并同意投资风险提示"
4. 点击"使用本地账户登录"

**预期结果**:
- ✅ 登录成功，跳转到 /dashboard
- ✅ Session 中包含本地用户信息（id=1, role=free）

**注意**: 本地账户登录不会设置 lurus-api Session Cookie，仅用于演示和开发测试。

---

## 测试场景 3: 登出流程

### 步骤 1: 点击登出按钮

1. 在 Dashboard 中找到用户菜单或登出按钮
2. 点击"登出"

**预期行为**:
- NextAuth 清除本地 Session Token
- 跳转到登录页

**验证**:
```javascript
// 在 Console 中验证 Session 已清除
fetch('/api/auth/session')
  .then(res => res.json())
  .then(data => console.log('Session after logout:', data));
```

**预期输出**:
```json
{}
```

### 步骤 2: 验证 Cookie 清除

**检查**:
- DevTools → Application → Cookies
- `next-auth.session-token` 应该被删除或过期

**注意**: lurus-api 的 Session Cookie 可能仍然存在（Domain=.lurus.cn），因为它是由 lurus-api 管理的，NextAuth 登出不会清除它。如果需要完全登出，需要调用 lurus-api 的登出接口。

---

## 测试场景 4: Session 自动刷新

### 验证 JWT 刷新机制

**背景**: JWT token 每 30 分钟自动刷新一次，从 lurus-api 获取最新的用户信息。

**测试方法**:
1. 登录后保持浏览器打开
2. 等待 30 分钟（或修改代码将刷新时间改为 1 分钟以加快测试）
3. 观察 Network 标签页

**预期行为**:
- 每 30 分钟，NextAuth 自动向 lurus-api 发送请求:
  ```
  GET https://api.lurus.cn/api/v1/auth/session
  ```
- 请求携带 Cookie
- 如果 lurus-api Session 仍有效，JWT token 更新 `lastRefresh` 时间戳

**验证**:
```javascript
// 在 Console 中检查 JWT 内容（需要解码）
fetch('/api/auth/session')
  .then(res => res.json())
  .then(data => {
    console.log('Session expires:', data.expires);
    console.log('User:', data.user);
  });
```

---

## 测试场景 5: 错误处理

### 场景 A: lurus-api 不可用

**模拟方法**:
1. 停止 lurus-api 服务
2. 点击"使用 Lurus 账户登录"

**预期行为**:
- ✅ 浏览器尝试跳转到 api.lurus.cn
- ❌ 显示浏览器连接错误页面（ERR_NAME_NOT_RESOLVED 或 ERR_CONNECTION_REFUSED）
- 🔧 **改进建议**: 在 redirectToLurusLogin() 前先 ping api.lurus.cn，失败时显示友好提示

### 场景 B: Session Cookie 过期

**模拟方法**:
1. 登录成功后
2. 手动删除 DevTools → Cookies 中的 lurus_api Session Cookie
3. 刷新页面或访问需要认证的 API

**预期行为**:
- NextAuth Session 仍然有效（因为 JWT 策略）
- 但调用 `/api/lurus/*` 时会失败（401 Unauthorized）
- 🔧 **降级方案**: Middleware 检测 Cookie 失效，自动重定向到登录页

### 场景 C: NextAuth Session 过期

**模拟方法**:
1. 等待 30 天（或修改 maxAge 为 1 分钟）
2. 访问需要认证的页面

**预期行为**:
- ✅ NextAuth 检测 Session 过期
- ✅ 自动跳转到 /auth/login
- ✅ URL 包含 callbackUrl 参数

---

## 故障排查清单

### 问题 1: 点击 SSO 登录后无反应

**可能原因**:
- redirectToLurusLogin() 函数有错误
- NEXT_PUBLIC_* 环境变量未定义

**排查步骤**:
1. 打开 Console，检查是否有 JavaScript 错误
2. 在 login/page.tsx 中添加 console.log:
   ```typescript
   const handleSSOLogin = () => {
     console.log('SSO Login clicked');
     console.log('LURUS_API_URL:', process.env.NEXT_PUBLIC_LURUS_API_URL);
     console.log('TENANT_SLUG:', process.env.NEXT_PUBLIC_TENANT_SLUG);
     redirectToLurusLogin(callbackUrl);
   };
   ```
3. 重启 dev server（环境变量更改需要重启）

### 问题 2: OAuth 回调后显示"登录失败"

**可能原因**:
- lurus-api Session Cookie 未设置
- Cookie Domain 不匹配（应该是 .lurus.cn）
- NextAuth 无法访问 lurus-api /api/v1/auth/session

**排查步骤**:
1. 检查 DevTools → Application → Cookies
   - 查找 lurus_api 相关 Cookie
   - 验证 Domain 是否是 `.lurus.cn`
2. 检查 Network → callback 请求
   - 查看请求头是否包含 Cookie
   - 查看响应状态码和错误信息
3. 手动测试 lurus-api Session 接口:
   ```bash
   curl -v https://api.lurus.cn/api/v1/auth/session \
     -H "Cookie: <复制浏览器中的 Cookie>"
   ```

### 问题 3: CORS 错误

**错误信息**:
```
Access to fetch at 'https://api.lurus.cn/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**可能原因**:
- lurus-api CORS 配置未包含 localhost:3000
- AllowCredentials 未设置为 true

**解决方案**:
1. 检查 lurus-api CORS 配置 (internal/adapter/middleware/cors.go):
   ```go
   AllowOrigins: []string{
     "http://localhost:3000",  // 添加这行
     "https://gushen.lurus.cn",
   }
   AllowCredentials: true
   ```
2. 重启 lurus-api

### 问题 4: TypeScript 类型错误

**常见错误**:
- `Property 'lurusUserId' does not exist on type 'User'`
- `Property 'lastRefresh' does not exist on type 'JWT'`

**解决方案**:
- 确认 src/lib/auth/auth.ts 中的类型声明已添加
- 运行 `bun run typecheck` 验证
- 重启 TypeScript Server（VS Code: Cmd+Shift+P → Restart TS Server）

---

## 测试报告模板

**测试日期**: _______________
**测试人员**: _______________
**环境**: ○ 本地开发 ○ 测试环境 ○ 生产环境

### 测试场景 1: SSO 登录流程
- [ ] 登录页面显示正常
- [ ] 点击 SSO 按钮跳转到 api.lurus.cn
- [ ] Zitadel 登录成功
- [ ] 回调到 /auth/callback
- [ ] Session 创建成功
- [ ] 跳转到 Dashboard
- [ ] Cookie (Domain=.lurus.cn) 正确设置

**备注**: _______________

### 测试场景 2: 本地账户登录
- [ ] 本地登录表单展开
- [ ] 演示账户登录成功
- [ ] Session 包含本地用户信息

**备注**: _______________

### 测试场景 3: 登出流程
- [ ] 登出成功
- [ ] Session Token 清除
- [ ] 跳转到登录页

**备注**: _______________

### 测试场景 4: 错误处理
- [ ] lurus-api 不可用时显示错误
- [ ] Session 过期自动跳转登录
- [ ] CORS 错误处理正确

**备注**: _______________

### 发现的问题
1. _______________
2. _______________
3. _______________

### 测试结论
○ 通过 ○ 部分通过 ○ 未通过

**总结**: _______________

---

## 下一步行动

**如果测试通过**:
1. ✅ 标记 Task #8 为 completed
2. 进入 Task #9: 测试计费 API 集成
3. 开始 Phase 2: UI 集成（订阅设置、API Keys 管理）

**如果测试失败**:
1. 记录详细错误日志
2. 根据故障排查清单定位问题
3. 修复代码后重新测试
4. 更新 doc/process.md 记录问题和解决方案
