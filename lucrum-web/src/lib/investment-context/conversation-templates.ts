/**
 * Investment Conversation Templates
 * 投资决策对话模板
 *
 * Professional dialogue frameworks for investment decision-making
 * 专业的投资决策对话框架
 */

// =============================================================================
// SYSTEM PROMPTS / 系统提示词
// =============================================================================

/**
 * Master System Prompt for Investment Advisor
 * 投资顾问主系统提示词
 */
export const INVESTMENT_ADVISOR_SYSTEM_PROMPT = `你是Lucrum投资决策顾问，一个基于"三道六术"框架的专业投资分析系统。

## 核心理念 / Core Philosophy

**"道"层面(战略)优于"术"层面(战术)，决策质量优于执行速度。**

在投资中，正确的方向比精准的时机更重要。我们追求：
- 深度理解 > 快速反应
- 系统思考 > 碎片信息
- 风险意识 > 收益追逐
- 独立判断 > 跟随市场

## 三道六术框架 / 3-Dao 6-Shu Framework

### 三道（战略层）

**天道 - 宏观环境**
- 全球经济周期定位
- 主要央行货币政策取向
- 地缘政治风险评估
- 国内宏观政策方向（财政、货币、产业）

**地道 - 市场结构**
- 市场趋势与阶段判断
- 行业轮动与板块强弱
- 资金流向与流动性环境
- 技术面关键位置

**人道 - 投资者行为**
- 市场情绪与预期
- 机构持仓与动向
- 散户行为特征
- 聪明钱信号追踪

### 六术（战术层）

1. **政策术** - 政策解读与影响路径分析
2. **资金术** - 资金流向与主力意图判断
3. **基本术** - 估值与财务质量评估
4. **技术术** - 价格形态与指标信号
5. **情绪术** - 市场心理与舆情监控
6. **风控术** - 风险评估与仓位管理

## 对话风格 / Dialogue Style

1. **专业化与清晰化结合**
   - 使用准确的金融术语，但同时给出通俗解释
   - 结论明确，逻辑清晰，避免模棱两可
   - 重要观点用数据和逻辑支撑

2. **引导式提问**
   - 在给出建议前，先了解用户的投资目标、风险承受能力、时间周期
   - 通过提问帮助用户理清思路
   - 不急于给出结论，确保信息充分

3. **多维度分析**
   - 任何投资决策都从三道六术多个角度分析
   - 明确指出bullish和bearish两方面的论据
   - 量化信心水平和风险等级

4. **审慎负责**
   - 明确提示投资有风险
   - 不做过度乐观或悲观的表态
   - 强调用户需要独立判断

## 分析输出格式 / Output Format

对于任何投资分析请求，请按以下结构输出：

### 一、核心判断（一句话）

### 二、三道分析
- **天道**：宏观环境对该投资的影响
- **地道**：市场结构与技术面状态
- **人道**：情绪面与资金面信号

### 三、关键论据
- 看多理由（Bull Case）
- 看空理由（Bear Case）
- 潜在催化剂
- 主要风险点

### 四、决策建议
- 操作方向：买入/持有/卖出/观望
- 置信度：高/中/低
- 建议仓位：X%
- 时间周期：短期/中期/长期

### 五、执行计划
- 入场条件与价位
- 止损设置
- 止盈目标
- 需要监控的指标

### 六、信息缺口
- 做出更好决策还需要了解的信息
- 建议关注的数据源

---

记住：**好的决策 > 好的执行**。帮助用户想清楚、看明白，比催促他们行动更重要。
`;

// =============================================================================
// CONVERSATION STARTERS / 对话开场白
// =============================================================================

/**
 * Initial greeting and information gathering
 * 初始问候与信息收集
 */
export const CONVERSATION_STARTERS = {
  // Standard greeting / 标准问候
  standard: `你好，我是谷神投资顾问。在开始分析之前，我想先了解几个问题，以便给出更贴合你需求的建议：

1. **投资目标**：你的投资目标是什么？（资产增值、稳定收益、对冲风险等）
2. **风险承受**：你的风险承受能力如何？（保守、稳健、积极、激进）
3. **时间周期**：你计划的投资时间是多长？（短线、波段、中长线、长期投资）
4. **资金规模**：大致的资金规模？（这会影响我对流动性和冲击成本的考量）

请告诉我这些基本信息，或者直接说明你想分析的标的和问题。`,

  // Quick analysis mode / 快速分析模式
  quick: `欢迎使用谷神快速分析。请告诉我：
- 你想分析的标的是什么？
- 主要想了解哪个方面？（政策影响/资金动向/技术走势/估值判断）`,

  // Market overview request / 市场概览请求
  marketOverview: `让我为你梳理当前市场的整体状态。我将从三道角度分析：

**天道（宏观环境）**
**地道（市场结构）**
**人道（情绪资金）**

请稍等，我来整合最新信息...`,
};

// =============================================================================
// ANALYSIS TEMPLATES / 分析模板
// =============================================================================

/**
 * Stock Analysis Template
 * 个股分析模板
 */
export const STOCK_ANALYSIS_TEMPLATE = `
## {{symbol}} 投资分析报告

### 一、核心判断
{{core_judgment}}

---

### 二、三道分析

#### 天道 - 宏观环境
| 维度 | 状态 | 影响 |
|------|------|------|
| 货币政策 | {{monetary_policy}} | {{monetary_impact}} |
| 产业政策 | {{industrial_policy}} | {{industrial_impact}} |
| 行业周期 | {{industry_cycle}} | {{cycle_impact}} |

**综合评估**：{{tian_dao_summary}}

#### 地道 - 市场结构
| 指标 | 数值 | 信号 |
|------|------|------|
| 所属行业RS | {{sector_rs}} | {{sector_signal}} |
| 资金流向 | {{capital_flow}} | {{flow_signal}} |
| 技术趋势 | {{technical_trend}} | {{trend_signal}} |

**综合评估**：{{di_dao_summary}}

#### 人道 - 情绪资金
| 指标 | 状态 | 含义 |
|------|------|------|
| 北向持仓 | {{northbound}} | {{northbound_meaning}} |
| 机构动向 | {{institutional}} | {{institutional_meaning}} |
| 散户情绪 | {{retail_sentiment}} | {{retail_meaning}} |

**综合评估**：{{ren_dao_summary}}

---

### 三、关键论据

#### 看多理由 (Bull Case)
{{#each bull_case}}
- {{this}}
{{/each}}

#### 看空理由 (Bear Case)
{{#each bear_case}}
- {{this}}
{{/each}}

#### 潜在催化剂
{{#each catalysts}}
- {{this}}
{{/each}}

#### 主要风险
{{#each risks}}
- {{this}}
{{/each}}

---

### 四、决策建议

| 维度 | 建议 |
|------|------|
| **操作方向** | {{action}} |
| **置信度** | {{confidence}} |
| **建议仓位** | {{position_size}} |
| **时间周期** | {{time_horizon}} |

---

### 五、执行计划

- **入场条件**：{{entry_condition}}
- **目标价位**：{{target_price}}
- **止损价位**：{{stop_loss}}
- **监控指标**：{{monitor_indicators}}

---

### 六、信息缺口

以下信息如能补充，可提高决策质量：
{{#each information_gaps}}
- {{this}}
{{/each}}

---

*报告生成时间：{{timestamp}}*
*数据来源：{{data_sources}}*
*风险提示：本报告仅供参考，不构成投资建议。投资有风险，入市需谨慎。*
`;

/**
 * Sector Analysis Template
 * 行业分析模板
 */
export const SECTOR_ANALYSIS_TEMPLATE = `
## {{sector_name}} 行业投资分析

### 一、行业定位
{{sector_positioning}}

### 二、政策环境
{{policy_environment}}

### 三、景气度评估
| 指标 | 当前值 | 趋势 | 信号 |
|------|--------|------|------|
{{#each prosperity_indicators}}
| {{this.name}} | {{this.value}} | {{this.trend}} | {{this.signal}} |
{{/each}}

### 四、资金偏好
{{capital_preference}}

### 五、核心标的
{{#each top_stocks}}
- **{{this.symbol}}**：{{this.reason}}
{{/each}}

### 六、投资建议
{{investment_advice}}

### 七、风险提示
{{risk_warning}}
`;

/**
 * Market Overview Template
 * 市场概览模板
 */
export const MARKET_OVERVIEW_TEMPLATE = `
## 市场全景扫描 | {{date}}

### 天道 - 宏观环境

**全球视角**
| 区域 | 经济状态 | 政策取向 | 风险事件 |
|------|----------|----------|----------|
| 美国 | {{us_economy}} | {{us_policy}} | {{us_risk}} |
| 中国 | {{cn_economy}} | {{cn_policy}} | {{cn_risk}} |
| 欧洲 | {{eu_economy}} | {{eu_policy}} | {{eu_risk}} |

**国内政策**
- 货币政策：{{monetary_stance}}
- 财政政策：{{fiscal_stance}}
- 产业重点：{{industrial_focus}}

**宏观结论**：{{macro_conclusion}}

---

### 地道 - 市场结构

**指数状态**
| 指数 | 点位 | 涨跌 | 趋势 | 关键位 |
|------|------|------|------|--------|
{{#each indices}}
| {{this.name}} | {{this.price}} | {{this.change}} | {{this.trend}} | {{this.key_level}} |
{{/each}}

**行业强弱**
- 领涨板块：{{leading_sectors}}
- 领跌板块：{{lagging_sectors}}
- 轮动方向：{{rotation_direction}}

**流动性**
- 两市成交：{{turnover}}
- 融资余额：{{margin_balance}}
- 北向资金：{{northbound_flow}}

**市场结论**：{{market_conclusion}}

---

### 人道 - 情绪资金

**情绪指标**
- 恐惧贪婪：{{fear_greed_index}}
- 市场温度：{{market_temperature}}
- 赚钱效应：{{profit_effect}}

**资金动向**
- 主力方向：{{main_force_direction}}
- 游资偏好：{{hot_money_preference}}
- 散户行为：{{retail_behavior}}

**情绪结论**：{{sentiment_conclusion}}

---

### 综合研判

**市场阶段**：{{market_phase}}

**操作策略**：{{operation_strategy}}

**关注重点**：{{focus_points}}

---

*更新时间：{{update_time}}*
`;

// =============================================================================
// QUESTIONING FRAMEWORKS / 提问框架
// =============================================================================

/**
 * Questions to clarify investment intent
 * 澄清投资意图的问题
 */
export const CLARIFICATION_QUESTIONS = {
  // About the target / 关于标的
  target: [
    "你对这个标的了解多少？是首次关注还是已经跟踪一段时间？",
    "你是看好这个公司/行业的长期价值，还是短期交易机会？",
    "有没有具体的买入/卖出理由？或者你想让我帮你分析？",
  ],

  // About timing / 关于时机
  timing: [
    "你现在是想入场，还是已经持有想知道何时退出？",
    "有没有必须在某个时间点前做出决定的约束？",
    "如果错过这次机会，你会遗憾吗？还是觉得会有下一次？",
  ],

  // About position / 关于仓位
  position: [
    "如果买入，你打算用多大比例的资金？",
    "你目前的持仓结构是怎样的？这笔投资会让组合更分散还是更集中？",
    "如果下跌20%，你会加仓、持有还是止损？",
  ],

  // About risk / 关于风险
  risk: [
    "你能承受的最大亏损是多少？",
    "你有设置止损的习惯吗？通常设在什么位置？",
    "你担心这笔投资最坏的情况是什么？",
  ],

  // Deep thinking / 深度思考
  deepThinking: [
    "如果市场上大多数人都看好它，你有没有想过大多数人可能是错的？",
    "这个投资机会是你独立发现的，还是听别人推荐的？",
    "三年后回头看，什么情况下你会认为这是一个正确的决定？",
    "有没有什么信息，如果你知道了，会改变你的决定？",
  ],
};

/**
 * Follow-up questions based on analysis gaps
 * 基于分析缺口的追问
 */
export const FOLLOW_UP_QUESTIONS = {
  // Need more macro context / 需要更多宏观背景
  macroGap: "我想更好地理解宏观环境对你投资的影响。你对当前的货币政策/经济周期/地缘政治有什么看法吗？",

  // Need more fundamental info / 需要更多基本面信息
  fundamentalGap: "关于这家公司的基本面，你最关心哪些方面？盈利能力、成长性、还是估值水平？",

  // Need more technical clarity / 需要更多技术面信息
  technicalGap: "从技术面看，你通常关注哪些指标？有没有你认为重要的支撑/压力位？",

  // Need position context / 需要仓位背景
  positionGap: "能告诉我你目前的持仓情况吗？这样我可以从组合角度给你建议。",
};

// =============================================================================
// RESPONSE PATTERNS / 回应模式
// =============================================================================

/**
 * How to deliver analysis results
 * 如何传达分析结果
 */
export const RESPONSE_PATTERNS = {
  // High conviction positive / 高置信度看好
  highConvictionBullish: `
基于三道六术的全面分析，我对 {{target}} 持**谨慎乐观**态度。

**核心逻辑**：{{core_logic}}

**信心来源**：
1. {{confidence_reason_1}}
2. {{confidence_reason_2}}
3. {{confidence_reason_3}}

**需要警惕**：{{key_risk}}

**建议操作**：{{suggested_action}}
`,

  // High conviction negative / 高置信度看空
  highConvictionBearish: `
经过审慎分析，我认为 {{target}} 目前**风险大于机会**。

**核心担忧**：{{core_concern}}

**主要理由**：
1. {{concern_reason_1}}
2. {{concern_reason_2}}
3. {{concern_reason_3}}

**可能的反转条件**：{{reversal_condition}}

**建议操作**：{{suggested_action}}
`,

  // Neutral / 中性
  neutral: `
对于 {{target}}，目前的信号比较**复杂**，多空因素交织。

**看多因素**：
{{bull_factors}}

**看空因素**：
{{bear_factors}}

**我的判断**：{{judgment}}

**建议策略**：{{suggested_strategy}}
`,

  // Need more information / 需要更多信息
  needMoreInfo: `
关于 {{target}} 的分析，我需要更多信息才能给出有价值的建议。

**已知信息支持**：{{known_facts}}

**需要补充**：
{{info_needed}}

**你能提供以上信息吗？或者告诉我你最关心的是哪个方面？**
`,
};

// =============================================================================
// RISK WARNINGS / 风险提示
// =============================================================================

export const RISK_WARNINGS = {
  standard: "投资有风险，入市需谨慎。以上分析仅供参考，不构成投资建议。",

  leverage: "该产品涉及杠杆，可能放大收益也可能放大亏损，请确保你理解相关风险。",

  illiquid: "该标的流动性较差，可能面临买卖价差较大、难以及时变现的风险。",

  volatile: "该标的波动性较高，短期内可能出现大幅涨跌，请做好风险管理。",

  newInvestor: "如果你是投资新手，建议先从小仓位开始，边学边做，逐步积累经验。",

  concentration: "单一标的仓位过重可能带来集中风险，建议考虑分散投资。",
};
