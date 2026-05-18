/**
 * Auto-naming for user strategies.
 *
 * Slot template: <style>·<topic>·<MMDD>·#<seq>
 * Examples:
 *   动量·MACD+KDJ·0512·#2
 *   价值·茅台·0511·#1
 *   AI生成·趋势·0512·#3
 *
 * Deterministic, readable, searchable. No LLM cost.
 *
 * @module lib/strategy/auto-name
 */

// ---------------------------------------------------------------------------
// Style detection — priority order matters; first match wins.
// ---------------------------------------------------------------------------

interface StyleRule {
  style: string;
  keywords: string[];
  codePatterns?: RegExp[];
}

const STYLE_RULES: readonly StyleRule[] = [
  {
    style: "网格",
    keywords: ["网格", "grid"],
  },
  {
    style: "反转",
    keywords: ["反转", "超卖", "超买", "mean reversion", "反弹"],
  },
  {
    style: "动量",
    keywords: ["动量", "momentum", "强势", "相对强度"],
  },
  {
    style: "趋势",
    keywords: ["趋势", "突破", "trend", "donchian", "通道"],
    codePatterns: [/\bMA\d*\b|sma|ema/i],
  },
  {
    style: "价值",
    keywords: ["价值", "低估", "低 pe", "低pe", "peg", "value", "巴菲特", "林奇"],
  },
  {
    style: "成长",
    keywords: ["成长", "高 roe", "高roe", "growth", "加速"],
  },
  {
    style: "量化",
    keywords: ["多因子", "因子", "量化", "统计套利", "波动率"],
  },
  {
    style: "宏观",
    keywords: ["宏观", "行业轮动", "板块轮动", "macro"],
  },
] as const;

const DEFAULT_STYLE = "AI生成";

function detectStyle(prompt: string, code: string): string {
  const haystack = `${prompt}\n${code}`.toLowerCase();
  for (const rule of STYLE_RULES) {
    for (const kw of rule.keywords) {
      if (haystack.includes(kw.toLowerCase())) return rule.style;
    }
    if (rule.codePatterns) {
      for (const pat of rule.codePatterns) {
        if (pat.test(code)) return rule.style;
      }
    }
  }
  return DEFAULT_STYLE;
}

// ---------------------------------------------------------------------------
// Topic detection — indicator tokens + theme keywords (max 2, joined by "+").
// ---------------------------------------------------------------------------

const INDICATOR_TOKENS: readonly string[] = [
  "MACD",
  "KDJ",
  "RSI",
  "BOLL",
  "BIAS",
  "CCI",
  "OBV",
  "MA",
  "EMA",
  "SMA",
  "WMA",
  "ATR",
  "Volume",
  "VOL",
];

const THEME_KEYWORDS: readonly string[] = [
  "半导体",
  "银行",
  "茅台",
  "新能源",
  "消费",
  "医药",
  "军工",
  "光伏",
  "白酒",
  "地产",
  "煤炭",
  "钢铁",
  "有色",
  "黄金",
  "稀土",
];

function detectTopics(prompt: string, code: string): string[] {
  const topics: string[] = [];
  const seen = new Set<string>();

  // Indicators: scan code first (signal-strong), then prompt as backup.
  // Custom boundary: any non-[A-Z0-9] char counts as a delimiter (so `_` is
  // treated as a separator — `compute_macd` matches MACD but not MA).
  const codeUpper = code.toUpperCase();
  const promptUpper = prompt.toUpperCase();
  for (const ind of INDICATOR_TOKENS) {
    const tok = ind.toUpperCase();
    const re = new RegExp(`(?:^|[^A-Z0-9])${tok}(?:[^A-Z0-9]|$)`);
    if (re.test(codeUpper) || re.test(promptUpper)) {
      if (!seen.has(ind)) {
        topics.push(ind);
        seen.add(ind);
      }
    }
  }

  // Themes: only check prompt (code rarely names sectors).
  for (const theme of THEME_KEYWORDS) {
    if (prompt.includes(theme) && !seen.has(theme)) {
      topics.push(theme);
      seen.add(theme);
    }
  }

  return topics.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Date and sequence.
// ---------------------------------------------------------------------------

/** MMDD for the given date (defaults to today). */
export function formatDateSlot(date: Date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}${dd}`;
}

/**
 * Determine the next sequence number for a given date slot by scanning
 * existing names of the form "<...>·MMDD·#<n>".
 */
export function nextSequence(dateSlot: string, existingNames: readonly string[]): number {
  const pattern = new RegExp(`·${dateSlot}·#(\\d+)`);
  let max = 0;
  for (const name of existingNames) {
    const m = name.match(pattern);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateStrategyNameInput {
  prompt?: string;
  code?: string;
  existingNames?: readonly string[];
  /** Override the date used for the MMDD slot (mostly for tests). */
  date?: Date;
}

/**
 * Generate a strategy name from prompt + code.
 *
 * Returns a deterministic, slot-formatted name. Never returns "未命名策略".
 */
export function generateStrategyName(input: GenerateStrategyNameInput): string {
  const prompt = (input.prompt ?? "").trim();
  const code = (input.code ?? "").trim();
  const existingNames = input.existingNames ?? [];
  const date = input.date ?? new Date();

  const dateSlot = formatDateSlot(date);
  const style = detectStyle(prompt, code);
  const topics = detectTopics(prompt, code);
  const seq = nextSequence(dateSlot, existingNames);

  const segments: string[] = [style];
  if (topics.length > 0) segments.push(topics.join("+"));
  segments.push(dateSlot);
  segments.push(`#${seq}`);

  return segments.join("·");
}
