/**
 * Workflow Module Types
 * 工作流模块类型定义
 *
 * Defines types for the multi-step operation workflow system.
 * 定义多步骤操作工作流系统的类型
 */

// =============================================================================
// Workflow Types / 工作流类型
// =============================================================================

/**
 * Supported workflow types
 * 支持的工作流类型
 */
export type WorkflowType = 'strategy_dev' | 'backtest_analysis' | 'advisor_chat';

/**
 * Workflow session status
 * 工作流会话状态
 */
export type WorkflowStatus = 'active' | 'completed' | 'expired' | 'cancelled';

/**
 * Step status
 * 步骤状态
 */
export type StepStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

/**
 * Step types for different workflows
 * 不同工作流的步骤类型
 */
export type StrategyDevStep =
  | 'stock_select'
  | 'strategy_input'
  | 'strategy_generate'
  | 'parameter_adjust'
  | 'backtest_run'
  | 'result_analysis';

export type BacktestAnalysisStep =
  | 'strategy_select'
  | 'date_range_select'
  | 'parameter_config'
  | 'run_backtest'
  | 'analyze_results';

export type AdvisorChatStep =
  | 'advisor_query'
  | 'agent_analysis'
  | 'debate_round'
  | 'conclusion';

export type StepType = StrategyDevStep | BacktestAnalysisStep | AdvisorChatStep;

// =============================================================================
// Data Types / 数据类型
// =============================================================================

/**
 * Workflow step definition
 * 工作流步骤定义
 */
export interface WorkflowStepDefinition {
  /** Step number (0-indexed) / 步骤号 */
  stepNumber: number;
  /** Step type / 步骤类型 */
  stepType: StepType;
  /** Display name / 显示名称 */
  name: string;
  /** Description / 描述 */
  description: string;
  /** Is step optional / 是否可选 */
  optional?: boolean;
  /** Can loop (repeat) / 是否可循环 */
  canLoop?: boolean;
  /** Cache TTL in seconds (0 = no cache) / 缓存TTL（秒） */
  cacheTTL: number;
  /** Required input fields / 必需的输入字段 */
  requiredInputs?: string[];
  /** Output fields / 输出字段 */
  outputFields?: string[];
}

/**
 * Workflow definition
 * 工作流定义
 */
export interface WorkflowDefinition {
  /** Workflow type / 工作流类型 */
  type: WorkflowType;
  /** Display name / 显示名称 */
  name: string;
  /** Description / 描述 */
  description: string;
  /** Step definitions / 步骤定义 */
  steps: WorkflowStepDefinition[];
  /** Default expiration time in hours / 默认过期时间（小时） */
  defaultExpirationHours: number;
}

/**
 * Workflow session data
 * 工作流会话数据
 */
export interface WorkflowSession {
  /** Session ID / 会话ID */
  id: string;
  /** User ID / 用户ID */
  userId: string;
  /** Workflow type / 工作流类型 */
  workflowType: WorkflowType;
  /** Current status / 当前状态 */
  status: WorkflowStatus;
  /** Current step number / 当前步骤号 */
  currentStep: number;
  /** Total steps / 总步骤数 */
  totalSteps: number;
  /** Session title / 会话标题 */
  title?: string;
  /** Session context / 会话上下文 */
  context?: Record<string, unknown>;
  /** Step data snapshots / 步骤数据快照 */
  stepData?: Record<number, StepData>;
  /** Created at / 创建时间 */
  createdAt: Date;
  /** Updated at / 更新时间 */
  updatedAt: Date;
  /** Expires at / 过期时间 */
  expiresAt: Date;
}

/**
 * Step data for a single step
 * 单个步骤的数据
 */
export interface StepData {
  /** Step number / 步骤号 */
  stepNumber: number;
  /** Step type / 步骤类型 */
  stepType: StepType;
  /** Step status / 步骤状态 */
  status: StepStatus;
  /** Input data / 输入数据 */
  inputData?: Record<string, unknown>;
  /** Output data / 输出数据 */
  outputData?: Record<string, unknown>;
  /** Cached result / 缓存结果 */
  cachedResult?: unknown;
  /** Error message / 错误信息 */
  errorMessage?: string;
  /** Started at / 开始时间 */
  startedAt?: Date;
  /** Completed at / 完成时间 */
  completedAt?: Date;
}

/**
 * Step execution context
 * 步骤执行上下文
 */
export interface StepExecutionContext {
  /** Session / 会话 */
  session: WorkflowSession;
  /** Step definition / 步骤定义 */
  stepDef: WorkflowStepDefinition;
  /** Previous step data / 前一步骤数据 */
  previousSteps: StepData[];
  /** User ID / 用户ID */
  userId: string;
}

/**
 * Step execution result
 * 步骤执行结果
 */
export interface StepExecutionResult {
  /** Success / 是否成功 */
  success: boolean;
  /** Output data / 输出数据 */
  outputData?: Record<string, unknown>;
  /** Error message / 错误信息 */
  error?: string;
  /** Should cache result / 是否应该缓存结果 */
  shouldCache?: boolean;
  /** Next step override / 下一步骤覆盖 */
  nextStep?: number;
}

// =============================================================================
// Cache Types / 缓存类型
// =============================================================================

/**
 * Cache entry metadata
 * 缓存条目元数据
 */
export interface CacheEntryMeta {
  /** Step type / 步骤类型 */
  stepType: StepType;
  /** Input hash / 输入哈希 */
  inputHash: string;
  /** Cached at / 缓存时间 */
  cachedAt: Date;
  /** Expires at / 过期时间 */
  expiresAt: Date;
  /** Hit count / 命中次数 */
  hitCount: number;
}

/**
 * Step cache strategy
 * 步骤缓存策略
 */
export interface StepCacheStrategy {
  /** Whether to cache this step / 是否缓存此步骤 */
  enabled: boolean;
  /** TTL in seconds / TTL（秒） */
  ttl: number;
  /** Cache key generator / 缓存键生成器 */
  keyGenerator: (input: Record<string, unknown>) => string;
  /** Should invalidate / 是否应该失效 */
  shouldInvalidate?: (
    cachedData: unknown,
    newInput: Record<string, unknown>
  ) => boolean;
}

// =============================================================================
// Event Types / 事件类型
// =============================================================================

/**
 * Workflow event types
 * 工作流事件类型
 */
export type WorkflowEventType =
  | 'session:created'
  | 'session:updated'
  | 'session:completed'
  | 'session:expired'
  | 'step:started'
  | 'step:completed'
  | 'step:failed'
  | 'step:cached'
  | 'cache:hit'
  | 'cache:miss';

/**
 * Workflow event
 * 工作流事件
 */
export interface WorkflowEvent {
  type: WorkflowEventType;
  sessionId: string;
  userId: string;
  timestamp: Date;
  data?: {
    stepNumber?: number;
    stepType?: StepType;
    status?: StepStatus;
    message?: string;
    error?: string;
    cacheKey?: string;
  };
}

// =============================================================================
// Request/Response Types / 请求/响应类型
// =============================================================================

/**
 * Create session request
 * 创建会话请求
 */
export interface CreateSessionRequest {
  workflowType: WorkflowType;
  title?: string;
  initialContext?: Record<string, unknown>;
}

/**
 * Execute step request
 * 执行步骤请求
 */
export interface ExecuteStepRequest {
  sessionId: string;
  stepNumber: number;
  inputData: Record<string, unknown>;
  skipCache?: boolean;
}

/**
 * Session response
 * 会话响应
 */
export interface SessionResponse {
  session: WorkflowSession;
  currentStepDef: WorkflowStepDefinition;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  canGoBack: boolean;
  canGoForward: boolean;
}

/**
 * Step result response
 * 步骤结果响应
 */
export interface StepResultResponse {
  success: boolean;
  stepData: StepData;
  nextStep?: number;
  isComplete: boolean;
  cached: boolean;
  error?: string;
}
