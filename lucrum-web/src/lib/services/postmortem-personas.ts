/**
 * Postmortem persona registry.
 *
 * Wraps four master-investor agents (Buffett / Lynch / Livermore / Simons)
 * with a postmortem-specific viewpoint and analysis framework. The agents'
 * existing system prompts (`master-agents.ts`) carry the persona voice; the
 * registry below tells the dispatcher *how* to angle each persona at a
 * finished backtest run.
 *
 * Keeping this list to 4 (vs. all 11 advisor agents) is a deliberate
 * tradeoff between token spend, latency, and narrative differentiation —
 * the personas span the four highest-leverage analytic lenses without
 * overlapping.
 *
 * @module lib/services/postmortem-personas
 */

import {
  BUFFETT_AGENT,
  LYNCH_AGENT,
  LIVERMORE_AGENT,
  SIMONS_AGENT,
} from "@/lib/advisor/agent/master-agents";
import type { MasterAgent } from "@/lib/advisor/agent/types";

export type PostmortemPersonaId = "value" | "trend" | "momentum" | "risk";

export interface PostmortemPersona {
  readonly id: PostmortemPersonaId;
  /** Short display label (≤4 chars Chinese). */
  readonly label: string;
  /** Lens summary shown next to the persona name. */
  readonly viewpoint: string;
  /** The master-agent whose voice we borrow. */
  readonly agent: MasterAgent;
  /**
   * Specific analytic axes this persona must address. The prompt builder
   * inlines them so each persona's evidence list stays distinct rather
   * than collapsing into generic "Sharpe is OK" boilerplate.
   */
  readonly analysisFramework: ReadonlyArray<string>;
}

export const POSTMORTEM_PERSONAS: ReadonlyArray<PostmortemPersona> = [
  {
    id: "value",
    label: "价值派",
    viewpoint: "看护城河、ROE、安全边际 — 这笔生意值不值得长持？",
    agent: BUFFETT_AGENT,
    analysisFramework: [
      "护城河与商业模式稳定性",
      "ROE / 资本回报质量",
      "安全边际是否充分（买点 vs. 内在价值）",
      "长期复利是否真实体现在曲线上",
    ],
  },
  {
    id: "trend",
    label: "趋势派",
    viewpoint: "看趋势强度、行业轮动 — 是顺势而为还是逆势挣扎？",
    agent: LIVERMORE_AGENT,
    analysisFramework: [
      "买点是否落在确认的趋势内",
      "行业 / 板块轮动是否对齐",
      "顺势加仓的金字塔结构是否成立",
      "止损纪律是否阻止了趋势反转中的回吐",
    ],
  },
  {
    id: "momentum",
    label: "动量派",
    viewpoint: "看 breakout、相对强度 — 何时加仓何时撤？",
    agent: LYNCH_AGENT,
    analysisFramework: [
      "突破点质量（量价配合）",
      "相对强度排名是否优于市场",
      "持仓周期是否符合动量衰减节奏",
      "退出纪律（突破失败 / 量能背离）",
    ],
  },
  {
    id: "risk",
    label: "风控派",
    viewpoint: "看 max drawdown、tail risk、Sharpe — 风险敞口可控吗？",
    agent: SIMONS_AGENT,
    analysisFramework: [
      "最大回撤与回撤持续期",
      "尾部风险（最差单笔 / 连续亏损）",
      "风险调整收益（Sharpe / Sortino）",
      "仓位管理与杠杆暴露",
    ],
  },
] as const;

export function getPostmortemPersona(
  id: string,
): PostmortemPersona | undefined {
  return POSTMORTEM_PERSONAS.find((p) => p.id === id);
}

/** LB price per persona dispatch. Fixed price keeps the wallet preview
 *  trivial (selected * COST_PER_PERSONA) and avoids leaking token counts
 *  through to the paywall UI. */
export const POSTMORTEM_COST_PER_PERSONA_LB = 1;

export const VERDICT_VALUES = [
  "strong_win",
  "weak_win",
  "neutral",
  "weak_loss",
  "strong_loss",
] as const;
export type PostmortemVerdict = (typeof VERDICT_VALUES)[number];
