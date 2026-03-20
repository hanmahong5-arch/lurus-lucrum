# 计费 API 集成测试指南

**测试日期**: 2026-02-11
**测试环境**: 本地开发 + lurus-api 集成

---

## 测试概览

### 测试目标

验证以下功能的正确性:
1. ✅ API 代理路由正确转发请求
2. ✅ NextAuth Session 验证工作正常
3. ✅ React Query Hooks 正确封装 API 调用
4. ✅ 错误处理机制完善（401、503 等）
5. ✅ 数据格式和类型正确

### 测试方法

**方法 1: Web UI 测试** (推荐)
- 访问测试页面: http://localhost:3000/test/billing
- 使用可视化界面测试所有 API
- 查看 React Query 实时数据

**方法 2: curl 命令测试**
- 使用命令行测试各个 API 端点
- 适合自动化和 CI/CD 集成

**方法 3: 浏览器 DevTools**
- 使用 Network 标签查看请求和响应
- Console 中手动调用 fetch API

---

## 前置条件

### 1. 登录状态

**必须先登录才能测试 API**:

```bash
# 访问登录页
http://localhost:3000/auth/login

# 使用本地账户登录
Email: demo@lurus.cn
Password: demo123

# 或等待 lurus-api 就绪后使用 SSO 登录
```

### 2. 获取 Session Cookie

登录成功后，浏览器会自动设置 Session Cookie:
- Cookie 名称: `next-auth.session-token`
- HttpOnly: true
- Path: /
- 用于所有 API 请求的身份验证

### 3. lurus-api 状态检查

```bash
# 检查 lurus-api 健康状态
curl -I https://api.lurus.cn/health

# 检查 V2 API 端点
curl -I https://api.lurus.cn/api/v2/lucrum/billing/plans
```

---

## 测试场景 1: Web UI 测试（推荐）

### 步骤 1: 访问测试页面

1. 确保已登录 (http://localhost:3000/auth/login)
2. 访问测试页面:
   ```
   http://localhost:3000/test/billing
   ```

### 步骤 2: 查看 Session 状态

测试页面顶部显示当前 Session 信息:
- ✅ Authenticated - 已登录
- ❌ Not authenticated - 未登录（需要先登录）

**Session 信息应包含**:
- Email: demo@lurus.cn
- User ID: 1
- Lurus User ID: (来自 lurus-api)
- Role: free

### 步骤 3: 运行自动化测试

点击"Run All Tests"按钮，自动执行以下测试:
1. ✅ Fetch Plans - 获取订阅计划
2. ✅ Fetch Tokens - 获取 API Keys
3. ✅ Fetch Topups - 获取充值历史

**预期结果**:

**场景 A: lurus-api 正常运行**
- 所有测试显示绿色 ✅ 成功图标
- 显示返回的数据（plans、tokens、topups）
- React Query 区域显示实时数据

**场景 B: lurus-api 未运行**
- 测试显示红色 ❌ 错误图标
- 错误信息: "服务暂时不可用，请稍后重试"
- 状态码: 503 Service Unavailable

**场景 C: 未登录**
- 测试显示红色 ❌ 错误图标
- 错误信息: "未授权，请先登录"
- 状态码: 401 Unauthorized

### 步骤 4: 查看 React Query 数据

测试页面中部显示 React Query 实时数据:

**Subscription Plans**:
```json
{
  "plans": [
    {
      "code": "basic",
      "name": "基础版",
      "price": 99,
      "period_days": 30,
      "daily_quota": 10000,
      "total_quota": 300000,
      "features": ["AI 对话", "策略回测"]
    }
  ]
}
```

**API Tokens**:
```json
{
  "tokens": [
    {
      "id": 1,
      "name": "Default Key",
      "key": "sk-xxx...",
      "remain_quota": 100000,
      "used_quota": 500,
      "status": 1,
      "created_time": 1707638400
    }
  ],
  "totalQuota": 100000,
  "totalUsedQuota": 500
}
```

### 步骤 5: 测试创建 API Key

1. 点击"Test Create Key"按钮
2. 系统会创建一个测试 API Key (名称: Test Key <timestamp>)

**预期结果**:
- ✅ API key created successfully
- 返回新创建的 Key 信息
- React Query 自动刷新，显示新 Key

**注意**: 此操作会在 lurus-api 中创建真实数据，测试后可能需要清理。

---

## 测试场景 2: curl 命令测试

### 前提: 获取 Session Cookie

```bash
# 1. 登录获取 Cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@lurus.cn","password":"demo123"}'

# 2. 查看 Cookie 文件
cat cookies.txt
```

### 测试 1: 获取订阅计划

```bash
curl -b cookies.txt -v http://localhost:3000/api/lurus/billing/plans
```

**预期响应 (成功)**:
```json
{
  "success": true,
  "data": [
    {
      "code": "basic",
      "name": "基础版",
      "price": 99,
      "period_days": 30,
      "daily_quota": 10000,
      "total_quota": 300000,
      "features": ["AI 对话", "策略回测"]
    }
  ]
}
```

**预期响应 (lurus-api 不可用)**:
```json
{
  "success": false,
  "error": "服务暂时不可用，请稍后重试",
  "message": "fetch failed"
}
```
Status: 503

**预期响应 (未登录)**:
```json
{
  "success": false,
  "error": "未授权，请先登录"
}
```
Status: 401

### 测试 2: 获取 API Tokens

```bash
curl -b cookies.txt -v "http://localhost:3000/api/lurus/tokens?page=1&page_size=10"
```

**预期响应 (成功)**:
```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "id": 1,
        "name": "Default Key",
        "key": "sk-xxx...",
        "remain_quota": 100000,
        "used_quota": 500,
        "unlimited_quota": false,
        "status": 1,
        "created_time": 1707638400
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 10
  }
}
```

### 测试 3: 创建 API Key

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/lurus/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test API Key",
    "remain_quota": 100000,
    "unlimited_quota": false,
    "expired_time": -1,
    "group": "lucrum"
  }'
```

**预期响应 (成功)**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Test API Key",
    "key": "sk-abc123...",
    "remain_quota": 100000,
    "used_quota": 0,
    "status": 1,
    "created_time": 1707638500
  }
}
```

### 测试 4: 删除 API Key

```bash
curl -b cookies.txt -X DELETE http://localhost:3000/api/lurus/tokens/2
```

**预期响应 (成功)**:
```json
{
  "success": true,
  "message": "Token deleted successfully"
}
```

### 测试 5: 获取充值历史

```bash
curl -b cookies.txt -v "http://localhost:3000/api/lurus/billing/topups?page=1&page_size=10"
```

**预期响应 (成功)**:
```json
{
  "success": true,
  "data": {
    "topups": [
      {
        "id": 1,
        "trade_no": "TOP20260211001",
        "amount": 10000,
        "money": 100,
        "payment_method": "alipay",
        "status": "paid",
        "created_time": 1707638400
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 10
  }
}
```

### 测试 6: 创建充值订单

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/lurus/billing/topup \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "payment_method": "alipay",
    "money": 100,
    "currency": "CNY"
  }'
```

**预期响应 (成功)**:
```json
{
  "success": true,
  "data": {
    "trade_no": "TOP20260211002",
    "amount": 10000,
    "money": 100,
    "payment_method": "alipay",
    "status": "pending",
    "created_time": 1707638500
  }
}
```

---

## 测试场景 3: 浏览器 DevTools 测试

### 步骤 1: 打开 DevTools

1. 访问任意页面（需要先登录）
2. 按 F12 打开 DevTools
3. 切换到 Console 标签

### 步骤 2: 手动调用 API

```javascript
// 测试 1: 获取订阅计划
fetch('/api/lurus/billing/plans')
  .then(res => res.json())
  .then(data => console.log('Plans:', data));

// 测试 2: 获取 API Tokens
fetch('/api/lurus/tokens?page=1&page_size=10')
  .then(res => res.json())
  .then(data => console.log('Tokens:', data));

// 测试 3: 创建 API Key
fetch('/api/lurus/tokens', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Console Test Key',
    remain_quota: 50000
  })
})
  .then(res => res.json())
  .then(data => console.log('Created Key:', data));

// 测试 4: 获取充值历史
fetch('/api/lurus/billing/topups?page=1&page_size=10')
  .then(res => res.json())
  .then(data => console.log('Topups:', data));

// 测试 5: 测试未授权访问（会失败）
fetch('/api/lurus/billing/plans', { credentials: 'omit' })
  .then(res => res.json())
  .then(data => console.log('Unauthorized:', data))
  .catch(err => console.error('Expected error:', err));
```

### 步骤 3: 查看 Network 请求

1. 切换到 Network 标签
2. 执行上述 API 调用
3. 观察请求和响应

**检查项**:
- ✅ Request URL: 正确指向 /api/lurus/*
- ✅ Request Method: GET/POST/DELETE
- ✅ Request Headers: 包含 Cookie
- ✅ Response Status: 200 (成功) / 401 (未授权) / 503 (服务不可用)
- ✅ Response Body: JSON 格式正确

---

## 错误处理测试

### 测试 1: 未登录访问

**步骤**:
1. 登出 (如果已登录)
2. 尝试访问 API

```bash
curl -v http://localhost:3000/api/lurus/billing/plans
```

**预期**:
- Status: 401 Unauthorized
- Response:
  ```json
  {
    "success": false,
    "error": "未授权，请先登录"
  }
  ```

### 测试 2: lurus-api 不可用

**步骤**:
1. 确保 lurus-api 未运行或不可达
2. 尝试访问 API

**预期**:
- Status: 503 Service Unavailable
- Response:
  ```json
  {
    "success": false,
    "error": "服务暂时不可用，请稍后重试",
    "message": "fetch failed"
  }
  ```

### 测试 3: 无效请求参数

```bash
# 创建 API Key 但缺少必要参数
curl -b cookies.txt -X POST http://localhost:3000/api/lurus/tokens \
  -H "Content-Type: application/json" \
  -d '{}'
```

**预期**:
- Status: 400 Bad Request 或 lurus-api 返回的错误状态
- Response: 包含具体错误信息

### 测试 4: 删除不存在的资源

```bash
# 删除不存在的 Token
curl -b cookies.txt -X DELETE http://localhost:3000/api/lurus/tokens/999999
```

**预期**:
- Status: 404 Not Found 或 lurus-api 返回的错误状态
- Response: 包含错误信息

---

## React Query Hooks 验证

### useBilling Hook

**测试文件**: `src/hooks/useBilling.ts`

**功能验证**:
```typescript
// 在测试页面或组件中
import { useBilling } from '@/hooks/useBilling';

function TestComponent() {
  const {
    plans,           // 订阅计划列表
    plansLoading,    // 加载状态
    plansError,      // 错误信息
    topups,          // 充值历史
    topupsLoading,
    topupsError,
    createTopup,     // 创建充值订单 (Mutation)
    initiatePayment, // 发起支付 (Mutation)
  } = useBilling();

  // 验证数据格式
  console.log('Plans:', plans);
  console.log('Topups:', topups);

  // 测试创建订单
  const handleCreateTopup = async () => {
    try {
      const result = await createTopup.mutateAsync({
        amount: 10000,
        payment_method: 'alipay'
      });
      console.log('Topup created:', result);
    } catch (error) {
      console.error('Failed to create topup:', error);
    }
  };
}
```

**验证清单**:
- [ ] plans 数据格式正确 (SubscriptionPlan[])
- [ ] topups 数据格式正确 (TopupOrder[])
- [ ] plansLoading 状态正确切换 (true → false)
- [ ] 错误时 plansError 包含错误信息
- [ ] createTopup mutation 成功后自动 invalidate topups query
- [ ] React Query 缓存正常工作

### useApiKeys Hook

**测试文件**: `src/hooks/useApiKeys.ts`

**功能验证**:
```typescript
import { useApiKeys } from '@/hooks/useApiKeys';

function TestComponent() {
  const {
    tokens,          // API Keys 列表
    totalQuota,      // 总配额
    totalUsedQuota,  // 已用配额
    isLoading,
    error,
    createKey,       // 创建 Key (Mutation)
    deleteKey,       // 删除 Key (Mutation)
    updateKey,       // 更新 Key (Mutation)
  } = useApiKeys();

  console.log('Tokens:', tokens);
  console.log('Total Quota:', totalQuota);

  // 测试创建 Key
  const handleCreateKey = async () => {
    try {
      const result = await createKey.mutateAsync({
        name: 'Test Key',
        quota: 100000
      });
      console.log('Key created:', result);
    } catch (error) {
      console.error('Failed to create key:', error);
    }
  };

  // 测试删除 Key
  const handleDeleteKey = async (id: number) => {
    try {
      await deleteKey.mutateAsync(id);
      console.log('Key deleted');
    } catch (error) {
      console.error('Failed to delete key:', error);
    }
  };
}
```

**验证清单**:
- [ ] tokens 数据格式正确 (ApiKey[])
- [ ] totalQuota 计算正确 (sum of remain_quota)
- [ ] totalUsedQuota 计算正确 (sum of used_quota)
- [ ] createKey mutation 成功后自动 invalidate tokens query
- [ ] deleteKey mutation 成功后自动刷新列表
- [ ] 错误处理正确显示错误信息

---

## 性能和缓存测试

### React Query 缓存验证

**测试步骤**:
1. 访问测试页面，首次加载数据
2. 切换到其他页面
3. 返回测试页面

**预期**:
- 首次加载时显示 loading 状态
- 再次访问时立即显示缓存数据（无 loading）
- 后台自动刷新数据（staleTime 后）

### 网络请求优化

**检查 Network 标签**:
- [ ] 相同的请求不会重复发送（React Query 自动去重）
- [ ] Mutation 后自动刷新相关 Query
- [ ] 请求失败后有重试机制（React Query 默认重试 3 次）

---

## 集成测试清单

### API 代理路由测试

- [ ] `/api/lurus/billing/plans` - GET 正确转发到 lurus-api
- [ ] `/api/lurus/tokens` - GET 正确转发
- [ ] `/api/lurus/tokens` - POST 正确转发
- [ ] `/api/lurus/tokens/:id` - DELETE 正确转发
- [ ] `/api/lurus/billing/topups` - GET 正确转发
- [ ] `/api/lurus/billing/topup` - POST 正确转发
- [ ] 所有请求自动携带 Session Cookie
- [ ] 查询参数正确转发 (page, page_size)
- [ ] Request Body 正确转发 (POST/PUT)

### 认证和授权测试

- [ ] 未登录访问返回 401
- [ ] 已登录访问返回正常数据
- [ ] Session 过期自动跳转登录页
- [ ] Cookie 正确设置和发送

### 错误处理测试

- [ ] lurus-api 不可用返回 503
- [ ] 网络超时返回友好错误
- [ ] 无效参数返回 400 (或 lurus-api 错误)
- [ ] 资源不存在返回 404 (或 lurus-api 错误)
- [ ] 所有错误包含可操作的错误信息

### React Query 集成测试

- [ ] useBilling Hook 数据加载正常
- [ ] useApiKeys Hook 数据加载正常
- [ ] Mutation 成功后自动刷新相关 Query
- [ ] 缓存机制正常工作
- [ ] Loading 和 Error 状态正确显示

---

## 故障排查

### 问题 1: 401 Unauthorized

**可能原因**:
- 未登录或 Session 过期
- Cookie 未正确发送

**排查步骤**:
1. 检查是否已登录: 访问 /api/auth/session
2. 检查 Cookie: DevTools → Application → Cookies
3. 确认 Cookie 名称: `next-auth.session-token`

**解决方案**:
- 重新登录
- 清除浏览器 Cookie 后重新登录

### 问题 2: 503 Service Unavailable

**可能原因**:
- lurus-api 未运行
- 网络连接问题
- lurus-api 地址配置错误

**排查步骤**:
1. 检查 .env.local 中的 LURUS_API_URL
2. 测试 lurus-api 健康: `curl https://api.lurus.cn/health`
3. 检查 lurus-api 日志

**解决方案**:
- 启动 lurus-api 服务
- 修正 LURUS_API_URL 配置
- 检查网络和防火墙设置

### 问题 3: CORS 错误

**错误信息**:
```
Access to fetch at 'https://api.lurus.cn/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**可能原因**:
- lurus-api CORS 未包含 localhost:3000
- AllowCredentials 未设置

**解决方案**:
在 lurus-api 配置 CORS:
```go
AllowOrigins: []string{
  "http://localhost:3000",
  "https://lucrum.lurus.cn",
}
AllowCredentials: true
```

### 问题 4: React Query 不自动刷新

**可能原因**:
- QueryClient 未正确配置
- Mutation 后未调用 invalidateQueries

**排查步骤**:
1. 检查 src/hooks/useBilling.ts 中的 onSuccess 回调
2. 确认 queryClient.invalidateQueries 调用正确

**解决方案**:
```typescript
const createKey = useMutation({
  mutationFn: async (params) => { /* ... */ },
  onSuccess: () => {
    // 确保调用 invalidate
    queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  }
});
```

---

## 测试报告模板

**测试日期**: _______________
**测试人员**: _______________
**环境**: ○ 本地开发 ○ 测试环境 ○ 生产环境

### 测试结果汇总

| API 端点 | 方法 | 状态 | 备注 |
|---------|------|------|------|
| /api/lurus/billing/plans | GET | ○ 通过 ○ 失败 | |
| /api/lurus/tokens | GET | ○ 通过 ○ 失败 | |
| /api/lurus/tokens | POST | ○ 通过 ○ 失败 | |
| /api/lurus/tokens/:id | DELETE | ○ 通过 ○ 失败 | |
| /api/lurus/billing/topups | GET | ○ 通过 ○ 失败 | |
| /api/lurus/billing/topup | POST | ○ 通过 ○ 失败 | |

### React Query Hooks

| Hook | 状态 | 备注 |
|------|------|------|
| useBilling | ○ 通过 ○ 失败 | |
| useApiKeys | ○ 通过 ○ 失败 | |

### 错误处理

| 场景 | 状态 | 备注 |
|------|------|------|
| 未登录访问 (401) | ○ 通过 ○ 失败 | |
| 服务不可用 (503) | ○ 通过 ○ 失败 | |
| 无效参数 | ○ 通过 ○ 失败 | |

### 发现的问题

1. _______________
2. _______________
3. _______________

### 测试结论

○ 全部通过 ○ 部分通过 ○ 未通过

**总结**: _______________

---

## 下一步行动

**测试通过后**:
1. ✅ 标记 Task #9 为 completed
2. 开始 Phase 2: UI 集成
   - 订阅设置页面
   - API Keys 管理界面
   - 用户中心改造
3. 准备生产环境部署

**测试失败时**:
1. 记录详细错误日志和截图
2. 根据故障排查指南定位问题
3. 修复代码后重新测试
4. 更新 doc/process.md 记录问题和解决方案
