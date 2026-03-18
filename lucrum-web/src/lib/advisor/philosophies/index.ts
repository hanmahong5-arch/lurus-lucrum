/**
 * Lucrum Agentic Advisor - Investment Philosophy Library
 *
 * Comprehensive collection of investment philosophies, analysis methods,
 * trading styles, and specialty strategies
 *
 * Total: 7 philosophies + 5 methods + 5 styles + 4 strategies = 21 options
 */

import type {
  InvestmentPhilosophy,
  AnalysisMethod,
  TradingStyle,
  SpecialtyStrategy,
} from "../agent/types";

// ============================================================================
// Philosophy Definitions
// ============================================================================

export interface PhilosophyDefinition {
  id: InvestmentPhilosophy;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  keyPrinciples: string[];
  representatives: string[];
  bestFor: string[];
  prompt: string;
  tokenCost: number;
}

export const PHILOSOPHY_DEFINITIONS: Record<
  InvestmentPhilosophy,
  PhilosophyDefinition
> = {
  // -------------------------------------------------------------------------
  // Value Investing / 价值投资
  // -------------------------------------------------------------------------
  value: {
    id: "value",
    name: "价值投资",
    nameEn: "Value Investing",
    description: "寻找内在价值被低估的股票，以安全边际买入，长期持有",
    descriptionEn:
      "Finding undervalued stocks, buying with margin of safety, holding long-term",
    keyPrinciples: [
      "内在价值评估",
      "安全边际",
      "护城河分析",
      "长期持有",
      "逆向思维",
    ],
    representatives: [
      "本杰明·格雷厄姆",
      "沃伦·巴菲特",
      "查理·芒格",
      "塞斯·卡拉曼",
    ],
    bestFor: ["长期投资者", "风险厌恶者", "追求稳定回报"],
    tokenCost: 500,
    prompt: `## 价值投资分析框架 / Value Investing Framework

### 核心原则
1. **内在价值**: 通过基本面分析计算企业真实价值
2. **安全边际**: 只在价格显著低于内在价值时买入（>30%折扣）
3. **护城河**: 关注企业的持久竞争优势
4. **长期持有**: 做企业的合伙人，不做股票交易者
5. **逆向思维**: 在他人恐惧时贪婪，在他人贪婪时恐惧

### 估值方法
- DCF 现金流折现模型
- 资产重置成本法
- 可比公司估值
- 历史估值分位数

### 护城河类型
- 品牌定价权 / 网络效应 / 转换成本 / 成本优势 / 规模效应

### 投资纪律
- 买入条件: 价格 < 内在价值 70%
- 持有条件: 基本面未恶化
- 卖出条件: 严重高估 >150% 或护城河消失`,
  },

  // -------------------------------------------------------------------------
  // Growth Investing / 成长投资
  // -------------------------------------------------------------------------
  growth: {
    id: "growth",
    name: "成长投资",
    nameEn: "Growth Investing",
    description: "寻找高速增长的企业，为增长潜力支付溢价",
    descriptionEn:
      "Finding high-growth companies, paying premium for growth potential",
    keyPrinciples: [
      "收入/利润高速增长",
      "市场空间广阔",
      "竞争优势明确",
      "PEG估值",
      "动态跟踪验证",
    ],
    representatives: ["彼得·林奇", "菲利普·费雪", "T. Rowe Price"],
    bestFor: ["中长期投资者", "能承受波动", "追求超额回报"],
    tokenCost: 450,
    prompt: `## 成长投资分析框架 / Growth Investing Framework

### 核心原则
1. **增长为王**: 寻找收入和利润高速增长的企业（CAGR > 20%）
2. **赛道优先**: 大行业 + 高增速 = 大机会
3. **估值容忍**: 为高确定性增长支付合理溢价
4. **动态跟踪**: 持续验证增长逻辑

### 增长股分类 (彼得·林奇框架)
- 快速成长股: 年增 20-25%，10倍股来源
- 稳定成长股: 年增 10-12%，抵御衰退
- 周期股: 业绩随周期波动
- 困境反转股: 触底回升

### 估值方法
- PEG = PE / 预期增长率
- PEG < 1 = 低估, PEG 1-2 = 合理, PEG > 2 = 高估
- PS + 利润率改善预期
- 远期 DCF

### 投资纪律
- 买入: 增速拐点向上 + PEG < 1
- 持有: 增速符合预期
- 卖出: 增速持续放缓 + 天花板逼近`,
  },

  // -------------------------------------------------------------------------
  // Trend Following / 趋势跟踪
  // -------------------------------------------------------------------------
  trend: {
    id: "trend",
    name: "趋势跟踪",
    nameEn: "Trend Following",
    description: "顺势而为，追踪市场趋势，截断亏损让利润奔跑",
    descriptionEn:
      "Following market trends, cutting losses and letting profits run",
    keyPrinciples: [
      "顺势而为",
      "关键点交易",
      "分批建仓",
      "严格止损",
      "让利润奔跑",
    ],
    representatives: ["杰西·利弗莫尔", "理查德·丹尼斯", "比尔·邓恩"],
    bestFor: ["活跃交易者", "技术分析爱好者", "能承受波动"],
    tokenCost: 400,
    prompt: `## 趋势跟踪分析框架 / Trend Following Framework

### 核心原则
1. **趋势是朋友**: 顺势而为，不与市场对抗
2. **关键点**: 等待关键突破点出现再行动
3. **仓位管理**: 分批建仓，金字塔加仓
4. **止损纪律**: 严格止损，不扛单
5. **利润奔跑**: 不要过早获利了结

### 趋势判断方法
- 均线系统 (MA/EMA)
- 趋势线和通道
- 唐奇安通道突破
- MACD 趋势确认

### 关键点交易
- 突破买入点: 突破前期高点/阻力位
- 回踩确认点: 突破后回踩不破
- 加仓点: 趋势延续确认
- 止损点: 跌破关键支撑

### 仓位规则
- 初始仓位 ≤ 20%
- 只在盈利时加仓
- 亏损仓位不加仓
- 单笔止损 ≤ 2%`,
  },

  // -------------------------------------------------------------------------
  // Quantitative Investing / 量化投资
  // -------------------------------------------------------------------------
  quantitative: {
    id: "quantitative",
    name: "量化投资",
    nameEn: "Quantitative Investing",
    description: "用数据和模型驱动投资决策，追求统计套利",
    descriptionEn:
      "Data and model-driven decisions, seeking statistical arbitrage",
    keyPrinciples: [
      "数据驱动",
      "模型决策",
      "统计套利",
      "风险管理",
      "系统化执行",
    ],
    representatives: ["吉姆·西蒙斯", "D.E. Shaw", "Two Sigma"],
    bestFor: ["理性投资者", "相信数据", "纪律执行"],
    tokenCost: 400,
    prompt: `## 量化投资分析框架 / Quantitative Investing Framework

### 核心原则
1. **数据驱动**: 所有决策基于数据分析
2. **模型决策**: 用数学模型替代主观判断
3. **统计套利**: 利用市场的统计规律获利
4. **风险管理**: 严格控制风险敞口
5. **系统化**: 消除人类情绪影响

### 量化因子
- **价值因子**: PE/PB/股息率
- **动量因子**: 过去收益率、趋势强度
- **质量因子**: ROE、盈利稳定性
- **波动率因子**: 低波动异象
- **规模因子**: 小市值效应

### 分析方法
- 因子暴露分析
- 历史回测验证
- 样本外测试
- 风险调整收益

### 风险控制
- 单一头寸 ≤ 1%
- 高度分散化
- 最大回撤限制
- 对冲系统性风险`,
  },

  // -------------------------------------------------------------------------
  // Index Investing / 指数投资
  // -------------------------------------------------------------------------
  index: {
    id: "index",
    name: "指数投资",
    nameEn: "Index/Passive Investing",
    description: "相信市场有效，低成本配置宽基指数，获取市场平均回报",
    descriptionEn:
      "Believing in market efficiency, low-cost broad index allocation",
    keyPrinciples: [
      "市场有效假说",
      "低成本配置",
      "长期持有",
      "定期再平衡",
      "资产配置",
    ],
    representatives: ["约翰·博格", "伯顿·马尔基尔", "David Swensen"],
    bestFor: ["被动投资者", "追求稳定", "长期财富积累"],
    tokenCost: 300,
    prompt: `## 指数投资分析框架 / Index Investing Framework

### 核心原则
1. **市场有效**: 长期来看难以战胜市场
2. **低成本**: 费用是确定的回报损耗
3. **分散化**: 不把鸡蛋放在一个篮子里
4. **长期持有**: 时间是复利的朋友
5. **纪律再平衡**: 定期调整资产配置

### 配置策略
- **核心卫星策略**: 70%核心(宽基指数) + 30%卫星(行业/主题)
- **生命周期策略**: 年龄越大，债券比例越高
- **恒定比例策略**: 固定股债比例，定期再平衡

### 指数选择
- 宽基指数: 沪深300、中证500、创业板指
- 行业指数: 消费、医药、科技
- 策略指数: 红利、低波动、质量

### 执行方法
- 定期定额投资
- 年度再平衡
- 避免择时
- 长期坚持`,
  },

  // -------------------------------------------------------------------------
  // Dividend Investing / 股息投资
  // -------------------------------------------------------------------------
  dividend: {
    id: "dividend",
    name: "股息投资",
    nameEn: "Dividend Investing",
    description: "投资高股息、稳定分红的企业，追求现金流收益",
    descriptionEn:
      "Investing in high-dividend, stable payout companies for cash flow",
    keyPrinciples: [
      "股息收益率",
      "分红稳定性",
      "股息增长",
      "现金流质量",
      "复利再投资",
    ],
    representatives: ["John Neff", "Geraldine Weiss"],
    bestFor: ["收益型投资者", "退休规划", "追求稳定现金流"],
    tokenCost: 350,
    prompt: `## 股息投资分析框架 / Dividend Investing Framework

### 核心原则
1. **股息收益**: 寻找股息率 > 无风险利率的股票
2. **分红稳定**: 关注分红历史和连续性
3. **股息增长**: 寻找能持续提高分红的企业
4. **现金流质量**: 分红必须有充足现金流支撑
5. **复利效应**: 股息再投资放大长期回报

### 选股标准
- 股息率 > 3%
- 连续分红 > 5 年
- 股息支付率 < 70%
- 自由现金流覆盖分红

### 分析维度
- 股息收益率 vs 历史分位
- 股息增长率 (5年CAGR)
- 现金分红比例
- 行业分红特征

### 风险提示
- 警惕"股息陷阱"（高股息+业绩恶化）
- 关注分红的可持续性
- 不要只看股息率，忽视业务质量`,
  },

  // -------------------------------------------------------------------------
  // Momentum Investing / 动量投资
  // -------------------------------------------------------------------------
  momentum: {
    id: "momentum",
    name: "动量投资",
    nameEn: "Momentum Investing",
    description: "追踪价格动量，买入强势股，卖出弱势股",
    descriptionEn: "Following price momentum, buying winners, selling losers",
    keyPrinciples: [
      "强者恒强",
      "动量持续性",
      "相对强度",
      "及时止损",
      "轮动交易",
    ],
    representatives: ["William O'Neil", "Gary Antonacci", "Cliff Asness"],
    bestFor: ["活跃交易者", "追求超额收益", "能快速反应"],
    tokenCost: 350,
    prompt: `## 动量投资分析框架 / Momentum Investing Framework

### 核心原则
1. **强者恒强**: 近期表现强势的股票倾向于继续强势
2. **动量持续**: 价格趋势具有惯性
3. **相对强度**: 关注相对大盘的表现
4. **及时换手**: 动量减弱时及时退出
5. **轮动策略**: 在不同股票间轮动

### 动量指标
- 过去 N 个月收益率排名
- 相对强度指数 (RSI)
- 价格动量 (ROC)
- 均线偏离度

### 选股策略
- 过去 3-12 个月收益率排名前 20%
- 排除过去 1 个月（短期反转）
- 结合成交量确认
- 每月再平衡

### 风险管理
- 动量崩溃风险
- 分散持仓
- 及时止损
- 控制换手成本`,
  },
};

// ============================================================================
// Analysis Method Definitions
// ============================================================================

export interface AnalysisMethodDefinition {
  id: AnalysisMethod;
  name: string;
  nameEn: string;
  description: string;
  focusAreas: string[];
  prompt: string;
  tokenCost: number;
}

export const ANALYSIS_METHOD_DEFINITIONS: Record<
  AnalysisMethod,
  AnalysisMethodDefinition
> = {
  fundamental: {
    id: "fundamental",
    name: "基本面分析",
    nameEn: "Fundamental Analysis",
    description: "分析企业财务、业务、竞争力等基本面因素",
    focusAreas: ["财报分析", "估值模型", "行业分析", "竞争格局"],
    tokenCost: 300,
    prompt: `### 基本面分析视角
关注: 财务健康度、盈利能力、估值水平、竞争优势
方法: ROE/ROIC 分析、现金流质量、估值对比、护城河评估`,
  },

  technical: {
    id: "technical",
    name: "技术分析",
    nameEn: "Technical Analysis",
    description: "分析价格走势、成交量、技术指标等图表信息",
    focusAreas: ["趋势判断", "K线形态", "技术指标", "量价分析"],
    tokenCost: 300,
    prompt: `### 技术分析视角
关注: 趋势方向、支撑阻力、形态信号、量价配合
方法: 均线系统、MACD/RSI/KDJ、形态识别、资金流向`,
  },

  macro: {
    id: "macro",
    name: "宏观分析",
    nameEn: "Macro Analysis",
    description: "分析宏观经济、政策、行业周期等宏观因素",
    focusAreas: ["经济周期", "货币政策", "行业轮动", "全球形势"],
    tokenCost: 300,
    prompt: `### 宏观分析视角
关注: 经济周期定位、政策取向、行业景气度、全球联动
方法: 周期判断、政策解读、行业比较、跨市场分析`,
  },

  behavioral: {
    id: "behavioral",
    name: "行为金融",
    nameEn: "Behavioral Finance",
    description: "分析市场情绪、投资者行为、认知偏差",
    focusAreas: ["市场情绪", "资金流向", "逆向机会", "认知偏差"],
    tokenCost: 250,
    prompt: `### 行为金融视角
关注: 市场情绪极端、羊群效应、过度反应、逆向机会
方法: 情绪指标、资金流向、筹码分析、逆向思维`,
  },

  factor: {
    id: "factor",
    name: "因子分析",
    nameEn: "Factor Analysis",
    description: "基于价值、动量、质量等因子进行量化分析",
    focusAreas: ["因子暴露", "因子收益", "风险归因", "组合优化"],
    tokenCost: 250,
    prompt: `### 因子分析视角
关注: 价值/动量/质量/低波动等因子暴露
方法: 因子得分、历史回测、风险调整收益、因子轮动`,
  },
};

// ============================================================================
// Trading Style Definitions
// ============================================================================

export interface TradingStyleDefinition {
  id: TradingStyle;
  name: string;
  nameEn: string;
  holdingPeriod: string;
  characteristics: string;
  prompt: string;
  tokenCost: number;
}

export const TRADING_STYLE_DEFINITIONS: Record<
  TradingStyle,
  TradingStyleDefinition
> = {
  scalping: {
    id: "scalping",
    name: "超短线",
    nameEn: "Scalping",
    holdingPeriod: "分钟 ~ 小时",
    characteristics: "高频交易，追求小而频繁的利润",
    tokenCost: 100,
    prompt:
      "交易风格: 超短线，持仓分钟到小时，追求日内小利润，注重技术面和盘口",
  },

  day_trading: {
    id: "day_trading",
    name: "短线交易",
    nameEn: "Day/Swing Trading",
    holdingPeriod: "天 ~ 周",
    characteristics: "捕捉短期波动，快进快出",
    tokenCost: 100,
    prompt:
      "交易风格: 短线交易，持仓天到周，捕捉短期波动，技术面为主结合基本面",
  },

  swing: {
    id: "swing",
    name: "波段操作",
    nameEn: "Swing Trading",
    holdingPeriod: "周 ~ 月",
    characteristics: "跟随中期趋势，高抛低吸",
    tokenCost: 100,
    prompt: "交易风格: 波段操作，持仓周到月，跟随中期趋势，技术面和基本面结合",
  },

  position: {
    id: "position",
    name: "中长线",
    nameEn: "Position Trading",
    holdingPeriod: "月 ~ 年",
    characteristics: "基于基本面，跟随主要趋势",
    tokenCost: 100,
    prompt: "交易风格: 中长线投资，持仓月到年，基本面驱动，技术面辅助择时",
  },

  buy_hold: {
    id: "buy_hold",
    name: "长期持有",
    nameEn: "Buy & Hold",
    holdingPeriod: "年 ~ 十年",
    characteristics: "做时间的朋友，享受复利增长",
    tokenCost: 100,
    prompt: "交易风格: 长期持有，持仓年到十年，做企业合伙人，忽略短期波动",
  },
};

// ============================================================================
// Specialty Strategy Definitions
// ============================================================================

export interface SpecialtyStrategyDefinition {
  id: SpecialtyStrategy;
  name: string;
  nameEn: string;
  description: string;
  origin: string;
  prompt: string;
  tokenCost: number;
}

export const SPECIALTY_STRATEGY_DEFINITIONS: Record<
  SpecialtyStrategy,
  SpecialtyStrategyDefinition
> = {
  san_dao_liu_shu: {
    id: "san_dao_liu_shu",
    name: "三道六术",
    nameEn: "3-Dao 6-Shu",
    description: "融合天时地利人和的东方投资智慧",
    origin: "Lucrum 原创",
    tokenCost: 400,
    prompt: `### 三道六术特色策略

**三道 (认知框架)**:
- 天道: 宏观周期、政策走向、行业大势
- 地道: 企业基本面、财务状况、竞争格局
- 人道: 市场情绪、资金博弈、主力动向

**六术 (战术方法)**:
1. 望术: 观察市场整体态势
2. 闻术: 收集行业和公司信息
3. 问术: 质疑和验证投资逻辑
4. 切术: 精准把握买卖时机
5. 守术: 持仓管理和风险控制
6. 弃术: 及时止损和组合优化`,
  },

  canslim: {
    id: "canslim",
    name: "CANSLIM",
    nameEn: "CANSLIM",
    description: "威廉·欧奈尔的七大选股法则",
    origin: "William O'Neil",
    tokenCost: 350,
    prompt: `### CANSLIM 选股法则

- **C** (Current Earnings): 当季EPS同比增长 > 25%
- **A** (Annual Earnings): 年度EPS连续增长
- **N** (New): 新产品/新管理/新高价
- **S** (Supply & Demand): 股票供需和成交量
- **L** (Leader): 行业龙头，相对强度高
- **I** (Institutional): 机构持股支撑
- **M** (Market Direction): 顺应市场大势`,
  },

  turtle: {
    id: "turtle",
    name: "海龟交易",
    nameEn: "Turtle Trading",
    description: "理查德·丹尼斯的突破交易系统",
    origin: "Richard Dennis",
    tokenCost: 350,
    prompt: `### 海龟交易法则

**入场规则**:
- 系统1: 20日突破买入，10日跌破卖出
- 系统2: 55日突破买入，20日跌破卖出

**仓位管理**:
- 每次交易风险 = 账户的 1%
- 仓位大小 = 1% / ATR
- 最多4个单位金字塔加仓

**止损规则**:
- 初始止损 = 2 × ATR
- 移动止损跟随价格`,
  },

  cycle: {
    id: "cycle",
    name: "周期投资",
    nameEn: "Cycle Investing",
    description: "基于经济周期和行业周期的轮动投资",
    origin: "Martin Pring / Ray Dalio",
    tokenCost: 350,
    prompt: `### 周期投资框架

**经济周期阶段**:
1. 复苏期: 超配成长股、周期股
2. 过热期: 超配商品、防御股
3. 滞胀期: 超配现金、贵金属
4. 衰退期: 超配债券、防御股

**行业轮动规律**:
- 早周期: 金融、地产、汽车
- 中周期: 资本品、原材料
- 晚周期: 能源、公用事业
- 防御性: 消费、医药`,
  },

  event_driven: {
    id: "event_driven",
    name: "事件驱动",
    nameEn: "Event-Driven",
    description: "利用重大事件带来的信息不对称和价格错配",
    origin: "Hedge Fund Strategy",
    tokenCost: 300,
    prompt: `### 事件驱动策略

**事件类型**:
- 并购重组: 套利机会
- 业绩发布: 超预期/低于预期
- 政策变化: 受益/受损行业
- 重大合同: 业务突破

**分析要点**:
- 事件的确定性
- 预期差的大小
- 催化剂的时间
- 风险收益比`,
  },
};

// ============================================================================
// Export Utility Functions
// ============================================================================

export function getPhilosophyPrompt(id: InvestmentPhilosophy): string {
  return PHILOSOPHY_DEFINITIONS[id]?.prompt || "";
}

export function getAnalysisMethodPrompt(id: AnalysisMethod): string {
  return ANALYSIS_METHOD_DEFINITIONS[id]?.prompt || "";
}

export function getTradingStylePrompt(id: TradingStyle): string {
  return TRADING_STYLE_DEFINITIONS[id]?.prompt || "";
}

export function getSpecialtyStrategyPrompt(id: SpecialtyStrategy): string {
  return SPECIALTY_STRATEGY_DEFINITIONS[id]?.prompt || "";
}

/**
 * Get all philosophy options for UI / 获取所有流派选项用于前端展示
 */
export function getPhilosophyOptions() {
  return Object.values(PHILOSOPHY_DEFINITIONS).map((p) => ({
    id: p.id,
    name: p.name,
    nameEn: p.nameEn,
    description: p.description,
    representatives: p.representatives,
    tokenCost: p.tokenCost,
  }));
}

/**
 * Get all analysis method options / 获取所有分析方法选项
 */
export function getAnalysisMethodOptions() {
  return Object.values(ANALYSIS_METHOD_DEFINITIONS).map((m) => ({
    id: m.id,
    name: m.name,
    nameEn: m.nameEn,
    description: m.description,
    tokenCost: m.tokenCost,
  }));
}

/**
 * Get all trading style options / 获取所有交易风格选项
 */
export function getTradingStyleOptions() {
  return Object.values(TRADING_STYLE_DEFINITIONS).map((s) => ({
    id: s.id,
    name: s.name,
    nameEn: s.nameEn,
    holdingPeriod: s.holdingPeriod,
    characteristics: s.characteristics,
    tokenCost: s.tokenCost,
  }));
}

/**
 * Get all specialty strategy options / 获取所有特色策略选项
 */
export function getSpecialtyStrategyOptions() {
  return Object.values(SPECIALTY_STRATEGY_DEFINITIONS).map((s) => ({
    id: s.id,
    name: s.name,
    nameEn: s.nameEn,
    description: s.description,
    origin: s.origin,
    tokenCost: s.tokenCost,
  }));
}
