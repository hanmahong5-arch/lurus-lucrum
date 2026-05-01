---
name: llm-router
description: "Lucrum 的 LLM 路由模块 (`src/lib/llm/`)：三档 task class、统一走公司 newapi gateway、自动 fallback、telemetry、DeepSeek V4 reasoning_content 处理。当用户改 advisor/agent/strategy-generator 任何 LLM 调用、调模型选型、轮转 newapi token、或追加新 LLM 端点时自动启用。"
---

# Lucrum LLM Router

**目的**: 统一 lucrum-web 所有 LLM 出口，按任务难度自动选 DeepSeek 模型，集中 telemetry/fallback/key 管理。所有"我要调一个 LLM"都走 `@/lib/llm`，**禁止**直接 `new ChatOpenAI(...)` 或 `fetch('https://...api.../v1/chat/completions')`。

## 1. 三档 task class

```
routine    → deepseek-chat (newapi 当前 alias 到 v4-flash 无 CoT) | 1024 tok | 30s | 短/结构化/低风险
analytic   → deepseek-v4-pro                                       | 8192 tok | 90s | 多步散文 + 领域知识 (CoT-heavy)
reasoning  → deepseek-reasoner                                     | 16384 tok| 240s| 显式 chain-of-thought
```

**怎么选**（被 2026-05-01 strategy/generate 事故打脸后定的硬规则）:
- 输出**长度有上限** + **结构固定**（≤5K 字符代码 / SQL / JSON / 模板填充） → **routine**
- 需要**多步推理 + 散文解释 + 领域权衡**（投资分析、长决策） → analytic
- 显式 CoT 必要（数学证明 / 反事实） → reasoning
- 拿不准 → 先用 routine 跑一次测延迟和输出完整性。analytic/reasoning 配错位会立刻表现为"慢 + 被截断"（见 §4）

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

V4-pro / reasoner 会先输出 `reasoning_content`（内部独白），再输出 `content`（用户答案）。**max_tokens 给小了 → reasoning_content 把预算吃光 → content 为空**或**截断在方法体中**：

```json
{"choices":[{"message":{"content":"","reasoning_content":"..."},
             "finish_reason":"length"}]}
```

router 的修复：
- `extractContent()` 在 `content` 为空时 fallback 到 `reasoning_content`
- TASK_PROFILES 里 analytic/reasoning 给的预算分别是 8K/16K，留足空间
- 调用方 override `maxTokens` 时**不要**降到 < 1024，否则即便 fallback 也只能拿到半截思考（floor 已在 §8.7 强制）

**`deepseek-chat` alias 真相（2026-05-01 当前 newapi channel 配置）**：alias 到 `deepseek-v4-flash`，但**当前 channel 配置下不带 CoT**——直答模式。in-pod A/B 实测同 prompt：
- analytic / v4-pro: 65s，1.4K 字符（被 maxTokens=2000 截断在 method 内）
- routine / v4-flash: 25s，6.4K 字符（完整收尾）

如果未来 newapi channel 配置改了让 `deepseek-chat` 路由到 CoT 后端，routine 的延迟和截断会同时变差——这是回归信号。监控 `kind:"llm.call",caller:"strategy.generate"` 的 latencyMs 分布，如果 P50 突然从 ~25s 涨到 ~50s，先去 newapi console 看 channel routing。

## 4.x 模板化代码生成 → routine（**2026-05-01 加固**）

`/api/strategy/generate` 之前用 `analytic` 是把"代码生成"当成"需要思考的复杂任务"——错。VeighNa CtaTemplate 是**模板填充**：参数定义 / on_bar / on_trade / on_stop_order，结构在系统 prompt 里就钉死了。模型不需要 CoT 来"想清楚要写什么"，CoT 只会浪费预算到内部独白上。

**经验法则**：
- 代码 / SQL / 配置文件 / JSON / Markdown 表格——任何**形态固定**的结构化输出，先用 routine
- 投资分析 / 报告 / 多步推理散文——用 analytic
- 数学证明 / 反事实——用 reasoning

只要 prompt 里能用 system message 把"输出结构"约束死，就归 routine。让模型选择"先思考再输出"的自由度只能在结构松散时才有价值。

## 5. Telemetry

每次 `chatComplete` / `streamChat` / 任何 `getChatModel` 返回的 LangChain 调用产生一行 JSON：

```json
{"kind":"llm.call","ts":"2026-04-27T08:17:16Z",
 "taskClass":"analytic","modelRequested":"deepseek-v4-pro",
 "modelActual":"deepseek-v4-pro","latencyMs":5623,
 "promptTokens":13,"completionTokens":145,"totalTokens":158,
 "success":true,"cancelled":false,"error":null,
 "fallbackUsed":false,"maxTokensFloored":false,
 "caller":"advisor.chat:diagnose"}
```

落 stdout，被 K8s/Loki 直接采集。在 lucrum-monitoring 加面板筛 `kind=llm.call` 可以看：
- 各 class 的 P50/P99 延迟
- fallback 频率（重型模型健康度）
- 每 class 的 token 用量趋势（对账 newapi 计费）
- 按 `caller` 切分的归因（哪个 UI surface 在花钱、哪个 graph 节点最慢）

**streamChat 的 token 用量**：`stream_options.include_usage:true` 让 newapi 在 `[DONE]` 之前发一个 `usage:{...}` 帧，router 在透传字节的同时 sniff 这一帧，写进 telemetry。如果上游（某些 channel）忽略 `include_usage`，token 字段为 `null`，但 success/cancelled/latency 仍然准确 —— 数清"调了多少次"的成本归因不依赖 token。

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

## 8.5 Cancellation 契约（**2026-04-30 加固**）

**问题**: `streamChat` 之前没接 caller signal — 用户关 tab 后，upstream newapi 还会跑到自身 STREAMING_TIMEOUT (300s) 才停，这 5 分钟全是无人读的 token，是真钱。`chatComplete` 同理。

**契约**:
- `ModelOverrides.signal?: AbortSignal` 现在是一等公民
- API route 调用时**必须**传 `request.signal`：
  ```typescript
  await chatComplete('analytic', msgs, { signal: request.signal });
  await streamChat('analytic', msgs, { signal: request.signal });
  ```
- caller signal abort → fetch socket 立即关 → newapi 端见到 client disconnect → 停止 generation
- 抛出 `LlmCancelledError`（区别于 fetch 错误），调用方 catch 时:
  ```typescript
  if (err instanceof LlmCancelledError) {
    return new NextResponse(null, { status: 499 }); // nginx convention
  }
  ```
- **重要**: cancel 时**不**走 fallback 链。理由：用户已经走了，再降级到便宜模型只会多烧 token，没人读。这是 router 的硬规则。
- Telemetry 里 `cancelled:true, error:null, success:false`。监控 error rate 应过滤 `cancelled=false` 否则关 tab 高峰会显假错误。

**未覆盖**: `getChatModel` (LangChain ChatOpenAI) 暂不接 signal — 因为 LangGraph 的 stateful 流转里一个 graph 通常会发起多个 LLM 调用，逐个 abort 是 graph 层的责任，不是 router 的。如果未来 agent 路径长得离谱，再考虑 graph-level cancellation。

## 8.6 SSE 流错误翻译（**2026-04-30 加固**）

**问题**: 之前 `/api/advisor/chat` 直接 `pipeThrough(TransformStream)`，三个坑:
1. 跨 chunk 切的 `data: {…}` JSON.parse 失败被静默吞掉，丢字
2. newapi 流到一半 `data: {"error":...}` 时 UI 看不到错误，假死
3. upstream socket 在 `[DONE]` 之前断了，UI 当成"答完了"显示半截答案

**方案**: `src/lib/llm/sse-transform.ts` 做统一翻译层。下游协议:
```
data: {"content":"…"}\n\n          (token 流)
data: {"error":{code,title,description,severity,recoveryActions}}\n\n   (终止错误)
data: [DONE]\n\n                    (干净结束)
```

`error` payload 形状跟 JSON-route error 一模一样，UI 可以共用 banner 渲染。

**关键判断**:
- upstream 的 `data:` JSON 里有 `error` 字段 → 翻译为 `ADVISOR_STREAM_GATEWAY` 错误帧并立即关流
- upstream 流断没 `[DONE]` → 翻译为 `ADVISOR_STREAM_TRUNCATED`
- upstream `controller.error()` (socket 断) → 翻译为 `ADVISOR_STREAM_IO`
- caller signal 已 abort → 静默关流（no error frame，因为 UI 已经走了，发也没人看）

**UI 端**: `src/hooks/use-streaming-chat.ts` 现在认 `parsed.error`：
- 见到 `error` 字段 → 不把 partial response 当 message 存（误导用户）→ setError + onError
- 流结束没 `sawDone` 也没 error → console.warn，可能是网络层 truncation
- 完全没内容、没 done、没 error → 显式报"AI 未返回响应"

**测试**: `sse-transform.test.ts` 8 个 case 覆盖 cross-chunk buffer / mid-stream error / truncation / IO error / pre-aborted / `data:` 无空格变体 / 非-data 行忽略。

## 8.7 maxTokens 守门员（**2026-04-30 加固**）

§4 提到的 V4 reasoning_content 吃光预算的坑，之前只在 skill 里口头警告。现在 router 强制：

| Class | default maxTokens | minMaxTokens (floor) |
|-------|------:|------:|
| routine | 1024 | 64 |
| analytic | 8192 | 1024 |
| reasoning | 16384 | 1024 |

**行为**: 调用者 override `maxTokens` 低于 floor 时:
- 自动上调到 floor（不抛错，避免一个粗心覆盖把 route 打挂）
- `console.warn` 一次，附带 hint："想要快/便宜，用 `taskClass='routine'`"
- Telemetry 加 `maxTokensFloored:true`，监控可以 grep `maxTokensFloored=true` 找出被默默修过的调用

**设计取舍**: 抛错 vs warn-floor。选 warn-floor 是因为：
- 抛错: 一次粗心修改让上线挂了，UI 收到 502
- warn-floor: 调用 OK，监控能发现，开发后续修

NaN / 负数 / Infinity 一律视作 < floor。

**未覆盖**: routine class 的 minMaxTokens=64 偏低，理论上 64 token 也能触发尾部截断。但 routine 是 deepseek-chat 直答模式无 CoT，截断的就是用户答案本身，不会出现"内部独白把预算吃光"的现象，可接受。

## 8.8 Caller telemetry（**2026-04-30 加固**）

之前 `kind:"llm.call"` 日志只能告诉你"哪个 task class 在烧 token"，不能告诉你"哪个**route**在烧"。新增 `caller` 字段闭这个口子。

**调用方式**:
```typescript
chatComplete('analytic', msgs, {
  ...,
  caller: 'advisor.chat:diagnose',   // 命名约定: <feature>.<route>[:<sub-mode>]
});
```

**已布点**（含 LangChain agents — 见 §8.9）:
| Caller string | 描述 |
|--|--|
| `advisor.chat:quick\|deep\|debate\|diagnose` | 顾问对话四种模式 |
| `advisor.debate:argument:bull\|bear` | 多空辩论分论点 |
| `advisor.debate:conclusion` | 主持人结论 |
| `strategy.generate` | 策略代码生成 |
| `agent.backtest:parseIntent\|analyzeResult` | 回测 agent 两个 LLM 节点 |
| `agent.scanner:insights` | 扫描 agent 排名洞察 |
| `agent.custom:insights` | 自定义 agent 多标的对比洞察 |
| `advisor.graph:quickAnalyst\|deepAnalyst\|bullResearcher\|bearResearcher\|moderator` | LangGraph 多 agent 顾问图，按节点分别归因 |

**最快用法 — 产品化的 spend-report CLI**:
```bash
# 默认 R6 / 最近 1h / 按 caller 分桶
./scripts/llm-spend-report.sh

# 最近 24h 按 graph 节点分组
SINCE=24h GROUP=caller ./scripts/llm-spend-report.sh

# 仅看 advisor.* 流量
FILTER=advisor ./scripts/llm-spend-report.sh

# 看 fallback 流向（哪个 modelActual 在分担流量）
GROUP=modelActual ./scripts/llm-spend-report.sh

# JSON 输出，喂给其他工具
FORMAT=json ./scripts/llm-spend-report.sh | jq .
```

**输出列**: `cnt / ok / cncl / err / fb / tokens / p50ms / p95ms`，按 token 量降序排，TOTAL 行带 success/cancel/err/fallback 比例。

**手动 jq 一行式**（脚本不可用时备用）:
```bash
ssh root@100.122.83.20 "kubectl -n lucrum logs deploy/lucrum-web --tail=10000 | \
  grep 'kind\":\"llm.call' | jq -r 'select(.success) | [.caller, .totalTokens] | @tsv' | \
  awk '{a[$1]+=$2} END{for (k in a) print a[k], k}' | sort -rn"
```

## 8.9 LangChain agents 已纳入 router 契约（**2026-04-30 加固**）

之前 `getChatModel` 返回的是裸 `ChatOpenAI`，LangGraph 节点的调用绕过 router 的 telemetry / cancel / floor / caller 四套契约 —— 是 router 最大的盲区。新增 `RouterAwareChatOpenAI` 子类填掉。

**实现位置**: `src/lib/llm/router-aware-chat-model.ts`

**子类的覆盖范围**:
- `_generate`：success/error/cancel 三态都 emit telemetry（同 `chatComplete` 一份 schema），sticky `caller` / `taskClass` / `maxTokensFloored` 在构造期固定
- `_streamResponseChunks`：流式同上，最终 chunk 的 tokenUsage 进入 telemetry
- AbortSignal：`options.signal`（来自 RunnableConfig）pre-check + 中途异常→`LlmCancelledError`，识别基于 `signal.aborted` + `error.name === 'AbortError'` + 消息正则
- maxTokens floor：在 `getChatModel` 里和 `chatComplete` 共用 `resolveProfile`，已经统一

**调用约定**:
```typescript
const llm = getChatModel('analytic', { temperature: 0.7, caller: 'agent.scanner:insights' });
const out = await llm.invoke([...], { signal: request.signal });  // signal 走 RunnableConfig
```

**故意不做**：跨 task class fallback（analytic→routine on failure）。LangChain 自己有 retry，graph 节点对 LLM 失败有自己的 state 处理；router 在这层做 fallback 会让 graph 状态机出现不可预测分支。要 fallback 用 `chatComplete` 直接调。

**测试**: `src/lib/llm/__tests__/router-aware-chat-model.test.ts`（10 例）—— 通过 `vi.spyOn(ChatOpenAI.prototype, '_generate')` 把 super 调用打桩，覆盖成功/失败/pre-cancel/mid-cancel/timeout-非-cancel 五种路径。

## 9. 已知 newapi side issue

`deepseek-reasoner` 在当前 newapi channel 配置下被 alias 到 `deepseek-v4-flash`（看 telemetry 里 modelActual）。这是 newapi 后台 channel 路由配置，不是 router bug。要让 reasoning class 真正走 R1 时，去 `https://newapi.lurus.cn/console` 加一个 deepseek-reasoner → 真实 endpoint 的 channel。

## 10. 扩展本 Skill

- 新 task class → §1 加一行 + 在 `config.ts` 加 profile + 写测试
- 新 gateway provider（不是 OpenAI 兼容） → router 抽 provider 接口，不要在 `chatComplete` 里塞特殊分支
- 新 telemetry 字段 → 改 `LlmCallTelemetry` + `emitLlmTelemetry`，注意 Loki 采集字段是否需要更新
