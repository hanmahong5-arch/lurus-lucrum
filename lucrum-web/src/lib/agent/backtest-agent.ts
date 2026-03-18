/**
 * Backtest Agent — LangGraph StateGraph
 *
 * Implements a 5-node workflow for natural-language-driven backtesting:
 *   parseIntent → validateParams → runBacktest → analyzeResult → generateReport
 *
 * Uses DeepSeek (OpenAI-compatible) as the LLM backend, consistent with the
 * existing advisor-graph.ts configuration.
 */

import { Annotation, StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";

// =============================================================================
// Types
// =============================================================================

export interface BacktestAgentResult {
  equityCurve: Array<{ date: string; equity: number; drawdown: number }>;
  returnMetrics: {
    totalReturn: number;
    annualizedReturn: number;
  };
  riskMetrics: {
    maxDrawdown: number;
    sharpeRatio: number;
  };
  tradingMetrics: {
    totalTrades: number;
    winRate: number;
  };
  trades?: Array<{
    date: string;
    type: string;
    symbol: string;
    pnl?: number;
    pnlPercent?: number;
  }>;
}

// =============================================================================
// State Annotation
// =============================================================================

const BacktestAgentStateAnnotation = Annotation.Root({
  // Conversation history
  messages: Annotation<BaseMessage[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  // Parsed intent fields
  symbol: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
  symbolName: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
  strategy: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
  dateRange: Annotation<{ start: string; end: string } | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
  capital: Annotation<number | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),

  // Follow-up question when params are missing
  followUpQuestion: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),

  // Backtest result from engine
  backtestResult: Annotation<BacktestAgentResult | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),

  // AI-generated report
  report: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),

  // Workflow step for SSE streaming
  step: Annotation<
    "init" | "parsing" | "validating" | "running" | "analyzing" | "done" | "error"
  >({
    reducer: (_a, b) => b,
    default: () => "init",
  }),

  // Error message if any
  errorMessage: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
});

export type BacktestAgentState = typeof BacktestAgentStateAnnotation.State;

// =============================================================================
// LLM Configuration (reuses DeepSeek, consistent with advisor-graph.ts)
// =============================================================================

function createLLM(temperature: number = 0.3): ChatOpenAI {
  return new ChatOpenAI({
    modelName: "deepseek-chat",
    temperature,
    maxTokens: 2000,
    configuration: {
      baseURL: process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    },
  });
}

// =============================================================================
// Node: parseIntent
// Extract symbol, strategy, dateRange, capital from user message
// =============================================================================

async function parseIntentNode(
  state: BacktestAgentState,
): Promise<Partial<BacktestAgentState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const userText = lastMessage instanceof HumanMessage ? lastMessage.content as string : "";

  const llm = createLLM(0.1);
  const systemPrompt = `你是一个回测参数解析助手。从用户的自然语言中提取回测参数，返回严格的 JSON 格式。

字段说明：
- symbol: 股票代码（A股格式，如 000001.SZ、600519.SH）。如果用户说股票名称，推断代码。
- symbolName: 股票中文名称
- strategy: 策略ID，从以下选项中选择: ma_cross（均线交叉/双均线）、rsi（RSI策略）、macd（MACD策略）、boll（布林线策略）
- dateRange: { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
- capital: 初始资金（人民币元，整数）

常见股票代码参考：
- 平安银行 → 000001.SZ
- 万科A → 000002.SZ
- 贵州茅台 → 600519.SH
- 招商银行 → 600036.SH

如果某字段无法确定，设为 null。
只返回 JSON，不要任何解释。

示例输出：
{"symbol":"000001.SZ","symbolName":"平安银行","strategy":"ma_cross","dateRange":{"start":"2023-01-01","end":"2023-12-31"},"capital":100000}`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userText),
  ]);

  let parsed: {
    symbol?: string;
    symbolName?: string;
    strategy?: string;
    dateRange?: { start: string; end: string };
    capital?: number;
  } = {};

  try {
    const content = response.content as string;
    // Extract JSON from the response (may have surrounding text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("[BacktestAgent] parseIntent: failed to parse LLM JSON", e);
  }

  return {
    step: "validating",
    symbol: parsed.symbol ?? state.symbol,
    symbolName: parsed.symbolName ?? state.symbolName,
    strategy: parsed.strategy ?? state.strategy,
    dateRange: parsed.dateRange ?? state.dateRange,
    capital: parsed.capital ?? state.capital,
  };
}

// =============================================================================
// Node: validateParams
// Check for missing required parameters; ask follow-up if needed
// =============================================================================

async function validateParamsNode(
  state: BacktestAgentState,
): Promise<Partial<BacktestAgentState>> {
  const missing: string[] = [];

  if (!state.symbol) missing.push("股票代码");
  if (!state.dateRange) missing.push("回测时间范围");
  if (!state.strategy) missing.push("策略类型（均线/RSI/MACD/布林线）");
  if (!state.capital) missing.push("初始资金");

  if (missing.length > 0) {
    const question = `请提供以下信息才能开始回测：${missing.join("、")}。`;
    return {
      step: "done",
      followUpQuestion: question,
    };
  }

  // Apply defaults where needed
  const capital = state.capital ?? 100000;
  const strategy = state.strategy ?? "ma_cross";

  return {
    step: "running",
    capital,
    strategy,
    followUpQuestion: undefined,
  };
}

// =============================================================================
// Node: runBacktest
// Call the unified backtest API internally
// =============================================================================

async function runBacktestNode(
  state: BacktestAgentState,
): Promise<Partial<BacktestAgentState>> {
  if (!state.symbol || !state.dateRange || !state.strategy || !state.capital) {
    return {
      step: "error",
      errorMessage: "回测参数不完整，请重新输入",
    };
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/backtest/unified`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: {
          mode: "stock",
          stock: {
            symbol: state.symbol,
            name: state.symbolName ?? state.symbol,
            market: state.symbol.endsWith(".SH") ? "SH" : "SZ",
          },
        },
        strategy: {
          type: "builtin",
          builtinId: state.strategy,
        },
        config: {
          startDate: state.dateRange.start,
          endDate: state.dateRange.end,
          initialCapital: state.capital,
          commission: 0.0003,
          slippage: 0.001,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`;
      return {
        step: "error",
        errorMessage: `回测失败: ${msg}`,
      };
    }

    const body = await response.json() as {
      success: boolean;
      data: {
        equityCurve: Array<{ date: string; equity: number; drawdown: number }>;
        returnMetrics: { totalReturn: number; annualizedReturn: number };
        riskMetrics: { maxDrawdown: number; sharpeRatio: number };
        tradingMetrics: { totalTrades: number; winRate: number };
        trades?: Array<{ date: string; type: string; symbol: string; pnl?: number; pnlPercent?: number }>;
      };
    };

    if (!body.success || !body.data) {
      return {
        step: "error",
        errorMessage: "回测返回数据异常",
      };
    }

    const result: BacktestAgentResult = {
      equityCurve: body.data.equityCurve,
      returnMetrics: body.data.returnMetrics,
      riskMetrics: body.data.riskMetrics,
      tradingMetrics: body.data.tradingMetrics,
      trades: body.data.trades,
    };

    return {
      step: "analyzing",
      backtestResult: result,
    };
  } catch (error) {
    return {
      step: "error",
      errorMessage: `内部错误: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

// =============================================================================
// Node: analyzeResult
// Use LLM to generate insights on the backtest result
// =============================================================================

async function analyzeResultNode(
  state: BacktestAgentState,
): Promise<Partial<BacktestAgentState>> {
  const result = state.backtestResult;
  if (!result) {
    return { step: "error", errorMessage: "无回测结果可供分析" };
  }

  const llm = createLLM(0.7);
  const systemPrompt = `你是一位专业的量化交易分析师。请根据回测数据生成简洁、专业的分析报告。
报告包含：
1. 策略总体表现（1-2句）
2. 关键风险点（最大回撤、波动率）
3. 交易质量分析（胜率、盈亏比）
4. 结论与建议（1-3条）

使用中文，语言简洁专业，避免空话。不要重复数字，直接给出解读。`;

  const dataPrompt = `回测标的: ${state.symbolName ?? state.symbol}
策略: ${state.strategy}
时间范围: ${state.dateRange?.start} 至 ${state.dateRange?.end}
初始资金: ¥${(state.capital ?? 0).toLocaleString()}

关键指标:
- 总收益率: ${result.returnMetrics.totalReturn.toFixed(2)}%
- 年化收益率: ${result.returnMetrics.annualizedReturn.toFixed(2)}%
- 最大回撤: ${result.riskMetrics.maxDrawdown.toFixed(2)}%
- 夏普比率: ${result.riskMetrics.sharpeRatio.toFixed(4)}
- 交易次数: ${result.tradingMetrics.totalTrades}
- 胜率: ${(result.tradingMetrics.winRate * 100).toFixed(1)}%

请生成分析报告：`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(dataPrompt),
  ]);

  return {
    step: "done",
    report: response.content as string,
    messages: [new AIMessage(response.content as string)],
  };
}

// =============================================================================
// Graph Assembly
// =============================================================================

/**
 * Routing function: determine next node after validateParams
 */
function routeAfterValidate(state: BacktestAgentState): string {
  if (state.followUpQuestion) {
    return END; // Need more info from user
  }
  if (state.step === "running") {
    return "runBacktest";
  }
  return END;
}

/**
 * Routing function: determine next node after runBacktest
 */
function routeAfterRun(state: BacktestAgentState): string {
  if (state.step === "error" || !state.backtestResult) {
    return END;
  }
  return "analyzeResult";
}

const workflow = new StateGraph(BacktestAgentStateAnnotation)
  .addNode("parseIntent", parseIntentNode)
  .addNode("validateParams", validateParamsNode)
  .addNode("runBacktest", runBacktestNode)
  .addNode("analyzeResult", analyzeResultNode)
  .addEdge(START, "parseIntent")
  .addEdge("parseIntent", "validateParams")
  .addConditionalEdges("validateParams", routeAfterValidate, {
    runBacktest: "runBacktest",
    [END]: END,
  })
  .addConditionalEdges("runBacktest", routeAfterRun, {
    analyzeResult: "analyzeResult",
    [END]: END,
  })
  .addEdge("analyzeResult", END);

export const backtestAgentGraph = workflow.compile();

// =============================================================================
// Streaming helper — runs graph and yields state snapshots
// =============================================================================

export interface AgentStreamEvent {
  type: "status" | "result" | "report" | "error" | "followUp";
  step?: string;
  message?: string;
  backtestResult?: BacktestAgentResult;
  content?: string;
  code?: string;
}

const STEP_LABELS: Record<string, string> = {
  parsing: "正在解析您的请求...",
  validating: "参数验证中...",
  running: "回测执行中，请稍候...",
  analyzing: "分析回测结果...",
  done: "分析完成",
  error: "出现错误",
};

/**
 * Stream backtest agent events for a user message.
 * Yields AgentStreamEvent objects for SSE consumption.
 */
export async function* streamBacktestAgent(
  userMessage: string,
  previousState?: Partial<BacktestAgentState>,
): AsyncGenerator<AgentStreamEvent> {
  const initialState: Partial<BacktestAgentState> = {
    ...previousState,
    step: "parsing",
    messages: [
      ...(previousState?.messages ?? []),
      new HumanMessage(userMessage),
    ],
  };

  yield { type: "status", step: "parsing", message: STEP_LABELS["parsing"] };

  try {
    for await (const chunk of await backtestAgentGraph.stream(
      initialState,
      { streamMode: "values" },
    )) {
      const state = chunk as BacktestAgentState;

      if (state.step && STEP_LABELS[state.step]) {
        yield {
          type: "status",
          step: state.step,
          message: STEP_LABELS[state.step],
        };
      }

      if (state.followUpQuestion) {
        yield { type: "followUp", content: state.followUpQuestion };
        return;
      }

      if (state.step === "error" && state.errorMessage) {
        yield { type: "error", code: "AGENT_ERROR", message: state.errorMessage };
        return;
      }

      if (state.backtestResult && state.step === "analyzing") {
        yield { type: "result", backtestResult: state.backtestResult };
      }

      if (state.report && state.step === "done") {
        yield { type: "report", content: state.report };
      }
    }
  } catch (error) {
    yield {
      type: "error",
      code: "AGENT_EXCEPTION",
      message: error instanceof Error ? error.message : "Agent execution failed",
    };
  }
}
