/**
 * Metric Rating System
 * Financial metric evaluation with color ratings and short explanations
 *
 * Rating levels: good (green), moderate (yellow), poor (red)
 * Tooltip explanations: max 15 Chinese characters
 */

// Rating level type
export type MetricRating = "good" | "moderate" | "poor";

// Rating color CSS classes (using design system tokens)
export const RATING_CLASSES: Record<MetricRating, string> = {
  good: "bg-profit/10 text-profit border-profit/20",
  moderate: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  poor: "bg-loss/10 text-loss border-loss/20",
};

// Rating dot colors for inline indicators
export const RATING_DOT_CLASSES: Record<MetricRating, string> = {
  good: "bg-profit",
  moderate: "bg-amber-500",
  poor: "bg-loss",
};

// Metric definition with thresholds and tooltip
interface MetricDef {
  /** Short explanation, max 15 Chinese chars */
  tooltip: string;
  /** Threshold for "good" rating */
  goodThreshold: number;
  /** Threshold for "moderate" rating (below this = poor) */
  moderateThreshold: number;
  /** Whether higher is better (true) or lower is better (false) */
  higherIsBetter: boolean;
}

// All supported metric definitions
const METRIC_DEFS: Record<string, MetricDef> = {
  // Return metrics
  totalReturn: {
    tooltip: "策略总盈亏百分比",
    goodThreshold: 20,
    moderateThreshold: 0,
    higherIsBetter: true,
  },
  annualizedReturn: {
    tooltip: "折算到每年的收益率",
    goodThreshold: 15,
    moderateThreshold: 5,
    higherIsBetter: true,
  },
  alpha: {
    tooltip: "超越大盘的额外收益",
    goodThreshold: 5,
    moderateThreshold: 0,
    higherIsBetter: true,
  },

  // Risk metrics
  sharpeRatio: {
    tooltip: "每承担1份风险赚多少",
    goodThreshold: 1.5,
    moderateThreshold: 0.5,
    higherIsBetter: true,
  },
  sortinoRatio: {
    tooltip: "只看亏损风险的收益效率",
    goodThreshold: 2.0,
    moderateThreshold: 1.0,
    higherIsBetter: true,
  },
  calmarRatio: {
    tooltip: "收益与最大回撤之比",
    goodThreshold: 1.5,
    moderateThreshold: 0.5,
    higherIsBetter: true,
  },
  maxDrawdown: {
    tooltip: "最惨时从高点亏了多少",
    goodThreshold: 15,
    moderateThreshold: 30,
    higherIsBetter: false,
  },
  maxDrawdownDuration: {
    tooltip: "从亏损到回本的天数",
    goodThreshold: 60,
    moderateThreshold: 180,
    higherIsBetter: false,
  },
  var95: {
    tooltip: "95%概率不会亏超过这个",
    goodThreshold: 2,
    moderateThreshold: 5,
    higherIsBetter: false,
  },

  // Trading metrics
  winRate: {
    tooltip: "赚钱交易占总交易比例",
    goodThreshold: 55,
    moderateThreshold: 45,
    higherIsBetter: true,
  },
  profitFactor: {
    tooltip: "平均每笔赚的除以亏的",
    goodThreshold: 1.5,
    moderateThreshold: 1.0,
    higherIsBetter: true,
  },
  totalTrades: {
    tooltip: "回测期间总交易笔数",
    goodThreshold: 30,
    moderateThreshold: 10,
    higherIsBetter: true,
  },
  avgHoldingDays: {
    tooltip: "平均每笔交易持仓天数",
    goodThreshold: 30,
    moderateThreshold: 90,
    higherIsBetter: false,
  },
  maxConsecutiveWins: {
    tooltip: "连续盈利的最长次数",
    goodThreshold: 5,
    moderateThreshold: 3,
    higherIsBetter: true,
  },
  maxConsecutiveLosses: {
    tooltip: "连续亏损的最长次数",
    goodThreshold: 3,
    moderateThreshold: 5,
    higherIsBetter: false,
  },

  // Diagnostic
  maxSingleWin: {
    tooltip: "单笔最大盈利百分比",
    goodThreshold: 10,
    moderateThreshold: 5,
    higherIsBetter: true,
  },
  maxSingleLoss: {
    tooltip: "单笔最大亏损百分比",
    goodThreshold: 5,
    moderateThreshold: 10,
    higherIsBetter: false,
  },
  returnVolatility: {
    tooltip: "收益率的波动幅度",
    goodThreshold: 15,
    moderateThreshold: 30,
    higherIsBetter: false,
  },
};

/**
 * Get the rating for a metric value.
 * Returns "good", "moderate", or "poor".
 */
export function getMetricRating(metricKey: string, value: number): MetricRating {
  const def = METRIC_DEFS[metricKey];
  if (!def) return "moderate";

  const absValue = Math.abs(value);
  const testValue = def.higherIsBetter ? value : absValue;

  if (def.higherIsBetter) {
    if (testValue >= def.goodThreshold) return "good";
    if (testValue >= def.moderateThreshold) return "moderate";
    return "poor";
  } else {
    if (testValue <= def.goodThreshold) return "good";
    if (testValue <= def.moderateThreshold) return "moderate";
    return "poor";
  }
}

/**
 * Get tooltip text for a metric.
 * Returns a short Chinese explanation (max 15 chars).
 */
export function getMetricTooltip(metricKey: string): string | undefined {
  return METRIC_DEFS[metricKey]?.tooltip;
}

/**
 * Check if a metric key has a definition.
 */
export function hasMetricDef(metricKey: string): boolean {
  return metricKey in METRIC_DEFS;
}

/**
 * Get all defined metric keys.
 */
export function getDefinedMetricKeys(): string[] {
  return Object.keys(METRIC_DEFS);
}
