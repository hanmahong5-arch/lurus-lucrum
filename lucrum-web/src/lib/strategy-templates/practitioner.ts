/**
 * Practitioner Strategy Templates
 * 实战大师策略模板
 *
 * Strategies developed by legendary traders and practitioners.
 * These strategies have been battle-tested in real markets.
 *
 * @module lib/strategy-templates/practitioner
 */

import type { StrategyTemplate } from "./index";

// =============================================================================
// PRACTITIONER STRATEGIES / 实战大师策略 (10个)
// =============================================================================

export const practitionerStrategies: StrategyTemplate[] = [
  // ========== GROWTH & MOMENTUM MASTERS (3) ==========
  {
    id: "practitioner-01",
    name: "威廉·欧奈尔CANSLIM",
    nameEn: "O'Neil CANSLIM",
    category: "momentum",
    subcategory: "growth",
    type: "practitioner",
    icon: "📰",
    summary: "七要素成长股选股法，《投资者商业日报》创始人的经典体系",
    summaryEn:
      "Seven-factor growth stock selection, IBD founder's classic system",
    description:
      "CANSLIM是威廉·欧奈尔研究过去50年超级牛股后总结的选股方法，每个字母代表一个选股标准。这套系统结合了基本面和技术面，被誉为'成长股投资圣经'。",
    markets: ["stock"],
    timeframes: ["swing", "position"],
    difficulty: 3,
    riskLevel: "high",
    theory: {
      origin: "1988年《笑傲股市》首次系统阐述",
      author: "William O'Neil",
      authorInfo:
        "《投资者商业日报》创始人，从借来的5000美元起家，30岁成为纽交所最年轻的会员",
      year: 1988,
      paper: "How to Make Money in Stocks",
      academicBasis: "成长股投资、动量投资、技术分析",
    },
    logic: {
      entry: [
        "C - Current Earnings: 当季EPS增长≥25%",
        "A - Annual Earnings: 年度EPS增长≥25%，连续3年",
        "N - New: 新产品/新管理/新高价",
        "S - Supply/Demand: 流通股较少，成交量放大",
        "L - Leader: 行业龙头，RS≥80",
        "I - Institutional: 机构持股增加",
        "M - Market: 大盘处于上升趋势",
      ],
      exit: ["跌破买入价8%止损", "或RS跌破70时减仓"],
      riskManagement: "单只股票仓位不超过20%，严格止损8%",
    },
    params: [
      {
        name: "EPS增长阈值",
        nameEn: "EPS Growth",
        default: 25,
        range: "20-50%",
        description: "最低EPS增速",
      },
      {
        name: "RS排名",
        nameEn: "RS Rating",
        default: 80,
        range: "70-90",
        description: "相对强度排名",
      },
      {
        name: "止损比例",
        nameEn: "Stop Loss",
        default: 8,
        range: "5-10%",
        description: "最大亏损止损",
      },
    ],
    pros: ["系统完整", "结合基本面和技术面", "选出过很多超级牛股"],
    cons: ["选股条件苛刻", "需要大量数据", "牛市才有效"],
    bestPractices: {
      dos: [
        "严格执行8%止损",
        "只在M（大盘）确认时入场",
        "关注杯柄形态突破买点",
      ],
      donts: [
        "不要在熊市使用",
        "不要忽视止损",
        "不要买入下跌中的股票",
      ],
      tips: [
        "最佳买点是'杯柄形态'突破时",
        "成交量是关键确认信号",
        "第一个买点失败后等第二个",
      ],
      commonMistakes: [
        "止损执行不严格",
        "熊市强行选股",
        "追高买入而非买突破",
      ],
    },
    periodSignificance: {
      shortTerm: "日线级别的突破是买入信号",
      mediumTerm: "周线级别确认趋势",
      longTerm: "季报确认基本面",
      bestPeriod: "日线买入，周线持有",
    },
    bestFor: "牛市中的成长股投资",
    bestForEn: "Growth stock investing in bull markets",
    notSuitableFor: "熊市、价值投资者",
    historicalPerformance: {
      note: "欧奈尔团队多年复合年化收益超过40%",
    },
    relatedStrategies: ["practitioner-02"],
    riskWarning: "CANSLIM策略波动大，需要严格止损，不适合风险厌恶者。",
    prompt:
      "CANSLIM选股：当季EPS增长>25%，年度EPS增长>25%连续3年，RS排名>80，新高突破放量买入，跌破8%止损",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },
  {
    id: "practitioner-02",
    name: "杰西·利弗莫尔关键点",
    nameEn: "Livermore Pivotal Points",
    category: "trend",
    subcategory: "breakout",
    type: "practitioner",
    icon: "📊",
    summary: "传奇投机者的关键价格点突破法，《股票大作手回忆录》精髓",
    summaryEn: "Legendary speculator's pivotal point breakout method",
    description:
      "杰西·利弗莫尔被称为'华尔街大空头'，在1929年大崩盘中做空赚取1亿美元。他的关键点理论认为股价在关键价格水平会做出重要决定，突破关键点是入场时机。",
    markets: ["stock", "futures"],
    timeframes: ["swing", "position"],
    difficulty: 2,
    riskLevel: "high",
    theory: {
      origin: "1940年《股票大作手操盘术》",
      author: "Jesse Livermore",
      authorInfo:
        "20世纪最传奇的投机者，4次破产又4次东山再起，1929年做空赚取1亿美元",
      year: 1940,
      paper: "How to Trade in Stocks",
      academicBasis: "技术分析、趋势跟踪、市场心理",
    },
    logic: {
      entry: [
        "识别关键价格点：前高、前低、整数关口",
        "价格突破关键点时入场",
        "等待回测确认后加仓",
      ],
      exit: ["价格跌破关键支撑时止损", "趋势反转时平仓"],
      positionSizing: "金字塔加仓，首仓20%，盈利后加仓",
    },
    params: [
      {
        name: "突破幅度",
        nameEn: "Breakout",
        default: "3%",
        range: "2-5%",
        description: "超过关键点的确认幅度",
      },
      {
        name: "止损幅度",
        nameEn: "Stop Loss",
        default: "10%",
        range: "5-15%",
      },
    ],
    pros: ["逻辑清晰", "买在关键位置", "风险可控"],
    cons: ["假突破风险", "需要盯盘", "主观性较强"],
    bestPractices: {
      dos: [
        "耐心等待关键点出现",
        "突破后等待回测确认",
        "顺势加仓，逆势止损",
      ],
      donts: ["不要预测关键点位", "不要逆势抄底", "不要重仓单只股票"],
      tips: [
        "整数关口（如100、50）往往是关键点",
        "历史前高前低是重要关键点",
        "成交量是突破有效性的确认",
      ],
    },
    periodSignificance: {
      shortTerm: "日内关键点用于短线",
      mediumTerm: "周线关键点更重要",
      longTerm: "历史大顶大底是终极关键点",
      bestPeriod: "日线突破，周线确认",
    },
    bestFor: "趋势交易者",
    bestForEn: "Trend traders",
    historicalPerformance: {
      note: "利弗莫尔1929年单年赚取1亿美元（相当于今天30亿美元）",
    },
    riskWarning:
      "利弗莫尔本人最终破产自杀，说明即使是大师也可能失败，风险管理至关重要。",
    prompt:
      "利弗莫尔关键点：识别前高/前低/整数关口作为关键点，价格突破3%后买入，跌破关键支撑10%止损",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },
  {
    id: "practitioner-03",
    name: "斯坦·温斯坦阶段分析",
    nameEn: "Weinstein Stage Analysis",
    category: "trend",
    subcategory: "stage",
    type: "practitioner",
    icon: "📈",
    summary: "四阶段理论，只在第二阶段（上升期）买入",
    summaryEn: "Four-stage theory, only buy in Stage 2 (advancing phase)",
    description:
      "斯坦·温斯坦在1988年提出的阶段分析法将股票走势分为四个阶段：筑底期、上升期、筑顶期、下跌期。核心思想是只买处于第二阶段（上升期）的股票。",
    markets: ["stock"],
    timeframes: ["position"],
    difficulty: 2,
    riskLevel: "medium",
    theory: {
      origin: "1988年《Stan Weinstein's Secrets for Profiting in Bull and Bear Markets》",
      author: "Stan Weinstein",
      authorInfo: "《专业投资人》杂志创始人，技术分析教育家",
      year: 1988,
      paper: "Secrets for Profiting in Bull and Bear Markets",
      academicBasis: "技术分析、趋势跟踪",
    },
    logic: {
      entry: [
        "识别当前阶段：",
        "阶段1（筑底）：30周均线走平，股价在均线附近震荡",
        "阶段2（上升）：股价突破30周均线，均线上翘",
        "阶段3（筑顶）：30周均线走平，股价在均线上方震荡",
        "阶段4（下跌）：股价跌破30周均线，均线下弯",
        "只在阶段2初期买入！",
      ],
      exit: ["股价跌破30周均线时卖出", "或进入阶段3时逐步减仓"],
    },
    params: [
      {
        name: "均线周期",
        nameEn: "MA Period",
        default: 30,
        range: "26-40",
        description: "周均线周期",
      },
      {
        name: "突破确认",
        nameEn: "Breakout Confirm",
        default: "2周",
        range: "1-3周",
        description: "突破后确认时间",
      },
    ],
    pros: ["避免买在顶部", "顺势而为", "框架清晰"],
    cons: ["可能错过阶段1末期的涨幅", "判断阶段有主观性"],
    bestPractices: {
      dos: ["使用周线图判断阶段", "配合成交量确认", "只买阶段2股票"],
      donts: [
        "不要抄底阶段4股票",
        "不要在阶段3追高",
        "不要忽视30周均线",
      ],
      tips: [
        "阶段1到阶段2的转变是最佳买点",
        "放量突破更可靠",
        "可同时持有多只阶段2股票分散风险",
      ],
    },
    periodSignificance: {
      shortTerm: "日线噪音大，不适合判断阶段",
      mediumTerm: "周线是判断阶段的核心周期",
      longTerm: "月线确认大趋势",
      bestPeriod: "周线判断，日线择时",
    },
    bestFor: "中长期趋势投资者",
    bestForEn: "Medium to long-term trend investors",
    historicalPerformance: {
      note: "温斯坦在1987年崩盘前成功发出卖出信号",
    },
    prompt:
      "温斯坦阶段分析：使用30周均线判断股票所处阶段，只买入刚突破进入阶段2的股票，跌破30周均线止损",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },

  // ========== TECHNICAL MASTERS (3) ==========
  {
    id: "practitioner-04",
    name: "亚历山大·艾尔德三重滤网",
    nameEn: "Elder Triple Screen",
    category: "composite",
    subcategory: "multi-timeframe",
    type: "practitioner",
    icon: "🔍",
    summary: "三重时间框架确认，趋势+震荡指标结合",
    summaryEn: "Triple timeframe confirmation, trend + oscillator combination",
    description:
      "艾尔德博士提出的三重滤网系统使用三个时间框架和不同类型的指标：长周期判断趋势，中周期寻找回调，短周期精确入场。这避免了单一指标的局限性。",
    markets: ["stock", "futures", "crypto"],
    timeframes: ["swing"],
    difficulty: 3,
    riskLevel: "medium",
    theory: {
      origin: "1993年《Trading for a Living》",
      author: "Alexander Elder",
      authorInfo: "精神科医生、职业交易员，著名交易教育家",
      year: 1993,
      paper: "Trading for a Living",
      academicBasis: "多时间框架分析、趋势跟踪、震荡交易",
    },
    logic: {
      entry: [
        "第一层滤网（周线）：判断大趋势，用MACD或均线",
        "第二层滤网（日线）：趋势回调时，用RSI或KD寻找买点",
        "第三层滤网（小时线）：精确入场点，突破入场",
        "三层全部确认才入场",
      ],
      exit: ["周线趋势反转时全部平仓", "日线震荡指标超买时部分平仓"],
    },
    params: [
      { name: "周线指标", nameEn: "Weekly Indicator", default: "MACD", range: "MACD/EMA" },
      { name: "日线指标", nameEn: "Daily Indicator", default: "RSI", range: "RSI/KD/Force" },
      { name: "RSI超卖", nameEn: "RSI Oversold", default: 30, range: "20-40" },
    ],
    pros: ["多重确认减少假信号", "顺大势逆小势", "入场点精确"],
    cons: ["系统复杂", "可能错过快速行情", "需要看多个周期"],
    bestPractices: {
      dos: ["周线定方向", "日线找机会", "小时线定点位"],
      donts: ["不要逆周线趋势操作", "不要在日线超买区买入"],
      tips: ["周线MACD柱状图的方向是第一过滤条件"],
    },
    periodSignificance: {
      shortTerm: "小时线用于精确入场",
      mediumTerm: "日线是操作核心周期",
      longTerm: "周线决定方向",
      bestPeriod: "周线-日线-4小时线组合",
    },
    bestFor: "认真的技术交易者",
    bestForEn: "Serious technical traders",
    prompt:
      "艾尔德三重滤网：周线MACD判断趋势方向，日线RSI<30超卖区等待买点，4小时线突破入场",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },
  {
    id: "practitioner-05",
    name: "拉里·威廉斯短线交易",
    nameEn: "Larry Williams Short-Term Trading",
    category: "intraday",
    subcategory: "swing",
    type: "practitioner",
    icon: "⚡",
    summary: "波动性突破+威廉%R，短线交易冠军的方法",
    summaryEn: "Volatility breakout + Williams %R, from the trading champion",
    description:
      "拉里·威廉斯在1987年罗宾斯杯交易大赛中以11376%的收益率夺冠。他的核心方法是利用价格波动性进行突破交易，结合自创的威廉%R指标。",
    markets: ["futures", "stock"],
    timeframes: ["intraday", "swing"],
    difficulty: 3,
    riskLevel: "very-high",
    theory: {
      origin: "1979年《How I Made One Million Dollars》",
      author: "Larry Williams",
      authorInfo:
        "1987年罗宾斯杯冠军，一年将1万美元变成114万美元，收益率11376%",
      year: 1979,
      paper: "How I Made One Million Dollars Last Year Trading Commodities",
      academicBasis: "波动性交易、短线动量",
    },
    logic: {
      entry: [
        "计算前一日的真实波幅(TR)",
        "当日开盘价 + X%×TR = 多头触发价",
        "当日开盘价 - X%×TR = 空头触发价",
        "价格触及触发价时入场",
      ],
      exit: ["当日收盘平仓", "或威廉%R反转时平仓"],
    },
    params: [
      {
        name: "波幅倍数",
        nameEn: "ATR Multiple",
        default: 0.5,
        range: "0.3-1.0",
        description: "突破触发的ATR倍数",
      },
      {
        name: "威廉%R周期",
        nameEn: "Williams %R",
        default: 10,
        range: "5-14",
      },
    ],
    pros: ["收益潜力大", "规则明确", "久经验证"],
    cons: ["风险极高", "需要实时盯盘", "对执行力要求高"],
    bestPractices: {
      dos: ["严格执行入场和出场规则", "控制仓位大小", "记录每笔交易"],
      donts: ["不要过夜持仓（除非系统允许）", "不要改变系统规则", "不要报复性交易"],
      tips: [
        "周二至周四往往是最佳交易日",
        "期货比股票更适合此策略",
        "资金管理比入场更重要",
      ],
    },
    periodSignificance: {
      shortTerm: "日内交易核心周期",
      mediumTerm: "可延伸至2-3天持有",
      longTerm: "不适用",
      bestPeriod: "日内或隔日",
    },
    bestFor: "高风险承受能力的短线交易者",
    bestForEn: "High-risk-tolerant short-term traders",
    historicalPerformance: {
      backtestPeriod: "1987年罗宾斯杯",
      annualReturn: 11376,
      note: "实盘验证，1万变114万美元",
    },
    riskWarning:
      "拉里·威廉斯的女儿米歇尔2024年也获得罗宾斯杯冠军，但绝大多数尝试此策略的人会亏损。",
    prompt:
      "威廉斯波动突破：计算前日TR，今日开盘价±0.5×TR作为突破点，触发后入场，收盘平仓",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },
  {
    id: "practitioner-06",
    name: "维克多·斯波朗迪123法则",
    nameEn: "Sperandeo 123 Reversal",
    category: "pattern",
    subcategory: "reversal",
    type: "practitioner",
    icon: "🔄",
    summary: "趋势反转三步确认：破趋势线、测试失败、破前高/低",
    summaryEn: "Three-step trend reversal: break trendline, failed test, break previous high/low",
    description:
      "维克多·斯波朗迪被称为'华尔街的终结者'，他的123法则提供了一个系统化判断趋势反转的方法，避免过早抄底或逃顶。",
    markets: ["stock", "futures", "crypto"],
    timeframes: ["swing", "position"],
    difficulty: 2,
    riskLevel: "medium",
    theory: {
      origin: "1991年《专业投机原理》",
      author: "Victor Sperandeo",
      authorInfo: "被称为'华尔街的终结者'，40年职业交易生涯，年均收益超70%",
      year: 1991,
      paper: "Trader Vic: Methods of a Wall Street Master",
      academicBasis: "技术分析、趋势反转",
    },
    logic: {
      entry: [
        "1. 趋势线被有效突破（下跌趋势：向上突破下降趋势线）",
        "2. 价格回测但未能创新低（或新高）",
        "3. 价格突破回测前的高点（或低点）",
        "三步完成后确认反转，入场",
      ],
      exit: ["反向出现123形态时平仓", "或突破失败时止损"],
    },
    params: [
      {
        name: "趋势线突破确认",
        nameEn: "Breakout Confirm",
        default: "3%",
        range: "2-5%",
      },
      {
        name: "止损位置",
        nameEn: "Stop Loss",
        default: "前低/前高",
        range: "前低/前高",
      },
    ],
    pros: ["减少假信号", "有明确的止损位", "可量化"],
    cons: ["可能错过部分行情", "需要耐心等待三步完成"],
    bestPractices: {
      dos: ["耐心等待三步完成", "在第3步突破时入场", "止损设在第2步的极值"],
      donts: ["不要在第1步就入场", "不要预测", "不要忽视成交量"],
      tips: [
        "日线级别的123形态最可靠",
        "配合成交量更可靠",
        "第2步回测深度越浅，后续力量越强",
      ],
    },
    periodSignificance: {
      shortTerm: "小时线123用于日内交易",
      mediumTerm: "日线123是核心",
      longTerm: "周线123确认大趋势反转",
      bestPeriod: "日线级别",
    },
    bestFor: "趋势反转交易者",
    bestForEn: "Trend reversal traders",
    prompt:
      "123法则：1.突破趋势线 2.回测不创新低 3.突破回测前高点 → 确认反转买入，止损设在第2步低点",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },

  // ========== SYSTEM TRADERS (2) ==========
  {
    id: "practitioner-07",
    name: "范撒普R倍数系统",
    nameEn: "Van Tharp R-Multiple System",
    category: "composite",
    subcategory: "money-management",
    type: "practitioner",
    icon: "📐",
    summary: "以风险为单位思考，追求高R倍数交易",
    summaryEn: "Think in terms of risk, aim for high R-multiple trades",
    description:
      "范撒普博士提出用R（初始风险）作为衡量所有交易的统一单位。R=入场价到止损的距离。目标是寻找和持有R倍数高的交易（盈利/风险比高），让利润奔跑，截断亏损。",
    markets: ["stock", "futures", "crypto"],
    timeframes: ["swing", "position"],
    difficulty: 2,
    riskLevel: "medium",
    theory: {
      origin: "1998年《通往财务自由之路》",
      author: "Van K. Tharp",
      authorInfo: "交易心理学和系统开发专家，培训了数千名交易者",
      year: 1998,
      paper: "Trade Your Way to Financial Freedom",
      academicBasis: "资金管理、风险管理、交易心理",
    },
    logic: {
      entry: ["任何系统入场信号", "计算1R = |入场价 - 止损价|"],
      exit: [
        "止损 = -1R（最大亏损）",
        "目标至少2R-3R",
        "让利润奔跑，用移动止损锁定利润",
      ],
      positionSizing: "单笔风险 = 账户的1-2% = 1R的金额",
      riskManagement: "计算仓位：股数 = 账户风险金额 / 1R金额",
    },
    params: [
      {
        name: "单笔风险",
        nameEn: "Risk Per Trade",
        default: "1%",
        range: "0.5-2%",
        description: "账户的百分比",
      },
      {
        name: "目标R倍数",
        nameEn: "Target R",
        default: 3,
        range: "2-5",
        description: "最小盈利/风险比",
      },
    ],
    pros: ["标准化风险管理", "保护资金", "让利润奔跑"],
    cons: ["需要自行确定入场系统", "需要严格纪律"],
    bestPractices: {
      dos: [
        "每笔交易前计算1R",
        "坚持止损 = -1R",
        "目标至少2R-3R",
        "记录每笔交易的R倍数",
      ],
      donts: ["不要扩大止损", "不要过早止盈", "不要单笔风险超过2%"],
      tips: [
        "统计你的平均R倍数",
        "长期胜率30%也能盈利（如果平均R=3）",
        "交易日志是改进的关键",
      ],
    },
    periodSignificance: {
      shortTerm: "每笔交易计算R",
      mediumTerm: "周度统计R倍数分布",
      longTerm: "年度评估系统期望值",
      bestPeriod: "适用于所有周期",
    },
    bestFor: "系统交易者、追求稳定的交易者",
    bestForEn: "System traders, consistency seekers",
    prompt:
      "R倍数系统：1R = 入场到止损的距离，单笔风险1%账户，止损-1R，目标3R，用移动止损让利润奔跑",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },
  {
    id: "practitioner-08",
    name: "马克·道格拉斯概率思维",
    nameEn: "Mark Douglas Probabilistic Thinking",
    category: "composite",
    subcategory: "psychology",
    type: "practitioner",
    icon: "🧠",
    summary: "接受随机结果，关注概率优势，交易心理框架",
    summaryEn: "Accept random outcomes, focus on edge, trading psychology framework",
    description:
      "马克·道格拉斯在《交易心理分析》中提出：每笔交易的结果是随机的，但长期来看有统计优势的系统会盈利。关键是建立正确的信念结构，不被单笔结果影响。",
    markets: ["stock", "futures", "crypto"],
    timeframes: ["swing", "position"],
    difficulty: 2,
    riskLevel: "medium",
    theory: {
      origin: "2000年《交易心理分析》",
      author: "Mark Douglas",
      authorInfo: "交易心理学大师，著有《自律的交易者》和《交易心理分析》",
      year: 2000,
      paper: "Trading in the Zone",
      academicBasis: "交易心理学、概率论、行为金融",
    },
    logic: {
      entry: [
        "使用任何有正期望值的系统",
        "定义明确的入场规则",
        "每次交易只是一系列交易中的一个",
      ],
      exit: [
        "使用预定的止损和止盈",
        "不因恐惧或贪婪改变计划",
        "接受结果，无论盈亏",
      ],
    },
    params: [
      {
        name: "系统胜率",
        nameEn: "Win Rate",
        default: "40%",
        range: "30-60%",
        description: "历史胜率",
      },
      {
        name: "盈亏比",
        nameEn: "Risk/Reward",
        default: "1:2",
        range: "1:1.5-1:3",
        description: "平均盈亏比",
      },
    ],
    pros: ["建立正确的心理框架", "减少情绪干扰", "长期稳定"],
    cons: ["不提供具体系统", "需要时间内化", "需要交易日志"],
    bestPractices: {
      dos: [
        "计算系统的期望值",
        "执行至少20-30笔交易才评估系统",
        "记录每笔交易的心理状态",
      ],
      donts: [
        "不要因单笔亏损怀疑系统",
        "不要因单笔大赚改变规则",
        "不要预测市场",
      ],
      tips: [
        "期望值 = (胜率×平均盈利) - (败率×平均亏损)",
        "正期望值的系统长期会盈利",
        "心理问题是交易失败的主因",
      ],
    },
    periodSignificance: {
      shortTerm: "每笔交易保持概率思维",
      mediumTerm: "20-30笔交易后评估",
      longTerm: "年度总结和改进",
      bestPeriod: "适用于所有周期",
    },
    bestFor: "所有交易者，尤其是受情绪影响的交易者",
    bestForEn: "All traders, especially those affected by emotions",
    prompt:
      "概率思维交易：使用有正期望值的系统，严格执行规则，接受随机结果，关注长期概率优势",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },

  // ========== MARKET MAKERS & CYCLES (2) ==========
  {
    id: "practitioner-09",
    name: "琳达·拉什克开盘缺口",
    nameEn: "Linda Raschke Opening Gap",
    category: "intraday",
    subcategory: "gap",
    type: "practitioner",
    icon: "📊",
    summary: "利用开盘缺口的回补或延续，日内交易经典策略",
    summaryEn: "Trade opening gap fill or continuation, classic intraday strategy",
    description:
      "琳达·拉什克是《街头智慧》作者，多次获得交易冠军。开盘缺口策略利用市场开盘时的情绪过度反应：大部分缺口会在当日回补，而少数强势缺口会延续成趋势。",
    markets: ["stock", "futures"],
    timeframes: ["intraday"],
    difficulty: 2,
    riskLevel: "high",
    theory: {
      origin: "1994年《Street Smarts》",
      author: "Linda Bradford Raschke",
      authorInfo: "多次获得交易冠军，30年职业交易经验",
      year: 1994,
      paper: "Street Smarts: High Probability Short-Term Trading Strategies",
      academicBasis: "日内交易、缺口分析、市场微观结构",
    },
    logic: {
      entry: [
        "缺口回补策略：开盘跳空高开超过1%，等待15分钟",
        "如果价格开始回落，做空博回补缺口",
        "缺口延续策略：开盘跳空且30分钟内创新高/新低",
        "顺势入场博缺口延续",
      ],
      exit: ["回补策略：缺口完全回补时平仓", "延续策略：收盘前平仓或反转时止损"],
    },
    params: [
      { name: "缺口阈值", nameEn: "Gap Threshold", default: "1%", range: "0.5-2%" },
      { name: "等待时间", nameEn: "Wait Period", default: 15, range: "10-30分钟" },
      { name: "止损", nameEn: "Stop Loss", default: "缺口的50%", range: "30-70%" },
    ],
    pros: ["成功率较高（缺口回补）", "当日结算", "规则明确"],
    cons: ["需要实时盯盘", "强势缺口可能不回补", "佣金和滑点"],
    bestPractices: {
      dos: [
        "等待开盘后15-30分钟再行动",
        "确认缺口方向与大趋势一致或相反",
        "设置明确止损",
      ],
      donts: ["不要在开盘第一分钟交易", "不要过夜持仓", "不要逆大趋势做回补"],
      tips: [
        "周一缺口回补率最高",
        "财报后的缺口往往会延续",
        "配合成交量判断缺口性质",
      ],
    },
    periodSignificance: {
      shortTerm: "核心策略周期是日内",
      mediumTerm: "不适用",
      longTerm: "不适用",
      bestPeriod: "日内交易，收盘前平仓",
    },
    bestFor: "日内交易者",
    bestForEn: "Day traders",
    prompt:
      "开盘缺口策略：跳空高开>1%，等15分钟，回落则做空博回补；新高则做多博延续，当日平仓",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },
  {
    id: "practitioner-10",
    name: "马丁·普林格周期分析",
    nameEn: "Martin Pring Cycle Analysis",
    category: "composite",
    subcategory: "cycle",
    type: "practitioner",
    icon: "🔄",
    summary: "经济周期与行业轮动，六阶段模型",
    summaryEn: "Economic cycle and sector rotation, six-stage model",
    description:
      "马丁·普林格的周期分析将经济分为六个阶段，每个阶段不同资产和行业表现不同。通过判断当前经济周期位置，选择表现最好的资产类别和行业板块。",
    markets: ["stock"],
    timeframes: ["position", "longterm"],
    difficulty: 3,
    riskLevel: "medium",
    theory: {
      origin: "1991年《技术分析》",
      author: "Martin Pring",
      authorInfo: "技术分析和周期分析大师，著有多本经典著作",
      year: 1991,
      paper: "Technical Analysis Explained",
      academicBasis: "经济周期、行业轮动、资产配置",
    },
    logic: {
      entry: [
        "阶段1（复苏初期）：债券↑，股票↓，商品↓ → 买债券",
        "阶段2（复苏中期）：债券↑，股票↑，商品↓ → 买股票",
        "阶段3（复苏晚期）：债券↓，股票↑，商品↑ → 买周期股/商品",
        "阶段4（衰退初期）：债券↓，股票↓，商品↑ → 买商品/现金",
        "阶段5（衰退中期）：债券↓，股票↓，商品↓ → 持现金",
        "阶段6（衰退晚期）：债券↑，股票↓，商品↓ → 买债券",
      ],
      exit: ["进入下一阶段时轮换资产"],
    },
    params: [
      {
        name: "领先指标",
        nameEn: "Leading Indicators",
        default: "PMI/利率",
        range: "PMI/收益率曲线/就业",
      },
    ],
    pros: ["宏观视角", "资产配置框架", "避免逆周期投资"],
    cons: ["周期判断困难", "转换点难以把握", "周期长度不固定"],
    bestPractices: {
      dos: [
        "跟踪领先指标（PMI、收益率曲线）",
        "确认周期转换后再行动",
        "逐步调整而非全仓切换",
      ],
      donts: ["不要预测周期拐点", "不要频繁切换", "不要忽视市场情绪"],
      tips: [
        "收益率曲线是最可靠的周期指标",
        "行业轮动验证周期位置",
        "与Harvey收益率曲线策略结合使用",
      ],
    },
    periodSignificance: {
      shortTerm: "不适用，周期分析是宏观视角",
      mediumTerm: "季度级别观察周期变化",
      longTerm: "完整周期通常3-7年",
      bestPeriod: "季度/年度调整",
    },
    bestFor: "资产配置、宏观投资者",
    bestForEn: "Asset allocators, macro investors",
    relatedStrategies: ["academic-10"],
    prompt:
      "周期轮动：判断当前经济阶段（复苏/繁荣/衰退），在复苏期买股票，繁荣期买商品，衰退期持债券/现金",
    version: "1.0",
    lastUpdated: "2025-01-20",
  },
];

// Export all practitioner strategies
export default practitionerStrategies;
