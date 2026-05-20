/**
 * Postmortem prompt-builder + parser tests.
 *
 * Coverage:
 *   - prompts inline persona viewpoint + analysis framework
 *   - parser tolerates leading/trailing chatter around the JSON
 *   - parser rejects schema-invalid output (verdict / lengths / confidence)
 */

import { describe, it, expect } from "vitest";
import {
  buildPostmortemSystemPrompt,
  buildPostmortemUserPrompt,
  parsePersonaOutput,
  type PostmortemContext,
} from "@/lib/agent/postmortem-prompts";
import { POSTMORTEM_PERSONAS } from "@/lib/services/postmortem-personas";

const samplePersona = POSTMORTEM_PERSONAS[0]!; // value (Buffett)

const sampleContext: PostmortemContext = {
  strategyName: "双均线策略",
  codeSummary: "fast_window=5, slow_window=20, on 金叉买入 / 死叉卖出",
  symbol: "600519 贵州茅台",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  metrics: {
    sharpe: 1.23,
    maxDrawdown: -0.18,
    winRate: 0.53,
    annualReturn: 0.21,
    totalReturn: 0.21,
    totalTrades: 24,
  },
  topWins: [
    {
      symbol: "600519",
      entry: "2024-03-01",
      exit: "2024-04-10",
      pnlPercent: 0.083,
      holdDays: 28,
    },
  ],
  topLosses: [
    {
      symbol: "600519",
      entry: "2024-08-12",
      exit: "2024-09-02",
      pnlPercent: -0.052,
      holdDays: 15,
    },
  ],
  equity: {
    start: 1,
    peak: 1.22,
    peakDay: 198,
    trough: 0.94,
    troughDay: 35,
    end: 1.21,
  },
};

describe("postmortem prompt builder", () => {
  it("system prompt carries the agent voice + postmortem mode addendum", () => {
    const sys = buildPostmortemSystemPrompt(samplePersona);
    // Borrowed from the underlying master agent's system prompt
    expect(sys).toContain(samplePersona.agent.masterName);
    // Postmortem-specific instructions
    expect(sys).toMatch(/Postmortem|复盘/);
    expect(sys).toContain("JSON");
  });

  it("user prompt includes persona viewpoint + every framework axis", () => {
    const user = buildPostmortemUserPrompt(samplePersona, sampleContext);
    expect(user).toContain(samplePersona.label);
    expect(user).toContain(samplePersona.viewpoint);
    for (const axis of samplePersona.analysisFramework) {
      expect(user).toContain(axis);
    }
  });

  it("user prompt formats the headline metrics + trade tables", () => {
    const user = buildPostmortemUserPrompt(samplePersona, sampleContext);
    expect(user).toContain("21.00%"); // total return
    expect(user).toContain("-18.00%"); // max drawdown
    expect(user).toContain("8.30%"); // top winning trade percent
    expect(user).toContain("-5.20%"); // top losing trade percent
    expect(user).toContain("第 198 日"); // peak day
  });

  it("user prompt degrades gracefully when fields are null/empty", () => {
    const minimal: PostmortemContext = {
      ...sampleContext,
      metrics: {
        sharpe: null,
        maxDrawdown: null,
        winRate: null,
        annualReturn: null,
        totalReturn: null,
        totalTrades: null,
      },
      topWins: [],
      topLosses: [],
    };
    const user = buildPostmortemUserPrompt(samplePersona, minimal);
    expect(user).toContain("n/a");
    expect(user).toContain("(无)");
  });
});

describe("postmortem output parser", () => {
  const validResponse = JSON.stringify({
    verdict: "weak_win",
    summary: "Sharpe 1.23 + max DD 18%, edge 真但容量受限。",
    evidence: [
      { point: "胜率仅 53%", data: "winRate=0.53" },
      { point: "回撤明显", data: "maxDrawdown=-0.18" },
    ],
    improvements: ["加 trailing stop", "降低单笔仓位"],
    confidence: 0.7,
  });

  it("parses a clean JSON response", () => {
    const out = parsePersonaOutput(validResponse);
    expect(out.verdict).toBe("weak_win");
    expect(out.evidence).toHaveLength(2);
    expect(out.confidence).toBeCloseTo(0.7);
  });

  it("tolerates markdown / leading chatter around the JSON", () => {
    const wrapped =
      "好的，这是我的分析：\n```json\n" + validResponse + "\n```\n谢谢。";
    const out = parsePersonaOutput(wrapped);
    expect(out.verdict).toBe("weak_win");
  });

  it("rejects an unknown verdict", () => {
    const bad = JSON.stringify({
      verdict: "could_be_better",
      summary: "x",
      evidence: [
        { point: "a", data: "b" },
        { point: "c", data: "d" },
      ],
      improvements: ["x", "y"],
      confidence: 0.5,
    });
    expect(() => parsePersonaOutput(bad)).toThrow();
  });

  it("rejects confidence outside [0,1]", () => {
    const bad = JSON.stringify({
      verdict: "neutral",
      summary: "x",
      evidence: [
        { point: "a", data: "b" },
        { point: "c", data: "d" },
      ],
      improvements: ["x", "y"],
      confidence: 1.7,
    });
    expect(() => parsePersonaOutput(bad)).toThrow();
  });

  it("rejects when evidence is too short", () => {
    const bad = JSON.stringify({
      verdict: "neutral",
      summary: "x",
      evidence: [{ point: "a", data: "b" }],
      improvements: ["x", "y"],
      confidence: 0.5,
    });
    expect(() => parsePersonaOutput(bad)).toThrow();
  });

  it("rejects responses with no JSON object at all", () => {
    expect(() => parsePersonaOutput("sorry, I cannot help with that")).toThrow();
  });
});
