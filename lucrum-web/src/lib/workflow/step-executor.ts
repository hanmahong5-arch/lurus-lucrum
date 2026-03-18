/**
 * Step Executor
 * 步骤执行器
 *
 * Executes individual workflow steps based on step type.
 * Each step type has its own execution logic.
 *
 * 根据步骤类型执行单个工作流步骤
 * 每种步骤类型有自己的执行逻辑
 */

import type {
  StepExecutionContext,
  StepExecutionResult,
  StepType,
  StrategyDevStep,
} from './types';

// =============================================================================
// Step Executor Registry / 步骤执行器注册表
// =============================================================================

type StepExecutor = (
  context: StepExecutionContext,
  input: Record<string, unknown>
) => Promise<StepExecutionResult>;

const STEP_EXECUTORS: Partial<Record<StepType, StepExecutor>> = {
  // Strategy Development Steps
  stock_select: executeStockSelect,
  strategy_input: executeStrategyInput,
  strategy_generate: executeStrategyGenerate,
  parameter_adjust: executeParameterAdjust,
  backtest_run: executeBacktestRun,
  result_analysis: executeResultAnalysis,
};

// =============================================================================
// Main Executor / 主执行器
// =============================================================================

/**
 * Execute a workflow step
 * 执行工作流步骤
 */
export async function executeStep(
  context: StepExecutionContext,
  input: Record<string, unknown>
): Promise<StepExecutionResult> {
  const executor = STEP_EXECUTORS[context.stepDef.stepType];

  if (!executor) {
    return {
      success: false,
      error: `No executor found for step type: ${context.stepDef.stepType}`,
    };
  }

  try {
    return await executor(context, input);
  } catch (error) {
    return {
      success: false,
      error: `Step execution failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// =============================================================================
// Strategy Development Step Executors / 策略开发步骤执行器
// =============================================================================

/**
 * Execute stock selection step
 * 执行选股步骤
 */
async function executeStockSelect(
  context: StepExecutionContext,
  input: Record<string, unknown>
): Promise<StepExecutionResult> {
  const symbols = input.symbols as string[];

  if (!symbols || symbols.length === 0) {
    return {
      success: false,
      error: 'No stocks selected',
    };
  }

  // Validate symbols and get stock info
  // In a real implementation, this would query the database
  const stockInfo = symbols.map((symbol) => ({
    symbol,
    name: `Stock ${symbol}`, // Would be fetched from DB
    valid: true,
  }));

  const invalidStocks = stockInfo.filter((s) => !s.valid);
  if (invalidStocks.length > 0) {
    return {
      success: false,
      error: `Invalid symbols: ${invalidStocks.map((s) => s.symbol).join(', ')}`,
    };
  }

  return {
    success: true,
    outputData: {
      selectedStocks: symbols,
      stockInfo,
      count: symbols.length,
    },
    shouldCache: true,
  };
}

/**
 * Execute strategy input step
 * 执行策略描述步骤
 */
async function executeStrategyInput(
  context: StepExecutionContext,
  input: Record<string, unknown>
): Promise<StepExecutionResult> {
  const strategyDescription = input.strategyDescription as string;

  if (!strategyDescription || strategyDescription.trim().length < 10) {
    return {
      success: false,
      error: 'Strategy description is too short (minimum 10 characters)',
    };
  }

  // Parse strategy description for key elements
  const parsed = parseStrategyDescription(strategyDescription);

  return {
    success: true,
    outputData: {
      strategyDescription,
      parsedStrategy: parsed,
      suggestedIndicators: parsed.indicators,
    },
    shouldCache: true,
  };
}

/**
 * Execute strategy generation step
 * 执行策略生成步骤
 */
async function executeStrategyGenerate(
  context: StepExecutionContext,
  input: Record<string, unknown>
): Promise<StepExecutionResult> {
  const strategyDescription = input.strategyDescription as string;
  const indicators = input.indicators as string[];

  if (!strategyDescription) {
    return {
      success: false,
      error: 'Strategy description is required',
    };
  }

  // In a real implementation, this would call the LLM API
  // For now, return a placeholder result
  const generatedCode = generatePlaceholderStrategy(strategyDescription, indicators);

  return {
    success: true,
    outputData: {
      generatedCode,
      parameters: extractParameters(generatedCode),
      explanation: 'Strategy generated based on your description.',
    },
    shouldCache: true,
  };
}

/**
 * Execute parameter adjustment step
 * 执行参数调整步骤
 */
async function executeParameterAdjust(
  context: StepExecutionContext,
  input: Record<string, unknown>
): Promise<StepExecutionResult> {
  const parameters = input.parameters as Record<string, unknown>;
  const originalCode = input.originalCode as string;

  if (!parameters || Object.keys(parameters).length === 0) {
    return {
      success: true,
      outputData: {
        adjustedParameters: {},
        modifiedCode: originalCode,
        message: 'No parameters to adjust',
      },
      shouldCache: false, // Don't cache parameter adjustments
    };
  }

  // Apply parameter changes to code
  const modifiedCode = applyParametersToCode(originalCode, parameters);

  return {
    success: true,
    outputData: {
      adjustedParameters: parameters,
      modifiedCode,
    },
    shouldCache: false,
  };
}

/**
 * Execute backtest run step
 * 执行回测步骤
 */
async function executeBacktestRun(
  context: StepExecutionContext,
  input: Record<string, unknown>
): Promise<StepExecutionResult> {
  const strategyCode = input.strategyCode as string;
  const symbols = input.symbols as string[];
  const dateRange = input.dateRange as { start: string; end: string };

  if (!strategyCode) {
    return {
      success: false,
      error: 'Strategy code is required',
    };
  }

  if (!symbols || symbols.length === 0) {
    return {
      success: false,
      error: 'At least one symbol is required',
    };
  }

  // In a real implementation, this would call the backtest engine
  // For now, return a placeholder result
  const backtestResult = {
    totalReturn: 0.15,
    annualReturn: 0.12,
    sharpeRatio: 1.2,
    maxDrawdown: 0.08,
    winRate: 0.55,
    tradeCount: 42,
    startDate: dateRange?.start ?? '2024-01-01',
    endDate: dateRange?.end ?? '2024-12-31',
    symbols,
  };

  return {
    success: true,
    outputData: {
      backtestResult,
      trades: [], // Would include trade history
      metrics: backtestResult,
    },
    shouldCache: true,
  };
}

/**
 * Execute result analysis step
 * 执行结果分析步骤
 */
async function executeResultAnalysis(
  context: StepExecutionContext,
  input: Record<string, unknown>
): Promise<StepExecutionResult> {
  const backtestResult = input.backtestResult as Record<string, unknown>;

  if (!backtestResult) {
    return {
      success: false,
      error: 'Backtest result is required',
    };
  }

  // Analyze backtest results
  const analysis = analyzeBacktestResult(backtestResult);

  return {
    success: true,
    outputData: {
      analysis,
      recommendations: analysis.recommendations,
      nextSteps: analysis.nextSteps,
    },
    shouldCache: true,
  };
}

// =============================================================================
// Helper Functions / 辅助函数
// =============================================================================

/**
 * Parse strategy description for key elements
 * 解析策略描述以获取关键元素
 */
function parseStrategyDescription(description: string): {
  type: string;
  indicators: string[];
  conditions: string[];
} {
  const indicatorPatterns: [RegExp, string][] = [
    [/\b(ma|sma|ema|移动平均)\b/i, 'MA'],
    [/\b(macd|指数平滑)\b/i, 'MACD'],
    [/\b(rsi|相对强弱)\b/i, 'RSI'],
    [/\b(boll|布林)\b/i, 'BOLL'],
    [/\b(kdj|随机指标)\b/i, 'KDJ'],
    [/\b(atr|平均真实波幅)\b/i, 'ATR'],
  ];

  const indicators: string[] = [];
  for (const [pattern, indicator] of indicatorPatterns) {
    if (pattern.test(description)) {
      indicators.push(indicator);
    }
  }

  // Default indicator if none detected
  if (indicators.length === 0) {
    indicators.push('MA');
  }

  return {
    type: indicators.includes('MACD') ? 'trend' : 'momentum',
    indicators,
    conditions: [],
  };
}

/**
 * Generate placeholder strategy code
 * 生成占位策略代码
 */
function generatePlaceholderStrategy(description: string, indicators?: string[]): string {
  const usedIndicators = indicators?.join(', ') ?? 'MA';

  return `# Strategy generated from description:
# ${description}
#
# Indicators used: ${usedIndicators}

from vnpy_ctastrategy import CtaTemplate, BarData

class GeneratedStrategy(CtaTemplate):
    """Auto-generated strategy"""
    author = "Lucrum"

    # Parameters
    fast_window = 10
    slow_window = 20
    fixed_size = 1

    # Variables
    fast_ma = 0.0
    slow_ma = 0.0

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)

    def on_init(self):
        self.write_log("Strategy initialized")
        self.load_bar(30)

    def on_start(self):
        self.write_log("Strategy started")

    def on_stop(self):
        self.write_log("Strategy stopped")

    def on_bar(self, bar: BarData):
        # Update indicators
        am = self.am
        am.update_bar(bar)
        if not am.inited:
            return

        # Calculate moving averages
        self.fast_ma = am.sma(self.fast_window)
        self.slow_ma = am.sma(self.slow_window)

        # Trading logic
        if self.fast_ma > self.slow_ma and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.fast_ma < self.slow_ma and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
`;
}

/**
 * Extract parameters from strategy code
 * 从策略代码提取参数
 */
function extractParameters(code: string): Array<{ name: string; value: number; type: string }> {
  const params: Array<{ name: string; value: number; type: string }> = [];
  const pattern = /(\w+)\s*=\s*(\d+(?:\.\d+)?)/g;

  let match;
  while ((match = pattern.exec(code)) !== null) {
    const name = match[1];
    const value = match[2];
    if (name && value && !['self', 'True', 'False', 'None'].includes(name)) {
      params.push({
        name,
        value: parseFloat(value),
        type: value.includes('.') ? 'float' : 'int',
      });
    }
  }

  return params;
}

/**
 * Apply parameters to strategy code
 * 将参数应用到策略代码
 */
function applyParametersToCode(
  code: string,
  parameters: Record<string, unknown>
): string {
  let modifiedCode = code;

  for (const [name, value] of Object.entries(parameters)) {
    const pattern = new RegExp(`(${name}\\s*=\\s*)\\d+(?:\\.\\d+)?`, 'g');
    modifiedCode = modifiedCode.replace(pattern, `$1${value}`);
  }

  return modifiedCode;
}

/**
 * Analyze backtest result
 * 分析回测结果
 */
function analyzeBacktestResult(result: Record<string, unknown>): {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  nextSteps: string[];
} {
  const totalReturn = (result.totalReturn as number) ?? 0;
  const sharpeRatio = (result.sharpeRatio as number) ?? 0;
  const maxDrawdown = (result.maxDrawdown as number) ?? 0;
  const winRate = (result.winRate as number) ?? 0;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  // Analyze performance
  if (totalReturn > 0.1) {
    strengths.push('Good overall return');
  } else if (totalReturn < 0) {
    weaknesses.push('Negative return');
    recommendations.push('Review entry/exit conditions');
  }

  if (sharpeRatio > 1.5) {
    strengths.push('Excellent risk-adjusted return');
  } else if (sharpeRatio < 1) {
    weaknesses.push('Low risk-adjusted return');
    recommendations.push('Consider adding stop-loss');
  }

  if (maxDrawdown < 0.1) {
    strengths.push('Low drawdown');
  } else if (maxDrawdown > 0.2) {
    weaknesses.push('High drawdown risk');
    recommendations.push('Reduce position size');
  }

  if (winRate > 0.55) {
    strengths.push('Good win rate');
  } else if (winRate < 0.45) {
    weaknesses.push('Low win rate');
    recommendations.push('Adjust signal thresholds');
  }

  return {
    summary: `Strategy achieved ${(totalReturn * 100).toFixed(1)}% return with ${(maxDrawdown * 100).toFixed(1)}% max drawdown.`,
    strengths,
    weaknesses,
    recommendations,
    nextSteps: [
      'Adjust parameters for optimization',
      'Test on different time periods',
      'Add additional filter conditions',
    ],
  };
}
