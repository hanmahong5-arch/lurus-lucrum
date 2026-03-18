/**
 * LangGraph State Types
 * LangGraph 状态类型定义
 *
 * Defines the state structures for all LangGraph graphs in the system.
 * Follows the StateGraph pattern from LangGraphJS.
 */

import type { BaseMessage } from "@langchain/core/messages";

// ============================================================================
// Advisor Graph State
// ============================================================================

/**
 * Investment philosophy types
 * 投资流派类型
 */
export type InvestmentPhilosophy =
  | "value"
  | "growth"
  | "trend"
  | "quantitative"
  | "index"
  | "dividend"
  | "momentum";

/**
 * Analysis method types
 * 分析方法类型
 */
export type AnalysisMethod =
  | "fundamental"
  | "technical"
  | "macro"
  | "behavioral"
  | "factor";

/**
 * Chat mode types
 * 对话模式类型
 */
export type ChatMode = "quick" | "deep" | "debate" | "diagnose";

/**
 * Agent stance for debate
 * 辩论立场
 */
export type Stance = "bull" | "bear" | "neutral";

/**
 * Risk profile for user context
 * 用户风险画像
 */
export interface RiskProfile {
  tolerance: "conservative" | "moderate" | "aggressive";
  investmentHorizon: "short" | "medium" | "long";
  capitalSize?: "small" | "medium" | "large";
}

/**
 * User context for advisor
 * 顾问用户上下文
 */
export interface UserContext {
  corePhilosophy: InvestmentPhilosophy;
  analysisMethods: AnalysisMethod[];
  tradingStyle: string;
  specialtyStrategies: string[];
  riskProfile: RiskProfile;
  masterAgent?: string;
}

/**
 * Market data snapshot
 * 市场数据快照
 */
export interface MarketData {
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

/**
 * Agent analysis result
 * Agent 分析结果
 */
export interface AgentAnalysis {
  agentId: string;
  agentName: string;
  agentType: "analyst" | "researcher" | "master" | "moderator";
  stance?: Stance;
  content: string;
  keyPoints: string[];
  confidence?: number;
  timestamp: Date;
}

/**
 * Debate argument
 * 辩论论点
 */
export interface DebateArgument {
  round: number;
  stance: Stance;
  agentId: string;
  content: string;
  keyPoints: string[];
  evidence?: string[];
  timestamp: Date;
}

/**
 * Debate conclusion
 * 辩论结论
 */
export interface DebateConclusion {
  consensus?: string;
  keyBullPoints: string[];
  keyBearPoints: string[];
  riskFactors: string[];
  opportunityFactors: string[];
  finalVerdict: Stance;
  confidenceLevel: number;
  suggestedAction?: string;
}

/**
 * Main Advisor Graph State
 * 主顾问 Graph 状态
 *
 * This state is passed between nodes in the advisor graph.
 */
export interface AdvisorGraphState {
  // Input fields
  /** User's question / 用户问题 */
  question: string;
  /** Stock symbol (optional) / 股票代码 */
  symbol?: string;
  /** Chat mode / 对话模式 */
  mode: ChatMode;
  /** User context / 用户上下文 */
  userContext: UserContext;

  // Market data (optional)
  /** Market data snapshot / 市场数据快照 */
  marketData?: MarketData;

  // Conversation history
  /** Message history / 消息历史 */
  messages: BaseMessage[];

  // Agent analyses
  /** Analyses from different agents / 各 Agent 的分析结果 */
  analyses: AgentAnalysis[];

  // Debate-specific fields
  /** Is this a debate session / 是否为辩论会话 */
  isDebate: boolean;
  /** Debate topic / 辩论主题 */
  debateTopic?: string;
  /** Current debate round / 当前辩论轮次 */
  debateRound: number;
  /** Maximum debate rounds / 最大辩论轮次 */
  maxDebateRounds: number;
  /** Debate arguments / 辩论论点 */
  debateArguments: DebateArgument[];
  /** Debate conclusion / 辩论结论 */
  debateConclusion?: DebateConclusion;

  // Output fields
  /** Final response to user / 最终响应 */
  finalResponse?: string;
  /** Next agent to run / 下一个运行的 Agent */
  nextAgent?: string;

  // Metadata
  /** Processing errors / 处理错误 */
  errors: string[];
  /** Execution timestamp / 执行时间戳 */
  timestamp: Date;
}

// ============================================================================
// Data Pipeline Graph State
// ============================================================================

/**
 * K-line data point
 * K线数据点
 */
export interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Data quality validation result
 * 数据质量验证结果
 */
export interface DataValidation {
  coverage: number;
  quality: "good" | "fair" | "poor";
  missingDays: number;
  anomalies: string[];
  haltDays: number;
  limitUpDays: number;
  limitDownDays: number;
}

/**
 * Calculated indicators
 * 计算的技术指标
 */
export interface CalculatedIndicators {
  ma5?: number[];
  ma10?: number[];
  ma20?: number[];
  ma60?: number[];
  ema12?: number[];
  ema26?: number[];
  macd?: number[];
  signal?: number[];
  histogram?: number[];
  rsi14?: number[];
  upperBoll?: number[];
  middleBoll?: number[];
  lowerBoll?: number[];
}

/**
 * Data Pipeline Graph State
 * 数据管道 Graph 状态
 */
export interface DataPipelineState {
  // Input
  /** Stock symbol / 股票代码 */
  symbol: string;
  /** Timeframe / 时间周期 */
  timeframe: string;
  /** Number of bars to fetch / 获取的K线数量 */
  limit: number;
  /** Start date / 开始日期 */
  startDate?: string;
  /** End date / 结束日期 */
  endDate?: string;

  // Data fetching
  /** Raw K-line data / 原始K线数据 */
  klines: KLineData[];
  /** Data source used / 使用的数据源 */
  dataSource: "database" | "eastmoney" | "sina" | "mock";
  /** Cache hit / 是否命中缓存 */
  cacheHit: boolean;

  // Validation
  /** Data quality validation / 数据质量验证 */
  validation?: DataValidation;
  /** Validation errors / 验证错误 */
  validationErrors: string[];

  // Processing
  /** Cleaned K-line data / 清洗后的K线数据 */
  cleanedKlines: KLineData[];
  /** Calculated indicators / 计算的指标 */
  indicators?: CalculatedIndicators;

  // Output
  /** Final processed data / 最终处理的数据 */
  finalData?: {
    klines: KLineData[];
    indicators?: CalculatedIndicators;
    validation: DataValidation;
    metadata: {
      symbol: string;
      timeframe: string;
      dataSource: string;
      recordCount: number;
      dateRange: { start: string; end: string };
    };
  };

  // Status
  /** Processing status / 处理状态 */
  status: "pending" | "fetching" | "validating" | "cleaning" | "calculating" | "completed" | "error";
  /** Error messages / 错误信息 */
  errors: string[];
}

// ============================================================================
// Agent Protocol Types (Framework-agnostic)
// ============================================================================

/**
 * Run status for Agent Protocol
 * Agent Protocol 运行状态
 */
export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * Thread state for multi-turn conversations
 * 多轮对话的线程状态
 */
export interface ThreadState {
  threadId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
  values: Record<string, unknown>;
}

/**
 * Run result from Agent Protocol
 * Agent Protocol 运行结果
 */
export interface RunResult {
  runId: string;
  threadId?: string;
  status: RunStatus;
  result?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Memory item for long-term storage
 * 长期存储的记忆项
 */
export interface MemoryItem {
  key: string;
  value: unknown;
  namespace: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Default State Factories
// ============================================================================

/**
 * Create default advisor graph state
 * 创建默认的顾问 Graph 状态
 */
export function createDefaultAdvisorState(
  overrides?: Partial<AdvisorGraphState>
): AdvisorGraphState {
  return {
    question: "",
    mode: "quick",
    userContext: {
      corePhilosophy: "value",
      analysisMethods: ["fundamental"],
      tradingStyle: "position",
      specialtyStrategies: [],
      riskProfile: {
        tolerance: "moderate",
        investmentHorizon: "medium",
      },
    },
    messages: [],
    analyses: [],
    isDebate: false,
    debateRound: 0,
    maxDebateRounds: 2,
    debateArguments: [],
    errors: [],
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create default data pipeline state
 * 创建默认的数据管道 Graph 状态
 */
export function createDefaultDataPipelineState(
  overrides?: Partial<DataPipelineState>
): DataPipelineState {
  return {
    symbol: "",
    timeframe: "1d",
    limit: 200,
    klines: [],
    dataSource: "database",
    cacheHit: false,
    validationErrors: [],
    cleanedKlines: [],
    status: "pending",
    errors: [],
    ...overrides,
  };
}
