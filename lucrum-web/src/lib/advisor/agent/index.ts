/**
 * Agent Module Index
 * Agent 模块索引
 *
 * Exports all agent-related types, definitions, and utilities
 */

// Types
export * from "./types";

// Analyst Agents
export {
  FUNDAMENTALS_ANALYST,
  TECHNICAL_ANALYST,
  SENTIMENT_ANALYST,
  MACRO_ANALYST,
  ALL_ANALYSTS,
  getAnalystById,
  getAnalystsByMethod,
  recommendAnalyst,
} from "./analyst-agents";

// Researcher Agents
export {
  BULL_RESEARCHER,
  BEAR_RESEARCHER,
  DEBATE_MODERATOR,
  ALL_RESEARCHERS,
  getDebateTeam,
  generateDebatePrompt,
  generateModeratorPrompt,
} from "./researcher-agents";

// Master Agents
export {
  BUFFETT_AGENT,
  LYNCH_AGENT,
  LIVERMORE_AGENT,
  SIMONS_AGENT,
  ALL_MASTER_AGENTS,
  getMasterAgentById,
  getMasterAgentByPhilosophy,
  getMasterAgentSummaries,
} from "./master-agents";

// Orchestrator
export {
  selectAgents,
  getAllAgents,
  estimateTokens,
  calculateTokenBudget,
  buildContextPrompt,
  buildAgentPrompt,
  buildDebatePrompt,
  buildModeratorPrompt,
  createExecutionPlan,
  type AgentExecutionPlan,
} from "./agent-orchestrator";
