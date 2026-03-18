/**
 * Agent Module Index
 * Agent 模块索引
 *
 * Main exports for the LangGraph-based agent system.
 * This module provides a unified interface for:
 * - LangGraph advisor graph
 * - LangChain tools for market data and indicators
 * - Type definitions for Agent Protocol
 */

// ============================================================================
// Graph Types
// ============================================================================

export type {
  AdvisorGraphState,
  DataPipelineState,
  AgentAnalysis,
  DebateArgument,
  DebateConclusion,
  MarketData,
  KLineData,
  CalculatedIndicators,
  DataValidation,
  UserContext,
  RiskProfile,
  ChatMode,
  Stance,
  InvestmentPhilosophy,
  AnalysisMethod,
  RunStatus,
  ThreadState,
  RunResult,
  MemoryItem,
} from "./graphs/types";

// ============================================================================
// State Factories
// ============================================================================

export {
  createDefaultAdvisorState,
  createDefaultDataPipelineState,
} from "./graphs/types";

// ============================================================================
// Advisor Graph
// ============================================================================

export {
  createAdvisorGraph,
  AdvisorStateAnnotation,
} from "./graphs/advisor-graph";

export type { AdvisorState } from "./graphs/advisor-graph";

// ============================================================================
// LangChain Tools
// ============================================================================

// Market data tools
export {
  marketTools,
  fetchKLinesTool,
  checkDataAvailabilityTool,
  getMarketQuoteTool,
  getMarketIndicesTool,
  searchStocksTool,
} from "./tools/market-tools";

// Technical indicator tools
export {
  indicatorTools,
  calculateIndicatorsTool,
  analyzeTrendTool,
  generateSignalTool,
} from "./tools/indicator-tools";
