/**
 * Strategy Development Workflow
 * 策略开发工作流
 *
 * 6-step workflow for developing and testing trading strategies:
 * 1. Stock Selection - Select target stocks
 * 2. Strategy Input - Describe strategy in natural language
 * 3. Strategy Generation - AI generates strategy code
 * 4. Parameter Adjustment - Fine-tune parameters
 * 5. Backtest Run - Execute backtest
 * 6. Result Analysis - Analyze and iterate
 *
 * 6步策略开发工作流：
 * 1. 选股 - 选择目标股票
 * 2. 策略描述 - 用自然语言描述策略
 * 3. 策略生成 - AI生成策略代码
 * 4. 参数调整 - 微调参数
 * 5. 回测执行 - 执行回测
 * 6. 结果分析 - 分析并迭代
 */

import type { WorkflowDefinition, WorkflowStepDefinition, StrategyDevStep } from '../types';
import { STEP_TTLS } from '../cache-strategy';

// =============================================================================
// Step Definitions / 步骤定义
// =============================================================================

const STOCK_SELECT_STEP: WorkflowStepDefinition = {
  stepNumber: 0,
  stepType: 'stock_select' as StrategyDevStep,
  name: '选择股票 / Select Stocks',
  description:
    '选择要进行回测和交易的股票。可以按行业、市值或手动选择。' +
    '\nSelect stocks for backtesting and trading. Filter by industry, market cap, or select manually.',
  optional: false,
  cacheTTL: STEP_TTLS.stock_select,
  requiredInputs: ['symbols'],
  outputFields: ['selectedStocks', 'stockInfo'],
};

const STRATEGY_INPUT_STEP: WorkflowStepDefinition = {
  stepNumber: 1,
  stepType: 'strategy_input' as StrategyDevStep,
  name: '描述策略 / Describe Strategy',
  description:
    '用自然语言描述您的交易策略，包括入场条件、出场条件和风险管理规则。' +
    '\nDescribe your trading strategy in natural language, including entry conditions, exit conditions, and risk management rules.',
  optional: false,
  cacheTTL: STEP_TTLS.strategy_input,
  requiredInputs: ['strategyDescription'],
  outputFields: ['parsedStrategy', 'suggestedIndicators'],
};

const STRATEGY_GENERATE_STEP: WorkflowStepDefinition = {
  stepNumber: 2,
  stepType: 'strategy_generate' as StrategyDevStep,
  name: '生成策略 / Generate Strategy',
  description:
    'AI根据您的描述生成可执行的策略代码。' +
    '\nAI generates executable strategy code based on your description.',
  optional: false,
  cacheTTL: STEP_TTLS.strategy_generate,
  requiredInputs: ['strategyDescription', 'indicators'],
  outputFields: ['generatedCode', 'parameters', 'explanation'],
};

const PARAMETER_ADJUST_STEP: WorkflowStepDefinition = {
  stepNumber: 3,
  stepType: 'parameter_adjust' as StrategyDevStep,
  name: '调整参数 / Adjust Parameters',
  description:
    '微调策略参数以优化性能。可以手动调整或使用参数优化。' +
    '\nFine-tune strategy parameters to optimize performance. Adjust manually or use parameter optimization.',
  optional: true,
  cacheTTL: 0, // No caching for parameter adjustments
  requiredInputs: ['parameters'],
  outputFields: ['adjustedParameters', 'modifiedCode'],
};

const BACKTEST_RUN_STEP: WorkflowStepDefinition = {
  stepNumber: 4,
  stepType: 'backtest_run' as StrategyDevStep,
  name: '运行回测 / Run Backtest',
  description:
    '在历史数据上执行策略回测，评估策略性能。' +
    '\nExecute strategy backtest on historical data to evaluate strategy performance.',
  optional: false,
  cacheTTL: STEP_TTLS.backtest_run,
  requiredInputs: ['strategyCode', 'parameters', 'symbols', 'dateRange'],
  outputFields: ['backtestResult', 'trades', 'metrics'],
};

const RESULT_ANALYSIS_STEP: WorkflowStepDefinition = {
  stepNumber: 5,
  stepType: 'result_analysis' as StrategyDevStep,
  name: '分析结果 / Analyze Results',
  description:
    '分析回测结果，识别优势和改进点。可以返回调整参数并重新回测。' +
    '\nAnalyze backtest results, identify strengths and areas for improvement. Can go back to adjust parameters and re-test.',
  optional: false,
  cacheTTL: STEP_TTLS.result_analysis,
  requiredInputs: ['backtestResult'],
  outputFields: ['analysis', 'recommendations', 'nextSteps'],
};

// =============================================================================
// Workflow Definition / 工作流定义
// =============================================================================

export const STRATEGY_DEV_WORKFLOW: WorkflowDefinition = {
  type: 'strategy_dev',
  name: '策略开发 / Strategy Development',
  description:
    '从策略想法到可执行代码的完整工作流。包括选股、策略描述、代码生成、参数调整、回测和结果分析。' +
    '\nComplete workflow from strategy idea to executable code. Includes stock selection, strategy description, code generation, parameter tuning, backtesting, and result analysis.',
  steps: [
    STOCK_SELECT_STEP,
    STRATEGY_INPUT_STEP,
    STRATEGY_GENERATE_STEP,
    PARAMETER_ADJUST_STEP,
    BACKTEST_RUN_STEP,
    RESULT_ANALYSIS_STEP,
  ],
  defaultExpirationHours: 24,
};

// =============================================================================
// Helper Functions / 辅助函数
// =============================================================================

/**
 * Get step definition by step number
 * 根据步骤号获取步骤定义
 */
export function getStrategyDevStep(stepNumber: number): WorkflowStepDefinition | undefined {
  return STRATEGY_DEV_WORKFLOW.steps[stepNumber];
}

/**
 * Get step definition by step type
 * 根据步骤类型获取步骤定义
 */
export function getStrategyDevStepByType(
  stepType: StrategyDevStep
): WorkflowStepDefinition | undefined {
  return STRATEGY_DEV_WORKFLOW.steps.find((s) => s.stepType === stepType);
}

/**
 * Check if step can be skipped
 * 检查步骤是否可以跳过
 */
export function canSkipStep(stepNumber: number): boolean {
  const step = getStrategyDevStep(stepNumber);
  return step?.optional ?? false;
}

/**
 * Get required inputs for step
 * 获取步骤所需的输入
 */
export function getRequiredInputs(stepNumber: number): string[] {
  const step = getStrategyDevStep(stepNumber);
  return step?.requiredInputs ?? [];
}

/**
 * Validate step input
 * 验证步骤输入
 */
export function validateStepInput(
  stepNumber: number,
  input: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const required = getRequiredInputs(stepNumber);
  const missing = required.filter((field) => !(field in input) || input[field] == null);

  return {
    valid: missing.length === 0,
    missing,
  };
}
