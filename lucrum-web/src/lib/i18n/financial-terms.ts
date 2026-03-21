/**
 * Financial Terms Dictionary
 *
 * Provides plain-Chinese explanations for financial/technical terms
 * used throughout the platform. Each term includes an explanation,
 * why it matters to the user, and optional suggested value ranges.
 *
 * Used by SmartTooltip to provide contextual education at point of need.
 */

// =============================================================================
// Types
// =============================================================================

export interface FinancialTermEntry {
  /** Display name in Chinese */
  term: string;
  /** Plain-language explanation */
  explanation: string;
  /** Why this metric matters to the user's decision */
  whyItMatters?: string;
  /** Suggested or reference value range */
  suggestedRange?: string;
}

// =============================================================================
// Dictionary
// =============================================================================

export const FINANCIAL_TERMS: Record<string, FinancialTermEntry> = {
  // ---- Return metrics ----
  sharpe: {
    term: "夏普比率",
    explanation: "每承受一单位风险获得的超额收益，数值越高说明风险补偿越充分",
    whyItMatters: ">1 良好, >2 优秀, <0 表示收益不如无风险资产",
    suggestedRange: "0.5 ~ 3.0",
  },
  sortino: {
    term: "索提诺比率",
    explanation: "只考虑下行风险的风险调整收益，比夏普比率更关注亏损风险",
    whyItMatters: "比夏普更贴合实际体感, >2 优秀",
    suggestedRange: "0.5 ~ 4.0",
  },
  annualReturn: {
    term: "年化收益",
    explanation: "投资收益折算为一年的回报率，方便不同周期的策略横向对比",
    whyItMatters: ">15% 优秀 (A股长期平均约8%)",
    suggestedRange: "8% ~ 50%",
  },
  totalReturn: {
    term: "总收益率",
    explanation: "回测期间从起始资金到最终资金的总变化百分比",
    whyItMatters: "直观反映策略整体盈利能力",
  },
  excessReturn: {
    term: "超额收益",
    explanation: "策略收益率减去基准(如沪深300)收益率的差值",
    whyItMatters: ">0 说明跑赢大盘, <0 不如直接买指数基金",
  },

  // ---- Risk metrics ----
  maxDrawdown: {
    term: "最大回撤",
    explanation: "从最高点到最低点的最大跌幅，衡量最坏情况下你可能亏多少",
    whyItMatters: "<10% 优秀, 10-20% 正常, >30% 高风险",
    suggestedRange: "5% ~ 25%",
  },
  volatility: {
    term: "波动率",
    explanation: "收益率的标准差，衡量收益的不确定性和上下波动幅度",
    whyItMatters: "越低越稳定, 但过低可能意味着收益也低",
    suggestedRange: "10% ~ 30%",
  },
  calmar: {
    term: "卡玛比率",
    explanation: "年化收益除以最大回撤，衡量每承受一单位回撤获得的收益",
    whyItMatters: ">1 良好, >2 优秀",
    suggestedRange: "0.5 ~ 3.0",
  },
  var95: {
    term: "VaR (95%)",
    explanation: "在95%置信度下，一天内最大可能亏损的金额",
    whyItMatters: "帮助你预估极端情况下的单日损失",
  },

  // ---- Trading metrics ----
  winRate: {
    term: "胜率",
    explanation: "盈利交易占总交易的比例",
    whyItMatters: ">60% 良好, 但需结合盈亏比看 (胜率低但盈亏比高也可盈利)",
    suggestedRange: "40% ~ 70%",
  },
  profitFactor: {
    term: "盈亏比",
    explanation: "总盈利除以总亏损的绝对值",
    whyItMatters: ">1.5 良好, >2 优秀, <1 说明总体亏损",
    suggestedRange: "1.2 ~ 3.0",
  },
  avgHoldingDays: {
    term: "平均持仓天数",
    explanation: "每笔交易从买入到卖出的平均天数",
    whyItMatters: "<5天 短线策略, 5-20天 波段, >20天 中长线",
  },
  tradeCount: {
    term: "交易次数",
    explanation: "回测期间的总交易笔数",
    whyItMatters: "太少(<10)统计意义不足, 太多(>200)注意手续费侵蚀",
  },
  avgWin: {
    term: "平均盈利",
    explanation: "所有盈利交易的平均收益率",
    whyItMatters: "与平均亏损对比, 比值>1.5为佳",
  },
  avgLoss: {
    term: "平均亏损",
    explanation: "所有亏损交易的平均亏损率",
    whyItMatters: "控制在2%以内为佳, 配合止损使用",
  },
  maxConsecutiveLoss: {
    term: "最大连续亏损",
    explanation: "连续亏损的最大次数",
    whyItMatters: "考验心态承受能力, >5次需要审视策略逻辑",
  },

  // ---- Market comparison metrics ----
  alpha: {
    term: "Alpha",
    explanation: "相对于基准(如沪深300)的超额收益, 衡量策略独立于大盘的盈利能力",
    whyItMatters: ">0 跑赢大盘, <0 跑输大盘",
  },
  beta: {
    term: "Beta",
    explanation: "相对于大盘的波动敏感度, 衡量策略随大盘涨跌的幅度",
    whyItMatters: "=1 与大盘同步, >1 放大波动, <1 防御性强",
    suggestedRange: "0.5 ~ 1.5",
  },

  // ---- Strategy characteristics ----
  turnoverRate: {
    term: "换手率",
    explanation: "一定时期内的交易额与持仓市值的比率",
    whyItMatters: "高换手意味着高手续费, 年化>500%需关注交易成本",
  },
  commission: {
    term: "佣金",
    explanation: "券商收取的交易手续费, 按成交金额的固定比例收取",
    whyItMatters: "通常万分之三, 最低5元/笔",
  },
  stampDuty: {
    term: "印花税",
    explanation: "卖出股票时国家征收的税费, 按成交金额的固定比例收取",
    whyItMatters: "千分之一, 仅卖出时收取",
  },
  slippage: {
    term: "滑点",
    explanation: "预期成交价与实际成交价的差异, 主要由流动性和延迟导致",
    whyItMatters: "回测默认0.1-0.2%, 实盘可能更高",
    suggestedRange: "0.05% ~ 0.3%",
  },
  lotSize: {
    term: "一手",
    explanation: "A股最小交易单位, 等于100股",
    whyItMatters: "买入必须是整手的倍数",
  },
  t1Rule: {
    term: "T+1规则",
    explanation: "今天买入的股票明天才能卖出, A股市场的交易制度",
    whyItMatters: "A股特有规则, 无法日内回转交易",
  },
  totalTrades: {
    term: "交易次数",
    explanation: "回测期间总共执行的买卖次数",
    whyItMatters: "过少(<10)统计意义不足, 过多可能过度交易",
  },

  // ---- Technical indicators ----
  macd: {
    term: "MACD",
    explanation: "趋势跟踪动量指标, 由快线(DIF)、慢线(DEA)和柱状图组成",
    whyItMatters: "金叉(DIF上穿DEA)为买入信号, 死叉为卖出信号",
  },
  rsi: {
    term: "RSI (相对强弱指标)",
    explanation: "衡量近期价格上涨和下跌的相对强度, 范围0-100",
    whyItMatters: ">70 超买(考虑卖出), <30 超卖(考虑买入)",
    suggestedRange: "30 ~ 70",
  },
  bollinger: {
    term: "布林带",
    explanation: "由中轨(均线)和上下轨(标准差通道)组成的波动率通道",
    whyItMatters: "价格触及上轨可能回调, 触及下轨可能反弹",
  },
  kdj: {
    term: "KDJ",
    explanation: "随机指标, 反映价格在近期波动范围中的相对位置",
    whyItMatters: "K>80超买, K<20超卖; KD金叉买入, 死叉卖出",
  },
  atr: {
    term: "ATR (平均真实波幅)",
    explanation: "衡量市场波动程度的指标, 常用于设置止损位",
    whyItMatters: "2倍ATR止损是常见策略, 波动大时自动放宽止损",
  },
  ma: {
    term: "均线 (MA)",
    explanation: "一段时间内收盘价的平均值, 反映价格中期趋势",
    whyItMatters: "短期均线上穿长期均线(金叉)为看多信号",
  },

  // ---- Scoring ----
  gradeS: {
    term: "S级评分",
    explanation: "综合评分最高等级, 各维度均表现卓越",
    whyItMatters: "非常稀少, 需警惕过拟合风险",
  },
  gradeA: {
    term: "A级评分",
    explanation: "综合评分优秀, 收益与风险平衡良好",
    whyItMatters: "实战中A级策略已属上乘",
  },
  gradeB: {
    term: "B级评分",
    explanation: "综合评分良好, 有改进空间",
    whyItMatters: "可通过优化参数或增加过滤条件提升",
  },
  gradeC: {
    term: "C级评分",
    explanation: "综合评分一般, 建议仔细审视策略逻辑",
    whyItMatters: "需要显著调整才适合实盘",
  },
  gradeD: {
    term: "D级评分",
    explanation: "综合评分较差, 不建议直接使用",
    whyItMatters: "可能存在逻辑缺陷或严重过拟合",
  },
} as const;

// =============================================================================
// Lookup helper
// =============================================================================

/**
 * Retrieve a financial term entry by key.
 * Returns undefined if the key does not exist.
 */
export function getFinancialTerm(key: string): FinancialTermEntry | undefined {
  return FINANCIAL_TERMS[key];
}
