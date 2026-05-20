/**
 * Postmortem user-prompt builder.
 *
 * Given a persona definition + backtest context, produces:
 *   - the system message (persona agent's existing system prompt, with a
 *     small postmortem-mode addendum that forces structured JSON output)
 *   - the user message (compact backtest summary + framework directives)
 *
 * Output schema lives in this module too — the dispatcher uses Zod to
 * validate the LLM's JSON; if validation fails, the dispatcher retries
 * once with a stricter instruction before giving up.
 *
 * @module lib/agent/postmortem-prompts
 */

import { z } from "zod";
import type { PostmortemPersona } from "@/lib/services/postmortem-personas";
import { VERDICT_VALUES } from "@/lib/services/postmortem-personas";

// ---------------------------------------------------------------------------
// Backtest context shape
// ---------------------------------------------------------------------------

export interface PostmortemContext {
  strategyName: string;
  /** Trimmed strategy summary (≤200 chars). */
  codeSummary: string;
  symbol: string;
  startDate: string;
  endDate: string;
  /** Headline metrics. All values pre-formatted (or null when missing). */
  metrics: {
    sharpe: number | null;
    maxDrawdown: number | null; // negative, e.g. -0.18
    winRate: number | null; // 0..1
    annualReturn: number | null; // 0..1
    totalReturn: number | null; // 0..1
    totalTrades: number | null;
  };
  /** Top 5 winning trades (descending by pnl%). */
  topWins: ReadonlyArray<TradeRow>;
  /** Top 5 losing trades (ascending by pnl%). */
  topLosses: ReadonlyArray<TradeRow>;
  /** 4-sample equity curve descriptor — start / peak / trough / end. */
  equity: {
    start: number;
    peak: number;
    peakDay: number;
    trough: number;
    troughDay: number;
    end: number;
  };
}

export interface TradeRow {
  symbol: string;
  entry: string; // YYYY-MM-DD
  exit: string;
  pnlPercent: number; // -1..+inf, e.g. 0.083 for +8.3%
  holdDays: number;
}

// ---------------------------------------------------------------------------
// Output schema — what we demand from the LLM
// ---------------------------------------------------------------------------

export const personaOutputSchema = z.object({
  verdict: z.enum(VERDICT_VALUES),
  summary: z.string().min(1).max(400),
  evidence: z
    .array(
      z.object({
        point: z.string().min(1),
        data: z.string().min(1),
      }),
    )
    .min(2)
    .max(6),
  improvements: z.array(z.string().min(1)).min(2).max(5),
  confidence: z.number().min(0).max(1),
});

export type PersonaOutput = z.infer<typeof personaOutputSchema>;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const POSTMORTEM_SYSTEM_ADDENDUM = `

---
## 当前任务：策略回测复盘（Postmortem mode）

你正在以你的视角复盘一次**已经完成**的量化策略回测。
你的工作不是给出投资建议，而是**评判这次回测**：
  - 它的核心矛盾是什么？
  - 数据上有什么你视角下的硬证据？
  - 用户下一步可以怎么改？

**严格要求**：仅输出一个 JSON 对象（不要 markdown / 不要前后说明 / 不要 \`\`\`），结构如下：

{
  "verdict": "strong_win" | "weak_win" | "neutral" | "weak_loss" | "strong_loss",
  "summary": "150-300字以内的结论",
  "evidence": [
    { "point": "你的论据(短)", "data": "引用回测中的具体数字/事件" }
    // 3-5 条
  ],
  "improvements": ["改进建议1", "改进建议2", "改进建议3"],
  "confidence": 0.0-1.0
}`;

function formatPercent(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatTradeRow(t: TradeRow): string {
  return `${t.symbol} ${t.entry}→${t.exit} ${formatPercent(t.pnlPercent)} (持${t.holdDays}日)`;
}

export function buildPostmortemUserPrompt(
  persona: PostmortemPersona,
  ctx: PostmortemContext,
): string {
  const frameworkLines = persona.analysisFramework
    .map((axis, i) => `  ${i + 1}. ${axis}`)
    .join("\n");

  const topWins = ctx.topWins.length
    ? ctx.topWins.map((t, i) => `  ${i + 1}. ${formatTradeRow(t)}`).join("\n")
    : "  (无)";
  const topLosses = ctx.topLosses.length
    ? ctx.topLosses.map((t, i) => `  ${i + 1}. ${formatTradeRow(t)}`).join("\n")
    : "  (无)";

  const m = ctx.metrics;

  return `请你以 **${persona.label}** 的视角（${persona.viewpoint}）复盘以下回测。

## 策略
- 名称：${ctx.strategyName}
- 标的：${ctx.symbol}
- 区间：${ctx.startDate} ~ ${ctx.endDate}
- 代码摘要：${ctx.codeSummary}

## 关键指标
- 总收益：${formatPercent(m.totalReturn)}
- 年化：${formatPercent(m.annualReturn)}
- Sharpe：${m.sharpe == null ? "n/a" : m.sharpe.toFixed(2)}
- 最大回撤：${formatPercent(m.maxDrawdown)}
- 胜率：${formatPercent(m.winRate, 1)}
- 总交易笔数：${m.totalTrades ?? "n/a"}

## 最赚的 5 笔
${topWins}

## 最亏的 5 笔
${topLosses}

## 权益曲线 (相对初始 1.0)
- 起：${ctx.equity.start.toFixed(3)}
- 峰：${ctx.equity.peak.toFixed(3)}（第 ${ctx.equity.peakDay} 日）
- 谷：${ctx.equity.trough.toFixed(3)}（第 ${ctx.equity.troughDay} 日）
- 终：${ctx.equity.end.toFixed(3)}

## 你必须覆盖的分析维度（按你的视角）
${frameworkLines}

请输出 JSON。`;
}

export function buildPostmortemSystemPrompt(persona: PostmortemPersona): string {
  return persona.agent.systemPrompt + POSTMORTEM_SYSTEM_ADDENDUM;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Pulls a JSON object out of an LLM response that may include leading or
 * trailing chatter (despite our instructions). Looks for the first `{`,
 * the last `}`, parses the slice, and validates with Zod.
 */
export function parsePersonaOutput(raw: string): PersonaOutput {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end < start) {
    throw new Error("postmortem: no JSON object in LLM response");
  }
  const slice = raw.slice(start, end + 1);
  const parsed = JSON.parse(slice);
  return personaOutputSchema.parse(parsed);
}
