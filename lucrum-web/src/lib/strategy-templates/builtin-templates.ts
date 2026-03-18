/**
 * Builtin Strategy Template Library
 *
 * Curated collection of 5+ builtin strategy templates for quick-start.
 * Fulfills FR-1.5: Strategy template library (>=5 templates).
 *
 * Each template includes:
 * - Complete vnpy CtaTemplate Python code
 * - Default parameters with descriptions
 * - Buy/sell conditions in plain language
 * - Difficulty classification (beginner/intermediate/advanced)
 * - Expected score range reference
 *
 * @module lib/strategy-templates/builtin-templates
 */

import type { StrategyCategory } from "./index";
import type { ScoreGrade } from "@/lib/backtest/score/types";
import type { PlanTier } from "@/lib/config/plan-limits";

// =============================================================================
// TYPES
// =============================================================================

/** Difficulty levels for builtin templates */
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

/** Builtin template interface with complete data for quick-start */
export interface BuiltinTemplate {
  /** Unique template identifier */
  id: string;
  /** Chinese name */
  name: string;
  /** English name */
  nameEn: string;
  /** Short Chinese description */
  description: string;
  /** Short English description */
  descriptionEn: string;
  /** Difficulty level */
  difficulty: DifficultyLevel;
  /** Strategy category from existing taxonomy */
  category: StrategyCategory;
  /** Display icon */
  icon: string;
  /** Complete vnpy CtaTemplate Python code */
  code: string;
  /** Default parameters as key-value pairs */
  defaultParams: Record<string, number | string>;
  /** Trading conditions in plain language */
  conditions: {
    /** Buy signal conditions */
    buy: string[];
    /** Sell signal conditions */
    sell: string[];
    /** Position sizing rule (optional) */
    position?: string;
  };
  /** Expected backtest score range (for display reference only) */
  expectedScoreRange: {
    min: ScoreGrade;
    max: ScoreGrade;
  };
  /** Natural language prompt for AI generation */
  prompt: string;
  /** Minimum plan tier required to use this template */
  tier: PlanTier;
}

/** Difficulty display configuration */
export interface DifficultyDisplayConfig {
  /** Chinese label */
  label: string;
  /** English label */
  labelEn: string;
  /** Tailwind CSS color class */
  colorClass: string;
  /** Badge background class */
  bgClass: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Difficulty level display configuration */
export const DIFFICULTY_CONFIG: Record<DifficultyLevel, DifficultyDisplayConfig> = {
  beginner: {
    label: "简单",
    labelEn: "Beginner",
    colorClass: "text-green-400",
    bgClass: "bg-green-500/20 text-green-400",
  },
  intermediate: {
    label: "进阶",
    labelEn: "Intermediate",
    colorClass: "text-yellow-400",
    bgClass: "bg-yellow-500/20 text-yellow-400",
  },
  advanced: {
    label: "专业",
    labelEn: "Advanced",
    colorClass: "text-red-400",
    bgClass: "bg-red-500/20 text-red-400",
  },
};

// =============================================================================
// BUILTIN TEMPLATES (5 REQUIRED + EXTRAS)
// =============================================================================

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Dual MA Crossover (Beginner)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "builtin-dual-ma",
    name: "双均线交叉策略",
    nameEn: "Dual MA Crossover",
    description: "MA5上穿MA20买入，下穿卖出，最经典的趋势跟踪入门策略",
    descriptionEn: "Buy on MA5 crossing above MA20, sell on crossing below",
    difficulty: "beginner",
    category: "trend",
    icon: "📈",
    code: `from vnpy_ctastrategy import CtaTemplate, BarData, TradeData, OrderData
from vnpy_ctastrategy.utility import BarGenerator, ArrayManager


class DualMaCrossStrategy(CtaTemplate):
    """Dual Moving Average Crossover Strategy"""

    author = "Lucrum"

    fast_window = 5
    slow_window = 20
    stop_loss_pct = 5.0
    fixed_size = 1

    fast_ma = 0.0
    slow_ma = 0.0

    parameters = ["fast_window", "slow_window", "stop_loss_pct", "fixed_size"]
    variables = ["fast_ma", "slow_ma"]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
        self.bg = BarGenerator(self.on_bar)
        self.am = ArrayManager(size=max(self.fast_window, self.slow_window) + 10)

    def on_init(self):
        self.write_log("Strategy initialized")
        self.load_bar(self.slow_window + 10)

    def on_start(self):
        self.write_log("Strategy started")

    def on_stop(self):
        self.write_log("Strategy stopped")

    def on_bar(self, bar: BarData):
        self.am.update_bar(bar)
        if not self.am.inited:
            return

        self.fast_ma = self.am.sma(self.fast_window)
        self.slow_ma = self.am.sma(self.slow_window)

        if self.pos == 0:
            if self.fast_ma > self.slow_ma:
                self.buy(bar.close_price, self.fixed_size)
        elif self.pos > 0:
            if self.fast_ma < self.slow_ma:
                self.sell(bar.close_price, abs(self.pos))

        self.put_event()
`,
    defaultParams: {
      fast_window: 5,
      slow_window: 20,
      stop_loss_pct: 5,
      fixed_size: 1,
    },
    conditions: {
      buy: ["短期均线(MA5)上穿长期均线(MA20)形成金叉"],
      sell: ["短期均线(MA5)下穿长期均线(MA20)形成死叉"],
      position: "每次买入固定手数",
    },
    expectedScoreRange: { min: "C", max: "B" },
    prompt: "双均线交叉策略：当5日均线上穿20日均线时买入，当5日均线下穿20日均线时卖出，止损5%",
    tier: "free",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. KDJ Overbought/Oversold (Beginner)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "builtin-kdj",
    name: "KDJ超买超卖策略",
    nameEn: "KDJ Overbought/Oversold",
    description: "KDJ在20以下金叉买入，80以上死叉卖出，适合震荡行情",
    descriptionEn: "Buy when KDJ golden cross below 20, sell when death cross above 80",
    difficulty: "beginner",
    category: "mean-revert",
    icon: "📊",
    code: `from vnpy_ctastrategy import CtaTemplate, BarData, TradeData, OrderData
from vnpy_ctastrategy.utility import BarGenerator, ArrayManager


class KdjStrategy(CtaTemplate):
    """KDJ Overbought/Oversold Strategy"""

    author = "Lucrum"

    kdj_period = 9
    kdj_slow = 3
    kdj_smooth = 3
    oversold_threshold = 20
    overbought_threshold = 80
    fixed_size = 1

    k_value = 0.0
    d_value = 0.0
    prev_k = 0.0
    prev_d = 0.0

    parameters = [
        "kdj_period", "kdj_slow", "kdj_smooth",
        "oversold_threshold", "overbought_threshold", "fixed_size"
    ]
    variables = ["k_value", "d_value"]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
        self.bg = BarGenerator(self.on_bar)
        self.am = ArrayManager(size=self.kdj_period + 20)

    def on_init(self):
        self.write_log("Strategy initialized")
        self.load_bar(self.kdj_period + 20)

    def on_start(self):
        self.write_log("Strategy started")

    def on_stop(self):
        self.write_log("Strategy stopped")

    def on_bar(self, bar: BarData):
        self.am.update_bar(bar)
        if not self.am.inited:
            return

        self.prev_k = self.k_value
        self.prev_d = self.d_value

        high_arr = self.am.high[-self.kdj_period:]
        low_arr = self.am.low[-self.kdj_period:]
        highest = max(high_arr)
        lowest = min(low_arr)

        if highest != lowest:
            rsv = (bar.close_price - lowest) / (highest - lowest) * 100
        else:
            rsv = 50

        self.k_value = (2 / 3) * self.prev_k + (1 / 3) * rsv
        self.d_value = (2 / 3) * self.prev_d + (1 / 3) * self.k_value

        golden_cross = self.prev_k <= self.prev_d and self.k_value > self.d_value
        death_cross = self.prev_k >= self.prev_d and self.k_value < self.d_value

        if self.pos == 0:
            if golden_cross and self.k_value < self.oversold_threshold:
                self.buy(bar.close_price, self.fixed_size)
        elif self.pos > 0:
            if death_cross and self.k_value > self.overbought_threshold:
                self.sell(bar.close_price, abs(self.pos))

        self.put_event()
`,
    defaultParams: {
      kdj_period: 9,
      kdj_slow: 3,
      kdj_smooth: 3,
      oversold_threshold: 20,
      overbought_threshold: 80,
      fixed_size: 1,
    },
    conditions: {
      buy: ["K值低于20进入超卖区", "K线上穿D线形成金叉时买入"],
      sell: ["K值高于80进入超买区", "K线下穿D线形成死叉时卖出"],
      position: "每次买入固定手数",
    },
    expectedScoreRange: { min: "C", max: "B" },
    prompt: "KDJ策略：当K值低于20且K线上穿D线形成金叉时买入，当K值高于80且K线下穿D线时卖出",
    tier: "free",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. MACD Momentum (Intermediate)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "builtin-macd",
    name: "MACD动量策略",
    nameEn: "MACD Momentum",
    description: "MACD金叉配合量能确认买入，动量消退时卖出",
    descriptionEn: "MACD golden cross with volume confirmation",
    difficulty: "intermediate",
    category: "momentum",
    icon: "🚀",
    code: `from vnpy_ctastrategy import CtaTemplate, BarData, TradeData, OrderData
from vnpy_ctastrategy.utility import BarGenerator, ArrayManager


class MacdMomentumStrategy(CtaTemplate):
    """MACD Momentum Strategy with Volume Confirmation"""

    author = "Lucrum"

    fast_period = 12
    slow_period = 26
    signal_period = 9
    volume_ratio_threshold = 1.5
    volume_ma_period = 5
    fixed_size = 1

    macd_value = 0.0
    signal_value = 0.0
    hist_value = 0.0
    prev_macd = 0.0
    prev_signal = 0.0

    parameters = [
        "fast_period", "slow_period", "signal_period",
        "volume_ratio_threshold", "volume_ma_period", "fixed_size"
    ]
    variables = ["macd_value", "signal_value", "hist_value"]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
        self.bg = BarGenerator(self.on_bar)
        self.am = ArrayManager(size=self.slow_period + self.signal_period + 10)

    def on_init(self):
        self.write_log("Strategy initialized")
        self.load_bar(self.slow_period + self.signal_period + 10)

    def on_start(self):
        self.write_log("Strategy started")

    def on_stop(self):
        self.write_log("Strategy stopped")

    def on_bar(self, bar: BarData):
        self.am.update_bar(bar)
        if not self.am.inited:
            return

        self.prev_macd = self.macd_value
        self.prev_signal = self.signal_value

        macd_data = self.am.macd(
            self.fast_period, self.slow_period, self.signal_period
        )
        self.macd_value = macd_data[0]
        self.signal_value = macd_data[1]
        self.hist_value = macd_data[2]

        volume_ma = sum(self.am.volume[-self.volume_ma_period:]) / self.volume_ma_period
        volume_ratio = bar.volume / volume_ma if volume_ma > 0 else 0

        golden_cross = (
            self.prev_macd <= self.prev_signal
            and self.macd_value > self.signal_value
        )
        death_cross = (
            self.prev_macd >= self.prev_signal
            and self.macd_value < self.signal_value
        )

        if self.pos == 0:
            if golden_cross and volume_ratio >= self.volume_ratio_threshold:
                self.buy(bar.close_price, self.fixed_size)
        elif self.pos > 0:
            if death_cross:
                self.sell(bar.close_price, abs(self.pos))

        self.put_event()
`,
    defaultParams: {
      fast_period: 12,
      slow_period: 26,
      signal_period: 9,
      volume_ratio_threshold: 1.5,
      volume_ma_period: 5,
      fixed_size: 1,
    },
    conditions: {
      buy: ["MACD金叉(DIF上穿DEA)", "成交量大于均量1.5倍确认"],
      sell: ["MACD死叉(DIF下穿DEA)时卖出"],
      position: "每次买入固定手数",
    },
    expectedScoreRange: { min: "C", max: "A" },
    prompt: "MACD动量策略：DIF上穿DEA金叉且成交量放大1.5倍时买入，DIF下穿DEA死叉时卖出，参数12-26-9",
    tier: "basic",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Bollinger Bands Breakout (Intermediate)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "builtin-bollinger",
    name: "布林带突破策略",
    nameEn: "Bollinger Bands Breakout",
    description: "价格突破布林上轨买入，跌破中轨卖出，捕捉波动扩张",
    descriptionEn: "Buy on upper band breakout, sell on middle band breakdown",
    difficulty: "intermediate",
    category: "trend",
    icon: "📏",
    code: `from vnpy_ctastrategy import CtaTemplate, BarData, TradeData, OrderData
from vnpy_ctastrategy.utility import BarGenerator, ArrayManager


class BollingerBreakoutStrategy(CtaTemplate):
    """Bollinger Bands Breakout Strategy"""

    author = "Lucrum"

    boll_period = 20
    boll_dev = 2.0
    fixed_size = 1

    boll_upper = 0.0
    boll_middle = 0.0
    boll_lower = 0.0

    parameters = ["boll_period", "boll_dev", "fixed_size"]
    variables = ["boll_upper", "boll_middle", "boll_lower"]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
        self.bg = BarGenerator(self.on_bar)
        self.am = ArrayManager(size=self.boll_period + 10)

    def on_init(self):
        self.write_log("Strategy initialized")
        self.load_bar(self.boll_period + 10)

    def on_start(self):
        self.write_log("Strategy started")

    def on_stop(self):
        self.write_log("Strategy stopped")

    def on_bar(self, bar: BarData):
        self.am.update_bar(bar)
        if not self.am.inited:
            return

        self.boll_upper, self.boll_middle, self.boll_lower = self.am.boll(
            self.boll_period, self.boll_dev
        )

        if self.pos == 0:
            if bar.close_price > self.boll_upper:
                self.buy(bar.close_price, self.fixed_size)
        elif self.pos > 0:
            if bar.close_price < self.boll_middle:
                self.sell(bar.close_price, abs(self.pos))

        self.put_event()
`,
    defaultParams: {
      boll_period: 20,
      boll_dev: 2.0,
      fixed_size: 1,
    },
    conditions: {
      buy: ["价格突破布林带上轨时买入"],
      sell: ["价格跌破布林带中轨时卖出"],
      position: "每次买入固定手数",
    },
    expectedScoreRange: { min: "C", max: "B" },
    prompt: "布林带突破策略：价格突破布林带上轨时买入，跌破中轨时卖出，布林带周期20，标准差倍数2",
    tier: "basic",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Multi-Factor Composite (Advanced)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "builtin-multi-factor",
    name: "多因子综合策略",
    nameEn: "Multi-Factor Composite",
    description: "RSI + MACD + 均线三重确认，多维度过滤提高胜率",
    descriptionEn: "RSI + MACD + MA triple confirmation for higher win rate",
    difficulty: "advanced",
    category: "composite",
    icon: "🔗",
    code: `from vnpy_ctastrategy import CtaTemplate, BarData, TradeData, OrderData
from vnpy_ctastrategy.utility import BarGenerator, ArrayManager


class MultiFactorStrategy(CtaTemplate):
    """Multi-Factor Composite Strategy (RSI + MACD + MA)"""

    author = "Lucrum"

    rsi_period = 14
    rsi_oversold = 40
    rsi_overbought = 70
    macd_fast = 12
    macd_slow = 26
    macd_signal = 9
    ma_period = 20
    fixed_size = 1

    rsi_value = 0.0
    macd_value = 0.0
    signal_value = 0.0
    ma_value = 0.0
    prev_macd = 0.0
    prev_signal = 0.0

    parameters = [
        "rsi_period", "rsi_oversold", "rsi_overbought",
        "macd_fast", "macd_slow", "macd_signal",
        "ma_period", "fixed_size"
    ]
    variables = ["rsi_value", "macd_value", "signal_value", "ma_value"]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
        self.bg = BarGenerator(self.on_bar)
        size = max(self.macd_slow + self.macd_signal, self.rsi_period, self.ma_period) + 20
        self.am = ArrayManager(size=size)

    def on_init(self):
        self.write_log("Strategy initialized")
        self.load_bar(50)

    def on_start(self):
        self.write_log("Strategy started")

    def on_stop(self):
        self.write_log("Strategy stopped")

    def on_bar(self, bar: BarData):
        self.am.update_bar(bar)
        if not self.am.inited:
            return

        self.prev_macd = self.macd_value
        self.prev_signal = self.signal_value

        self.rsi_value = self.am.rsi(self.rsi_period)

        macd_data = self.am.macd(self.macd_fast, self.macd_slow, self.macd_signal)
        self.macd_value = macd_data[0]
        self.signal_value = macd_data[1]

        self.ma_value = self.am.sma(self.ma_period)

        macd_golden_cross = (
            self.prev_macd <= self.prev_signal
            and self.macd_value > self.signal_value
        )
        macd_death_cross = (
            self.prev_macd >= self.prev_signal
            and self.macd_value < self.signal_value
        )

        price_above_ma = bar.close_price > self.ma_value
        rsi_not_overbought = self.rsi_value < self.rsi_overbought
        rsi_oversold_zone = self.rsi_value < self.rsi_oversold

        if self.pos == 0:
            buy_signal = (
                macd_golden_cross
                and price_above_ma
                and rsi_not_overbought
            )
            if buy_signal:
                self.buy(bar.close_price, self.fixed_size)
        elif self.pos > 0:
            sell_signal = (
                macd_death_cross
                or self.rsi_value > self.rsi_overbought
                or bar.close_price < self.ma_value
            )
            if sell_signal:
                self.sell(bar.close_price, abs(self.pos))

        self.put_event()
`,
    defaultParams: {
      rsi_period: 14,
      rsi_oversold: 40,
      rsi_overbought: 70,
      macd_fast: 12,
      macd_slow: 26,
      macd_signal: 9,
      ma_period: 20,
      fixed_size: 1,
    },
    conditions: {
      buy: [
        "MACD金叉(DIF上穿DEA)",
        "价格在20日均线之上",
        "RSI未超买(低于70)",
      ],
      sell: [
        "MACD死叉(DIF下穿DEA)",
        "或RSI超买(高于70)",
        "或价格跌破20日均线",
      ],
      position: "每次买入固定手数",
    },
    expectedScoreRange: { min: "B", max: "A" },
    prompt: "多因子综合策略：MACD金叉 + 价格在20日均线之上 + RSI低于70时买入，MACD死叉或RSI超70或跌破均线时卖出",
    tier: "basic",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. RSI Mean Reversion (Beginner) - BONUS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "builtin-rsi",
    name: "RSI超卖反弹策略",
    nameEn: "RSI Oversold Bounce",
    description: "RSI低于30超卖买入，高于70超买卖出，捕捉反弹机会",
    descriptionEn: "Buy when RSI below 30 (oversold), sell when RSI above 70 (overbought)",
    difficulty: "beginner",
    category: "mean-revert",
    icon: "📉",
    code: `from vnpy_ctastrategy import CtaTemplate, BarData, TradeData, OrderData
from vnpy_ctastrategy.utility import BarGenerator, ArrayManager


class RsiReversalStrategy(CtaTemplate):
    """RSI Oversold Bounce Strategy"""

    author = "Lucrum"

    rsi_period = 14
    oversold_level = 30
    overbought_level = 70
    neutral_level = 50
    fixed_size = 1

    rsi_value = 0.0

    parameters = [
        "rsi_period", "oversold_level",
        "overbought_level", "neutral_level", "fixed_size"
    ]
    variables = ["rsi_value"]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
        self.bg = BarGenerator(self.on_bar)
        self.am = ArrayManager(size=self.rsi_period + 20)

    def on_init(self):
        self.write_log("Strategy initialized")
        self.load_bar(self.rsi_period + 20)

    def on_start(self):
        self.write_log("Strategy started")

    def on_stop(self):
        self.write_log("Strategy stopped")

    def on_bar(self, bar: BarData):
        self.am.update_bar(bar)
        if not self.am.inited:
            return

        self.rsi_value = self.am.rsi(self.rsi_period)

        if self.pos == 0:
            if self.rsi_value < self.oversold_level:
                self.buy(bar.close_price, self.fixed_size)
        elif self.pos > 0:
            if self.rsi_value > self.overbought_level:
                self.sell(bar.close_price, abs(self.pos))

        self.put_event()
`,
    defaultParams: {
      rsi_period: 14,
      oversold_level: 30,
      overbought_level: 70,
      neutral_level: 50,
      fixed_size: 1,
    },
    conditions: {
      buy: ["RSI低于30进入超卖区时买入"],
      sell: ["RSI高于70进入超买区时卖出"],
      position: "每次买入固定手数",
    },
    expectedScoreRange: { min: "C", max: "B" },
    prompt: "RSI策略：RSI(14)低于30时买入，高于70时卖出",
    tier: "free",
  },
] as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a builtin template by its ID
 */
export function getBuiltinTemplateById(
  id: string,
): BuiltinTemplate | undefined {
  if (!id) return undefined;
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get builtin templates filtered by difficulty level
 */
export function getBuiltinTemplatesByDifficulty(
  difficulty: DifficultyLevel,
): BuiltinTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.difficulty === difficulty);
}

/**
 * Get all builtin template IDs
 */
export function getBuiltinTemplateIds(): string[] {
  return BUILTIN_TEMPLATES.map((t) => t.id);
}
