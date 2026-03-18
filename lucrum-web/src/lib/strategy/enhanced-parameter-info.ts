/**
 * Enhanced Parameter Information
 * 增强的参数详细说明
 *
 * Provides comprehensive information for each strategy parameter:
 * - Meaning and mechanism (含义与机制)
 * - Impact analysis (影响分析)
 * - Common values with use cases (常见取值与场景)
 * - Recommendations for different markets (使用建议)
 * - Related parameters (相关参数)
 * - Best practices (最佳实践)
 *
 * @module lib/strategy/enhanced-parameter-info
 */

// =============================================================================
// Types
// =============================================================================

export interface ParameterImpact {
  smaller: string; // Impact when value decreases (值变小的影响)
  larger: string; // Impact when value increases (值变大的影响)
}

export interface CommonValue {
  value: number; // Parameter value (参数值)
  label: string; // Display label (显示标签, e.g., "5日", "超短线")
  useCase: string; // Use case description (使用场景)
}

export interface Recommendations {
  stocks: string; // Recommendation for stock trading (股票推荐)
  futures?: string; // Recommendation for futures (期货推荐)
  crypto?: string; // Recommendation for crypto (加密货币推荐)
}

export interface EnhancedParameterInfo {
  meaning: string; // Parameter meaning (参数含义)
  mechanism: string; // How it works (作用机制)
  impact: ParameterImpact; // Impact analysis (影响分析)
  commonValues: CommonValue[]; // Common values (常见取值)
  recommendations: Recommendations; // Usage recommendations (使用建议)
  relatedParams: string[]; // Related parameter names (相关参数)
  bestPractices: string[]; // Best practices (最佳实践)
}

// =============================================================================
// Enhanced Parameter Information Database
// =============================================================================

export const ENHANCED_PARAMETER_INFO: Record<string, EnhancedParameterInfo> = {
  // ===== Moving Average Parameters / 均线参数 =====

  fast_window: {
    meaning: "快速移动平均线的计算周期（天数）",
    mechanism: "用于捕捉短期价格趋势的变化，周期越短，对价格变化的反应越灵敏",
    impact: {
      smaller: "反应更灵敏，交易信号更频繁，但假信号也会增多，适合超短线交易和波动大的市场",
      larger: "信号更可靠，噪音更少，但反应滞后，可能错过快速机会，适合中长线交易",
    },
    commonValues: [
      { value: 5, label: "5日", useCase: "超短线交易，捕捉快速波动，适合日内或2-3天持有" },
      { value: 10, label: "10日", useCase: "短线交易，平衡灵敏度和可靠性，适合1-2周持有" },
      { value: 20, label: "20日", useCase: "中线交易，信号较为可靠，适合月度级别持有" },
      { value: 30, label: "30日", useCase: "中长线交易，趋势稳定，适合季度级别持有" },
    ],
    recommendations: {
      stocks: "推荐5-20日。A股常用5日（超短）或10日（短线），波动小的蓝筹股用20日",
      futures: "推荐5-15日。期货波动大，用较小周期。商品期货5-10日，股指期货10-15日",
      crypto: "推荐4-12小时周期。加密货币24/7交易，传统日线需要转换",
    },
    relatedParams: ["slow_window"],
    bestPractices: [
      "快线周期应小于慢线周期，通常为慢线的1/2到1/4",
      "不同市场和品种需要调整：波动大的品种用较小周期，波动小的用较大周期",
      "配合成交量指标确认信号有效性，避免在震荡市中频繁交易",
      "回测时测试多个周期组合，找到最优参数而非凭经验猜测",
    ],
  },

  slow_window: {
    meaning: "慢速移动平均线的计算周期（天数）",
    mechanism: "用于识别中长期趋势，过滤短期噪音，提供更稳定的趋势参考",
    impact: {
      smaller: "对趋势变化反应更快，但容易受短期波动干扰，金叉死叉信号增多",
      larger: "趋势稳定性高，信号可靠但滞后，可能在趋势末期才发出信号",
    },
    commonValues: [
      { value: 20, label: "20日", useCase: "短期趋势，适合快进快出，配合5-10日快线" },
      { value: 30, label: "30日", useCase: "月线趋势，经典配置，配合10日快线" },
      { value: 60, label: "60日", useCase: "季线趋势，长线投资，配合20日快线" },
      { value: 120, label: "120日", useCase: "半年线，超长线，配合30-60日快线" },
    ],
    recommendations: {
      stocks: "推荐20-60日。经典配置：快线10日+慢线30日，或快线20日+慢线60日",
      futures: "推荐15-40日。期货合约周期短，不宜用过长周期",
      crypto: "推荐12小时-3日周期。考虑24/7交易特性",
    },
    relatedParams: ["fast_window"],
    bestPractices: [
      "慢线周期应为快线的2-4倍，如快线5日则慢线20日",
      "慢线突破后趋势更可靠，可作为主要交易依据",
      "慢线方向决定仓位：向上可重仓，向下应轻仓或空仓",
      "多周期共振：日线慢线向上+周线慢线向上，信号更强",
    ],
  },

  ma_window: {
    meaning: "单一移动平均线的计算周期（天数）",
    mechanism: "平滑价格波动，显示趋势方向，价格突破均线可作为交易信号",
    impact: {
      smaller: "贴近价格，信号灵敏但频繁，适合短线和震荡市",
      larger: "远离价格，趋势明显但滞后，适合长线和趋势市",
    },
    commonValues: [
      { value: 5, label: "5日均线", useCase: "超短线支撑压力，日内交易参考" },
      { value: 10, label: "10日均线", useCase: "短线交易，周级别操作" },
      { value: 20, label: "20日均线", useCase: "月线，重要支撑位，中线交易" },
      { value: 60, label: "60日均线", useCase: "季线，牛熊分界线，长线布局" },
      { value: 250, label: "250日均线", useCase: "年线，超长线投资，市场底部参考" },
    ],
    recommendations: {
      stocks: "多周期组合：5日+10日+20日+60日，形成支撑压力体系",
      futures: "单均线策略常用20-30日，配合突破或回调入场",
      crypto: "考虑使用小时级别均线，如4小时、12小时、1日",
    },
    relatedParams: ["fast_window", "slow_window"],
    bestPractices: [
      "均线多头排列（5>10>20>60）是强势市场特征",
      "价格回踩均线不破是买点，跌破是止损",
      "均线斜率反映趋势强度：斜率越大，趋势越强",
      "不同周期均线共振时，信号可靠性大幅提升",
    ],
  },

  // ===== RSI Parameters / RSI参数 =====

  rsi_window: {
    meaning: "RSI（相对强弱指标）的计算周期（天数）",
    mechanism: "衡量价格涨跌力度，计算周期内上涨日与下跌日的力度对比",
    impact: {
      smaller: "RSI波动剧烈，超买超卖信号频繁，适合短线和波动市场",
      larger: "RSI平滑稳定，信号更可靠但反应慢，适合中长线",
    },
    commonValues: [
      { value: 6, label: "6日RSI", useCase: "超短线，极度灵敏，适合日内交易" },
      { value: 14, label: "14日RSI", useCase: "经典配置，平衡灵敏度和可靠性" },
      { value: 24, label: "24日RSI", useCase: "中线配置，信号稳定" },
    ],
    recommendations: {
      stocks: "推荐12-14日。经典RSI(14)久经考验，适合大多数A股",
      futures: "推荐6-10日。期货波动大，用较短周期更有效",
      crypto: "推荐6-14小时周期（折算为日线周期）",
    },
    relatedParams: ["rsi_buy", "rsi_sell"],
    bestPractices: [
      "RSI周期越短，信号越多但可靠性越低，需要配合其他指标过滤",
      "建议使用RSI(6)和RSI(14)组合，形成快慢RSI系统",
      "RSI在70以上持续时，趋势可能很强，不要盲目做空",
      "RSI背离是强力信号：价格新高但RSI不创新高，可能反转",
    ],
  },

  rsi_buy: {
    meaning: "RSI超卖阈值，低于此值触发买入信号",
    mechanism: "当RSI低于该阈值时，表示市场超卖，可能出现反弹",
    impact: {
      smaller: "买入条件更严格，信号更少但可靠性更高，适合保守策略",
      larger: "买入信号更频繁，但假信号增多，适合激进策略",
    },
    commonValues: [
      { value: 20, label: "20（保守）", useCase: "极度超卖才买入，成功率高但机会少" },
      { value: 30, label: "30（标准）", useCase: "经典配置，平衡机会和风险" },
      { value: 40, label: "40（激进）", useCase: "更早介入，适合趋势市场" },
    ],
    recommendations: {
      stocks: "推荐25-30。A股波动大，30是常用值。蓝筹股可用20",
      futures: "推荐15-25。期货波动极大，需要更低阈值",
      crypto: "推荐20-30。加密货币经常出现极端行情",
    },
    relatedParams: ["rsi_sell", "rsi_window"],
    bestPractices: [
      "趋势市场中，超卖可能持续很久，不要过早抄底",
      "配合趋势过滤：仅在上升趋势中使用RSI超卖买入",
      "RSI低于20后，等待RSI回升至30以上再买入（二次确认）",
      "与MACD配合：RSI超卖+MACD金叉，成功率更高",
    ],
  },

  rsi_sell: {
    meaning: "RSI超买阈值，高于此值触发卖出信号",
    mechanism: "当RSI高于该阈值时，表示市场超买，可能出现回调",
    impact: {
      smaller: "卖出信号更频繁，可能错过大涨行情，适合震荡市",
      larger: "持有时间更长，在强势市场中获利更多，但回撤也更大",
    },
    commonValues: [
      { value: 70, label: "70（标准）", useCase: "经典配置，适合大多数市场" },
      { value: 80, label: "80（宽松）", useCase: "允许更大涨幅，适合牛市" },
      { value: 60, label: "60（严格）", useCase: "快速止盈，适合震荡市" },
    ],
    recommendations: {
      stocks: "推荐70-75。标准值70久经考验，牛市可放宽到80",
      futures: "推荐75-85。期货趋势性强，超买可能持续",
      crypto: "推荐70-80。加密货币牛市时RSI可长期保持高位",
    },
    relatedParams: ["rsi_buy", "rsi_window"],
    bestPractices: [
      "强势股RSI可能长期在70以上，不要过早卖出",
      "RSI超买后，等待RSI跌破70再卖出（避免震荡）",
      "牛市中放宽卖出阈值到80甚至90，否则会错失主升浪",
      "RSI超买+成交量萎缩，是可靠的卖出信号",
    ],
  },

  // ===== MACD Parameters / MACD参数 =====

  macd_fast: {
    meaning: "MACD快线EMA（指数移动平均）的计算周期",
    mechanism: "计算快速EMA，捕捉短期趋势变化",
    impact: {
      smaller: "MACD波动更剧烈，金叉死叉更频繁，适合短线",
      larger: "MACD平滑稳定，信号减少但更可靠",
    },
    commonValues: [
      { value: 12, label: "12日（标准）", useCase: "经典MACD配置，久经验证" },
      { value: 8, label: "8日（激进）", useCase: "更快反应，适合短线" },
      { value: 15, label: "15日（保守）", useCase: "更稳定，适合中线" },
    ],
    recommendations: {
      stocks: "推荐12日。经典MACD(12,26,9)是全球通用标准",
      futures: "推荐8-10日。期货波动快，需要更灵敏参数",
      crypto: "推荐6-12小时周期（折算为传统参数）",
    },
    relatedParams: ["macd_slow", "macd_signal"],
    bestPractices: [
      "MACD快线应明显小于慢线，通常为慢线的1/2左右",
      "不同市场不要盲目使用(12,26,9)，应根据品种特性调整",
      "MACD零轴上方金叉信号更可靠（多头市场）",
      "MACD柱状图比MACD线更敏感，可作为先导指标",
    ],
  },

  macd_slow: {
    meaning: "MACD慢线EMA的计算周期",
    mechanism: "计算慢速EMA，代表中长期趋势",
    impact: {
      smaller: "快慢线差距缩小，MACD波动增大，信号更频繁",
      larger: "快慢线差距扩大，MACD波动稳定，信号更可靠",
    },
    commonValues: [
      { value: 26, label: "26日（标准）", useCase: "经典配置，全球通用" },
      { value: 20, label: "20日（激进）", useCase: "更快反应，适合快节奏市场" },
      { value: 30, label: "30日（保守）", useCase: "更稳定，适合大周期操作" },
    ],
    recommendations: {
      stocks: "推荐26日。经典配置(12,26,9)最广泛使用",
      futures: "推荐20-24日。期货特性需要稍快参数",
      crypto: "推荐12-24小时周期",
    },
    relatedParams: ["macd_fast", "macd_signal"],
    bestPractices: [
      "慢线周期应为快线的2-3倍",
      "慢线代表主趋势，MACD在零轴上方表示牛市，下方表示熊市",
      "MACD金叉死叉配合K线形态，成功率大幅提高",
      "周线MACD比日线MACD更可靠，用于判断大趋势",
    ],
  },

  macd_signal: {
    meaning: "MACD信号线（DEA）的计算周期",
    mechanism: "对MACD值进行再次EMA平滑，作为交易信号触发线",
    impact: {
      smaller: "信号线更贴近MACD，金叉死叉更频繁但更灵敏",
      larger: "信号线平滑，交易信号减少但更可靠",
    },
    commonValues: [
      { value: 9, label: "9日（标准）", useCase: "经典配置，平衡灵敏度和可靠性" },
      { value: 6, label: "6日（激进）", useCase: "更早发出信号，适合短线" },
      { value: 12, label: "12日（保守）", useCase: "信号滞后但可靠，适合长线" },
    ],
    recommendations: {
      stocks: "推荐9日。经典MACD(12,26,9)配置",
      futures: "推荐6-8日。期货需要更快信号",
      crypto: "推荐4-9小时周期",
    },
    relatedParams: ["macd_fast", "macd_slow"],
    bestPractices: [
      "信号线周期通常为快线周期的3/4左右",
      "MACD金叉后，等待柱状图连续3根以上再买入（确认）",
      "MACD顶背离/底背离是强力反转信号",
      "MACD在零轴附近金叉，是最佳买点（趋势刚启动）",
    ],
  },

  // ===== Bollinger Bands Parameters / 布林带参数 =====

  boll_window: {
    meaning: "布林带中轨（移动平均线）的计算周期",
    mechanism: "计算价格的移动平均线和标准差，形成动态通道",
    impact: {
      smaller: "布林带收缩更快，对价格波动反应更灵敏，交易信号更多",
      larger: "布林带稳定宽松，信号更可靠但反应慢",
    },
    commonValues: [
      { value: 20, label: "20日（标准）", useCase: "经典配置，适合大多数市场" },
      { value: 10, label: "10日（短线）", useCase: "短线交易，快速反应" },
      { value: 30, label: "30日（中线）", useCase: "中线交易，更稳定" },
    ],
    recommendations: {
      stocks: "推荐20日。布林带(20,2)是全球标准配置",
      futures: "推荐15-20日。期货波动大，稍短周期更合适",
      crypto: "推荐12-20小时周期",
    },
    relatedParams: ["boll_dev"],
    bestPractices: [
      "布林带收口后往往出现大行情（方向不确定）",
      "价格触及上轨不一定卖出，触及下轨不一定买入，需看趋势",
      "布林带向上开口+价格沿上轨走，是强势特征",
      "布林带中轨是重要支撑压力位",
    ],
  },

  boll_dev: {
    meaning: "布林带标准差倍数，控制上下轨宽度",
    mechanism: "标准差乘以倍数后，形成价格波动的上下边界",
    impact: {
      smaller: "布林带更窄，价格更容易触及上下轨，交易信号更频繁",
      larger: "布林带更宽，容纳更大波动，信号更少但更极端",
    },
    commonValues: [
      { value: 2, label: "2倍标准差（标准）", useCase: "经典配置，覆盖95%价格波动" },
      { value: 1.5, label: "1.5倍（窄通道）", useCase: "震荡市，更频繁交易" },
      { value: 2.5, label: "2.5倍（宽通道）", useCase: "高波动市场，避免假信号" },
    ],
    recommendations: {
      stocks: "推荐2倍。统计学上2倍标准差覆盖95%概率",
      futures: "推荐2-2.5倍。期货波动大，用较宽通道",
      crypto: "推荐2.5-3倍。加密货币极端波动，需要更宽容度",
    },
    relatedParams: ["boll_window"],
    bestPractices: [
      "标准差倍数不宜随意调整，2倍有统计学基础",
      "价格突破布林带外轨，是趋势启动或极端行情信号",
      "布林带宽度可衡量波动率：宽度收窄至极致后往往有大行情",
      "布林带配合RSI：价格触及下轨+RSI超卖，买入信号可靠性高",
    ],
  },

  // ===== Risk Management Parameters / 风控参数 =====

  stop_loss: {
    meaning: "止损比例，亏损达到该比例时自动卖出",
    mechanism: "限制单笔交易的最大亏损，保护账户资金",
    impact: {
      smaller: "止损更严格，亏损小但可能被频繁止损（假突破）",
      larger: "止损宽松，容忍更大回撤，但单笔亏损可能很大",
    },
    commonValues: [
      { value: 0.03, label: "3%（严格）", useCase: "短线交易，快进快出" },
      { value: 0.05, label: "5%（标准）", useCase: "经典配置，平衡保护和容错" },
      { value: 0.08, label: "8%（宽松）", useCase: "中线交易，容忍正常波动" },
      { value: 0.10, label: "10%（极宽）", useCase: "长线投资，避免被震出" },
    ],
    recommendations: {
      stocks: "推荐5-8%。A股波动大，5%偏紧，蓝筹股可用8-10%",
      futures: "推荐2-5%。期货杠杆高，必须严格止损",
      crypto: "推荐5-10%。加密货币波动极大，止损不能太紧",
    },
    relatedParams: ["take_profit"],
    bestPractices: [
      "止损是铁律，绝不能因为侥幸心理而不执行",
      "止损位设在关键支撑位下方，而非固定百分比",
      "连续止损3次以上，应停止交易，反思策略",
      "盈亏比至少2:1，即止盈至少是止损的2倍",
    ],
  },

  take_profit: {
    meaning: "止盈比例，盈利达到该比例时自动卖出",
    mechanism: "锁定利润，避免盈利回吐",
    impact: {
      smaller: "快速止盈，落袋为安，但可能错失大涨行情",
      larger: "追求更大利润，但可能利润回吐甚至转亏",
    },
    commonValues: [
      { value: 0.10, label: "10%（保守）", useCase: "震荡市，快速获利了结" },
      { value: 0.15, label: "15%（标准）", useCase: "平衡获利和持有" },
      { value: 0.20, label: "20%（激进）", useCase: "趋势市，追求更大利润" },
      { value: 0.30, label: "30%（极端）", useCase: "牛市中，持有大牛股" },
    ],
    recommendations: {
      stocks: "推荐10-20%。根据市场环境灵活调整，震荡市10%，趋势市20%",
      futures: "推荐5-15%。期货波动大，不宜追求过高止盈",
      crypto: "推荐15-30%。加密货币涨幅可能很大",
    },
    relatedParams: ["stop_loss"],
    bestPractices: [
      "止盈应至少是止损的2倍，保证盈亏比合理",
      "使用移动止盈：盈利后，将止损位上移到成本线以上",
      "强势股可不设止盈，用趋势跟踪策略（如跌破均线止盈）",
      "分批止盈：如50%仓位在10%止盈，剩余50%在20%止盈",
    ],
  },

  position_size: {
    meaning: "单次交易的仓位比例",
    mechanism: "控制单笔交易占用的资金比例，管理风险敞口",
    impact: {
      smaller: "仓位轻，安全性高但盈利有限，适合保守型投资者",
      larger: "仓位重，盈利大但风险高，一旦判断错误亏损惨重",
    },
    commonValues: [
      { value: 0.20, label: "20%（保守）", useCase: "分散投资，最多5只股票" },
      { value: 0.30, label: "30%（标准）", useCase: "平衡风险，最多3只股票" },
      { value: 0.50, label: "50%（激进）", useCase: "集中投资，最多2只股票" },
      { value: 1.00, label: "100%（全仓）", useCase: "极度看好，All-in" },
    ],
    recommendations: {
      stocks: "推荐20-30%。分散风险，不把鸡蛋放在一个篮子里",
      futures: "推荐10-20%。期货高杠杆，仓位必须轻",
      crypto: "推荐10-30%。高风险高收益，仓位需谨慎",
    },
    relatedParams: ["max_position"],
    bestPractices: [
      "新手应使用20%以下仓位，积累经验后逐步提高",
      "单一品种不超过30%，避免过度集中",
      "凯利公式：最优仓位 = (胜率×盈亏比-1) / 盈亏比",
      "牛市可适当加大仓位，熊市应减轻仓位",
    ],
  },

  max_position: {
    meaning: "最大持仓比例，限制总仓位上限",
    mechanism: "防止过度交易，保留现金应对机会和风险",
    impact: {
      smaller: "保留更多现金，灵活性高但资金利用率低",
      larger: "资金利用率高，但缺乏灵活性和安全垫",
    },
    commonValues: [
      { value: 0.70, label: "70%（保守）", useCase: "保留30%现金应对突发情况" },
      { value: 0.80, label: "80%（标准）", useCase: "平衡资金利用率和灵活性" },
      { value: 0.90, label: "90%（激进）", useCase: "高度看好市场，满仓操作" },
      { value: 1.00, label: "100%（满仓）", useCase: "极度乐观，无风险意识" },
    ],
    recommendations: {
      stocks: "推荐70-80%。保留现金应对补仓和新机会",
      futures: "推荐50-70%。期货风险高，必须保留足够保证金",
      crypto: "推荐60-80%。波动大，需要现金应对极端行情",
    },
    relatedParams: ["position_size"],
    bestPractices: [
      "永远不要满仓，至少保留10-20%现金",
      "熊市降低最大仓位到50%，牛市可提高到90%",
      "保留现金有两个用途：补仓摊低成本、抓住新机会",
      "资金管理比选股更重要，仓位控制决定生死",
    ],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get enhanced information for a parameter
 * 获取参数的增强信息
 */
export function getEnhancedInfo(paramName: string): EnhancedParameterInfo | null {
  return ENHANCED_PARAMETER_INFO[paramName] || null;
}

/**
 * Check if parameter has enhanced information
 * 检查参数是否有增强信息
 */
export function hasEnhancedInfo(paramName: string): boolean {
  return paramName in ENHANCED_PARAMETER_INFO;
}

/**
 * Get all parameter names with enhanced information
 * 获取所有有增强信息的参数名称
 */
export function getEnhancedParamNames(): string[] {
  return Object.keys(ENHANCED_PARAMETER_INFO);
}
