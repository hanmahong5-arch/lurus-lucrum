/**
 * Strategy Optimization API
 * 策略优化API
 *
 * POST /api/strategy/optimize
 *
 * Supports three operations:
 * - suggest_params: Suggest optimized parameters based on backtest results
 * - explain_strategy: Explain strategy logic in natural language
 * - sensitivity_analysis: Analyze parameter sensitivity
 *
 * @module app/api/strategy/optimize/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { checkUsage, incrementUsage } from "@/lib/middleware/usage-tracker";

// =============================================================================
// TYPE DEFINITIONS / 类型定义
// =============================================================================

/**
 * Optimization action types
 */
type OptimizationAction = "suggest_params" | "explain_strategy" | "sensitivity_analysis" | "analyze_boundaries";

/**
 * Request body interface
 */
interface OptimizeRequest {
  action: OptimizationAction;
  strategyCode: string;
  backtestResult?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    profitFactor?: number;
  };
  currentParameters?: Record<string, number>;
  symbol?: string;
  // For boundary analysis / 用于边界分析
  parameterName?: string;
  currentValue?: number;
}

/**
 * Parameter suggestion from AI
 */
interface ParameterSuggestion {
  name: string;
  currentValue: number;
  suggestedValue: number;
  reason: string;
  expectedImprovement: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Strategy explanation
 */
interface StrategyExplanation {
  summary: string;
  indicators: Array<{
    name: string;
    purpose: string;
    currentConfig: string;
  }>;
  entryLogic: string;
  exitLogic: string;
  riskManagement: string;
  strengths: string[];
  weaknesses: string[];
  suitableMarkets: string[];
}

/**
 * Sensitivity analysis result
 */
interface SensitivityAnalysis {
  parameter: string;
  currentValue: number;
  impactLevel: "high" | "medium" | "low";
  optimalRange: { min: number; max: number };
  recommendations: string[];
}

// =============================================================================
// API HANDLER / API处理器
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: OptimizeRequest = await request.json();
    const { action, strategyCode, backtestResult, currentParameters, parameterName, currentValue } = body;

    // Validate request
    if (!action || !strategyCode) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: action, strategyCode" },
        { status: 400 }
      );
    }

    // AI call quota check
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email ?? session?.user?.name ?? "anonymous";
    const plan = (session?.user as { role?: string } | undefined)?.role ?? "free";

    const usageStatus = await checkUsage(userId, "ai_call", plan);
    if (!usageStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `今日 AI 调用额度已用完 (${usageStatus.used}/${usageStatus.limit})`,
          code: "AI_QUOTA_EXCEEDED",
          resetAt: usageStatus.resetAt,
        },
        { status: 429 },
      );
    }

    // Increment usage (fire-and-forget)
    void incrementUsage(userId, "ai_call");

    // Route to appropriate handler
    switch (action) {
      case "suggest_params":
        return handleSuggestParams(strategyCode, backtestResult, currentParameters);

      case "explain_strategy":
        return handleExplainStrategy(strategyCode);

      case "sensitivity_analysis":
        return handleSensitivityAnalysis(strategyCode, currentParameters);

      case "analyze_boundaries":
        return handleAnalyzeBoundaries(strategyCode, parameterName, currentValue);

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Strategy Optimize API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// SUGGEST PARAMETERS / 参数建议
// =============================================================================

async function handleSuggestParams(
  strategyCode: string,
  backtestResult?: OptimizeRequest["backtestResult"],
  currentParameters?: Record<string, number>
): Promise<NextResponse> {
  // Extract parameters from code
  const extractedParams = extractParametersFromCode(strategyCode);

  // Generate suggestions based on backtest results and common optimization patterns
  const suggestions: ParameterSuggestion[] = [];

  // Analyze backtest result and provide suggestions
  if (backtestResult) {
    // Low win rate - suggest adjusting entry thresholds
    if (backtestResult.winRate < 0.4) {
      if (extractedParams.rsi_buy !== undefined) {
        suggestions.push({
          name: "rsi_buy",
          currentValue: extractedParams.rsi_buy,
          suggestedValue: Math.max(20, extractedParams.rsi_buy - 5),
          reason: "胜率偏低，建议降低RSI买入阈值以获得更好的入场点",
          expectedImprovement: "预计提升胜率 5-10%",
          confidence: "medium",
        });
      }
      if (extractedParams.fast_window !== undefined && extractedParams.slow_window !== undefined) {
        suggestions.push({
          name: "slow_window",
          currentValue: extractedParams.slow_window,
          suggestedValue: Math.min(60, extractedParams.slow_window + 10),
          reason: "胜率偏低，建议增加慢线周期以过滤更多虚假信号",
          expectedImprovement: "预计减少虚假信号 15-20%",
          confidence: "medium",
        });
      }
    }

    // High max drawdown - suggest tighter risk controls
    if (backtestResult.maxDrawdown > 0.2) {
      if (extractedParams.stop_loss !== undefined) {
        suggestions.push({
          name: "stop_loss",
          currentValue: extractedParams.stop_loss,
          suggestedValue: Math.max(2, extractedParams.stop_loss * 0.7),
          reason: "最大回撤过高，建议收紧止损比例",
          expectedImprovement: "预计降低最大回撤 10-15%",
          confidence: "high",
        });
      }
      if (extractedParams.atr_multiplier !== undefined) {
        suggestions.push({
          name: "atr_multiplier",
          currentValue: extractedParams.atr_multiplier,
          suggestedValue: Math.max(1.5, extractedParams.atr_multiplier - 0.5),
          reason: "回撤较大，建议降低ATR倍数以更快止损",
          expectedImprovement: "预计降低单笔最大亏损",
          confidence: "medium",
        });
      }
    }

    // Low Sharpe ratio - suggest optimizing risk-adjusted returns
    if (backtestResult.sharpeRatio < 1.0) {
      if (extractedParams.fixed_size !== undefined) {
        suggestions.push({
          name: "fixed_size",
          currentValue: extractedParams.fixed_size,
          suggestedValue: Math.max(1, Math.floor(extractedParams.fixed_size * 0.8)),
          reason: "夏普比率偏低，建议减小仓位以降低波动",
          expectedImprovement: "预计提升风险调整后收益",
          confidence: "low",
        });
      }
    }

    // Too few trades - suggest loosening entry conditions
    if (backtestResult.totalTrades < 20) {
      if (extractedParams.rsi_buy !== undefined) {
        suggestions.push({
          name: "rsi_buy",
          currentValue: extractedParams.rsi_buy,
          suggestedValue: Math.min(40, extractedParams.rsi_buy + 5),
          reason: "交易次数过少，建议适当放宽买入条件",
          expectedImprovement: "预计增加交易机会 20-30%",
          confidence: "medium",
        });
      }
    }
  }

  // Add general optimization suggestions if few suggestions generated
  if (suggestions.length < 2) {
    // MA crossover optimization
    if (extractedParams.fast_window !== undefined && extractedParams.slow_window !== undefined) {
      const ratio = extractedParams.slow_window / extractedParams.fast_window;
      if (ratio < 3) {
        suggestions.push({
          name: "slow_window",
          currentValue: extractedParams.slow_window,
          suggestedValue: extractedParams.fast_window * 4,
          reason: "快慢线比例较小，建议增大比例以减少频繁交易",
          expectedImprovement: "预计减少交易频率，提高信号质量",
          confidence: "medium",
        });
      }
    }

    // RSI optimization
    if (extractedParams.rsi_window !== undefined && extractedParams.rsi_window < 10) {
      suggestions.push({
        name: "rsi_window",
        currentValue: extractedParams.rsi_window,
        suggestedValue: 14,
        reason: "RSI周期较短，建议使用经典14周期以获得更稳定信号",
        expectedImprovement: "预计减少噪音信号",
        confidence: "high",
      });
    }
  }

  return NextResponse.json({
    success: true,
    action: "suggest_params",
    suggestions,
    disclaimer: "以上建议仅供参考，实际效果需通过回测验证。参数优化应避免过度拟合历史数据。",
    disclaimerEn: "Suggestions are for reference only. Actual performance should be validated through backtesting. Avoid overfitting to historical data.",
  });
}

// =============================================================================
// EXPLAIN STRATEGY / 策略解释
// =============================================================================

async function handleExplainStrategy(strategyCode: string): Promise<NextResponse> {
  // Parse strategy code to extract information
  const explanation = analyzeStrategyCode(strategyCode);

  return NextResponse.json({
    success: true,
    action: "explain_strategy",
    explanation,
    disclaimer: "策略解读基于代码分析，仅供参考。",
  });
}

function analyzeStrategyCode(code: string): StrategyExplanation {
  const lowerCode = code.toLowerCase();
  const indicators: StrategyExplanation["indicators"] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suitableMarkets: string[] = [];

  // Detect indicators
  if (lowerCode.includes("sma") || lowerCode.includes("ma_window") || lowerCode.includes("均线")) {
    indicators.push({
      name: "移动平均线 (MA)",
      purpose: "识别趋势方向，生成金叉/死叉信号",
      currentConfig: extractMAConfig(code),
    });
    strengths.push("适合趋势明确的市场");
    suitableMarkets.push("趋势市");
  }

  if (lowerCode.includes("rsi")) {
    indicators.push({
      name: "相对强弱指数 (RSI)",
      purpose: "识别超买超卖区域，捕捉反转机会",
      currentConfig: extractRSIConfig(code),
    });
    strengths.push("能识别超买超卖");
    weaknesses.push("在强趋势中可能过早反转");
    suitableMarkets.push("震荡市");
  }

  if (lowerCode.includes("macd")) {
    indicators.push({
      name: "MACD",
      purpose: "趋势跟踪与动量确认",
      currentConfig: extractMACDConfig(code),
    });
    strengths.push("结合趋势和动量");
    suitableMarkets.push("中长期趋势市");
  }

  if (lowerCode.includes("boll") || lowerCode.includes("布林")) {
    indicators.push({
      name: "布林带 (Bollinger Bands)",
      purpose: "识别价格波动范围和突破",
      currentConfig: "标准2倍标准差",
    });
    strengths.push("自适应波动率");
    suitableMarkets.push("波动市");
  }

  // Analyze entry/exit logic
  let entryLogic = "当买入条件满足时开仓";
  let exitLogic = "当卖出条件满足时平仓";

  if (lowerCode.includes("golden cross") || lowerCode.includes("金叉") || code.includes("fast_ma > slow_ma")) {
    entryLogic = "均线金叉时买入（快线上穿慢线）";
  }
  if (lowerCode.includes("death cross") || lowerCode.includes("死叉") || code.includes("fast_ma < slow_ma")) {
    exitLogic = "均线死叉时卖出（快线下穿慢线）";
  }
  if (lowerCode.includes("rsi") && lowerCode.includes("<")) {
    entryLogic += " / RSI低于阈值时买入（超卖）";
  }
  if (lowerCode.includes("rsi") && lowerCode.includes(">")) {
    exitLogic += " / RSI高于阈值时卖出（超买）";
  }

  // Analyze risk management
  let riskManagement = "未检测到明确的风险管理规则";
  if (lowerCode.includes("stop_loss") || lowerCode.includes("止损")) {
    riskManagement = "包含止损机制";
  }
  if (lowerCode.includes("take_profit") || lowerCode.includes("止盈")) {
    riskManagement += "，包含止盈机制";
  }
  if (lowerCode.includes("trailing") || lowerCode.includes("移动止损")) {
    riskManagement += "，包含移动止损";
  }

  // Generate summary
  const indicatorNames = indicators.map((i) => i.name).join("、") || "未检测到明确指标";
  const summary = `这是一个基于${indicatorNames}的量化交易策略。${
    indicators.length > 1 ? "策略综合多个技术指标进行决策。" : ""
  }`;

  // Add common weaknesses
  if (indicators.length === 1) {
    weaknesses.push("单一指标策略在某些市况下可能失效");
  }
  if (!lowerCode.includes("stop_loss") && !lowerCode.includes("止损")) {
    weaknesses.push("缺少止损机制，风险控制不足");
  }

  return {
    summary,
    indicators,
    entryLogic,
    exitLogic,
    riskManagement,
    strengths: strengths.length > 0 ? strengths : ["简单易懂，执行明确"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["需要根据市场情况调整参数"],
    suitableMarkets: suitableMarkets.length > 0 ? suitableMarkets : ["需要根据回测确定适用市场"],
  };
}

// =============================================================================
// SENSITIVITY ANALYSIS / 敏感性分析
// =============================================================================

async function handleSensitivityAnalysis(
  strategyCode: string,
  currentParameters?: Record<string, number>
): Promise<NextResponse> {
  const params = currentParameters || extractParametersFromCode(strategyCode);
  const analyses: SensitivityAnalysis[] = [];

  // Analyze each key parameter
  if (params.fast_window !== undefined) {
    analyses.push({
      parameter: "fast_window",
      currentValue: params.fast_window,
      impactLevel: "high",
      optimalRange: { min: 3, max: 15 },
      recommendations: [
        "快线周期对信号频率影响较大",
        "建议测试范围: 3-15日",
        "过短会产生过多噪音信号，过长会错过机会",
      ],
    });
  }

  if (params.slow_window !== undefined) {
    analyses.push({
      parameter: "slow_window",
      currentValue: params.slow_window,
      impactLevel: "high",
      optimalRange: { min: 10, max: 60 },
      recommendations: [
        "慢线周期决定趋势判断的敏感度",
        "建议测试范围: 10-60日",
        "应保持与快线3-5倍的比例关系",
      ],
    });
  }

  if (params.rsi_window !== undefined) {
    analyses.push({
      parameter: "rsi_window",
      currentValue: params.rsi_window,
      impactLevel: "medium",
      optimalRange: { min: 7, max: 21 },
      recommendations: [
        "RSI周期影响指标灵敏度",
        "经典设置为14日",
        "短周期更敏感但噪音更多",
      ],
    });
  }

  if (params.rsi_buy !== undefined) {
    analyses.push({
      parameter: "rsi_buy",
      currentValue: params.rsi_buy,
      impactLevel: "high",
      optimalRange: { min: 20, max: 40 },
      recommendations: [
        "买入阈值直接影响入场时机",
        "过低可能错过机会，过高可能追高",
        "建议根据市场波动性动态调整",
      ],
    });
  }

  if (params.stop_loss !== undefined) {
    analyses.push({
      parameter: "stop_loss",
      currentValue: params.stop_loss,
      impactLevel: "high",
      optimalRange: { min: 2, max: 8 },
      recommendations: [
        "止损比例对最大回撤影响最大",
        "过紧容易被震出，过松风险敞口大",
        "建议结合ATR动态设置",
      ],
    });
  }

  return NextResponse.json({
    success: true,
    action: "sensitivity_analysis",
    analyses,
    summary: {
      highImpactParams: analyses.filter((a) => a.impactLevel === "high").map((a) => a.parameter),
      recommendation: "建议优先对高敏感参数进行网格搜索优化，注意避免过度拟合。",
    },
  });
}

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Extract parameters from strategy code
 */
function extractParametersFromCode(code: string): Record<string, number> {
  const params: Record<string, number> = {};
  const lines = code.split("\n");

  const paramPatterns = [
    /^\s*(\w+)\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:#.*)?$/,
    /^\s*(\w+)\s*:\s*\w+\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:#.*)?$/,
  ];

  for (const line of lines) {
    for (const pattern of paramPatterns) {
      const match = line.match(pattern);
      if (match && match[1] && match[2]) {
        const name = match[1];
        const value = parseFloat(match[2]);
        if (!isNaN(value) && isKnownParameter(name)) {
          params[name] = value;
        }
      }
    }
  }

  return params;
}

/**
 * Check if parameter name is a known strategy parameter
 */
function isKnownParameter(name: string): boolean {
  const knownParams = [
    "fast_window", "slow_window", "ma_window",
    "rsi_window", "rsi_buy", "rsi_sell",
    "macd_fast", "macd_slow", "macd_signal",
    "boll_window", "boll_dev",
    "atr_window", "atr_multiplier",
    "stop_loss", "take_profit", "trailing_stop",
    "fixed_size", "trade_size", "position_pct",
    "max_position",
  ];
  return knownParams.includes(name);
}

/**
 * Extract MA configuration from code
 */
function extractMAConfig(code: string): string {
  const fastMatch = code.match(/fast_window\s*=\s*(\d+)/);
  const slowMatch = code.match(/slow_window\s*=\s*(\d+)/);
  const fast = fastMatch?.[1] ?? "5";
  const slow = slowMatch?.[1] ?? "20";
  return `快线${fast}日/慢线${slow}日`;
}

/**
 * Extract RSI configuration from code
 */
function extractRSIConfig(code: string): string {
  const windowMatch = code.match(/rsi_window\s*=\s*(\d+)/);
  const buyMatch = code.match(/rsi_buy\s*=\s*(\d+)/);
  const sellMatch = code.match(/rsi_sell\s*=\s*(\d+)/);
  const window = windowMatch?.[1] ?? "14";
  const buy = buyMatch?.[1] ?? "30";
  const sell = sellMatch?.[1] ?? "70";
  return `周期${window}日，买入<${buy}，卖出>${sell}`;
}

/**
 * Extract MACD configuration from code
 */
function extractMACDConfig(code: string): string {
  const fastMatch = code.match(/macd_fast\s*=\s*(\d+)/);
  const slowMatch = code.match(/macd_slow\s*=\s*(\d+)/);
  const signalMatch = code.match(/macd_signal\s*=\s*(\d+)/);
  const fast = fastMatch?.[1] ?? "12";
  const slow = slowMatch?.[1] ?? "26";
  const signal = signalMatch?.[1] ?? "9";
  return `快线${fast}/慢线${slow}/信号${signal}`;
}

// =============================================================================
// BOUNDARY ANALYSIS / 边界分析
// =============================================================================

/**
 * Parameter boundary definitions
 * 参数边界定义
 */
const PARAMETER_BOUNDARIES: Record<string, {
  theoreticalMin: number;
  theoreticalMax: number;
  practicalMin: number;
  practicalMax: number;
  optimalRange: { min: number; max: number };
  role: string;
  roleEn: string;
  affectedIndicators: string[];
  impactDescription: string;
  impactDescriptionEn: string;
  guidance: {
    beginner: string;
    intermediate: string;
    advanced: string;
    riskWarning?: string;
  };
}> = {
  fast_window: {
    theoreticalMin: 1,
    theoreticalMax: 250,
    practicalMin: 2,
    practicalMax: 30,
    optimalRange: { min: 3, max: 15 },
    role: "控制短期均线的计算周期，决定对价格变化的敏感度",
    roleEn: "Controls the calculation period for short-term MA, determines sensitivity to price changes",
    affectedIndicators: ["SMA", "EMA", "MA Crossover"],
    impactDescription: "周期越短，信号越敏感但噪音越多；周期越长，信号越稳定但滞后性越强",
    impactDescriptionEn: "Shorter period = more sensitive but noisier; longer period = more stable but more lag",
    guidance: {
      beginner: "建议使用5-10日，这是最常见的短期周期设置，适合捕捉短期趋势",
      intermediate: "可尝试3-7日用于日内交易，10-15日用于波段交易，根据交易风格调整",
      advanced: "结合ATR动态调整周期，在高波动时延长周期，低波动时缩短周期",
      riskWarning: "周期小于3可能产生大量虚假信号，导致频繁交易和高成本",
    },
  },
  slow_window: {
    theoreticalMin: 2,
    theoreticalMax: 500,
    practicalMin: 10,
    practicalMax: 120,
    optimalRange: { min: 15, max: 60 },
    role: "控制长期均线的计算周期，用于确认主趋势方向",
    roleEn: "Controls the calculation period for long-term MA, used to confirm main trend direction",
    affectedIndicators: ["SMA", "EMA", "MA Crossover"],
    impactDescription: "与快线形成交叉信号，周期差距影响信号频率和可靠性",
    impactDescriptionEn: "Forms crossover signals with fast line, period difference affects signal frequency and reliability",
    guidance: {
      beginner: "建议使用20-30日，与快线保持3-5倍的比例关系",
      intermediate: "可使用50日或60日作为中期趋势参考，200日作为长期趋势判断",
      advanced: "考虑使用EMA替代SMA以减少滞后，或使用自适应均线",
      riskWarning: "快慢线比例小于2倍可能导致过于频繁的交叉信号",
    },
  },
  rsi_window: {
    theoreticalMin: 2,
    theoreticalMax: 100,
    practicalMin: 5,
    practicalMax: 30,
    optimalRange: { min: 10, max: 21 },
    role: "RSI指标的计算周期，影响超买超卖信号的敏感度",
    roleEn: "Calculation period for RSI indicator, affects sensitivity of overbought/oversold signals",
    affectedIndicators: ["RSI"],
    impactDescription: "经典设置为14日，短周期更敏感，长周期更稳定",
    impactDescriptionEn: "Classic setting is 14 days, shorter period = more sensitive, longer period = more stable",
    guidance: {
      beginner: "使用经典的14日周期，这是Wilder提出的原始设置",
      intermediate: "日内交易可用7-9日，波段交易可用14-21日",
      advanced: "可结合ATR调整周期，或使用多周期RSI进行确认",
      riskWarning: "周期过短（<7）在震荡市中会产生大量虚假信号",
    },
  },
  rsi_buy: {
    theoreticalMin: 0,
    theoreticalMax: 100,
    practicalMin: 15,
    practicalMax: 45,
    optimalRange: { min: 25, max: 35 },
    role: "RSI买入阈值，低于此值视为超卖，产生买入信号",
    roleEn: "RSI buy threshold, values below this are considered oversold and generate buy signals",
    affectedIndicators: ["RSI", "Entry Signal"],
    impactDescription: "阈值越低，信号越保守但机会越少；阈值越高，信号越激进但风险越大",
    impactDescriptionEn: "Lower threshold = more conservative but fewer opportunities; higher threshold = more aggressive but higher risk",
    guidance: {
      beginner: "使用经典的30作为买入阈值，简单有效",
      intermediate: "在牛市中可适当提高至35-40，熊市中降低至20-25",
      advanced: "结合价格位置和成交量确认，避免在下跌趋势中抄底",
      riskWarning: "阈值过高容易在下跌趋势中过早买入，造成被套",
    },
  },
  rsi_sell: {
    theoreticalMin: 0,
    theoreticalMax: 100,
    practicalMin: 55,
    practicalMax: 85,
    optimalRange: { min: 65, max: 75 },
    role: "RSI卖出阈值，高于此值视为超买，产生卖出信号",
    roleEn: "RSI sell threshold, values above this are considered overbought and generate sell signals",
    affectedIndicators: ["RSI", "Exit Signal"],
    impactDescription: "阈值越低，退出越保守可能错过大涨；阈值越高，可能在顶部附近才退出",
    impactDescriptionEn: "Lower threshold = more conservative exit may miss rallies; higher threshold = exit near tops",
    guidance: {
      beginner: "使用经典的70作为卖出阈值",
      intermediate: "强势行情中可提高至75-80，避免过早止盈",
      advanced: "结合趋势强度指标，强趋势中适当延迟卖出",
      riskWarning: "阈值过低可能在强势行情中过早卖出，错失利润",
    },
  },
  stop_loss: {
    theoreticalMin: 0.1,
    theoreticalMax: 50,
    practicalMin: 1,
    practicalMax: 15,
    optimalRange: { min: 3, max: 8 },
    role: "止损比例(%)，控制单笔交易的最大亏损",
    roleEn: "Stop loss percentage, controls maximum loss per trade",
    affectedIndicators: ["Risk Management", "Position Size"],
    impactDescription: "止损越紧，风险越小但容易被震出；止损越宽，允许更大波动但风险敞口大",
    impactDescriptionEn: "Tighter stop = less risk but easier to get stopped out; wider stop = allows more volatility but higher risk exposure",
    guidance: {
      beginner: "建议5-8%的止损，平衡风险和被震出的概率",
      intermediate: "根据ATR动态设置止损，一般为1.5-2倍ATR",
      advanced: "考虑使用移动止损、时间止损等多维度风控",
      riskWarning: "止损过紧(<2%)在正常波动中容易被触发，止损过宽(>10%)可能造成较大亏损",
    },
  },
  fixed_size: {
    theoreticalMin: 1,
    theoreticalMax: 10000,
    practicalMin: 1,
    practicalMax: 100,
    optimalRange: { min: 1, max: 10 },
    role: "固定交易手数，决定每次交易的仓位大小",
    roleEn: "Fixed position size (lots), determines position size per trade",
    affectedIndicators: ["Position Size", "Risk Exposure"],
    impactDescription: "仓位越大，盈亏波动越大；仓位越小，资金利用率越低",
    impactDescriptionEn: "Larger position = higher P&L volatility; smaller position = lower capital utilization",
    guidance: {
      beginner: "建议从1手开始，熟悉策略后再增加",
      intermediate: "根据账户资金和风险偏好设置，一般单笔风险不超过总资金2%",
      advanced: "使用Kelly公式或固定百分比仓位管理",
      riskWarning: "仓位过大可能导致账户大幅波动，影响交易心态",
    },
  },
  macd_fast: {
    theoreticalMin: 2,
    theoreticalMax: 50,
    practicalMin: 5,
    practicalMax: 20,
    optimalRange: { min: 8, max: 15 },
    role: "MACD快线EMA周期，影响MACD对短期动量的敏感度",
    roleEn: "MACD fast EMA period, affects MACD sensitivity to short-term momentum",
    affectedIndicators: ["MACD", "MACD Histogram"],
    impactDescription: "经典设置为12，与慢线26和信号线9配合使用",
    impactDescriptionEn: "Classic setting is 12, used with slow line 26 and signal line 9",
    guidance: {
      beginner: "使用经典的12-26-9设置",
      intermediate: "日内交易可用5-13-6，波段交易可用12-26-9",
      advanced: "可尝试8-17-9等变体，根据品种特性调整",
    },
  },
  macd_slow: {
    theoreticalMin: 5,
    theoreticalMax: 100,
    practicalMin: 15,
    practicalMax: 50,
    optimalRange: { min: 20, max: 35 },
    role: "MACD慢线EMA周期，提供趋势的基准参考",
    roleEn: "MACD slow EMA period, provides trend baseline reference",
    affectedIndicators: ["MACD", "MACD Histogram"],
    impactDescription: "与快线配合形成MACD值，周期越长趋势判断越稳定",
    impactDescriptionEn: "Works with fast line to form MACD value, longer period = more stable trend determination",
    guidance: {
      beginner: "使用经典的26日周期",
      intermediate: "保持与快线约2倍的比例关系",
      advanced: "根据市场周期特性微调",
    },
  },
  macd_signal: {
    theoreticalMin: 2,
    theoreticalMax: 30,
    practicalMin: 5,
    practicalMax: 15,
    optimalRange: { min: 7, max: 12 },
    role: "MACD信号线EMA周期，用于产生交叉信号",
    roleEn: "MACD signal EMA period, used to generate crossover signals",
    affectedIndicators: ["MACD", "MACD Signal Crossover"],
    impactDescription: "周期越短信号越快但噪音越多",
    impactDescriptionEn: "Shorter period = faster signals but more noise",
    guidance: {
      beginner: "使用经典的9日周期",
      intermediate: "可根据交易频率需求在6-12之间调整",
      advanced: "结合柱状图高度和背离信号使用",
    },
  },
};

/**
 * Handle boundary analysis request
 * 处理边界分析请求
 */
async function handleAnalyzeBoundaries(
  strategyCode: string,
  parameterName?: string,
  currentValue?: number
): Promise<NextResponse> {
  if (!parameterName) {
    return NextResponse.json(
      { success: false, error: "Parameter name is required" },
      { status: 400 }
    );
  }

  // Get boundary definition for the parameter
  const boundaryDef = PARAMETER_BOUNDARIES[parameterName];

  if (!boundaryDef) {
    // Return generic boundaries for unknown parameters
    return NextResponse.json({
      success: true,
      action: "analyze_boundaries",
      data: {
        parameterName,
        displayName: parameterName,
        boundaries: {
          theoreticalMin: 0,
          theoreticalMax: 1000,
          practicalMin: 1,
          practicalMax: 100,
          optimalRange: { min: 5, max: 50 },
        },
        functionAnalysis: {
          role: "此参数的具体作用需要根据策略上下文分析",
          affectedIndicators: [],
          impactDescription: "参数值的变化会影响策略的行为表现",
        },
        guidance: {
          beginner: "建议从默认值开始，小幅度调整观察效果",
          intermediate: "通过回测验证不同参数值的表现",
          advanced: "可进行参数优化和敏感性分析",
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    action: "analyze_boundaries",
    data: {
      parameterName,
      displayName: getParameterDisplayName(parameterName),
      boundaries: {
        theoreticalMin: boundaryDef.theoreticalMin,
        theoreticalMax: boundaryDef.theoreticalMax,
        practicalMin: boundaryDef.practicalMin,
        practicalMax: boundaryDef.practicalMax,
        optimalRange: boundaryDef.optimalRange,
      },
      functionAnalysis: {
        role: boundaryDef.role,
        affectedIndicators: boundaryDef.affectedIndicators,
        impactDescription: boundaryDef.impactDescription,
      },
      guidance: boundaryDef.guidance,
    },
  });
}

/**
 * Get display name for parameter
 * 获取参数的显示名称
 */
function getParameterDisplayName(name: string): string {
  const displayNames: Record<string, string> = {
    fast_window: "快线周期",
    slow_window: "慢线周期",
    rsi_window: "RSI周期",
    rsi_buy: "RSI买入阈值",
    rsi_sell: "RSI卖出阈值",
    stop_loss: "止损比例 (%)",
    take_profit: "止盈比例 (%)",
    fixed_size: "固定手数",
    macd_fast: "MACD快线周期",
    macd_slow: "MACD慢线周期",
    macd_signal: "MACD信号线周期",
    atr_window: "ATR周期",
    atr_multiplier: "ATR倍数",
    boll_window: "布林带周期",
    boll_dev: "布林带标准差",
  };
  return displayNames[name] || name;
}

export const dynamic = "force-dynamic";
