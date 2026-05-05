/**
 * Shared helpers for /api/strategy/generate routes.
 *
 * Extracted from the original JSON route so the streaming variant can reuse
 * the exact same prompt + cache-key shape — accidentally diverging would
 * cause cache misses across transports and double-bill the LLM.
 *
 * @module lib/strategy/generate-shared
 */

import { createHash } from 'crypto';

/**
 * System prompt for VeighNa CTA strategy code generation.
 *
 * Bilingual on purpose: the model emits CN comments in code, and the EN
 * mirror keeps anglo-trained checkpoints from drifting on terminology.
 */
export const STRATEGY_SYSTEM_PROMPT = `你是一个专业的量化交易策略开发专家，精通 VeighNa 量化交易框架。
你的任务是根据用户的自然语言描述，生成可执行的 VeighNa CTA 策略代码。

代码要求：
1. 使用 VeighNa 4.0+ 的 CtaTemplate 类
2. 包含完整的策略类定义
3. 包含参数定义、变量定义、初始化方法和 on_bar 方法
4. 代码需要有中英双语注释
5. 代码需要符合 Python 最佳实践
6. 如果用户提到具体的技术指标（如均线、RSI、MACD、布林带等），要正确实现
7. 如果用户提到止盈止损，要正确实现

输出格式：
- 只输出 Python 代码，不要有其他解释
- 代码开头要有策略描述的文档字符串
- 代码要可以直接复制运行

You are a professional quantitative trading strategy developer, expert in VeighNa framework.
Your task is to generate executable VeighNa CTA strategy code based on user's natural language description.`;

/**
 * Build the user message that pairs with STRATEGY_SYSTEM_PROMPT.
 * Single source of truth so the JSON and streaming routes always send the
 * same upstream payload for a given prompt.
 */
export function buildStrategyUserMessage(prompt: string): string {
  return `请根据以下策略描述生成 VeighNa CTA 策略代码：\n\n${prompt}`;
}

/**
 * Compute a deterministic MD5 cache key from the strategy prompt.
 * Normalises whitespace + casing so semantically identical prompts hit the
 * same key. Must stay stable across routes — change here = entire cache pool
 * invalidated.
 */
export function computeStrategyCacheKey(prompt: string): string {
  const normalised = prompt.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('md5').update(normalised).digest('hex');
}

/**
 * Extract Python code from a markdown code block. Tolerates the model
 * emitting ` ```python ` or a bare ` ``` `; falls back to the raw text when
 * neither is found (the model occasionally skips fences entirely).
 *
 * Server-side use: called once on the assembled response after streaming
 * ends, before persisting to the popular-strategy pool.
 */
export function extractCode(raw: string): string {
  const withLang = raw.match(/```python\n([\s\S]*?)```/);
  if (withLang?.[1]) return withLang[1];
  const plain = raw.match(/```\n([\s\S]*?)```/);
  if (plain?.[1]) return plain[1];
  return raw;
}

/**
 * Streaming-aware code extractor. Identical to `extractCode` for fully
 * fenced blocks, but additionally peels open the leading ` ```python ` /
 * ` ``` ` fence while the closing fence has not yet arrived — so the UI
 * can show clean Python in the editor as tokens stream in instead of
 * exposing a dangling ` ``` ` to the user.
 *
 * Pure function (no allocations beyond the regex matches), safe to call on
 * every chunk.
 */
export function extractCodeProgressively(raw: string): string {
  const withLang = raw.match(/```python\n([\s\S]*?)```/);
  if (withLang?.[1]) return withLang[1];
  const plain = raw.match(/```\n([\s\S]*?)```/);
  if (plain?.[1]) return plain[1];
  // Stream still inside an open fence — strip the opener and show the body.
  const openLang = raw.match(/```python\n([\s\S]*)/);
  if (openLang?.[1]) return openLang[1];
  const openPlain = raw.match(/```\n([\s\S]*)/);
  if (openPlain?.[1]) return openPlain[1];
  return raw;
}

/**
 * Token estimate for cache-hit savings display. Rough: 0.4 tokens/char on
 * mixed CN+EN text per DeepSeek's tokenizer. Only used for UX badges; never
 * billed against quota.
 */
export const STRATEGY_TOKENS_PER_CHAR = 0.4;
