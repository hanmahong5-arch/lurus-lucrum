/**
 * Custom Agent Type Definitions
 * 自定义 Agent 类型定义
 *
 * Shared types for custom agent graph, API routes, and UI components.
 *
 * @module lib/agent/custom-agent-types
 */

// =============================================================================
// Agent Configuration Types
// =============================================================================

/** Target selection mode */
export type TargetMode = 'sector' | 'custom' | 'all';

/** Analysis depth controls AI token consumption */
export type AnalysisDepth = 'light' | 'standard' | 'deep';

/** Target configuration stored in custom_agents.targets */
export interface AgentTargets {
  mode: TargetMode;
  sectors?: string[];
  symbols?: string[];
}

/** Strategy binding stored in custom_agents.strategies */
export interface AgentStrategy {
  templateId: string;
  params?: Record<string, unknown>;
}

/** Backtest configuration override */
export interface AgentBacktestConfig {
  initialCapital?: number;
  dateRange?: { start: string; end: string };
  commission?: number;
  slippage?: number;
}

/** Full agent configuration for creating/updating */
export interface CustomAgentConfig {
  name: string;
  description?: string;
  targets: AgentTargets;
  strategies: AgentStrategy[];
  analysisDepth: AnalysisDepth;
  backtestConfig?: AgentBacktestConfig;
  icon?: string;
  color?: string;
}

// =============================================================================
// Run Result Types
// =============================================================================

/** Per-stock result from a custom agent run */
export interface StockResult {
  symbol: string;
  name: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  score: number;
  rank: number;
}

/** Aggregated run summary */
export interface RunSummary {
  totalStocks: number;
  analyzed: number;
  failed: number;
  topN: StockResult[];
  avgReturn: number;
  avgSharpe: number;
  bestSymbol: string;
  totalTokenCost: number;
  durationMs: number;
}

/** Token cost breakdown by graph node */
export interface TokenBreakdown {
  resolveTargets: number;
  insights: number;
}

// =============================================================================
// SSE Event Types
// =============================================================================

/** Status update from a graph node */
interface StatusEvent {
  type: 'status';
  node: string;
  message: string;
}

/** Progress update during parallel backtest */
interface ProgressEvent {
  type: 'progress';
  current: number;
  total: number;
  symbol?: string;
}

/** Individual stock result streamed to client */
interface StockResultEvent {
  type: 'stock_result';
  data: StockResult;
}

/** Real-time token consumption update */
interface TokenUpdateEvent {
  type: 'token_update';
  used: number;
  estimate: number;
}

/** AI-generated insights text */
interface InsightsEvent {
  type: 'insights';
  text: string;
}

/** Run completed successfully */
interface CompleteEvent {
  type: 'complete';
  summary: RunSummary;
}

/** Error occurred during run */
interface ErrorEvent {
  type: 'error';
  message: string;
  code?: string;
  metadata?: Record<string, unknown>;
}

export type CustomAgentEvent =
  | StatusEvent
  | ProgressEvent
  | StockResultEvent
  | TokenUpdateEvent
  | InsightsEvent
  | CompleteEvent
  | ErrorEvent;

// =============================================================================
// Graph State Types
// =============================================================================

export type CustomAgentStep =
  | 'validateConfig'
  | 'resolveTargets'
  | 'parallelBacktest'
  | 'rankAndAggregate'
  | 'generateInsights'
  | 'done'
  | 'error';

/** Token estimation per analysis depth */
export const TOKEN_ESTIMATES: Record<AnalysisDepth, number> = {
  light: 0,
  standard: 1500,
  deep: 5000,
};

// =============================================================================
// Plan Tier Limits for Custom Agents
// =============================================================================

export interface CustomAgentTierLimits {
  maxAgents: number;
  runsPerDay: number;
  maxStocks: number;
  allowDeep: boolean;
}
