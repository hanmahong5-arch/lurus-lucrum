/**
 * Investment Decision Framework - 3 Dao 6 Shu
 * 投资决策框架 - 三道六术
 *
 * Inspired by methodologies from:
 * 参考机构方法论：
 * - Bridgewater Associates (桥水基金) - All Weather / Pure Alpha
 * - Renaissance Technologies (文艺复兴) - Quantitative Analysis
 * - Hillhouse Capital (高瓴资本) - Long-term Value Investment
 * - GIC Singapore (新加坡政府投资) - Multi-Asset Framework
 * - CICC (中金公司) - A-Share Research Framework
 */

// =============================================================================
// TYPE DEFINITIONS / 类型定义
// =============================================================================

/**
 * The Three Dao (Strategic Levels)
 * 三道（战略层面）
 */
export interface ThreeDaoFramework {
  tianDao: TianDaoAnalysis;   // 天道 - Macro Environment
  diDao: DiDaoAnalysis;       // 地道 - Market Structure
  renDao: RenDaoAnalysis;     // 人道 - Investor Behavior
}

/**
 * 天道 - Macro Environment Analysis
 * Heavenly Dao: Understanding the broader economic and political landscape
 */
export interface TianDaoAnalysis {
  // Global Economic Cycle / 全球经济周期
  globalCycle: {
    phase: "expansion" | "peak" | "contraction" | "trough";
    leadingIndicators: LeadingIndicator[];
    centralBankPolicy: CentralBankPolicy[];
    geopoliticalRisks: GeopoliticalRisk[];
  };

  // Domestic Macro / 国内宏观
  domesticMacro: {
    gdpGrowth: number;
    cpi: number;
    pmi: number;
    monetaryPolicy: "easing" | "neutral" | "tightening";
    fiscalPolicy: "expansionary" | "neutral" | "contractionary";
    keyPolicies: PolicyEvent[];
  };

  // Cross-Asset Signals / 跨资产信号
  crossAssetSignals: {
    bondYieldCurve: "steepening" | "flat" | "inverted";
    creditSpread: "widening" | "stable" | "tightening";
    usdIndex: number;
    commodityTrend: "bullish" | "neutral" | "bearish";
    vixLevel: number;
  };

  // Overall Assessment / 整体评估
  assessment: {
    riskAppetite: "risk-on" | "neutral" | "risk-off";
    confidence: number; // 0-100
    keyInsights: string[];
    actionableAdvice: string;
  };
}

/**
 * 地道 - Market Structure Analysis
 * Earthly Dao: Understanding market mechanics and sector dynamics
 */
export interface DiDaoAnalysis {
  // Sector Rotation / 行业轮动
  sectorRotation: {
    leadingSectors: SectorInfo[];
    laggingSectors: SectorInfo[];
    rotationPhase: "early-cycle" | "mid-cycle" | "late-cycle" | "recession";
    hotThemes: ThemeInfo[];
  };

  // Market Breadth / 市场广度
  marketBreadth: {
    advanceDeclineRatio: number;
    newHighsNewLows: number;
    percentAboveMA20: number;
    percentAboveMA50: number;
    percentAboveMA200: number;
  };

  // Liquidity Conditions / 流动性环境
  liquidity: {
    marketTurnover: number;
    averageTurnover20d: number;
    marginTrading: MarginTradingData;
    northboundFlow: NorthboundFlowData;
    etfFlows: ETFFlowData[];
  };

  // Index Technical / 指数技术
  indexTechnical: {
    mainIndex: IndexTechnical[];
    supportResistance: SupportResistance[];
    trendStrength: number; // ADX or similar
  };

  // Assessment
  assessment: {
    marketPhase: "accumulation" | "markup" | "distribution" | "markdown";
    trendDirection: "bullish" | "neutral" | "bearish";
    confidence: number;
    keyInsights: string[];
    actionableAdvice: string;
  };
}

/**
 * 人道 - Investor Behavior Analysis
 * Human Dao: Understanding market psychology and positioning
 */
export interface RenDaoAnalysis {
  // Sentiment Indicators / 情绪指标
  sentiment: {
    fearGreedIndex: number; // 0-100
    putCallRatio: number;
    vixTerm: "contango" | "backwardation";
    surveyData: SentimentSurvey[];
    socialSentiment: SocialSentimentData;
  };

  // Positioning Data / 持仓数据
  positioning: {
    institutionalHoldings: InstitutionalHolding[];
    retailFlows: RetailFlowData;
    shortInterest: ShortInterestData;
    optionsPositioning: OptionsPositioningData;
  };

  // Smart Money Tracking / 聪明钱追踪
  smartMoney: {
    insiderTransactions: InsiderTransaction[];
    blockTrades: BlockTrade[];
    institutionalFilings: InstitutionalFiling[];
    hedgeFundMoves: HedgeFundMove[];
  };

  // Behavioral Signals / 行为信号
  behavioralSignals: {
    herding: number; // Herding index
    momentum: number; // Momentum following
    contrarian: number; // Contrarian signals
    volumeProfile: VolumeProfileData;
  };

  // Assessment
  assessment: {
    crowdedTrades: string[];
    potentialReversals: string[];
    confidence: number;
    keyInsights: string[];
    actionableAdvice: string;
  };
}

// =============================================================================
// SIX SHU (TACTICAL METHODS) / 六术（战术方法）
// =============================================================================

/**
 * 政策术 - Policy Analysis Method
 * Analyzing policy impact on markets
 */
export interface PolicyAnalysis {
  // Recent Policy Events / 近期政策事件
  recentPolicies: PolicyEvent[];

  // Policy Impact Assessment / 政策影响评估
  impactAssessment: {
    affectedSectors: string[];
    beneficiaries: string[];
    negativelyImpacted: string[];
    timeline: "immediate" | "short-term" | "medium-term" | "long-term";
    magnitude: "minor" | "moderate" | "significant" | "transformative";
  };

  // Policy Calendar / 政策日历
  upcomingEvents: PolicyCalendarEvent[];

  // Regulatory Risk / 监管风险
  regulatoryRisk: {
    sectors: { sector: string; riskLevel: "low" | "medium" | "high" }[];
    watchlist: string[];
  };
}

/**
 * 资金术 - Capital Flow Analysis Method
 * Tracking money flows across markets
 */
export interface CapitalFlowAnalysis {
  // Main Capital Flows / 主力资金流向
  mainCapitalFlow: {
    netInflow: number;
    largeOrderNetBuy: number;
    superLargeOrderNetBuy: number;
    topNetInflowSectors: { sector: string; amount: number }[];
    topNetInflowStocks: { symbol: string; amount: number }[];
  };

  // Northbound (Foreign) Capital / 北向资金
  northbound: {
    todayNetBuy: number;
    mtdNetBuy: number;
    ytdNetBuy: number;
    topHoldings: { symbol: string; shares: number; change: number }[];
    recentActivity: NorthboundActivity[];
  };

  // Margin Trading / 两融数据
  marginTrading: {
    marginBalance: number;
    marginBalanceChange: number;
    shortSellingBalance: number;
    marginBuyingTopStocks: { symbol: string; amount: number }[];
  };

  // Institutional Activity / 机构动向
  institutional: {
    fundFlows: FundFlowData[];
    insuranceAllocation: AllocationChange[];
    pensionAllocation: AllocationChange[];
    qfiiActivity: QFIIActivity[];
  };
}

/**
 * 基本术 - Fundamental Analysis Method
 * Evaluating intrinsic value
 */
export interface FundamentalAnalysis {
  // Valuation Metrics / 估值指标
  valuation: {
    pe: number;
    pb: number;
    ps: number;
    ev_ebitda: number;
    peg: number;
    dcfValue: number;
    historicalPercentile: number; // Where current valuation sits vs history
  };

  // Financial Quality / 财务质量
  financialQuality: {
    roe: number;
    roic: number;
    grossMargin: number;
    netMargin: number;
    assetTurnover: number;
    debtToEquity: number;
    interestCoverage: number;
    fcfYield: number;
  };

  // Growth Metrics / 成长指标
  growth: {
    revenueGrowth3y: number;
    epsGrowth3y: number;
    forwardRevenueGrowth: number;
    forwardEpsGrowth: number;
    analystRevisions: "upgrading" | "stable" | "downgrading";
  };

  // Competitive Position / 竞争地位
  competitivePosition: {
    marketShare: number;
    moatType: "none" | "narrow" | "wide";
    industryPosition: "leader" | "challenger" | "follower" | "niche";
    keyAdvantages: string[];
    keyRisks: string[];
  };
}

/**
 * 技术术 - Technical Analysis Method
 * Price and volume pattern analysis
 */
export interface TechnicalAnalysis {
  // Trend Analysis / 趋势分析
  trend: {
    shortTerm: "bullish" | "neutral" | "bearish";
    mediumTerm: "bullish" | "neutral" | "bearish";
    longTerm: "bullish" | "neutral" | "bearish";
    trendStrength: number; // ADX
    priceVsMA: {
      ma5: number;
      ma10: number;
      ma20: number;
      ma60: number;
      ma120: number;
      ma250: number;
    };
  };

  // Momentum Indicators / 动量指标
  momentum: {
    rsi14: number;
    macd: { macd: number; signal: number; histogram: number };
    stochastic: { k: number; d: number };
    cci: number;
    williams: number;
  };

  // Volume Analysis / 量能分析
  volume: {
    volumeVsAvg: number;
    volumeTrend: "increasing" | "stable" | "decreasing";
    obv: "bullish" | "neutral" | "bearish";
    volumeProfile: { priceLevel: number; volume: number }[];
  };

  // Pattern Recognition / 形态识别
  patterns: {
    candlePatterns: CandlePattern[];
    chartPatterns: ChartPattern[];
    keyLevels: { type: "support" | "resistance"; price: number; strength: number }[];
  };

  // Signals Summary / 信号汇总
  signals: {
    overallSignal: "strong-buy" | "buy" | "neutral" | "sell" | "strong-sell";
    signalStrength: number;
    conflictingSignals: string[];
  };
}

/**
 * 情绪术 - Sentiment Analysis Method
 * Market psychology assessment
 */
export interface SentimentAnalysisMethod {
  // Quantitative Sentiment / 量化情绪
  quantitative: {
    fearGreedIndex: number;
    putCallRatio: number;
    vix: number;
    bullBearSpread: number;
    marginDebtGrowth: number;
  };

  // News Sentiment / 新闻情绪
  newsSentiment: {
    overallScore: number; // -100 to +100
    recentHeadlines: { title: string; sentiment: number; source: string }[];
    topicTrends: { topic: string; sentiment: number; volume: number }[];
  };

  // Social Sentiment / 社交媒体情绪
  socialSentiment: {
    overallScore: number;
    mentionVolume: number;
    mentionTrend: "increasing" | "stable" | "decreasing";
    influencerOpinions: { name: string; opinion: string; followers: number }[];
    retailBuzz: string[];
  };

  // Analyst Sentiment / 分析师情绪
  analystSentiment: {
    consensusRating: number; // 1-5
    targetPrice: number;
    targetPriceRange: { low: number; high: number };
    recentChanges: { analyst: string; action: string; targetPrice: number }[];
  };
}

/**
 * 风控术 - Risk Management Method
 * Position sizing and risk control
 */
export interface RiskManagement {
  // Portfolio Risk / 组合风险
  portfolioRisk: {
    var95: number; // 95% VaR
    var99: number; // 99% VaR
    maxDrawdown: number;
    sharpeRatio: number;
    sortinoRatio: number;
    beta: number;
    correlation: { asset: string; correlation: number }[];
  };

  // Position Sizing / 仓位管理
  positionSizing: {
    suggestedSize: number;
    maxSize: number;
    kellyFraction: number;
    riskPerTrade: number;
  };

  // Stop Loss / 止损设置
  stopLoss: {
    technicalStop: number;
    volatilityStop: number;
    timeStop: number; // Days
    fundamentalStop: string; // Condition description
  };

  // Risk Alerts / 风险预警
  riskAlerts: {
    level: "low" | "medium" | "high" | "critical";
    alerts: RiskAlert[];
    recommendations: string[];
  };
}

// =============================================================================
// SUPPORTING TYPES / 辅助类型
// =============================================================================

export interface LeadingIndicator {
  name: string;
  value: number;
  previousValue: number;
  trend: "improving" | "stable" | "deteriorating";
  signal: "positive" | "neutral" | "negative";
}

export interface CentralBankPolicy {
  bank: string;
  currentRate: number;
  expectedChange: number;
  nextMeeting: string;
  forwardGuidance: string;
}

export interface GeopoliticalRisk {
  event: string;
  probability: number;
  impact: "low" | "medium" | "high";
  affectedAssets: string[];
}

export interface PolicyEvent {
  date: string;
  title: string;
  source: string;
  category: "monetary" | "fiscal" | "regulatory" | "industrial";
  summary: string;
  marketImpact: string;
  affectedSectors: string[];
}

export interface PolicyCalendarEvent {
  date: string;
  event: string;
  importance: "low" | "medium" | "high";
  expectedOutcome: string;
}

export interface SectorInfo {
  name: string;
  performance1m: number;
  performance3m: number;
  rsRating: number;
  flowStrength: number;
  catalysts: string[];
}

export interface ThemeInfo {
  name: string;
  description: string;
  keyStocks: string[];
  momentum: number;
  stage: "emerging" | "growing" | "mature" | "fading";
}

export interface MarginTradingData {
  totalBalance: number;
  dailyChange: number;
  trend: "increasing" | "stable" | "decreasing";
}

export interface NorthboundFlowData {
  todayNet: number;
  weekNet: number;
  monthNet: number;
  trend: "inflow" | "balanced" | "outflow";
}

export interface ETFFlowData {
  etfName: string;
  netFlow: number;
  aum: number;
}

export interface IndexTechnical {
  indexName: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  trend: "bullish" | "neutral" | "bearish";
  keyLevels: { support: number; resistance: number };
}

export interface SupportResistance {
  level: number;
  type: "support" | "resistance";
  strength: "weak" | "moderate" | "strong";
  touchCount: number;
}

export interface SentimentSurvey {
  source: string;
  bullish: number;
  bearish: number;
  neutral: number;
  date: string;
}

export interface SocialSentimentData {
  platform: string;
  sentimentScore: number;
  volume: number;
  topTopics: string[];
}

export interface InstitutionalHolding {
  institution: string;
  shares: number;
  changeFromPrevious: number;
  percentOfFloat: number;
}

export interface RetailFlowData {
  netBuying: number;
  trend: "buying" | "neutral" | "selling";
  tradingVolume: number;
}

export interface ShortInterestData {
  shortInterest: number;
  shortInterestRatio: number;
  daysToCovers: number;
  changeFromPrevious: number;
}

export interface OptionsPositioningData {
  putCallRatio: number;
  maxPainPrice: number;
  gammaExposure: number;
  openInterestChange: number;
}

export interface InsiderTransaction {
  insider: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  date: string;
}

export interface BlockTrade {
  symbol: string;
  volume: number;
  price: number;
  premium: number;
  date: string;
}

export interface InstitutionalFiling {
  institution: string;
  action: "increase" | "decrease" | "new" | "exit";
  shares: number;
  filingDate: string;
}

export interface HedgeFundMove {
  fund: string;
  action: string;
  conviction: "low" | "medium" | "high";
  commentary: string;
}

export interface VolumeProfileData {
  priceLevel: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface FundFlowData {
  fundType: string;
  netFlow: number;
  cumulativeFlow: number;
}

export interface AllocationChange {
  category: string;
  currentAllocation: number;
  previousAllocation: number;
  change: number;
}

export interface QFIIActivity {
  institution: string;
  action: string;
  amount: number;
  date: string;
}

export interface NorthboundActivity {
  date: string;
  netBuy: number;
  topBuys: string[];
  topSells: string[];
}

export interface CandlePattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  reliability: number;
  date: string;
}

export interface ChartPattern {
  name: string;
  type: "continuation" | "reversal";
  direction: "bullish" | "bearish";
  completionPercent: number;
  priceTarget: number;
}

export interface RiskAlert {
  type: string;
  message: string;
  severity: "info" | "warning" | "danger";
  timestamp: string;
}

// =============================================================================
// DECISION OUTPUT / 决策输出
// =============================================================================

/**
 * Final Investment Decision Output
 * 最终投资决策输出
 */
export interface InvestmentDecision {
  // Decision Summary / 决策摘要
  summary: {
    action: "strong-buy" | "buy" | "hold" | "sell" | "strong-sell" | "avoid";
    conviction: "low" | "medium" | "high" | "very-high";
    timeHorizon: "intraday" | "swing" | "position" | "investment";
    riskLevel: "low" | "medium" | "high";
  };

  // Three Dao Synthesis / 三道综合
  daoSynthesis: {
    tianDaoScore: number; // -100 to +100
    diDaoScore: number;
    renDaoScore: number;
    overallScore: number;
    conflictingSignals: string[];
  };

  // Six Shu Analysis / 六术分析
  shuAnalysis: {
    policyScore: number;
    capitalFlowScore: number;
    fundamentalScore: number;
    technicalScore: number;
    sentimentScore: number;
    riskScore: number;
  };

  // Key Arguments / 核心论据
  keyArguments: {
    bullCase: string[];
    bearCase: string[];
    catalysts: string[];
    risks: string[];
  };

  // Execution Plan / 执行计划
  executionPlan: {
    entryStrategy: string;
    entryPrice: { ideal: number; acceptable: number };
    positionSize: number;
    stopLoss: number;
    takeProfit: number[];
    exitConditions: string[];
  };

  // Confidence Analysis / 置信度分析
  confidenceAnalysis: {
    informationQuality: number;
    signalAlignment: number;
    historicalAccuracy: number;
    overallConfidence: number;
  };

  // Monitoring Plan / 监控计划
  monitoringPlan: {
    keyMetrics: string[];
    reviewFrequency: string;
    triggerConditions: string[];
    contingencyActions: string[];
  };
}
