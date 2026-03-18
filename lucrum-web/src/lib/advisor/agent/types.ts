/**
 * Lucrum Agentic Advisor - Core Type Definitions
 *
 * Multi-Agent architecture combining prediction and reaction systems
 * Reference: ai-hedge-fund, TradingAgents (UCLA), FinRobot
 */

// ============================================================================
// Investment Philosophy Types
// ============================================================================

/**
 * Core investment philosophies / 核心投资流派
 */
export type InvestmentPhilosophy =
  | "value" // 价值投资 - Graham, Buffett
  | "growth" // 成长投资 - Lynch, Fisher
  | "trend" // 趋势跟踪 - Livermore
  | "quantitative" // 量化投资 - Simons
  | "index" // 指数投资 - Bogle
  | "dividend" // 股息投资 - Dividend Growth
  | "momentum"; // 动量投资 - Momentum Factor

/**
 * Analysis methods / 分析方法
 */
export type AnalysisMethod =
  | "fundamental" // 基本面分析
  | "technical" // 技术分析
  | "macro" // 宏观分析
  | "behavioral" // 行为金融
  | "factor"; // 因子投资

/**
 * Trading styles / 交易风格
 */
export type TradingStyle =
  | "scalping" // 超短线 (分钟~小时)
  | "day_trading" // 短线交易 (天~周)
  | "swing" // 波段操作 (周~月)
  | "position" // 中长线 (月~年)
  | "buy_hold"; // 长期持有 (年~十年)

/**
 * Specialty strategies / 特色策略
 */
export type SpecialtyStrategy =
  | "san_dao_liu_shu" // 三道六术
  | "canslim" // O'Neil CANSLIM
  | "turtle" // 海龟交易
  | "cycle" // 周期投资
  | "event_driven"; // 事件驱动

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent types / Agent 类型
 */
export type AgentType =
  | "analyst" // 分析师
  | "researcher" // 研究员
  | "risk" // 风险管理
  | "trader" // 交易员
  | "monitor" // 监控
  | "master"; // 大师级

/**
 * Base Agent role definition / 基础 Agent 角色定义
 */
export interface AgentRole {
  id: string;
  name: string; // 中文名
  nameEn: string; // English name
  type: AgentType;
  philosophy?: InvestmentPhilosophy;
  personality: string; // 分析风格/性格
  focusAreas: string[]; // 关注领域
  systemPrompt: string; // 系统提示词
  temperature?: number; // LLM temperature
  maxTokens?: number; // Max output tokens
}

/**
 * Analyst Agent / 分析师 Agent
 */
export interface AnalystAgent extends AgentRole {
  type: "analyst";
  analysisMethod: AnalysisMethod;
  indicators?: string[]; // 关注的指标
  outputFormat: string; // 输出格式
}

/**
 * Researcher Agent stance / 研究员立场
 */
export type ResearcherStance = "bull" | "bear" | "neutral";

/**
 * Researcher Agent / 研究员 Agent (Bull vs Bear)
 */
export interface ResearcherAgent extends AgentRole {
  type: "researcher";
  stance: ResearcherStance;
  debateStyle: string; // 辩论风格
  argumentFocus: string[]; // 论证重点
}

/**
 * Core tactics structure for master agents
 * 大师核心战法结构
 */
export interface MasterCoreTactics {
  title: string; // 战法名称
  keyPoints: string[]; // 核心要点
}

/**
 * Master Investor Agent / 大师级投资者 Agent
 */
export interface MasterAgent extends AgentRole {
  type: "master";
  masterName: string; // 大师真名
  era: string; // 活跃时期
  quotes: string[]; // 经典语录
  tradingRules: string[]; // 交易规则
  books?: string[]; // 著作

  // Enhanced fields for better presentation / 增强展示字段
  coreTactics: MasterCoreTactics; // 核心战法摘要
  essenceOfThought: string; // 思想精华（一句话概括）
  signatureQuotes: string[]; // 代表性名言（2-3条最精华）
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * User advisor context / 用户顾问上下文
 */
export interface AdvisorContext {
  // Layer 1: Core philosophy (required)
  corePhilosophy: InvestmentPhilosophy;

  // Layer 2: Analysis methods (1-2 optional)
  analysisMethods: AnalysisMethod[];

  // Layer 3: Trading style
  tradingStyle: TradingStyle;

  // Layer 4: Specialty strategies (0-2 optional)
  specialtyStrategies: SpecialtyStrategy[];

  // User risk profile
  riskProfile: {
    tolerance: "conservative" | "moderate" | "aggressive";
    investmentHorizon: "short" | "medium" | "long";
    capitalSize?: "small" | "medium" | "large";
  };

  // Selected master agent (optional)
  masterAgent?: string;
}

/**
 * Chat modes / 对话模式
 */
export type ChatMode =
  | "quick" // 快速问答 (~1500 tokens)
  | "deep" // 深度分析 (~3000 tokens)
  | "debate" // 多空辩论
  | "diagnose"; // 组合诊断

/**
 * Analysis request / 分析请求
 */
export interface AnalysisRequest {
  symbol?: string; // 股票代码
  question: string; // 用户问题
  mode: ChatMode; // 分析模式
  context: AdvisorContext; // 用户上下文
  includeDebate?: boolean; // 是否包含辩论
  marketData?: MarketDataSnapshot;
}

/**
 * Market data snapshot / 市场数据快照
 */
export interface MarketDataSnapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  pe?: number;
  pb?: number;
  marketCap?: number;
  timestamp: Date;
}

// ============================================================================
// Debate Types
// ============================================================================

/**
 * Debate session / 辩论会话
 */
export interface DebateSession {
  id: string;
  topic: string; // 辩论主题
  symbol?: string; // 标的代码
  rounds: number; // 辩论轮数
  participants: {
    bull: ResearcherAgent;
    bear: ResearcherAgent;
    moderator?: AgentRole;
  };
  arguments: DebateArgument[];
  conclusion?: DebateConclusion;
  createdAt: Date;
}

/**
 * Debate argument / 辩论论点
 */
export interface DebateArgument {
  round: number;
  stance: ResearcherStance;
  agentId: string;
  content: string;
  keyPoints: string[];
  evidence?: string[];
  timestamp: Date;
}

/**
 * Debate conclusion / 辩论结论
 */
export interface DebateConclusion {
  consensus?: string; // 共识点
  keyBullPoints: string[]; // 多头核心论点
  keyBearPoints: string[]; // 空头核心论点
  riskFactors: string[]; // 风险因素
  opportunityFactors: string[]; // 机会因素
  finalVerdict: "bullish" | "bearish" | "neutral";
  confidenceLevel: number; // 置信度 0-100
  suggestedAction?: string; // 建议操作
}

// ============================================================================
// Alert Types (Prediction System)
// ============================================================================

/**
 * Alert types / 预警类型
 */
export type AlertType =
  | "price_breakout" // 价格突破
  | "volume_surge" // 放量异动
  | "sentiment_reversal" // 情绪反转
  | "news_impact" // 重大新闻
  | "technical_signal" // 技术信号
  | "risk_warning" // 风险预警
  | "opportunity" // 投资机会
  | "portfolio_rebalance" // 组合调仓
  | "morning_briefing" // 每日晨报
  | "closing_summary"; // 收盘总结

/**
 * Alert priority / 预警优先级
 */
export type AlertPriority = "low" | "medium" | "high" | "urgent";

/**
 * Proactive alert / 主动预警
 */
export interface ProactiveAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  symbol?: string;
  symbolName?: string;
  title: string;
  summary: string;
  analysis?: string; // Agent 生成的分析
  suggestedAction?: string; // 建议操作
  data?: Record<string, unknown>; // 附加数据
  triggeredBy: string; // 触发的 Agent ID
  timestamp: Date;
  expiresAt?: Date; // 时效性
  read?: boolean; // 是否已读
}

// ============================================================================
// Token Budget Types
// ============================================================================

/**
 * Token budget / Token 预算
 */
export interface TokenBudget {
  corePhilosophy: number; // 核心流派 ~500
  analysisMethods: number; // 分析方法 ~300 each
  tradingStyle: number; // 交易风格 ~100
  specialtyStrategies: number; // 特色策略 ~400 each
  riskProfile: number; // 风险偏好 ~100
  masterContext: number; // 大师上下文 ~300
  total: number;
  remaining: number;
}

/**
 * Token limits by mode / 各模式 Token 限制
 */
export const TOKEN_LIMITS: Record<ChatMode, number> = {
  quick: 1500,
  deep: 3000,
  debate: 4000,
  diagnose: 2500,
};

// ============================================================================
// User Preferences Types
// ============================================================================

/**
 * User notification preferences / 用户通知偏好
 */
export interface NotificationPreferences {
  channels: ("in_app" | "email" | "webhook")[];
  frequency: "realtime" | "batched" | "digest";
  alertTypes: AlertType[];
  quietHours?: {
    start: string; // HH:mm
    end: string;
  };
}

/**
 * User feedback / 用户反馈
 */
export interface UserFeedback {
  messageId: string;
  rating: "helpful" | "not_helpful" | "needs_improvement";
  preferredAspect?: "depth" | "clarity" | "actionable" | "risk";
  comment?: string;
  timestamp: Date;
}

/**
 * Saved user preferences / 保存的用户偏好
 */
export interface SavedAdvisorPreferences {
  defaultContext: AdvisorContext;
  notificationPrefs: NotificationPreferences;
  watchlist: string[];
  feedbackHistory: UserFeedback[];
  lastUpdated: Date;
}

// ============================================================================
// Institution Role Types (Buy-side Fund)
// 机构岗位类型（买方基金）
// ============================================================================

/**
 * Institution role IDs / 机构岗位 ID 枚举
 */
export type InstitutionRoleId =
  | "fund_manager"       // 基金经理
  | "head_researcher"    // 首席研究员
  | "analyst"            // 行业研究员
  | "quant"              // 量化研究员
  | "cro"                // 首席风控官
  | "macro_strategist"   // 宏观策略师
  | "head_trader";       // 首席交易员

/**
 * Institution role definition / 机构岗位定义
 */
export interface InstitutionRole {
  id: InstitutionRoleId;
  title: string;      // 中文职称
  titleEn: string;    // English title
  reportTo: InstitutionRoleId[];  // 汇报关系
  icon: string;       // emoji icon
  description: string;  // 职责简述
  systemPrompt: string; // LLM system prompt
  outputFormat: string; // 输出格式说明
  temperature: number;  // LLM temperature
  maxTokens: number;    // max output tokens
}

/**
 * Workflow step status / 工作流步骤状态
 */
export type WorkflowStepStatus = "pending" | "running" | "completed" | "error";

/**
 * Workflow step result / 工作流步骤结果
 */
export interface WorkflowStepResult {
  roleId: InstitutionRoleId;
  roleTitle: string;
  content: string;
  status: WorkflowStepStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

/**
 * Institution workflow chain definition / 机构工作流链路定义
 */
export interface InstitutionWorkflow {
  id: "single_stock" | "buy_decision" | "portfolio_review";
  name: string;          // 工作流名称
  description: string;   // 使用场景
  steps: InstitutionRoleId[][];  // 每组可并行执行，组间串行
  icon: string;
}

/**
 * Advisor panel mode / 顾问面板模式
 */
export type AdvisorPanelMode = "master" | "institution";

/**
 * Strategy drag payload / 策略拖拽数据
 */
export interface StrategyDragPayload {
  symbol: string;
  name: string;
  strategyCode?: string;
}
