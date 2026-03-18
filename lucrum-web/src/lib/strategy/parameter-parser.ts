/**
 * Strategy Parameter Parser
 * 策略参数解析器
 *
 * Advanced parameter extraction and code generation for trading strategies.
 * Supports multiple parameter types: number, boolean, string, list.
 *
 * Features:
 * - Extract parameters from VeighNa strategy code
 * - Parse indicator configurations
 * - Generate code with updated parameters
 * - Validate parameter ranges
 *
 * @module lib/strategy/parameter-parser
 */

// =============================================================================
// TYPE DEFINITIONS / 类型定义
// =============================================================================

/**
 * Parameter data types supported by the parser
 * 解析器支持的参数数据类型
 */
export type ParameterType = "number" | "boolean" | "string" | "list";

/**
 * Individual strategy parameter
 * 单个策略参数
 */
export interface StrategyParameter {
  name: string; // Parameter name (参数名)
  displayName: string; // Human-readable name (显示名称)
  type: ParameterType; // Data type (数据类型)
  value: number | boolean | string | number[]; // Current value (当前值)
  defaultValue: number | boolean | string | number[]; // Default value (默认值)
  description: string; // Description (描述)
  category: ParameterCategory; // Parameter category (参数分类)
  range?: ParameterRange; // Valid range for numeric params (数值范围)
  options?: Array<{ label: string; value: string | number }>; // Options for select (选项)
  unit?: string; // Unit suffix (单位后缀, e.g., "日", "%")
  step?: number; // Step for numeric input (步进值)
  required?: boolean; // Is required (是否必填)
  editable?: boolean; // Can be edited (是否可编辑)
  lineNumber?: number; // Line number in code (代码行号)
}

/**
 * Parameter category for grouping
 * 参数分类用于分组显示
 */
export type ParameterCategory =
  | "indicator" // Indicator parameters (指标参数)
  | "signal" // Signal thresholds (信号阈值)
  | "risk" // Risk management (风控参数)
  | "position" // Position sizing (仓位参数)
  | "general"; // General settings (常规设置)

/**
 * Valid range for numeric parameters
 * 数值参数的有效范围
 */
export interface ParameterRange {
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Technical indicator configuration
 * 技术指标配置
 */
export interface IndicatorConfig {
  type: IndicatorType;
  params: Record<string, number>;
  description: string;
}

/**
 * Supported indicator types
 * 支持的指标类型
 */
export type IndicatorType =
  | "SMA"
  | "EMA"
  | "RSI"
  | "MACD"
  | "BOLL"
  | "KDJ"
  | "ATR"
  | "CCI"
  | "WR"
  | "DMI";

/**
 * Complete parsed strategy result
 * 完整的策略解析结果
 */
export interface ParsedStrategyResult {
  name: string;
  description: string;
  parameters: StrategyParameter[];
  indicators: IndicatorConfig[];
  entryConditions: string[];
  exitConditions: string[];
  riskRules: string[];
  rawCode: string;
  isValid: boolean;
  errors: string[];
}

// =============================================================================
// PARAMETER DEFINITIONS / 参数定义
// =============================================================================

/**
 * Known parameter patterns with metadata
 * 已知参数模式及其元数据
 */
const PARAMETER_DEFINITIONS: Record<
  string,
  Omit<StrategyParameter, "name" | "value" | "defaultValue" | "lineNumber">
> = {
  // MA indicators / 均线指标
  fast_window: {
    displayName: "快线周期",
    type: "number",
    description: "Fast moving average period (快速均线周期)",
    category: "indicator",
    range: { min: 1, max: 250, step: 1 },
    unit: "日",
  },
  slow_window: {
    displayName: "慢线周期",
    type: "number",
    description: "Slow moving average period (慢速均线周期)",
    category: "indicator",
    range: { min: 1, max: 250, step: 1 },
    unit: "日",
  },
  ma_window: {
    displayName: "均线周期",
    type: "number",
    description: "Moving average period (均线周期)",
    category: "indicator",
    range: { min: 1, max: 250, step: 1 },
    unit: "日",
  },

  // RSI parameters / RSI参数
  rsi_window: {
    displayName: "RSI周期",
    type: "number",
    description: "RSI calculation period (RSI计算周期)",
    category: "indicator",
    range: { min: 2, max: 100, step: 1 },
    unit: "日",
  },
  rsi_buy: {
    displayName: "RSI买入阈值",
    type: "number",
    description: "RSI oversold threshold for buy signal (RSI超卖买入阈值)",
    category: "signal",
    range: { min: 0, max: 50, step: 1 },
  },
  rsi_sell: {
    displayName: "RSI卖出阈值",
    type: "number",
    description: "RSI overbought threshold for sell signal (RSI超买卖出阈值)",
    category: "signal",
    range: { min: 50, max: 100, step: 1 },
  },

  // MACD parameters / MACD参数
  macd_fast: {
    displayName: "MACD快线",
    type: "number",
    description: "MACD fast EMA period (MACD快速EMA周期)",
    category: "indicator",
    range: { min: 2, max: 50, step: 1 },
    unit: "日",
  },
  macd_slow: {
    displayName: "MACD慢线",
    type: "number",
    description: "MACD slow EMA period (MACD慢速EMA周期)",
    category: "indicator",
    range: { min: 10, max: 100, step: 1 },
    unit: "日",
  },
  macd_signal: {
    displayName: "MACD信号线",
    type: "number",
    description: "MACD signal line period (MACD信号线周期)",
    category: "indicator",
    range: { min: 2, max: 50, step: 1 },
    unit: "日",
  },

  // Bollinger Bands / 布林带参数
  boll_window: {
    displayName: "布林带周期",
    type: "number",
    description: "Bollinger Bands period (布林带计算周期)",
    category: "indicator",
    range: { min: 5, max: 100, step: 1 },
    unit: "日",
  },
  boll_dev: {
    displayName: "布林带标准差",
    type: "number",
    description: "Bollinger Bands standard deviation multiplier (布林带标准差倍数)",
    category: "indicator",
    range: { min: 0.5, max: 4, step: 0.1 },
    unit: "倍",
  },

  // KDJ parameters / KDJ参数
  kdj_window: {
    displayName: "KDJ周期",
    type: "number",
    description: "KDJ calculation period (KDJ计算周期)",
    category: "indicator",
    range: { min: 5, max: 50, step: 1 },
    unit: "日",
  },

  // ATR parameters / ATR参数
  atr_window: {
    displayName: "ATR周期",
    type: "number",
    description: "ATR calculation period (ATR计算周期)",
    category: "indicator",
    range: { min: 5, max: 50, step: 1 },
    unit: "日",
  },
  atr_multiplier: {
    displayName: "ATR倍数",
    type: "number",
    description: "ATR multiplier for stop loss (ATR止损倍数)",
    category: "risk",
    range: { min: 0.5, max: 5, step: 0.1 },
    unit: "倍",
  },

  // Position sizing / 仓位参数
  fixed_size: {
    displayName: "固定仓位",
    type: "number",
    description: "Fixed position size in lots (固定手数)",
    category: "position",
    range: { min: 1, max: 1000, step: 1 },
    unit: "手",
  },
  position_pct: {
    displayName: "仓位比例",
    type: "number",
    description: "Position size as percentage of capital (资金占比)",
    category: "position",
    range: { min: 1, max: 100, step: 1 },
    unit: "%",
  },

  // Risk management / 风控参数
  stop_loss: {
    displayName: "止损比例",
    type: "number",
    description: "Stop loss percentage (止损百分比)",
    category: "risk",
    range: { min: 0.1, max: 20, step: 0.1 },
    unit: "%",
  },
  take_profit: {
    displayName: "止盈比例",
    type: "number",
    description: "Take profit percentage (止盈百分比)",
    category: "risk",
    range: { min: 0.1, max: 100, step: 0.1 },
    unit: "%",
  },
  trailing_stop: {
    displayName: "移动止损",
    type: "number",
    description: "Trailing stop percentage (移动止损百分比)",
    category: "risk",
    range: { min: 0.1, max: 20, step: 0.1 },
    unit: "%",
  },
  max_position: {
    displayName: "最大持仓",
    type: "number",
    description: "Maximum position limit (最大持仓限制)",
    category: "risk",
    range: { min: 1, max: 10000, step: 1 },
    unit: "手",
  },

  // General settings / 常规设置
  trade_size: {
    displayName: "交易数量",
    type: "number",
    description: "Trade size per order (每次交易数量)",
    category: "general",
    range: { min: 1, max: 10000, step: 1 },
    unit: "股",
  },
};

// =============================================================================
// PARSER FUNCTIONS / 解析函数
// =============================================================================

/**
 * Parse strategy code and extract all parameters
 * 解析策略代码并提取所有参数
 */
export function parseStrategyParameters(code: string): ParsedStrategyResult {
  const result: ParsedStrategyResult = {
    name: "Custom Strategy",
    description: "",
    parameters: [],
    indicators: [],
    entryConditions: [],
    exitConditions: [],
    riskRules: [],
    rawCode: code,
    isValid: true,
    errors: [],
  };

  if (!code || code.trim().length === 0) {
    result.isValid = false;
    result.errors.push("Empty strategy code / 策略代码为空");
    return result;
  }

  // Extract strategy name from class definition
  const nameMatch = code.match(/class\s+(\w+)/);
  if (nameMatch?.[1]) {
    result.name = nameMatch[1];
  }

  // Extract description from docstring
  const docMatch = code.match(/"""([\s\S]*?)"""/);
  if (docMatch?.[1]) {
    result.description = docMatch[1].trim().split("\n")[0] ?? "";
  }

  // Parse parameters
  result.parameters = extractParameters(code);

  // Detect indicators used
  result.indicators = detectIndicators(code, result.parameters);

  // Extract entry/exit conditions (simplified)
  result.entryConditions = extractConditions(code, "entry");
  result.exitConditions = extractConditions(code, "exit");

  // Extract risk rules
  result.riskRules = extractRiskRules(code);

  // Validate
  if (result.parameters.length === 0) {
    result.errors.push("No parameters found / 未找到参数");
  }

  return result;
}

/**
 * Extract all parameters from code
 * 从代码中提取所有参数
 */
function extractParameters(code: string): StrategyParameter[] {
  const parameters: StrategyParameter[] = [];
  const lines = code.split("\n");

  // Pattern for parameter assignment (handles various formats)
  // 参数赋值的正则模式（处理各种格式）
  const patterns = [
    // Standard: fast_window = 5
    /^\s*(\w+)\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:#.*)?$/,
    // With type hint: fast_window: int = 5
    /^\s*(\w+)\s*:\s*\w+\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:#.*)?$/,
    // Boolean: use_trailing = True
    /^\s*(\w+)\s*=\s*(True|False)\s*(?:#.*)?$/,
    // String: strategy_name = "MACD"
    /^\s*(\w+)\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/,
    // List: periods = [5, 10, 20]
    /^\s*(\w+)\s*=\s*\[([\d,\s.]+)\]\s*(?:#.*)?$/,
  ];

  // Track seen parameters to avoid duplicates
  const seenParams = new Set<string>();

  lines.forEach((line, lineIndex) => {
    // Skip class/function definitions and imports
    if (
      line.trim().startsWith("class ") ||
      line.trim().startsWith("def ") ||
      line.trim().startsWith("import ") ||
      line.trim().startsWith("from ") ||
      line.trim().startsWith("self.") ||
      line.includes("__")
    ) {
      return;
    }

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1];
        const rawValue = match[2];

        // Skip if already seen or is a reserved word
        if (
          !name ||
          !rawValue ||
          seenParams.has(name) ||
          isReservedWord(name)
        ) {
          continue;
        }

        seenParams.add(name);

        // Determine type and value
        let type: ParameterType = "number";
        let value: number | boolean | string | number[];

        if (rawValue === "True" || rawValue === "False") {
          type = "boolean";
          value = rawValue === "True";
        } else if (rawValue.includes(",")) {
          type = "list";
          value = rawValue
            .split(",")
            .map((v) => parseFloat(v.trim()))
            .filter((n) => !isNaN(n));
        } else if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
          type = "string";
          value = rawValue;
        } else {
          type = "number";
          value = parseFloat(rawValue);
        }

        // Get metadata from definitions or create default
        const definition = PARAMETER_DEFINITIONS[name];
        const param: StrategyParameter = {
          name,
          displayName: definition?.displayName ?? formatDisplayName(name),
          type: definition?.type ?? type,
          value,
          defaultValue: value,
          description: definition?.description ?? `Parameter: ${name}`,
          category: definition?.category ?? guessCategory(name),
          range: definition?.range,
          unit: definition?.unit,
          step: definition?.step ?? (type === "number" ? 1 : undefined),
          required: true,
          editable: true,
          lineNumber: lineIndex + 1,
        };

        parameters.push(param);
      }
    }
  });

  // Sort parameters by category
  return parameters.sort((a, b) => {
    const categoryOrder: Record<ParameterCategory, number> = {
      indicator: 0,
      signal: 1,
      position: 2,
      risk: 3,
      general: 4,
    };
    return categoryOrder[a.category] - categoryOrder[b.category];
  });
}

/**
 * Detect indicators used in the strategy
 * 检测策略中使用的指标
 */
function detectIndicators(
  code: string,
  parameters: StrategyParameter[],
): IndicatorConfig[] {
  const indicators: IndicatorConfig[] = [];
  const lowerCode = code.toLowerCase();

  // SMA detection
  if (
    lowerCode.includes("sma") ||
    lowerCode.includes("ma_window") ||
    lowerCode.includes("均线")
  ) {
    const fast =
      parameters.find((p) => p.name.includes("fast"))?.value ?? 5;
    const slow =
      parameters.find((p) => p.name.includes("slow"))?.value ?? 20;
    indicators.push({
      type: "SMA",
      params: {
        fast: typeof fast === "number" ? fast : 5,
        slow: typeof slow === "number" ? slow : 20,
      },
      description: "Simple Moving Average (简单移动平均)",
    });
  }

  // EMA detection
  if (lowerCode.includes("ema")) {
    indicators.push({
      type: "EMA",
      params: { period: 12 },
      description: "Exponential Moving Average (指数移动平均)",
    });
  }

  // RSI detection
  if (lowerCode.includes("rsi")) {
    const period =
      parameters.find((p) => p.name.includes("rsi_window"))?.value ?? 14;
    indicators.push({
      type: "RSI",
      params: { period: typeof period === "number" ? period : 14 },
      description: "Relative Strength Index (相对强弱指标)",
    });
  }

  // MACD detection
  if (lowerCode.includes("macd")) {
    const fast =
      parameters.find((p) => p.name.includes("macd_fast"))?.value ?? 12;
    const slow =
      parameters.find((p) => p.name.includes("macd_slow"))?.value ?? 26;
    const signal =
      parameters.find((p) => p.name.includes("macd_signal"))?.value ?? 9;
    indicators.push({
      type: "MACD",
      params: {
        fast: typeof fast === "number" ? fast : 12,
        slow: typeof slow === "number" ? slow : 26,
        signal: typeof signal === "number" ? signal : 9,
      },
      description: "Moving Average Convergence Divergence",
    });
  }

  // Bollinger Bands detection
  if (lowerCode.includes("boll") || lowerCode.includes("布林")) {
    const period =
      parameters.find((p) => p.name.includes("boll_window"))?.value ?? 20;
    const dev =
      parameters.find((p) => p.name.includes("boll_dev"))?.value ?? 2;
    indicators.push({
      type: "BOLL",
      params: {
        period: typeof period === "number" ? period : 20,
        stdDev: typeof dev === "number" ? dev : 2,
      },
      description: "Bollinger Bands (布林带)",
    });
  }

  // KDJ detection
  if (lowerCode.includes("kdj") || lowerCode.includes("stoch")) {
    indicators.push({
      type: "KDJ",
      params: { period: 9 },
      description: "KDJ Stochastic Oscillator (KDJ随机指标)",
    });
  }

  // ATR detection
  if (lowerCode.includes("atr")) {
    indicators.push({
      type: "ATR",
      params: { period: 14 },
      description: "Average True Range (平均真实波幅)",
    });
  }

  return indicators;
}

/**
 * Extract entry/exit conditions from code
 * 从代码中提取入场/出场条件
 */
function extractConditions(
  code: string,
  type: "entry" | "exit",
): string[] {
  const conditions: string[] = [];
  const lowerCode = code.toLowerCase();

  if (type === "entry") {
    // Look for buy conditions
    if (
      lowerCode.includes("golden cross") ||
      lowerCode.includes("金叉") ||
      lowerCode.match(/fast.*>.*slow/)
    ) {
      conditions.push("MA Golden Cross (均线金叉)");
    }
    if (lowerCode.includes("rsi") && lowerCode.includes("<")) {
      conditions.push("RSI Oversold (RSI超卖)");
    }
    if (lowerCode.includes("macd") && lowerCode.includes(">")) {
      conditions.push("MACD Golden Cross (MACD金叉)");
    }
    if (lowerCode.includes("boll") && lowerCode.includes("lower")) {
      conditions.push("Bollinger Lower Band (布林下轨)");
    }
  } else {
    // Look for sell conditions
    if (
      lowerCode.includes("death cross") ||
      lowerCode.includes("死叉") ||
      lowerCode.match(/fast.*<.*slow/)
    ) {
      conditions.push("MA Death Cross (均线死叉)");
    }
    if (lowerCode.includes("rsi") && lowerCode.includes(">")) {
      conditions.push("RSI Overbought (RSI超买)");
    }
    if (lowerCode.includes("macd") && lowerCode.includes("<")) {
      conditions.push("MACD Death Cross (MACD死叉)");
    }
    if (lowerCode.includes("boll") && lowerCode.includes("upper")) {
      conditions.push("Bollinger Upper Band (布林上轨)");
    }
    if (lowerCode.includes("stop_loss") || lowerCode.includes("止损")) {
      conditions.push("Stop Loss (止损)");
    }
    if (lowerCode.includes("take_profit") || lowerCode.includes("止盈")) {
      conditions.push("Take Profit (止盈)");
    }
  }

  return conditions;
}

/**
 * Extract risk management rules
 * 提取风险管理规则
 */
function extractRiskRules(code: string): string[] {
  const rules: string[] = [];
  const lowerCode = code.toLowerCase();

  if (lowerCode.includes("stop_loss")) {
    rules.push("Stop Loss (止损)");
  }
  if (lowerCode.includes("take_profit")) {
    rules.push("Take Profit (止盈)");
  }
  if (lowerCode.includes("trailing")) {
    rules.push("Trailing Stop (移动止损)");
  }
  if (lowerCode.includes("max_position")) {
    rules.push("Position Limit (持仓限制)");
  }
  if (lowerCode.includes("drawdown")) {
    rules.push("Drawdown Control (回撤控制)");
  }

  return rules;
}

// =============================================================================
// CODE GENERATION / 代码生成
// =============================================================================

/**
 * Update parameters in strategy code
 * 更新策略代码中的参数值
 */
export function updateStrategyCode(
  originalCode: string,
  parameters: StrategyParameter[],
): string {
  let updatedCode = originalCode;

  for (const param of parameters) {
    // Create regex pattern for this parameter
    const patterns = [
      // Standard: param_name = value
      new RegExp(`(${param.name}\\s*=\\s*)(-?\\d+(?:\\.\\d+)?)(\\s*(?:#.*)?)`, "g"),
      // With type hint: param_name: type = value
      new RegExp(
        `(${param.name}\\s*:\\s*\\w+\\s*=\\s*)(-?\\d+(?:\\.\\d+)?)(\\s*(?:#.*)?)`,
        "g",
      ),
      // Boolean
      new RegExp(`(${param.name}\\s*=\\s*)(True|False)(\\s*(?:#.*)?)`, "g"),
      // String
      new RegExp(`(${param.name}\\s*=\\s*)["']([^"']+)["'](\\s*(?:#.*)?)`, "g"),
    ];

    // Format value based on type
    let formattedValue: string;
    if (param.type === "boolean") {
      formattedValue = param.value ? "True" : "False";
    } else if (param.type === "string") {
      formattedValue = `"${param.value}"`;
    } else if (param.type === "list" && Array.isArray(param.value)) {
      formattedValue = `[${param.value.join(", ")}]`;
    } else {
      formattedValue = String(param.value);
    }

    // Try each pattern
    for (const pattern of patterns) {
      if (pattern.test(updatedCode)) {
        updatedCode = updatedCode.replace(pattern, `$1${formattedValue}$3`);
        break;
      }
    }
  }

  return updatedCode;
}

/**
 * Update a single parameter in strategy code by name and value
 * 按名称和值更新策略代码中的单个参数
 *
 * @param code - Original strategy code
 * @param paramName - Name of the parameter to update
 * @param value - New value for the parameter
 * @returns Updated strategy code
 */
export function updateParameterInCode(
  code: string,
  paramName: string,
  value: number | string | boolean,
): string {
  // Determine type from value
  let type: ParameterType;
  if (typeof value === "boolean") {
    type = "boolean";
  } else if (typeof value === "string") {
    type = "string";
  } else {
    type = "number";
  }

  // Create a synthetic parameter object
  const param: StrategyParameter = {
    name: paramName,
    displayName: paramName,
    value: value,
    defaultValue: value,
    type: type,
    description: "",
    category: "general",
    editable: true,
  };

  return updateStrategyCode(code, [param]);
}

/**
 * Validate parameter value against range
 * 验证参数值是否在有效范围内
 */
export function validateParameter(param: StrategyParameter): {
  isValid: boolean;
  error?: string;
} {
  if (param.type !== "number" || !param.range) {
    return { isValid: true };
  }

  const value = param.value as number;

  if (param.range.min !== undefined && value < param.range.min) {
    return {
      isValid: false,
      error: `Value must be >= ${param.range.min} / 值必须 >= ${param.range.min}`,
    };
  }

  if (param.range.max !== undefined && value > param.range.max) {
    return {
      isValid: false,
      error: `Value must be <= ${param.range.max} / 值必须 <= ${param.range.max}`,
    };
  }

  return { isValid: true };
}

/**
 * Validate all parameters
 * 验证所有参数
 */
export function validateAllParameters(
  parameters: StrategyParameter[],
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const param of parameters) {
    const result = validateParameter(param);
    if (!result.isValid && result.error) {
      errors[param.name] = result.error;
      isValid = false;
    }
  }

  return { isValid, errors };
}

// =============================================================================
// CROSS-PARAMETER VALIDATION / 跨参数验证
// =============================================================================

/**
 * Cross-parameter validation rule
 * 跨参数验证规则
 */
export interface CrossParameterRule {
  name: string; // Rule name (规则名称)
  description: string; // Description (描述)
  descriptionEn: string; // English description
  validate: (params: Map<string, number | boolean | string | number[]>) => boolean;
  errorMessage: string; // Chinese error message
  errorMessageEn: string; // English error message
  affectedParams: string[]; // Parameters involved in this rule
}

/**
 * Predefined cross-parameter validation rules
 * 预定义的跨参数验证规则
 */
const CROSS_PARAMETER_RULES: CrossParameterRule[] = [
  // MA fast/slow window validation
  {
    name: "ma_window_order",
    description: "快线周期必须小于慢线周期",
    descriptionEn: "Fast window must be less than slow window",
    validate: (params) => {
      const fast = params.get("fast_window");
      const slow = params.get("slow_window");
      if (typeof fast !== "number" || typeof slow !== "number") return true;
      return fast < slow;
    },
    errorMessage: "快线周期必须小于慢线周期",
    errorMessageEn: "Fast window must be less than slow window",
    affectedParams: ["fast_window", "slow_window"],
  },

  // RSI buy/sell threshold validation
  {
    name: "rsi_threshold_order",
    description: "RSI买入阈值必须小于卖出阈值",
    descriptionEn: "RSI buy threshold must be less than sell threshold",
    validate: (params) => {
      const buy = params.get("rsi_buy");
      const sell = params.get("rsi_sell");
      if (typeof buy !== "number" || typeof sell !== "number") return true;
      return buy < sell;
    },
    errorMessage: "RSI买入阈值必须小于卖出阈值",
    errorMessageEn: "RSI buy threshold must be less than sell threshold",
    affectedParams: ["rsi_buy", "rsi_sell"],
  },

  // MACD fast/slow validation
  {
    name: "macd_period_order",
    description: "MACD快线周期必须小于慢线周期",
    descriptionEn: "MACD fast period must be less than slow period",
    validate: (params) => {
      const fast = params.get("macd_fast");
      const slow = params.get("macd_slow");
      if (typeof fast !== "number" || typeof slow !== "number") return true;
      return fast < slow;
    },
    errorMessage: "MACD快线周期必须小于慢线周期",
    errorMessageEn: "MACD fast period must be less than slow period",
    affectedParams: ["macd_fast", "macd_slow"],
  },

  // Stop loss / Take profit ratio validation
  {
    name: "stop_take_profit_ratio",
    description: "止盈比例建议至少为止损比例的1.5倍",
    descriptionEn: "Take profit should be at least 1.5x stop loss for positive risk-reward",
    validate: (params) => {
      const stopLoss = params.get("stop_loss");
      const takeProfit = params.get("take_profit");
      if (typeof stopLoss !== "number" || typeof takeProfit !== "number") return true;
      // Warning if risk-reward ratio is less than 1.5
      return takeProfit >= stopLoss * 1.5;
    },
    errorMessage: "止盈比例建议至少为止损比例的1.5倍（当前风险收益比不佳）",
    errorMessageEn: "Take profit should be at least 1.5x stop loss (poor risk-reward ratio)",
    affectedParams: ["stop_loss", "take_profit"],
  },

  // Position sizing validation
  {
    name: "position_limit",
    description: "单次交易数量不应超过最大持仓限制",
    descriptionEn: "Trade size should not exceed max position limit",
    validate: (params) => {
      const tradeSize = params.get("fixed_size") ?? params.get("trade_size");
      const maxPosition = params.get("max_position");
      if (typeof tradeSize !== "number" || typeof maxPosition !== "number") return true;
      return tradeSize <= maxPosition;
    },
    errorMessage: "单次交易数量不应超过最大持仓限制",
    errorMessageEn: "Trade size should not exceed max position limit",
    affectedParams: ["fixed_size", "trade_size", "max_position"],
  },

  // ATR multiplier validation
  {
    name: "atr_multiplier_range",
    description: "ATR倍数过大可能导致止损过宽",
    descriptionEn: "ATR multiplier too high may result in wide stop loss",
    validate: (params) => {
      const multiplier = params.get("atr_multiplier");
      if (typeof multiplier !== "number") return true;
      return multiplier <= 3.0;
    },
    errorMessage: "ATR倍数超过3.0可能导致止损过宽，建议1.5-2.5",
    errorMessageEn: "ATR multiplier > 3.0 may result in wide stops, recommend 1.5-2.5",
    affectedParams: ["atr_multiplier"],
  },
];

/**
 * Cross-parameter validation result
 * 跨参数验证结果
 */
export interface CrossParameterValidationResult {
  isValid: boolean;
  warnings: Array<{
    rule: string;
    message: string;
    messageEn: string;
    affectedParams: string[];
    severity: "error" | "warning";
  }>;
}

/**
 * Validate cross-parameter rules
 * 验证跨参数规则
 *
 * @param parameters - Array of strategy parameters
 * @returns Validation result with any warnings
 */
export function validateCrossParameterRules(
  parameters: StrategyParameter[],
): CrossParameterValidationResult {
  const warnings: CrossParameterValidationResult["warnings"] = [];

  // Build parameter map for easy lookup
  const paramMap = new Map<string, number | boolean | string | number[]>();
  for (const param of parameters) {
    paramMap.set(param.name, param.value);
  }

  // Check each rule
  for (const rule of CROSS_PARAMETER_RULES) {
    // Skip if none of the affected params are present
    const hasAffectedParams = rule.affectedParams.some((p) => paramMap.has(p));
    if (!hasAffectedParams) continue;

    // Validate rule
    const isValid = rule.validate(paramMap);
    if (!isValid) {
      // Determine severity based on rule name
      const severity = rule.name.includes("ratio") || rule.name.includes("range")
        ? "warning"
        : "error";

      warnings.push({
        rule: rule.name,
        message: rule.errorMessage,
        messageEn: rule.errorMessageEn,
        affectedParams: rule.affectedParams.filter((p) => paramMap.has(p)),
        severity,
      });
    }
  }

  return {
    isValid: warnings.every((w) => w.severity === "warning"),
    warnings,
  };
}

/**
 * Get cross-parameter rules that apply to given parameters
 * 获取适用于给定参数的跨参数规则
 */
export function getApplicableCrossRules(
  parameterNames: string[],
): CrossParameterRule[] {
  return CROSS_PARAMETER_RULES.filter((rule) =>
    rule.affectedParams.some((p) => parameterNames.includes(p))
  );
}

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Check if a word is reserved (Python keywords, common variable names)
 */
function isReservedWord(word: string): boolean {
  const reserved = [
    "self",
    "cls",
    "True",
    "False",
    "None",
    "and",
    "or",
    "not",
    "if",
    "else",
    "elif",
    "for",
    "while",
    "def",
    "class",
    "return",
    "import",
    "from",
    "as",
    "try",
    "except",
    "finally",
    "with",
    "yield",
    "lambda",
    "pass",
    "break",
    "continue",
    "raise",
    "global",
    "nonlocal",
    "assert",
    "del",
    "in",
    "is",
    // Common variable names to skip
    "result",
    "data",
    "value",
    "index",
    "i",
    "j",
    "k",
    "x",
    "y",
    "n",
    "pos",
    "bar",
    "bars",
    "open",
    "high",
    "low",
    "close",
    "volume",
  ];
  return reserved.includes(word);
}

/**
 * Format parameter name to display name
 * e.g., "fast_window" -> "Fast Window"
 */
function formatDisplayName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Guess parameter category from name
 */
function guessCategory(name: string): ParameterCategory {
  const lowerName = name.toLowerCase();

  if (
    lowerName.includes("window") ||
    lowerName.includes("period") ||
    lowerName.includes("ma") ||
    lowerName.includes("ema") ||
    lowerName.includes("rsi") ||
    lowerName.includes("macd") ||
    lowerName.includes("boll") ||
    lowerName.includes("atr")
  ) {
    return "indicator";
  }

  if (
    lowerName.includes("buy") ||
    lowerName.includes("sell") ||
    lowerName.includes("threshold") ||
    lowerName.includes("signal")
  ) {
    return "signal";
  }

  if (
    lowerName.includes("stop") ||
    lowerName.includes("profit") ||
    lowerName.includes("loss") ||
    lowerName.includes("drawdown") ||
    lowerName.includes("max")
  ) {
    return "risk";
  }

  if (
    lowerName.includes("size") ||
    lowerName.includes("position") ||
    lowerName.includes("pct") ||
    lowerName.includes("lot")
  ) {
    return "position";
  }

  return "general";
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: ParameterCategory): string {
  const names: Record<ParameterCategory, string> = {
    indicator: "📊 指标参数 / Indicator",
    signal: "🎯 信号参数 / Signal",
    position: "📈 仓位参数 / Position",
    risk: "🛡️ 风控参数 / Risk",
    general: "⚙️ 常规设置 / General",
  };
  return names[category];
}

/**
 * Group parameters by category
 */
export function groupParametersByCategory(
  parameters: StrategyParameter[],
): Record<ParameterCategory, StrategyParameter[]> {
  const groups: Record<ParameterCategory, StrategyParameter[]> = {
    indicator: [],
    signal: [],
    position: [],
    risk: [],
    general: [],
  };

  for (const param of parameters) {
    groups[param.category].push(param);
  }

  return groups;
}
