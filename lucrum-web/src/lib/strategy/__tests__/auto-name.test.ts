import { describe, expect, it } from "vitest";
import {
  generateStrategyName,
  formatDateSlot,
  nextSequence,
} from "../auto-name";

const D = new Date(2026, 4, 12); // 2026-05-12

describe("auto-name", () => {
  it("formats date slot as MMDD", () => {
    expect(formatDateSlot(D)).toBe("0512");
    expect(formatDateSlot(new Date(2026, 0, 1))).toBe("0101");
  });

  it("detects style from prompt keywords", () => {
    const name = generateStrategyName({
      prompt: "动量策略，跟踪强势股",
      code: "",
      date: D,
    });
    expect(name.startsWith("动量·")).toBe(true);
    expect(name.endsWith("·0512·#1")).toBe(true);
  });

  it("extracts indicator topics from code", () => {
    const name = generateStrategyName({
      prompt: "我要做趋势",
      code: "import talib\nMACD = talib.MACD(close)\nKDJ = ...",
      date: D,
    });
    expect(name).toContain("MACD+KDJ");
  });

  it("falls back to AI生成 when nothing matches", () => {
    const name = generateStrategyName({ prompt: "", code: "", date: D });
    expect(name).toBe("AI生成·0512·#1");
  });

  it("recognizes theme keywords in prompt", () => {
    const name = generateStrategyName({
      prompt: "买入茅台，长期持有",
      code: "",
      date: D,
    });
    expect(name).toContain("茅台");
    expect(name).toContain("0512");
    expect(name).toMatch(/#1$/);
  });

  it("increments seq based on existing same-day names", () => {
    const existing = [
      "动量·MACD·0512·#1",
      "价值·茅台·0512·#2",
      "趋势·0511·#5", // different day — ignored
    ];
    const name = generateStrategyName({
      prompt: "RSI 超卖反弹",
      code: "",
      date: D,
      existingNames: existing,
    });
    expect(name).toBe("反转·RSI·0512·#3");
  });

  it("nextSequence returns 1 when no matches", () => {
    expect(nextSequence("0512", [])).toBe(1);
    expect(nextSequence("0512", ["unrelated name"])).toBe(1);
  });

  it("does not gobble MA into MACD", () => {
    // A code that mentions MACD but not MA should produce MACD only.
    const name = generateStrategyName({
      prompt: "",
      code: "macd_value = compute_macd(bar)",
      date: D,
    });
    expect(name).toContain("MACD");
    expect(name).not.toContain("MA+");
    expect(name).not.toContain("+MA");
  });

  // ---------------------------------------------------------------------------
  // Branch / default coverage (lines 71, 194-195, 197)
  // ---------------------------------------------------------------------------

  it("detects style from code REGEX pattern when prompt has no keyword (line 71)", () => {
    // Empty prompt + code that ONLY matches the 趋势 codePattern (/\bMA\d*\b|sma|ema/i)
    // → must still classify as 趋势, not fall through to AI生成.
    const name = generateStrategyName({
      prompt: "",
      code: "sma_value = sma(close, 20)\nema_value = ema(close, 10)",
      date: D,
    });
    expect(name.startsWith("趋势·")).toBe(true);
  });

  it("uses 'new Date()' default when date arg is omitted", () => {
    // Just verify no crash + name contains today's MMDD.
    const name = generateStrategyName({ prompt: "动量", code: "" });
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    expect(name).toContain(`·${mm}${dd}·`);
  });

  it("falls back gracefully when ALL inputs are undefined", () => {
    const name = generateStrategyName({});
    expect(name).toMatch(/^AI生成·\d{4}·#1$/);
  });

  it("treats null-ish prompt/code as empty (no throw)", () => {
    expect(() =>
      generateStrategyName({
        // @ts-expect-error — exercise the ?? "" defaults at runtime
        prompt: undefined,
        // @ts-expect-error
        code: undefined,
        date: D,
      }),
    ).not.toThrow();
  });
});
