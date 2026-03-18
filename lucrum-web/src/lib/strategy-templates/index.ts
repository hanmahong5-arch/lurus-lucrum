/**
 * Strategy Templates Library
 * 策略模板库
 *
 * Contains 40 classic and popular trading strategies
 * covering stocks, futures, and cryptocurrencies.
 *
 * @module lib/strategy-templates
 */

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Strategy category enumeration
 * 策略分类枚举
 */
export type StrategyCategory =
  | "trend" // Trend following / 趋势跟踪
  | "mean-revert" // Mean reversion / 均值回归
  | "momentum" // Momentum / 动量
  | "pattern" // Chart pattern / 形态
  | "composite" // Composite / 复合
  | "factor" // Factor investing / 因子
  | "ml" // Machine learning / 机器学习
  | "crypto" // Crypto specific / 加密货币
  | "futures" // Futures specific / 期货
  | "intraday"; // Intraday / 日内

/**
 * Market type
 * 适用市场类型
 */
export type MarketType = "stock" | "futures" | "crypto";

/**
 * Timeframe type for strategy applicability
 * 策略适用的时间周期类型
 */
export type TimeframeType = "intraday" | "swing" | "position" | "longterm";

/**
 * Strategy template interface
 * 策略模板接口 (Phase 7 增强版)
 */
export interface StrategyTemplate {
  id: string;
  name: string;
  nameEn: string;
  category: StrategyCategory;
  subcategory?: string; // Phase 7: Subcategory for finer classification
  type: "classic" | "popular" | "academic" | "practitioner"; // Phase 7: Added academic & practitioner
  icon: string;
  summary: string;
  summaryEn: string;
  description?: string; // Phase 7: Detailed description
  descriptionEn?: string;
  markets: MarketType[];
  timeframes?: TimeframeType[]; // Phase 7: Applicable timeframes
  difficulty: 1 | 2 | 3; // 1=Easy, 2=Medium, 3=Hard
  riskLevel?: "low" | "medium" | "high" | "very-high"; // Phase 7: Risk level

  // Phase 7: Theory and academic background
  theory?: {
    origin?: string; // Where the strategy originated
    author?: string; // Creator/Author name
    authorInfo?: string; // Brief author bio
    year?: number; // Year published/created
    paper?: string; // Academic paper name
    paperUrl?: string; // Link to paper
    academicBasis?: string; // Academic foundation
  };

  logic: {
    entry: string[];
    exit: string[];
    positionSizing?: string; // Phase 7: Position sizing rules
    riskManagement?: string; // Phase 7: Risk management rules
  };
  params: {
    name: string;
    nameEn: string;
    default: number | string;
    range: string;
    description?: string; // Phase 7: Parameter description
  }[];
  pros: string[];
  cons: string[];

  // Phase 7: Best practices guidance
  bestPractices?: {
    dos: string[]; // Things to do
    donts: string[]; // Things to avoid
    tips: string[]; // Practical tips
    commonMistakes?: string[]; // Common mistakes to avoid
  };

  // Phase 7: Period significance
  periodSignificance?: {
    shortTerm: string; // Intraday/weekly significance
    mediumTerm: string; // Weekly/monthly significance
    longTerm: string; // Quarterly/yearly significance
    bestPeriod: string; // Optimal usage period
  };

  bestFor: string;
  bestForEn: string;
  notSuitableFor?: string; // Phase 7: When not to use

  // Phase 7: Historical performance reference
  historicalPerformance?: {
    backtestPeriod?: string;
    annualReturn?: number;
    maxDrawdown?: number;
    sharpeRatio?: number;
    winRate?: number;
    note?: string;
  };

  relatedStrategies?: string[]; // Phase 7: Related strategy IDs
  riskWarning?: string;
  prompt: string; // Prompt for AI generation

  // Phase 7: Versioning
  version?: string;
  lastUpdated?: string;
}

/**
 * Category display info
 * 分类显示信息
 */
export const categoryInfo: Record<
  StrategyCategory,
  { name: string; nameEn: string; icon: string }
> = {
  trend: { name: "趋势跟踪", nameEn: "Trend Following", icon: "📈" },
  "mean-revert": { name: "均值回归", nameEn: "Mean Reversion", icon: "🔄" },
  momentum: { name: "动量策略", nameEn: "Momentum", icon: "🚀" },
  pattern: { name: "形态识别", nameEn: "Pattern", icon: "📊" },
  composite: { name: "复合策略", nameEn: "Composite", icon: "🔗" },
  factor: { name: "因子投资", nameEn: "Factor", icon: "📐" },
  ml: { name: "量化套利", nameEn: "Quant/ML", icon: "🤖" },
  crypto: { name: "加密货币", nameEn: "Crypto", icon: "₿" },
  futures: { name: "期货套利", nameEn: "Futures", icon: "📜" },
  intraday: { name: "日内交易", nameEn: "Intraday", icon: "⏱️" },
};

/**
 * Market display info
 * 市场显示信息
 */
export const marketInfo: Record<MarketType, { name: string; color: string }> = {
  stock: { name: "股票", color: "bg-blue-500/20 text-blue-400" },
  futures: { name: "期货", color: "bg-orange-500/20 text-orange-400" },
  crypto: { name: "加密", color: "bg-purple-500/20 text-purple-400" },
};

// =============================================================================
// CLASSIC STRATEGIES / 经典策略 (20个)
// =============================================================================

export const classicStrategies: StrategyTemplate[] = [
  // ========== TREND FOLLOWING (6) ==========
  {
    id: "classic-01",
    name: "双均线交叉",
    nameEn: "Dual MA Crossover",
    category: "trend",
    subcategory: "moving-average",
    type: "classic",
    icon: "📈",
    summary: "MA5/MA20 金叉死叉，华尔街经典趋势策略",
    summaryEn:
      "MA5/MA20 golden/death cross, classic Wall Street trend strategy",
    description:
      "双均线交叉是最基础的趋势跟踪策略，通过短期和长期移动平均线的交叉来判断趋势方向。金叉（短期上穿长期）表示上升趋势开始，死叉（短期下穿长期）表示下降趋势开始。",
    markets: ["stock", "futures", "crypto"],
    timeframes: ["swing", "position"],
    difficulty: 1,
    riskLevel: "medium",
    theory: {
      origin: "移动平均线由Charles Dow在19世纪末提出",
      author: "Charles Dow",
      authorInfo: "道琼斯公司创始人，道氏理论奠基人",
      year: 1884,
      academicBasis: "价格趋势跟踪、均值平滑",
    },
    logic: {
      entry: ["短期均线(MA5)上穿长期均线(MA20)形成金叉时买入"],
      exit: ["短期均线(MA5)下穿长期均线(MA20)形成死叉时卖出"],
    },
    params: [
      {
        name: "短期均线",
        nameEn: "Fast MA",
        default: 5,
        range: "5-10",
        description: "常用5日、10日",
      },
      {
        name: "长期均线",
        nameEn: "Slow MA",
        default: 20,
        range: "20-60",
        description: "常用20日、60日",
      },
      { name: "止损比例", nameEn: "Stop Loss", default: "5%", range: "3-8%" },
    ],
    pros: ["逻辑简单，易于理解", "趋势明确时效果好", "参数少，不易过拟合"],
    cons: ["震荡市假信号多", "信号滞后", "频繁交易成本高"],
    bestPractices: {
      dos: ["配合成交量确认", "在趋势明确的市场使用", "设置止损控制风险"],
      donts: ["不要在震荡市频繁交易", "不要忽视大周期趋势"],
      tips: ["可结合ADX过滤震荡市", "周线金叉比日线更可靠"],
    },
    periodSignificance: {
      shortTerm: "日内交叉频繁，噪音大",
      mediumTerm: "日线级别金叉死叉较为可靠",
      longTerm: "周线金叉死叉用于判断大趋势",
      bestPeriod: "日线或周线级别",
    },
    bestFor: "单边趋势行情",
    bestForEn: "Strong trending markets",
    notSuitableFor: "震荡整理行情",
    version: "2.0",
    lastUpdated: "2025-01-20",
    prompt:
      "双均线交叉策略：当5日均线上穿20日均线时买入，当5日均线下穿20日均线时卖出，止损5%",
  },
  {
    id: "classic-02",
    name: "三均线系统",
    nameEn: "Triple MA System",
    category: "trend",
    type: "classic",
    icon: "📈",
    summary: "MA5/MA20/MA60 多空排列，趋势确认更可靠",
    summaryEn: "MA5/MA20/MA60 alignment for trend confirmation",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["MA5>MA20>MA60 多头排列时买入", "MA60向上拐头确认趋势"],
      exit: ["MA5<MA20 时卖出", "或 MA20<MA60 趋势反转时清仓"],
    },
    params: [
      { name: "短期均线", nameEn: "Fast MA", default: 5, range: "5-10" },
      { name: "中期均线", nameEn: "Mid MA", default: 20, range: "15-30" },
      { name: "长期均线", nameEn: "Slow MA", default: 60, range: "50-120" },
    ],
    pros: ["趋势确认更可靠", "减少假信号", "适合中长线"],
    cons: ["入场较晚", "盈利空间可能被压缩", "不适合短线"],
    bestFor: "中长期趋势行情",
    bestForEn: "Medium to long-term trends",
    prompt:
      "三均线系统：当5日、20日、60日均线呈多头排列(MA5>MA20>MA60)时买入，当MA5下穿MA20时卖出",
  },
  {
    id: "classic-03",
    name: "海龟交易法",
    nameEn: "Turtle Trading",
    category: "trend",
    subcategory: "breakout",
    type: "classic",
    icon: "🐢",
    summary: "20日突破入场，10日突破离场，传奇趋势跟踪系统",
    summaryEn: "20-day breakout entry, 10-day breakout exit, legendary system",
    description:
      "海龟交易法则是1983年由传奇交易员理查德·丹尼斯和威廉·埃克哈特设计的完整交易系统，用于证明优秀交易员可以被培养。他们招募了一群新手'海龟'，5年内创造了超过1.75亿美元的利润。",
    markets: ["stock", "futures", "crypto"],
    timeframes: ["swing", "position"],
    difficulty: 2,
    riskLevel: "medium",
    theory: {
      origin: "1983年芝加哥商品交易所海龟实验",
      author: "Richard Dennis & William Eckhardt",
      authorInfo:
        "Richard Dennis被称为'商品交易王子'，从400美元起家创造了2亿美元财富",
      year: 1983,
      paper: "Way of the Turtle",
      academicBasis: "趋势跟踪、突破交易、风险管理",
    },
    logic: {
      entry: ["价格突破20日最高价时买入", "ATR计算仓位大小"],
      exit: ["价格跌破10日最低价时卖出", "或触发2倍ATR止损"],
      positionSizing: "单笔风险控制在账户的1-2%，股数 = (账户×1%) / (ATR×2)",
      riskManagement: "最大持仓不超过账户的20%，单一方向不超过10%",
    },
    params: [
      {
        name: "入场周期",
        nameEn: "Entry Period",
        default: 20,
        range: "20-55",
        description: "System 1用20日，System 2用55日",
      },
      {
        name: "离场周期",
        nameEn: "Exit Period",
        default: 10,
        range: "10-20",
        description: "一般为入场周期的一半",
      },
      { name: "ATR周期", nameEn: "ATR Period", default: 20, range: "14-20" },
      {
        name: "ATR止损倍数",
        nameEn: "ATR Stop",
        default: 2,
        range: "1.5-3",
        description: "止损距离=2倍ATR",
      },
    ],
    pros: ["完整的交易系统", "包含仓位管理", "历史验证有效"],
    cons: ["回撤较大", "需要足够资金", "心理压力大"],
    bestPractices: {
      dos: [
        "严格遵守入场和出场规则",
        "使用ATR计算仓位",
        "同时交易多个不相关品种",
      ],
      donts: ["不要在震荡市强行使用", "不要随意调整止损", "不要过度杠杆"],
      tips: [
        "可添加趋势过滤器（如200日均线）减少假突破",
        "在强趋势市场效果最好",
      ],
      commonMistakes: ["止损太紧", "赢利时过早了结", "资金管理不当"],
    },
    periodSignificance: {
      shortTerm: "日内不适用，信号滞后且假突破多",
      mediumTerm: "最佳应用周期，20日突破能有效捕捉中期趋势",
      longTerm: "可调整为55日系统用于长期趋势",
      bestPeriod: "日线级别，持仓数周到数月",
    },
    bestFor: "期货和加密货币趋势",
    bestForEn: "Futures and crypto trends",
    notSuitableFor: "震荡市、高频交易、小资金账户",
    historicalPerformance: {
      backtestPeriod: "1983-1988 (原始海龟实验)",
      annualReturn: 80,
      maxDrawdown: 35,
      sharpeRatio: 1.2,
      winRate: 40,
      note: "虽然胜率仅40%，但平均盈利是平均亏损的4倍以上",
    },
    relatedStrategies: ["classic-04"],
    riskWarning: "海龟交易法回撤较大，需要充足资金和心理准备承受连续亏损。",
    prompt:
      "海龟交易法则：价格突破20日最高价买入，跌破10日最低价卖出，使用ATR计算仓位，止损2倍ATR",
    version: "2.0",
    lastUpdated: "2025-01-20",
  },
  {
    id: "classic-04",
    name: "唐奇安通道",
    nameEn: "Donchian Channel",
    category: "trend",
    type: "classic",
    icon: "📊",
    summary: "N日高低点突破，趋势交易始祖",
    summaryEn: "N-day high/low breakout, the ancestor of trend trading",
    markets: ["stock", "futures", "crypto"],
    difficulty: 1,
    logic: {
      entry: ["价格突破N日最高价时做多", "价格突破N日最低价时做空"],
      exit: ["反向突破时平仓", "或使用较短周期作为离场"],
    },
    params: [
      {
        name: "通道周期",
        nameEn: "Channel Period",
        default: 20,
        range: "10-55",
      },
      { name: "止损周期", nameEn: "Stop Period", default: 10, range: "5-20" },
    ],
    pros: ["规则清晰", "无需复杂计算", "趋势捕捉能力强"],
    cons: ["震荡市亏损", "假突破风险", "需要过滤条件"],
    bestFor: "强趋势品种",
    bestForEn: "Strongly trending instruments",
    prompt:
      "唐奇安通道策略：价格突破20日最高价买入，跌破20日最低价卖出，或跌破10日最低价止损",
  },
  {
    id: "classic-05",
    name: "ADX趋势确认",
    nameEn: "ADX Trend Filter",
    category: "trend",
    type: "classic",
    icon: "📏",
    summary: "ADX>25确认趋势，DI+/DI-判方向",
    summaryEn: "ADX>25 confirms trend, DI+/DI- determines direction",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["ADX>25 确认有趋势", "DI+>DI- 时做多", "DI->DI+ 时做空"],
      exit: ["ADX下降表示趋势减弱", "DI交叉反转时平仓"],
    },
    params: [
      { name: "ADX周期", nameEn: "ADX Period", default: 14, range: "10-20" },
      { name: "ADX阈值", nameEn: "ADX Threshold", default: 25, range: "20-30" },
    ],
    pros: ["过滤震荡市", "趋势强度量化", "减少假信号"],
    cons: ["信号滞后", "需配合其他指标", "复杂度较高"],
    bestFor: "趋势确认和过滤",
    bestForEn: "Trend confirmation and filtering",
    prompt:
      "ADX趋势策略：当ADX大于25且DI+上穿DI-时买入，当DI+下穿DI-或ADX低于20时卖出",
  },
  {
    id: "classic-06",
    name: "抛物线SAR",
    nameEn: "Parabolic SAR",
    category: "trend",
    type: "classic",
    icon: "🎯",
    summary: "追踪止损，趋势反转信号",
    summaryEn: "Trailing stop, trend reversal signal",
    markets: ["stock", "futures", "crypto"],
    difficulty: 1,
    logic: {
      entry: ["SAR点从价格上方移到下方时买入", "SAR点从价格下方移到上方时卖出"],
      exit: ["SAR反转时立即平仓", "作为动态止损"],
    },
    params: [
      {
        name: "加速因子",
        nameEn: "AF Step",
        default: 0.02,
        range: "0.01-0.05",
      },
      { name: "最大加速", nameEn: "AF Max", default: 0.2, range: "0.1-0.3" },
    ],
    pros: ["自动追踪止损", "简单直观", "锁定利润"],
    cons: ["震荡市频繁止损", "趋势初期表现差", "参数敏感"],
    bestFor: "趋势行情的止损管理",
    bestForEn: "Stop loss management in trends",
    prompt:
      "抛物线SAR策略：SAR指标翻转到价格下方时买入，翻转到价格上方时卖出，加速因子0.02，最大0.2",
  },

  // ========== MEAN REVERSION (4) ==========
  {
    id: "classic-07",
    name: "布林带回归",
    nameEn: "Bollinger Bands Reversion",
    category: "mean-revert",
    type: "classic",
    icon: "🔄",
    summary: "触及下轨买入，触及上轨卖出",
    summaryEn: "Buy at lower band, sell at upper band",
    markets: ["stock", "futures", "crypto"],
    difficulty: 1,
    logic: {
      entry: [
        "价格触及或跌破布林带下轨时买入",
        "价格触及或突破布林带上轨时卖出",
      ],
      exit: ["价格回归中轨时平仓", "或突破相反方向时止损"],
    },
    params: [
      { name: "均线周期", nameEn: "MA Period", default: 20, range: "15-30" },
      { name: "标准差倍数", nameEn: "Std Dev", default: 2, range: "1.5-2.5" },
    ],
    pros: ["震荡市效果好", "进出场明确", "波动率自适应"],
    cons: ["趋势市亏损", "极端行情失效", "需要过滤趋势"],
    bestFor: "震荡整理行情",
    bestForEn: "Range-bound markets",
    prompt:
      "布林带均值回归策略：价格触及布林带下轨时买入，触及上轨时卖出，回归中轨时获利了结，周期20，标准差2倍",
  },
  {
    id: "classic-08",
    name: "RSI超买超卖",
    nameEn: "RSI Overbought/Oversold",
    category: "mean-revert",
    type: "classic",
    icon: "📉",
    summary: "RSI<30买入，RSI>70卖出",
    summaryEn: "Buy when RSI<30, sell when RSI>70",
    markets: ["stock", "futures", "crypto"],
    difficulty: 1,
    logic: {
      entry: ["RSI低于30（超卖）时买入", "RSI高于70（超买）时做空"],
      exit: ["RSI回到50中性区域时平仓", "或触发止损"],
    },
    params: [
      { name: "RSI周期", nameEn: "RSI Period", default: 14, range: "7-21" },
      { name: "超卖阈值", nameEn: "Oversold", default: 30, range: "20-35" },
      { name: "超买阈值", nameEn: "Overbought", default: 70, range: "65-80" },
    ],
    pros: ["逻辑简单", "应用广泛", "配合其他指标效果更好"],
    cons: ["强趋势中可能持续超买超卖", "单独使用效果有限", "需要过滤"],
    bestFor: "震荡市反转交易",
    bestForEn: "Reversal trading in ranging markets",
    prompt:
      "RSI超买超卖策略：RSI(14)低于30时买入，高于70时卖出，RSI回到50时获利了结",
  },
  {
    id: "classic-09",
    name: "KDJ低位金叉",
    nameEn: "KDJ Low Cross",
    category: "mean-revert",
    type: "classic",
    icon: "📊",
    summary: "K<20且金叉买入，K>80且死叉卖出",
    summaryEn: "Buy on golden cross below 20, sell on death cross above 80",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["K值低于20进入超卖区", "K线上穿D线形成金叉时买入"],
      exit: ["K值高于80进入超买区", "K线下穿D线形成死叉时卖出"],
    },
    params: [
      { name: "K周期", nameEn: "K Period", default: 9, range: "5-14" },
      { name: "D平滑周期", nameEn: "D Period", default: 3, range: "3-5" },
      { name: "J平滑周期", nameEn: "J Period", default: 3, range: "3-5" },
    ],
    pros: ["反应灵敏", "底部信号明确", "A股应用广泛"],
    cons: ["假金叉较多", "趋势市效果差", "需要配合使用"],
    bestFor: "短线反弹交易",
    bestForEn: "Short-term bounce trading",
    prompt:
      "KDJ策略：当K值低于20且K线上穿D线形成金叉时买入，当K值高于80且K线下穿D线时卖出",
  },
  {
    id: "classic-10",
    name: "CCI极端值",
    nameEn: "CCI Extreme",
    category: "mean-revert",
    type: "classic",
    icon: "📐",
    summary: "CCI<-100买入，CCI>100卖出",
    summaryEn: "Buy when CCI<-100, sell when CCI>100",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["CCI低于-100进入超卖区买入", "CCI高于100进入超买区卖出"],
      exit: ["CCI回归0轴附近时平仓", "或反向突破极端区域时止损"],
    },
    params: [
      { name: "CCI周期", nameEn: "CCI Period", default: 20, range: "14-26" },
      { name: "极端阈值", nameEn: "Threshold", default: 100, range: "80-150" },
    ],
    pros: ["捕捉价格偏离", "适合震荡市", "信号相对较少"],
    cons: ["趋势市失效", "极端值可能持续", "需要止损保护"],
    bestFor: "震荡行情的极端反转",
    bestForEn: "Extreme reversals in ranging markets",
    prompt:
      "CCI策略：CCI(20)低于-100时买入，高于100时卖出，CCI回到0轴附近时平仓",
  },

  // ========== MOMENTUM (4) ==========
  {
    id: "classic-11",
    name: "MACD动量",
    nameEn: "MACD Momentum",
    category: "momentum",
    type: "classic",
    icon: "🚀",
    summary: "DIF与DEA金叉死叉，经典中的经典",
    summaryEn: "DIF/DEA cross, the classic of classics",
    markets: ["stock", "futures", "crypto"],
    difficulty: 1,
    logic: {
      entry: ["DIF上穿DEA形成金叉时买入", "MACD柱状图由负转正确认"],
      exit: ["DIF下穿DEA形成死叉时卖出", "MACD柱状图由正转负确认"],
    },
    params: [
      { name: "快线周期", nameEn: "Fast Period", default: 12, range: "8-15" },
      { name: "慢线周期", nameEn: "Slow Period", default: 26, range: "20-30" },
      {
        name: "信号线周期",
        nameEn: "Signal Period",
        default: 9,
        range: "7-12",
      },
    ],
    pros: ["应用最广泛", "趋势和动量兼顾", "信号明确"],
    cons: ["滞后性", "震荡市假信号", "需要过滤"],
    bestFor: "趋势确认和动量交易",
    bestForEn: "Trend confirmation and momentum trading",
    prompt:
      "MACD策略：DIF上穿DEA（金叉）买入，DIF下穿DEA（死叉）卖出，参数12-26-9",
  },
  {
    id: "classic-12",
    name: "威廉指标W%R",
    nameEn: "Williams %R",
    category: "momentum",
    type: "classic",
    icon: "📊",
    summary: "W%R进入超卖区反弹买入",
    summaryEn: "Buy when W%R bounces from oversold zone",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["W%R低于-80进入超卖区", "从超卖区反弹向上突破-80时买入"],
      exit: ["W%R高于-20进入超买区", "从超买区回落向下突破-20时卖出"],
    },
    params: [
      { name: "周期", nameEn: "Period", default: 14, range: "10-21" },
      { name: "超卖线", nameEn: "Oversold", default: -80, range: "-90 to -70" },
      {
        name: "超买线",
        nameEn: "Overbought",
        default: -20,
        range: "-30 to -10",
      },
    ],
    pros: ["反应灵敏", "适合短线", "与RSI互补"],
    cons: ["信号频繁", "需要过滤", "趋势市表现差"],
    bestFor: "短期超买超卖反转",
    bestForEn: "Short-term overbought/oversold reversals",
    prompt:
      "威廉指标策略：W%R(14)从低于-80的超卖区向上突破-80时买入，从高于-20的超买区向下突破-20时卖出",
  },
  {
    id: "classic-13",
    name: "动量突破",
    nameEn: "Momentum Breakout",
    category: "momentum",
    type: "classic",
    icon: "💪",
    summary: "价格创N日新高+成交量确认",
    summaryEn: "N-day high breakout with volume confirmation",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["价格突破N日最高价", "成交量大于N日平均成交量的1.5倍确认"],
      exit: ["价格跌破N/2日最低价时止损", "或达到目标收益时止盈"],
    },
    params: [
      {
        name: "突破周期",
        nameEn: "Breakout Period",
        default: 20,
        range: "10-30",
      },
      {
        name: "成交量倍数",
        nameEn: "Volume Multiple",
        default: 1.5,
        range: "1.2-2",
      },
      { name: "止损周期", nameEn: "Stop Period", default: 10, range: "5-15" },
    ],
    pros: ["捕捉强势股", "成交量确认可靠性高", "趋势初期入场"],
    cons: ["假突破风险", "入场价格较高", "回调风险"],
    bestFor: "强势突破行情",
    bestForEn: "Strong breakout situations",
    prompt:
      "动量突破策略：价格创20日新高且成交量超过20日均量1.5倍时买入，跌破10日最低价止损，止盈15%",
  },
  {
    id: "classic-14",
    name: "相对强弱",
    nameEn: "Relative Strength",
    category: "momentum",
    type: "classic",
    icon: "⚖️",
    summary: "选择相对大盘强势的标的",
    summaryEn: "Select instruments outperforming the benchmark",
    markets: ["stock"],
    difficulty: 2,
    logic: {
      entry: ["计算个股相对大盘的强弱比率", "买入相对强度排名前10%的股票"],
      exit: ["相对强度排名下降到后50%时卖出", "或持有固定周期后轮动"],
    },
    params: [
      { name: "计算周期", nameEn: "Period", default: 20, range: "10-60" },
      { name: "选股数量", nameEn: "Top N", default: 10, range: "5-20" },
      { name: "轮动周期", nameEn: "Rebalance", default: 20, range: "5-60" },
    ],
    pros: ["跟随强势股", "相对简单", "适合轮动策略"],
    cons: ["需要选股池", "交易成本高", "动量反转风险"],
    bestFor: "股票轮动策略",
    bestForEn: "Stock rotation strategies",
    prompt:
      "相对强弱策略：计算股票相对大盘指数的20日涨幅比率，买入强度排名前10%的股票，每20天轮动一次",
  },

  // ========== PATTERN (3) ==========
  {
    id: "classic-15",
    name: "双底反转",
    nameEn: "Double Bottom",
    category: "pattern",
    type: "classic",
    icon: "W",
    summary: "W底形态确认后入场",
    summaryEn: "Enter after W-bottom pattern confirmation",
    markets: ["stock", "futures", "crypto"],
    difficulty: 3,
    logic: {
      entry: [
        "识别两个相近的低点形成W形态",
        "价格突破颈线（两低点间的高点）时买入",
      ],
      exit: ["止损设在第二个底部下方", "目标价为颈线到底部距离的1-2倍"],
    },
    params: [
      {
        name: "形态识别周期",
        nameEn: "Pattern Period",
        default: 60,
        range: "30-120",
      },
      {
        name: "颈线突破确认",
        nameEn: "Neckline Break",
        default: "1%",
        range: "0.5-2%",
      },
      {
        name: "底部容差",
        nameEn: "Bottom Tolerance",
        default: "3%",
        range: "1-5%",
      },
    ],
    pros: ["可靠的反转信号", "止损明确", "盈亏比好"],
    cons: ["形态识别主观", "出现频率低", "需要人工确认"],
    bestFor: "底部反转交易",
    bestForEn: "Bottom reversal trading",
    prompt:
      "双底反转策略：识别W底形态，当价格突破颈线1%时买入，止损设在第二个底部下方3%，目标价设在颈线以上等距位置",
  },
  {
    id: "classic-16",
    name: "头肩底",
    nameEn: "Inverse Head & Shoulders",
    category: "pattern",
    type: "classic",
    icon: "👤",
    summary: "颈线突破后买入",
    summaryEn: "Buy after neckline breakout",
    markets: ["stock", "futures", "crypto"],
    difficulty: 3,
    logic: {
      entry: ["识别左肩-头部-右肩的三底结构", "价格突破颈线时买入"],
      exit: ["止损设在右肩下方", "目标价为头部到颈线距离"],
    },
    params: [
      {
        name: "形态周期",
        nameEn: "Pattern Period",
        default: 90,
        range: "60-180",
      },
      {
        name: "颈线突破确认",
        nameEn: "Neckline Break",
        default: "2%",
        range: "1-3%",
      },
    ],
    pros: ["经典反转形态", "成功率较高", "目标明确"],
    cons: ["形态识别难度大", "耗时长", "需要经验"],
    bestFor: "大级别底部反转",
    bestForEn: "Major bottom reversals",
    prompt:
      "头肩底策略：识别头肩底形态，当价格放量突破颈线2%时买入，止损设在右肩低点下方，目标价为头部到颈线的距离",
  },
  {
    id: "classic-17",
    name: "三角形突破",
    nameEn: "Triangle Breakout",
    category: "pattern",
    type: "classic",
    icon: "△",
    summary: "收敛三角形方向突破",
    summaryEn: "Breakout from converging triangle",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: [
        "识别高点降低、低点抬高的收敛三角形",
        "价格突破上轨做多，突破下轨做空",
      ],
      exit: ["止损设在三角形内部", "目标为三角形起始高度"],
    },
    params: [
      {
        name: "最小形态周期",
        nameEn: "Min Period",
        default: 20,
        range: "15-40",
      },
      {
        name: "突破确认",
        nameEn: "Break Confirm",
        default: "1.5%",
        range: "1-3%",
      },
    ],
    pros: ["方向性突破", "止损明确", "可做多做空"],
    cons: ["假突破风险", "需要及时识别", "震荡时间不确定"],
    bestFor: "盘整后的方向性突破",
    bestForEn: "Directional breakouts after consolidation",
    prompt:
      "三角形突破策略：识别收敛三角形形态，价格向上突破上边界1.5%时买入，向下突破下边界1.5%时卖出，止损设在三角形另一侧",
  },

  // ========== COMPOSITE (3) ==========
  {
    id: "classic-18",
    name: "MACD+RSI组合",
    nameEn: "MACD + RSI Combo",
    category: "composite",
    type: "classic",
    icon: "🔗",
    summary: "MACD金叉+RSI未超买双重确认",
    summaryEn: "MACD golden cross + RSI not overbought",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["MACD金叉（DIF上穿DEA）", "同时RSI低于60（未超买）时买入"],
      exit: ["MACD死叉", "或RSI高于80时卖出"],
    },
    params: [
      {
        name: "MACD参数",
        nameEn: "MACD",
        default: "12-26-9",
        range: "Standard",
      },
      { name: "RSI周期", nameEn: "RSI Period", default: 14, range: "10-21" },
      { name: "RSI阈值", nameEn: "RSI Threshold", default: 60, range: "55-70" },
    ],
    pros: ["双重确认减少假信号", "结合趋势和超买超卖", "灵活性高"],
    cons: ["信号较少", "可能错过快速行情", "参数需要优化"],
    bestFor: "稳健的趋势跟随",
    bestForEn: "Steady trend following",
    prompt:
      "MACD+RSI组合策略：当MACD金叉且RSI低于60时买入，当MACD死叉或RSI高于80时卖出",
  },
  {
    id: "classic-19",
    name: "均线+成交量",
    nameEn: "MA + Volume",
    category: "composite",
    type: "classic",
    icon: "📊",
    summary: "均线金叉+成交量放大确认",
    summaryEn: "MA cross with volume confirmation",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["MA5上穿MA20形成金叉", "当日成交量大于5日均量1.5倍时买入"],
      exit: ["MA5下穿MA20死叉时卖出", "或成交量萎缩时减仓"],
    },
    params: [
      { name: "短期均线", nameEn: "Fast MA", default: 5, range: "5-10" },
      { name: "长期均线", nameEn: "Slow MA", default: 20, range: "15-30" },
      {
        name: "量比阈值",
        nameEn: "Volume Ratio",
        default: 1.5,
        range: "1.2-2",
      },
    ],
    pros: ["成交量确认可靠", "减少假突破", "适合A股"],
    cons: ["成交量造假风险", "需要实时监控", "参数敏感"],
    bestFor: "放量突破行情",
    bestForEn: "Volume breakout situations",
    prompt:
      "均线成交量策略：MA5上穿MA20且成交量大于5日均量1.5倍时买入，MA5下穿MA20时卖出",
  },
  {
    id: "classic-20",
    name: "波动率突破",
    nameEn: "Volatility Breakout",
    category: "composite",
    type: "classic",
    icon: "💥",
    summary: "ATR突破+趋势确认",
    summaryEn: "ATR breakout with trend confirmation",
    markets: ["stock", "futures", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["价格突破前日收盘价+N倍ATR时买入", "同时MA方向向上确认趋势"],
      exit: ["价格跌破前日收盘价-N倍ATR时止损", "或利润达到2倍ATR时止盈"],
    },
    params: [
      { name: "ATR周期", nameEn: "ATR Period", default: 14, range: "10-20" },
      { name: "ATR倍数", nameEn: "ATR Multiple", default: 1.5, range: "1-2.5" },
      { name: "趋势均线", nameEn: "Trend MA", default: 20, range: "10-30" },
    ],
    pros: ["适应波动率变化", "动态止损止盈", "风险可控"],
    cons: ["低波动时信号少", "需要配合趋势过滤", "参数需优化"],
    bestFor: "波动率扩张行情",
    bestForEn: "Volatility expansion situations",
    prompt:
      "波动率突破策略：价格突破昨收+1.5倍ATR(14)且20日均线向上时买入，跌破昨收-1.5倍ATR止损，盈利2倍ATR止盈",
  },
];

// =============================================================================
// POPULAR STRATEGIES / 流行策略 (20个)
// =============================================================================

export const popularStrategies: StrategyTemplate[] = [
  // ========== FACTOR (5) ==========
  {
    id: "popular-01",
    name: "动量因子策略",
    nameEn: "Momentum Factor",
    category: "factor",
    type: "popular",
    icon: "🚀",
    summary: "买入过去N月收益最高的标的",
    summaryEn: "Buy top performers over past N months",
    markets: ["stock", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["计算所有标的过去N个月的收益率", "买入收益率排名前10%的标的"],
      exit: ["每月末重新排名", "卖出排名下降到后50%的标的"],
    },
    params: [
      {
        name: "回看周期",
        nameEn: "Lookback",
        default: "12个月",
        range: "3-12个月",
      },
      { name: "持仓数量", nameEn: "Top N", default: 10, range: "5-20" },
      {
        name: "轮动频率",
        nameEn: "Rebalance",
        default: "月度",
        range: "周/月/季",
      },
    ],
    pros: ["学术研究支持", "长期有效", "逻辑简单"],
    cons: ["动量反转风险", "交易成本高", "需要选股池"],
    bestFor: "中长期股票投资",
    bestForEn: "Medium to long-term stock investment",
    prompt:
      "动量因子策略：计算股票池中所有股票过去12个月收益率，每月初买入收益率最高的10只股票，等权持有，月末轮动",
  },
  {
    id: "popular-02",
    name: "价值因子策略",
    nameEn: "Value Factor",
    category: "factor",
    type: "popular",
    icon: "💎",
    summary: "低PE/PB股票组合",
    summaryEn: "Low PE/PB stock portfolio",
    markets: ["stock"],
    difficulty: 2,
    logic: {
      entry: ["筛选PE低于行业中位数的股票", "进一步筛选PB最低的前20%"],
      exit: ["PE/PB上升到行业平均以上时卖出", "或持有固定周期后轮动"],
    },
    params: [
      {
        name: "PE阈值",
        nameEn: "PE Threshold",
        default: "行业中位数",
        range: "行业中位数以下",
      },
      {
        name: "PB排名",
        nameEn: "PB Rank",
        default: "前20%",
        range: "前10-30%",
      },
      {
        name: "轮动频率",
        nameEn: "Rebalance",
        default: "季度",
        range: "月/季/半年",
      },
    ],
    pros: ["价值投资经典", "低估值保护", "长期收益稳定"],
    cons: ["价值陷阱风险", "可能长期跑输成长股", "需要基本面数据"],
    bestFor: "长期价值投资",
    bestForEn: "Long-term value investing",
    prompt:
      "价值因子策略：筛选PE低于行业中位数且PB最低的前20%股票，等权买入，每季度轮动一次",
  },
  {
    id: "popular-03",
    name: "质量因子策略",
    nameEn: "Quality Factor",
    category: "factor",
    type: "popular",
    icon: "⭐",
    summary: "高ROE+低负债组合",
    summaryEn: "High ROE + Low debt portfolio",
    markets: ["stock"],
    difficulty: 2,
    logic: {
      entry: ["筛选ROE高于15%的股票", "进一步筛选资产负债率低于50%的股票"],
      exit: ["ROE下降到10%以下时卖出", "或负债率上升到60%以上时卖出"],
    },
    params: [
      {
        name: "ROE阈值",
        nameEn: "ROE Threshold",
        default: "15%",
        range: "10-20%",
      },
      {
        name: "负债率上限",
        nameEn: "Debt Ratio Max",
        default: "50%",
        range: "40-60%",
      },
      {
        name: "轮动频率",
        nameEn: "Rebalance",
        default: "季度",
        range: "季/半年",
      },
    ],
    pros: ["选择优质公司", "风险较低", "收益稳定"],
    cons: ["可能错过高成长股", "需要财务数据", "估值可能偏高"],
    bestFor: "稳健型股票投资",
    bestForEn: "Steady stock investment",
    prompt:
      "质量因子策略：筛选ROE大于15%且资产负债率低于50%的优质股票，等权买入，每季度轮动",
  },
  {
    id: "popular-04",
    name: "小市值策略",
    nameEn: "Small Cap Strategy",
    category: "factor",
    type: "popular",
    icon: "🔬",
    summary: "小盘股超额收益",
    summaryEn: "Small cap excess returns",
    markets: ["stock"],
    difficulty: 2,
    logic: {
      entry: ["按市值排序，选择市值最小的10%股票", "排除流动性过低的股票"],
      exit: ["市值增长到中等以上时卖出", "定期轮动"],
    },
    params: [
      {
        name: "市值分位",
        nameEn: "Cap Percentile",
        default: "最小10%",
        range: "5-20%",
      },
      {
        name: "流动性过滤",
        nameEn: "Liquidity Filter",
        default: "日成交额>1000万",
        range: "500-5000万",
      },
      {
        name: "轮动频率",
        nameEn: "Rebalance",
        default: "月度",
        range: "周/月",
      },
    ],
    pros: ["小盘股溢价", "历史超额收益明显", "分散投资"],
    cons: ["流动性风险", "波动大", "壳价值扰动"],
    bestFor: "追求超额收益的投资者",
    bestForEn: "Investors seeking alpha",
    riskWarning: "小市值股票波动大，流动性风险高，不适合大资金",
    prompt:
      "小市值策略：买入市值最小的10%股票（排除日成交额低于1000万的），等权持有，每月轮动",
  },
  {
    id: "popular-05",
    name: "低波动策略",
    nameEn: "Low Volatility",
    category: "factor",
    type: "popular",
    icon: "🛡️",
    summary: "选择波动率最低的标的",
    summaryEn: "Select lowest volatility instruments",
    markets: ["stock", "crypto"],
    difficulty: 2,
    logic: {
      entry: ["计算所有标的过去N日的波动率", "买入波动率最低的20%"],
      exit: ["波动率上升到平均以上时卖出", "定期轮动"],
    },
    params: [
      {
        name: "波动率周期",
        nameEn: "Vol Period",
        default: 60,
        range: "20-120",
      },
      {
        name: "选股比例",
        nameEn: "Select Ratio",
        default: "最低20%",
        range: "10-30%",
      },
      {
        name: "轮动频率",
        nameEn: "Rebalance",
        default: "月度",
        range: "周/月",
      },
    ],
    pros: ["风险较低", "夏普比率高", "适合保守投资者"],
    cons: ["牛市可能跑输", "收益有限", "可能集中于特定行业"],
    bestFor: "稳健保守型投资",
    bestForEn: "Conservative investment",
    prompt:
      "低波动策略：计算股票60日波动率，买入波动率最低的20%股票，等权持有，每月轮动",
  },

  // ========== ML/QUANT (3) ==========
  {
    id: "popular-06",
    name: "多因子打分",
    nameEn: "Multi-Factor Scoring",
    category: "ml",
    type: "popular",
    icon: "🤖",
    summary: "综合多因子加权打分排序",
    summaryEn: "Weighted multi-factor scoring and ranking",
    markets: ["stock"],
    difficulty: 3,
    logic: {
      entry: ["计算价值、动量、质量、波动等因子得分", "按综合得分买入前10%"],
      exit: ["综合得分下降到后50%时卖出", "定期重新打分"],
    },
    params: [
      {
        name: "价值权重",
        nameEn: "Value Weight",
        default: "25%",
        range: "0-50%",
      },
      {
        name: "动量权重",
        nameEn: "Momentum Weight",
        default: "25%",
        range: "0-50%",
      },
      {
        name: "质量权重",
        nameEn: "Quality Weight",
        default: "25%",
        range: "0-50%",
      },
      {
        name: "波动权重",
        nameEn: "Vol Weight",
        default: "25%",
        range: "0-50%",
      },
    ],
    pros: ["多维度选股", "风险分散", "可定制化"],
    cons: ["因子权重需要优化", "过拟合风险", "实现复杂"],
    bestFor: "专业量化投资",
    bestForEn: "Professional quant investing",
    prompt:
      "多因子打分策略：计算价值(PE/PB)、动量(12月收益)、质量(ROE)、低波动因子得分，等权加权，买入综合得分前10%的股票",
  },
  {
    id: "popular-07",
    name: "配对交易",
    nameEn: "Pairs Trading",
    category: "ml",
    type: "popular",
    icon: "🔗",
    summary: "协整配对，价差回归",
    summaryEn: "Cointegrated pairs, spread reversion",
    markets: ["stock", "futures", "crypto"],
    difficulty: 3,
    logic: {
      entry: [
        "找出协整的股票对",
        "价差偏离均值2倍标准差时开仓",
        "做多被低估的，做空被高估的",
      ],
      exit: ["价差回归均值时平仓", "或价差继续扩大时止损"],
    },
    params: [
      {
        name: "协整检验周期",
        nameEn: "Coint Period",
        default: 250,
        range: "60-500",
      },
      {
        name: "开仓阈值",
        nameEn: "Entry Threshold",
        default: "2倍标准差",
        range: "1.5-3倍",
      },
      {
        name: "止损阈值",
        nameEn: "Stop Loss",
        default: "3倍标准差",
        range: "2.5-4倍",
      },
    ],
    pros: ["市场中性", "波动率低", "不依赖方向"],
    cons: ["协整关系可能破裂", "需要融券", "交易成本高"],
    bestFor: "对冲基金策略",
    bestForEn: "Hedge fund strategies",
    prompt:
      "配对交易策略：找出协整的股票对，当价差偏离均值超过2倍标准差时，做多被低估的股票同时做空被高估的，价差回归均值时平仓",
  },
  {
    id: "popular-08",
    name: "统计套利",
    nameEn: "Statistical Arbitrage",
    category: "ml",
    type: "popular",
    icon: "📈",
    summary: "基于统计规律的套利",
    summaryEn: "Arbitrage based on statistical patterns",
    markets: ["stock", "futures", "crypto"],
    difficulty: 3,
    logic: {
      entry: ["检测价格偏离统计规律的情况", "偏离超过阈值时反向交易"],
      exit: ["价格回归正常范围时平仓", "或触发止损"],
    },
    params: [
      { name: "回看周期", nameEn: "Lookback", default: 100, range: "50-200" },
      { name: "偏离阈值", nameEn: "Deviation", default: "2σ", range: "1.5-3σ" },
      {
        name: "持仓上限",
        nameEn: "Position Limit",
        default: "10%",
        range: "5-20%",
      },
    ],
    pros: ["数学基础扎实", "可量化风险", "多策略组合"],
    cons: ["统计关系可能失效", "黑天鹅风险", "需要高级编程"],
    bestFor: "量化对冲",
    bestForEn: "Quantitative hedging",
    prompt:
      "统计套利策略：计算价格的Z-score，当Z-score超过2时反向交易，回归0时平仓，止损设在3倍标准差",
  },

  // ========== CRYPTO (4) ==========
  {
    id: "popular-09",
    name: "网格交易",
    nameEn: "Grid Trading",
    category: "crypto",
    type: "popular",
    icon: "📶",
    summary: "价格区间内高抛低吸",
    summaryEn: "Buy low sell high within price range",
    markets: ["crypto", "stock"],
    difficulty: 2,
    logic: {
      entry: [
        "设定价格区间和网格数量",
        "每下跌一格买入固定数量",
        "每上涨一格卖出固定数量",
      ],
      exit: ["价格突破区间上限时全部卖出", "价格突破区间下限时止损或持有"],
    },
    params: [
      {
        name: "价格上限",
        nameEn: "Upper Bound",
        default: "当前价+20%",
        range: "+10-50%",
      },
      {
        name: "价格下限",
        nameEn: "Lower Bound",
        default: "当前价-20%",
        range: "-10-50%",
      },
      { name: "网格数量", nameEn: "Grid Count", default: 10, range: "5-50" },
    ],
    pros: ["震荡市稳定盈利", "自动化执行", "无需预测方向"],
    cons: ["趋势市亏损", "资金利用率低", "突破风险"],
    bestFor: "震荡行情",
    bestForEn: "Range-bound markets",
    riskWarning: "单边下跌行情会导致持续亏损",
    prompt:
      "网格交易策略：在当前价格上下20%范围内设置10个网格，每下跌一格买入，每上涨一格卖出，资金等分",
  },
  {
    id: "popular-10",
    name: "马丁格尔",
    nameEn: "Martingale",
    category: "crypto",
    type: "popular",
    icon: "🎰",
    summary: "亏损加仓，盈利出场",
    summaryEn: "Double down on loss, exit on profit",
    markets: ["crypto", "futures"],
    difficulty: 3,
    logic: {
      entry: ["首次开仓固定数量", "每亏损N%加倍仓位"],
      exit: ["总成本回本后全部平仓", "或达到最大加仓次数止损"],
    },
    params: [
      {
        name: "首次仓位",
        nameEn: "Initial Size",
        default: "1%资金",
        range: "0.5-2%",
      },
      {
        name: "加仓间隔",
        nameEn: "Add Interval",
        default: "5%",
        range: "3-10%",
      },
      { name: "最大加仓次数", nameEn: "Max Adds", default: 5, range: "3-8" },
    ],
    pros: ["高胜率", "震荡市有效", "简单直接"],
    cons: ["极端行情爆仓风险", "需要大量资金", "心理压力大"],
    bestFor: "小仓位投机",
    bestForEn: "Small position speculation",
    riskWarning: "极高风险策略，可能导致爆仓，不建议新手使用",
    prompt:
      "马丁格尔策略：初始仓位1%，每下跌5%加倍仓位，最多加仓5次，回本即平仓。警告：高风险策略！",
  },
  {
    id: "popular-11",
    name: "资金费率套利",
    nameEn: "Funding Rate Arbitrage",
    category: "crypto",
    type: "popular",
    icon: "💰",
    summary: "永续合约资金费率套利",
    summaryEn: "Perpetual contract funding rate arbitrage",
    markets: ["crypto"],
    difficulty: 3,
    logic: {
      entry: [
        "当资金费率为正且较高时",
        "做空永续合约，做多现货",
        "收取资金费率",
      ],
      exit: ["资金费率转负或接近0时平仓", "或持有长期收息"],
    },
    params: [
      {
        name: "费率阈值",
        nameEn: "Rate Threshold",
        default: "0.05%",
        range: "0.03-0.1%",
      },
      { name: "杠杆倍数", nameEn: "Leverage", default: "1x", range: "1-3x" },
      {
        name: "持仓周期",
        nameEn: "Hold Period",
        default: "8小时",
        range: "8-24小时",
      },
    ],
    pros: ["相对低风险", "稳定收益", "对冲市场风险"],
    cons: ["资金效率低", "交易所风险", "费率可能反转"],
    bestFor: "稳健套利",
    bestForEn: "Steady arbitrage",
    prompt:
      "资金费率套利：当永续合约资金费率超过0.05%时，等量做空永续做多现货，8小时后收取资金费，费率转负时平仓",
  },
  {
    id: "popular-12",
    name: "跨所套利",
    nameEn: "Cross-Exchange Arbitrage",
    category: "crypto",
    type: "popular",
    icon: "🔄",
    summary: "不同交易所价差套利",
    summaryEn: "Price difference arbitrage across exchanges",
    markets: ["crypto"],
    difficulty: 3,
    logic: {
      entry: [
        "监控多个交易所的同一币种价格",
        "价差超过交易成本时在低价所买入高价所卖出",
      ],
      exit: ["转币或平仓锁定利润", "价差消失时停止"],
    },
    params: [
      {
        name: "价差阈值",
        nameEn: "Spread Threshold",
        default: "0.5%",
        range: "0.3-1%",
      },
      {
        name: "单笔金额",
        nameEn: "Order Size",
        default: "根据流动性",
        range: "动态",
      },
    ],
    pros: ["几乎无风险", "即时利润", "可量化"],
    cons: ["机会稀少", "需要多所资金", "提币延迟风险"],
    bestFor: "高频套利",
    bestForEn: "High-frequency arbitrage",
    prompt:
      "跨所套利：监控多个交易所BTC/USDT价格，当价差超过0.5%时，在低价交易所买入同时在高价交易所卖出",
  },

  // ========== FUTURES (4) ==========
  {
    id: "popular-13",
    name: "期现套利",
    nameEn: "Cash-Futures Arbitrage",
    category: "futures",
    type: "popular",
    icon: "📜",
    summary: "期货现货价差收敛",
    summaryEn: "Futures-spot spread convergence",
    markets: ["futures"],
    difficulty: 2,
    logic: {
      entry: ["期货价格高于现货+持有成本时", "买入现货，卖出期货"],
      exit: ["交割日价差收敛", "或价差回到正常范围时提前平仓"],
    },
    params: [
      {
        name: "基差阈值",
        nameEn: "Basis Threshold",
        default: "年化5%",
        range: "年化3-10%",
      },
      {
        name: "持有成本",
        nameEn: "Carry Cost",
        default: "2%/年",
        range: "1-4%/年",
      },
    ],
    pros: ["风险低", "收益确定", "适合大资金"],
    cons: ["资金占用大", "收益有限", "需要交割能力"],
    bestFor: "稳健套利",
    bestForEn: "Steady arbitrage",
    prompt:
      "期现套利：当期货年化升水超过5%时，买入现货同时卖出等量期货，持有至交割日，赚取基差收敛收益",
  },
  {
    id: "popular-14",
    name: "跨期套利",
    nameEn: "Calendar Spread",
    category: "futures",
    type: "popular",
    icon: "📅",
    summary: "近远月合约价差",
    summaryEn: "Near-far month contract spread",
    markets: ["futures"],
    difficulty: 2,
    logic: {
      entry: [
        "近远月价差偏离历史均值",
        "价差过大时卖远买近",
        "价差过小时买远卖近",
      ],
      exit: ["价差回归均值时平仓", "或换月前平仓"],
    },
    params: [
      {
        name: "价差均值",
        nameEn: "Spread Mean",
        default: "历史60日均值",
        range: "动态",
      },
      {
        name: "开仓阈值",
        nameEn: "Entry Threshold",
        default: "2倍标准差",
        range: "1.5-3倍",
      },
    ],
    pros: ["双边风险对冲", "波动相对小", "不依赖方向"],
    cons: ["收益有限", "需要换月管理", "流动性问题"],
    bestFor: "期货价差交易",
    bestForEn: "Futures spread trading",
    prompt:
      "跨期套利：计算近月和远月合约价差的60日均值和标准差，价差偏离2倍标准差时开仓，回归均值时平仓",
  },
  {
    id: "popular-15",
    name: "跨品种套利",
    nameEn: "Inter-commodity Spread",
    category: "futures",
    type: "popular",
    icon: "🔀",
    summary: "相关品种价差回归",
    summaryEn: "Related commodity spread reversion",
    markets: ["futures"],
    difficulty: 3,
    logic: {
      entry: ["监控相关品种（如豆油豆粕）比值", "比值偏离历史均值时开仓"],
      exit: ["比值回归均值时平仓", "或触发止损"],
    },
    params: [
      {
        name: "比值均值",
        nameEn: "Ratio Mean",
        default: "历史均值",
        range: "动态计算",
      },
      {
        name: "开仓阈值",
        nameEn: "Entry Threshold",
        default: "2倍标准差",
        range: "1.5-3倍",
      },
    ],
    pros: ["基本面支撑", "风险可控", "多样化策略"],
    cons: ["相关性可能变化", "需要行业知识", "流动性不匹配"],
    bestFor: "商品期货套利",
    bestForEn: "Commodity futures arbitrage",
    prompt:
      "跨品种套利：计算豆油/豆粕比值的历史均值和标准差，比值偏离均值2倍标准差时开仓，回归均值时平仓",
  },
  {
    id: "popular-16",
    name: "基差交易",
    nameEn: "Basis Trading",
    category: "futures",
    type: "popular",
    icon: "📊",
    summary: "基于基差变化的策略",
    summaryEn: "Strategy based on basis changes",
    markets: ["futures"],
    difficulty: 3,
    logic: {
      entry: [
        "预期基差走强时做多基差（买现卖期）",
        "预期基差走弱时做空基差（卖现买期）",
      ],
      exit: ["基差达到预期目标时平仓", "或反向变化时止损"],
    },
    params: [
      {
        name: "基差历史分位",
        nameEn: "Basis Percentile",
        default: "看历史分布",
        range: "10-90%",
      },
      {
        name: "目标收益",
        nameEn: "Target Return",
        default: "2%",
        range: "1-5%",
      },
    ],
    pros: ["专业期货策略", "风险可控", "可结合基本面"],
    cons: ["需要专业知识", "判断难度大", "资金占用多"],
    bestFor: "专业期货交易者",
    bestForEn: "Professional futures traders",
    prompt:
      "基差交易：当基差处于历史低位（<20%分位）时买入现货卖出期货，当基差处于历史高位（>80%分位）时反向操作",
  },

  // ========== INTRADAY (4) ==========
  {
    id: "popular-17",
    name: "开盘区间突破",
    nameEn: "Opening Range Breakout",
    category: "intraday",
    type: "popular",
    icon: "🌅",
    summary: "开盘30分钟高低点突破",
    summaryEn: "30-minute opening high/low breakout",
    markets: ["stock", "futures"],
    difficulty: 2,
    logic: {
      entry: ["记录开盘30分钟内的最高价和最低价", "突破高点做多，突破低点做空"],
      exit: ["盘中反向突破另一端止损", "收盘前平仓"],
    },
    params: [
      {
        name: "区间时长",
        nameEn: "Range Period",
        default: 30,
        range: "15-60分钟",
      },
      {
        name: "突破确认",
        nameEn: "Break Confirm",
        default: "0.3%",
        range: "0.2-0.5%",
      },
    ],
    pros: ["规则明确", "日内了结", "波动率交易"],
    cons: ["假突破风险", "需要实时盯盘", "震荡日亏损"],
    bestFor: "日内趋势交易",
    bestForEn: "Intraday trend trading",
    prompt:
      "开盘区间突破：记录开盘30分钟的最高和最低价，价格向上突破高点0.3%做多，向下突破低点0.3%做空，收盘前平仓",
  },
  {
    id: "popular-18",
    name: "日内动量",
    nameEn: "Intraday Momentum",
    category: "intraday",
    type: "popular",
    icon: "⚡",
    summary: "捕捉日内强势股延续",
    summaryEn: "Capture intraday strong stock continuation",
    markets: ["stock"],
    difficulty: 2,
    logic: {
      entry: ["筛选早盘涨幅>3%的强势股", "回调到均线附近时买入"],
      exit: ["创新高后跌破5分钟均线止盈", "跌破买入价2%止损", "尾盘清仓"],
    },
    params: [
      {
        name: "强势筛选",
        nameEn: "Strong Filter",
        default: "涨幅>3%",
        range: "2-5%",
      },
      {
        name: "回调幅度",
        nameEn: "Pullback",
        default: "0.5-1%",
        range: "0.3-2%",
      },
      { name: "止损", nameEn: "Stop Loss", default: "2%", range: "1-3%" },
    ],
    pros: ["追随强势股", "日内了结", "胜率较高"],
    cons: ["追高风险", "需要快速反应", "不适合震荡市"],
    bestFor: "活跃市场日内交易",
    bestForEn: "Active market day trading",
    prompt:
      "日内动量策略：早盘筛选涨幅超过3%的强势股，当回调到5分钟均线附近时买入，跌破买入价2%止损，尾盘清仓",
  },
  {
    id: "popular-19",
    name: "尾盘策略",
    nameEn: "End-of-Day Strategy",
    category: "intraday",
    type: "popular",
    icon: "🌆",
    summary: "尾盘异动捕捉",
    summaryEn: "Capture end-of-day momentum",
    markets: ["stock"],
    difficulty: 2,
    logic: {
      entry: ["最后30分钟突然放量上涨", "买入持有过夜"],
      exit: ["次日开盘观察", "高开高走持有，低开或冲高回落卖出"],
    },
    params: [
      {
        name: "尾盘时段",
        nameEn: "EOD Period",
        default: "最后30分钟",
        range: "15-60分钟",
      },
      {
        name: "涨幅阈值",
        nameEn: "Rise Threshold",
        default: "1%",
        range: "0.5-2%",
      },
      { name: "量比阈值", nameEn: "Volume Ratio", default: 2, range: "1.5-3" },
    ],
    pros: ["捕捉次日高开", "规则简单", "隔夜持仓"],
    cons: ["隔夜风险", "可能低开", "假信号"],
    bestFor: "隔夜短线",
    bestForEn: "Overnight short-term",
    prompt:
      "尾盘策略：最后30分钟涨幅超过1%且成交量放大2倍以上的股票买入持有，次日开盘后择机卖出",
  },
  {
    id: "popular-20",
    name: "隔夜缺口",
    nameEn: "Overnight Gap",
    category: "intraday",
    type: "popular",
    icon: "📊",
    summary: "缺口回补或延续策略",
    summaryEn: "Gap fill or continuation strategy",
    markets: ["stock", "futures"],
    difficulty: 2,
    logic: {
      entry: [
        "高开缺口>2%：等待回补做多",
        "低开缺口>2%：等待回补做空",
        "或顺势延续交易",
      ],
      exit: ["缺口回补完成时平仓", "或反向突破时止损"],
    },
    params: [
      {
        name: "缺口阈值",
        nameEn: "Gap Threshold",
        default: "2%",
        range: "1-3%",
      },
      {
        name: "回补目标",
        nameEn: "Fill Target",
        default: "前日收盘价",
        range: "50-100%回补",
      },
      {
        name: "止损",
        nameEn: "Stop Loss",
        default: "缺口外1%",
        range: "0.5-2%",
      },
    ],
    pros: ["统计规律支撑", "目标明确", "风险可控"],
    cons: ["不是所有缺口都回补", "延续缺口难判断", "需要经验"],
    bestFor: "缺口交易",
    bestForEn: "Gap trading",
    prompt:
      "隔夜缺口策略：当股票高开超过2%时，等待价格回落到前日收盘价附近买入，止损设在高开价上方1%，目标为缺口回补",
  },
];

// =============================================================================
// IMPORT ADDITIONAL STRATEGIES / 导入额外策略
// =============================================================================

import { academicStrategies } from "./academic";
import { practitionerStrategies } from "./practitioner";

// Re-export for convenience
export { academicStrategies } from "./academic";
export { practitionerStrategies } from "./practitioner";

// Builtin templates for quick-start (Story 3.1 / FR-1.5)
export {
  BUILTIN_TEMPLATES,
  DIFFICULTY_CONFIG,
  getBuiltinTemplateById,
  getBuiltinTemplatesByDifficulty,
  getBuiltinTemplateIds,
} from "./builtin-templates";
export type {
  BuiltinTemplate,
  DifficultyLevel,
  DifficultyDisplayConfig,
} from "./builtin-templates";

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Get all strategies (Phase 7: Now includes academic and practitioner strategies)
 * Total: 40 classic/popular + 10 academic + 10 practitioner = 60 strategies
 */
export function getAllStrategies(): StrategyTemplate[] {
  return [
    ...classicStrategies,
    ...popularStrategies,
    ...academicStrategies,
    ...practitionerStrategies,
  ];
}

/**
 * Get strategies by type (Phase 7: Added academic and practitioner types)
 */
export function getStrategiesByType(
  type: "classic" | "popular" | "academic" | "practitioner",
): StrategyTemplate[] {
  switch (type) {
    case "classic":
      return classicStrategies;
    case "popular":
      return popularStrategies;
    case "academic":
      return academicStrategies;
    case "practitioner":
      return practitionerStrategies;
    default:
      return [];
  }
}

/**
 * Get strategies by category
 */
export function getStrategiesByCategory(
  category: StrategyCategory,
): StrategyTemplate[] {
  return getAllStrategies().filter((s) => s.category === category);
}

/**
 * Get strategies by market
 */
export function getStrategiesByMarket(market: MarketType): StrategyTemplate[] {
  return getAllStrategies().filter((s) => s.markets.includes(market));
}

/**
 * Search strategies by keyword
 */
export function searchStrategies(keyword: string): StrategyTemplate[] {
  const lowerKeyword = keyword.toLowerCase();
  return getAllStrategies().filter(
    (s) =>
      s.name.toLowerCase().includes(lowerKeyword) ||
      s.nameEn.toLowerCase().includes(lowerKeyword) ||
      s.summary.toLowerCase().includes(lowerKeyword) ||
      s.summaryEn.toLowerCase().includes(lowerKeyword),
  );
}
