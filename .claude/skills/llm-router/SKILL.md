---
name: llm-router
description: "Lucrum 的 LLM 路由模块 (`src/lib/llm/`)：三档 task class、统一走公司 newapi gateway、自动 fallback、telemetry、DeepSeek V4 reasoning_content 处理。当用户改 advisor/agent/strategy-generator 任何 LLM 调用、调模型选型、轮转 newapi token、或追加新 LLM 端点时自动启用。"
---

# Lucrum LLM Router

**目的**: 统一 lucrum-web 所有 LLM 出口，按任务难度自动选 DeepSeek 模型，集中 telemetry/fallback/key 管理。所有"我要调一个 LLM"都走 `@/lib/llm`，**禁止**直接 `new ChatOpenAI(...)` 或 `fetch('https://...api.../v1/chat/completions')`。

## 1. 三档 task class

```
routine    → deepseek-chat        | 1024 tok | 30s | 短/结构化/低风险
analytic   → deepseek-v4-pro      | 8192 tok | 90s | 多步散文 + 领域知识
reasoning  → deepseek-reasoner    | 16384 tok| 240s| 显式 chain-of-thought
```

新增 task class 的门槛：现有三档无法表达任务的认知负荷时才加。**严禁**为每个 feature 起一个 class。class 命名只反映"思考量"，不反映 feature。

## 2. 关键 API

```typescript
import { getChatModel, chatComplete, streamChat } from '@/lib/llm';

// LangChain agents (LangGraph state machines)
const llm = getChatModel('analytic', { temperature: 0.3, streaming: true });

// 一次性 completion (raw fetch sites)
const out = await chatComplete('routine', messages, { maxTokens: 1024 });
//   → { content, model, totalTokens, fallbackUsed }

// SSE 流转发 (advisor/chat 等)
const res = await streamChat('analytic', messages);
return new Response(res.body?.pipeThrough(myTransform), { ... });
```

## 3. Fallback 链

```
reasoning  ──fail──▶  analytic  ──fail──▶  routine  ──fail──▶  throw
```

设计意图：重型模型抖动不直接 500，自动降级到次级。Telemetry 里 `fallbackUsed:true` 说明发生了降级，在监控面板里需要可视化。

## 4. DeepSeek V4 / Reasoner 的特殊行为（**踩过的坑**）

V4-pro / reasoner 会先输出 `reasoning_content`（内部独白），再输出 `content`（用户答案）。**max_tokens 给小了 → reasoning_content 把预算吃光 → content 为空**：

```json
{"choices":[{"message":{"content":"","reasoning_content":"..."},
             "finish_reason":"length"}]}
```

router 的修复：
- `extractContent()` 在 `content` 为空时 fallback 到 `reasoning_content`
- TASK_PROFILES 里 analytic/reasoning 给的预算分别是 8K/16K，留足空间
- 调用方 override `maxTokens` 时**不要**降到 < 1024，否则即便 fallback 也只能拿到半截思考

`deepseek-chat` 是 newapi 提供的"无 reasoning_content 直答"别名，等价于 V4-flash 的快速模式。**routine class 永远用这个别名**，不要换成 `deepseek-v4-flash`，因为 flash 默认带 CoT。

## 5. Telemetry

每次 `chatComplete` / `streamChat` 调用产生一行 JSON：

```json
{"kind":"llm.call","ts":"2026-04-27T08:17:16Z",
 "taskClass":"analytic","modelRequested":"deepseek-v4-pro",
 "modelActual":"deepseek-v4-pro","latencyMs":5623,
 "promptTokens":13,"completionTokens":145,"totalTokens":158,
 "success":true,"error":null,"fallbackUsed":false}
```

落 stdout，被 K8s/Loki 直接采集。在 lucrum-monitoring 加面板筛 `kind=llm.call` 可以看：
- 各 class 的 P50/P99 延迟
- fallback 频率（重型模型健康度）
- 每 class 的 token 用量趋势（对账 newapi 计费）

## 6. Gateway 配置

- 默认 `LLM_API_BASE = https://newapi.lurus.cn/v1`（Lurus 公司 newapi）
- token 在 `newapi` DB 的 `tokens` 表，`name='lucrum-router'`，user_id=1，unlimited_quota=true
- legacy fallback 链：`LLM_API_KEY` → `DEEPSEEK_API_KEY` → `LURUS_API_KEY`（迁移期兼容，下一次稳定 deploy 后可删 legacy）
- 模型可换：`LLM_MODEL_ROUTINE=glm-4-plus` 等 env 即可 A/B，无需改代码

## 7. Token rotation

```bash
# 在 R1 newapi DB 里
ssh root@100.98.57.55 "kubectl exec -n database lurus-pg-1 -- psql -U postgres -d newapi -c \
  \"UPDATE tokens SET status=2 WHERE name='lucrum-router';\""
# 然后生成新 token (48 字符 base62) 并 INSERT 一条新记录:
TOKEN=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 48)
ssh root@100.98.57.55 "kubectl exec -n database lurus-pg-1 -- psql -U postgres -d newapi -c \
  \"INSERT INTO tokens (user_id,key,status,name,created_time,expired_time,unlimited_quota,tenant_id,identity_account_id) \
    VALUES (1,'$TOKEN',1,'lucrum-router',extract(epoch from now())::bigint,-1,true,'default',0);\""
echo $TOKEN
# 把 token 写进 R6 lucrum-secrets
ssh root@100.122.83.20 "kubectl -n lucrum patch secret lucrum-secrets --type=json \
  -p='[{\"op\":\"replace\",\"path\":\"/data/LLM_API_KEY\",\"value\":\"$(echo -n $TOKEN | base64 -w0)\"}]'"
ssh root@100.122.83.20 "kubectl -n lucrum rollout restart deploy/lucrum-web"
```

## 8. Smoke check

每次 token 轮转、newapi 升级、router 改动后：

```bash
LLM_API_KEY=<token> bun run lucrum-web/scripts/smoke-llm-router.ts
```

输出三档 class 的 round-trip + 模型实际 + token 用量。任一失败立刻退非零。

## 9. 已知 newapi side issue

`deepseek-reasoner` 在当前 newapi channel 配置下被 alias 到 `deepseek-v4-flash`（看 telemetry 里 modelActual）。这是 newapi 后台 channel 路由配置，不是 router bug。要让 reasoning class 真正走 R1 时，去 `https://newapi.lurus.cn/console` 加一个 deepseek-reasoner → 真实 endpoint 的 channel。

## 10. 扩展本 Skill

- 新 task class → §1 加一行 + 在 `config.ts` 加 profile + 写测试
- 新 gateway provider（不是 OpenAI 兼容） → router 抽 provider 接口，不要在 `chatComplete` 里塞特殊分支
- 新 telemetry 字段 → 改 `LlmCallTelemetry` + `emitLlmTelemetry`，注意 Loki 采集字段是否需要更新
