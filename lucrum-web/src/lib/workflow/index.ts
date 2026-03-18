/**
 * Workflow Module Exports
 * 工作流模块导出
 *
 * Central export point for the multi-step workflow system.
 * 多步骤工作流系统的统一导出点
 */

// Types
export type {
  WorkflowType,
  WorkflowStatus,
  StepStatus,
  StepType,
  StrategyDevStep,
  BacktestAnalysisStep,
  AdvisorChatStep,
  WorkflowStepDefinition,
  WorkflowDefinition,
  WorkflowSession,
  StepData,
  StepExecutionContext,
  StepExecutionResult,
  StepCacheStrategy,
  CacheEntryMeta,
  WorkflowEventType,
  WorkflowEvent,
  CreateSessionRequest,
  ExecuteStepRequest,
  SessionResponse,
  StepResultResponse,
} from './types';

// Workflow Manager
export { WorkflowManager, getWorkflowManager } from './workflow-manager';

// Step Executor
export { executeStep } from './step-executor';

// Cache Strategy
export {
  STEP_TTLS,
  STEP_CACHE_STRATEGIES,
  hashInput,
  generateStepCacheKey,
  getCachedStepResult,
  setCachedStepResult,
  invalidateStepCache,
  shouldCacheStep,
  getStepTTL,
} from './cache-strategy';

// Workflow Definitions
export {
  STRATEGY_DEV_WORKFLOW,
  getStrategyDevStep,
  getStrategyDevStepByType,
  canSkipStep,
  getRequiredInputs,
  validateStepInput,
} from './workflows/strategy-workflow';
