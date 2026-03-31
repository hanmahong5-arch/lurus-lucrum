/**
 * Custom Agent — User-defined batch analysis with LangGraph
 * 自定义 Agent — 用户定义的批量分析
 *
 * 5-Node StateGraph:
 *   validateConfig → resolveTargets → parallelBacktest → rankAndAggregate → generateInsights
 *
 * Reuses runWithConcurrency from scanner-agent and backtest API calls.
 * Token consumption only occurs in generateInsights node.
 *
 * @module lib/agent/custom-agent
 */

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getSectorStocks } from "@/lib/data-service/sources/eastmoney-sector";
import { db } from "@/lib/db";
import { stocks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type {
  CustomAgentConfig,
  CustomAgentEvent,
  CustomAgentStep,
  StockResult,
  RunSummary,
  TokenBreakdown,
  AnalysisDepth,
  TOKEN_ESTIMATES,
} from "./custom-agent-types";

// Re-import TOKEN_ESTIMATES as value
const DEPTH_TOKEN_ESTIMATES: Record<AnalysisDepth, number> = {
  light: 0,
  standard: 1500,
  deep: 5000,
};

// =============================================================================
// Constants
// =============================================================================

const AGENT_CONCURRENCY = parseInt(
  process.env.CUSTOM_AGENT_CONCURRENCY ?? "5",
  10
);

const MAX_STOCKS_ALL_MARKET = 100;

// =============================================================================
// LLM
// =============================================================================

function createLLM(temperature = 0.4, maxTokens = 2000): ChatOpenAI {
  return new ChatOpenAI({
    modelName: "deepseek-chat",
    temperature,
    maxTokens,
    configuration: {
      baseURL: process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    },
  });
}

// =============================================================================
// Concurrency control (same pattern as scanner-agent)
// =============================================================================

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      const item = items[idx]!;
      results[idx] = await fn(item, idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    worker
  );
  await Promise.all(workers);
  return results;
}

// =============================================================================
// Internal: single stock backtest via unified API
// =============================================================================

interface BacktestMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
}

async function runStockBacktest(
  symbol: string,
  name: string,
  strategyId: string,
  dateRange: { start: string; end: string },
  capital: number,
  commission: number,
  slippage: number
): Promise<BacktestMetrics> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/backtest/unified`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": process.env.INTERNAL_API_SECRET ?? "",
    },
    body: JSON.stringify({
      target: { mode: "stock", stock: { symbol, name } },
      strategy: { builtinId: strategyId },
      config: {
        startDate: dateRange.start,
        endDate: dateRange.end,
        initialCapital: capital,
        commission,
        slippage,
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    throw new Error(`Backtest API returned ${res.status} for ${symbol}`);
  }

  const json = (await res.json()) as {
    success: boolean;
    data?: {
      returnMetrics?: { totalReturn?: number };
      riskMetrics?: { sharpeRatio?: number; maxDrawdown?: number };
      tradingMetrics?: { winRate?: number; totalTrades?: number };
    };
  };

  if (!json.success || !json.data) {
    throw new Error(`Backtest failed for ${symbol}`);
  }

  const d = json.data;
  return {
    totalReturn: d.returnMetrics?.totalReturn ?? 0,
    sharpeRatio: d.riskMetrics?.sharpeRatio ?? 0,
    maxDrawdown: d.riskMetrics?.maxDrawdown ?? 0,
    winRate: d.tradingMetrics?.winRate ?? 0,
    tradeCount: d.tradingMetrics?.totalTrades ?? 0,
  };
}

// =============================================================================
// Graph Nodes
// =============================================================================

interface ResolvedStock {
  symbol: string;
  name: string;
}

interface GraphState {
  config: CustomAgentConfig;
  resolvedStocks: ResolvedStock[];
  backtestResults: StockResult[];
  ranking: StockResult[];
  insights: string;
  tokenUsed: number;
  step: CustomAgentStep;
  error?: string;
}

type EventQueue = CustomAgentEvent[];

/** Node 1: Validate configuration */
function validateConfigNode(
  state: GraphState,
  eventQueue: EventQueue
): GraphState {
  eventQueue.push({
    type: "status",
    node: "validateConfig",
    message: "正在验证 Agent 配置...",
  });

  const { config } = state;

  if (!config.name || config.name.length > 50) {
    return {
      ...state,
      step: "error",
      error: "Agent 名称无效（需要 1-50 个字符）",
    };
  }

  if (!config.strategies || config.strategies.length === 0) {
    return { ...state, step: "error", error: "至少需要绑定一个策略" };
  }

  if (!config.targets || !config.targets.mode) {
    return { ...state, step: "error", error: "目标配置无效" };
  }

  if (
    config.targets.mode === "custom" &&
    (!config.targets.symbols || config.targets.symbols.length === 0)
  ) {
    return { ...state, step: "error", error: "自选股模式需要至少选择一只股票" };
  }

  if (
    config.targets.mode === "sector" &&
    (!config.targets.sectors || config.targets.sectors.length === 0)
  ) {
    return { ...state, step: "error", error: "板块模式需要至少选择一个板块" };
  }

  return { ...state, step: "resolveTargets" };
}

/** Node 2: Resolve targets to concrete symbol list */
async function resolveTargetsNode(
  state: GraphState,
  eventQueue: EventQueue,
  maxStocks: number
): Promise<GraphState> {
  eventQueue.push({
    type: "status",
    node: "resolveTargets",
    message: "正在解析标的列表...",
  });

  const { config } = state;
  const resolved: ResolvedStock[] = [];

  if (config.targets.mode === "custom" && config.targets.symbols) {
    // Fetch stock names from DB
    for (const symbol of config.targets.symbols) {
      const rows = await db
        .select({ symbol: stocks.symbol, name: stocks.name })
        .from(stocks)
        .where(eq(stocks.symbol, symbol))
        .limit(1);

      if (rows[0]) {
        resolved.push({ symbol: rows[0].symbol, name: rows[0].name });
      }
    }
  } else if (config.targets.mode === "sector" && config.targets.sectors) {
    for (const sectorCode of config.targets.sectors) {
      const response = await getSectorStocks(sectorCode, 30);
      if (response.success && response.data?.stocks) {
        for (const s of response.data.stocks) {
          if (resolved.length >= maxStocks) break;
          if (!resolved.some((r) => r.symbol === s.symbol)) {
            resolved.push({ symbol: s.symbol, name: s.name });
          }
        }
      }
    }
  } else if (config.targets.mode === "all") {
    // Fetch top N by market cap from DB
    const rows = await db
      .select({ symbol: stocks.symbol, name: stocks.name })
      .from(stocks)
      .where(eq(stocks.status, "active"))
      .limit(Math.min(maxStocks, MAX_STOCKS_ALL_MARKET));

    for (const row of rows) {
      resolved.push({ symbol: row.symbol, name: row.name });
    }
  }

  // Enforce tier limit
  const capped = resolved.slice(0, maxStocks);

  if (capped.length === 0) {
    return {
      ...state,
      step: "error",
      error: "未能解析到任何有效标的",
    };
  }

  eventQueue.push({
    type: "status",
    node: "resolveTargets",
    message: `已解析 ${capped.length} 只标的`,
  });

  return { ...state, resolvedStocks: capped, step: "parallelBacktest" };
}

/** Node 3: Parallel backtest all resolved stocks */
async function parallelBacktestNode(
  state: GraphState,
  eventQueue: EventQueue
): Promise<GraphState> {
  eventQueue.push({
    type: "status",
    node: "parallelBacktest",
    message: `开始并行回测 ${state.resolvedStocks.length} 只标的...`,
  });

  const { config, resolvedStocks } = state;
  const dateRange = config.backtestConfig?.dateRange ?? {
    start: "2023-01-01",
    end: "2024-12-31",
  };
  const capital = config.backtestConfig?.initialCapital ?? 100000;
  const commission = config.backtestConfig?.commission ?? 0.0003;
  const slippage = config.backtestConfig?.slippage ?? 0.001;
  const strategyId = config.strategies[0]!.templateId;

  const results: StockResult[] = [];
  let done = 0;
  const total = resolvedStocks.length;

  await runWithConcurrency(
    resolvedStocks,
    AGENT_CONCURRENCY,
    async (stock) => {
      try {
        const metrics = await runStockBacktest(
          stock.symbol,
          stock.name,
          strategyId,
          dateRange,
          capital,
          commission,
          slippage
        );

        const result: StockResult = {
          symbol: stock.symbol,
          name: stock.name,
          totalReturn: metrics.totalReturn,
          sharpeRatio: metrics.sharpeRatio,
          maxDrawdown: metrics.maxDrawdown,
          winRate: metrics.winRate,
          tradeCount: metrics.tradeCount,
          score: 0, // computed in rank node
          rank: 0,
        };

        results.push(result);
        done++;

        eventQueue.push({ type: "stock_result", data: result });
        eventQueue.push({
          type: "progress",
          current: done,
          total,
          symbol: stock.symbol,
        });
      } catch (err) {
        done++;
        console.warn(
          `[CustomAgent] Failed to backtest ${stock.symbol}:`,
          err
        );
        eventQueue.push({
          type: "progress",
          current: done,
          total,
          symbol: `${stock.symbol} (失败)`,
        });
      }
    }
  );

  return { ...state, backtestResults: results, step: "rankAndAggregate" };
}

/** Node 4: Rank and aggregate results */
function rankAndAggregateNode(
  state: GraphState,
  eventQueue: EventQueue
): GraphState {
  eventQueue.push({
    type: "status",
    node: "rankAndAggregate",
    message: "正在排名和聚合结果...",
  });

  const { backtestResults } = state;
  if (backtestResults.length === 0) {
    return { ...state, ranking: [], step: "generateInsights" };
  }

  // Composite score: 60% return + 40% sharpe (normalized)
  const maxReturn = Math.max(
    ...backtestResults.map((r) => Math.abs(r.totalReturn)),
    0.001
  );
  const maxSharpe = Math.max(
    ...backtestResults.map((r) => Math.abs(r.sharpeRatio)),
    0.001
  );

  const ranked = backtestResults
    .map((r) => ({
      ...r,
      score:
        0.6 * (r.totalReturn / maxReturn) +
        0.4 * (r.sharpeRatio / maxSharpe),
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return { ...state, ranking: ranked, step: "generateInsights" };
}

/** Node 5: Generate AI insights (only if depth != light) */
async function generateInsightsNode(
  state: GraphState,
  eventQueue: EventQueue
): Promise<GraphState> {
  const depth = state.config.analysisDepth;

  if (depth === "light" || state.ranking.length === 0) {
    eventQueue.push({
      type: "status",
      node: "generateInsights",
      message:
        depth === "light"
          ? "轻量模式，跳过 AI 分析"
          : "无排名结果，跳过 AI 分析",
    });
    return { ...state, insights: "", step: "done" };
  }

  eventQueue.push({
    type: "status",
    node: "generateInsights",
    message: "正在生成 AI 综合分析...",
  });

  const topN = depth === "deep" ? 10 : 5;
  const maxTokens = depth === "deep" ? 4000 : 1500;
  const top = state.ranking.slice(0, topN);

  const topText = top
    .map(
      (r, i) =>
        `${i + 1}. ${r.name}（${r.symbol}）` +
        ` 总收益=${(r.totalReturn * 100).toFixed(1)}%` +
        ` 夏普=${r.sharpeRatio.toFixed(2)}` +
        ` 最大回撤=${(r.maxDrawdown * 100).toFixed(1)}%` +
        ` 胜率=${(r.winRate * 100).toFixed(1)}%`
    )
    .join("\n");

  const strategyNames = state.config.strategies
    .map((s) => s.templateId)
    .join(", ");

  const depthInstruction =
    depth === "deep"
      ? "请写一份详细的综合分析报告（800-1500字），包含市场环境分析、策略适配性评估、风险预警、仓位建议。"
      : "请写一份简洁的选股洞察报告（300-500字），包含表现分析、配置建议、风险提示。";

  const prompt = `你是一位资深A股量化投资分析师。

以下是使用「${strategyNames}」策略的回测排名结果（Top ${topN}）：

${topText}

共分析 ${state.backtestResults.length} 只标的，其中 ${state.ranking.length} 只成功完成。

${depthInstruction}

输出格式：纯 Markdown。`;

  const llm = createLLM(0.6, maxTokens);

  const response = await llm.invoke([
    new SystemMessage(
      "你是一位专业的A股量化投资分析师，擅长多标的横向对比和策略适配性分析。"
    ),
    new HumanMessage(prompt),
  ]);

  const insights = response.content as string;
  const tokenCost = DEPTH_TOKEN_ESTIMATES[depth];

  eventQueue.push({ type: "insights", text: insights });
  eventQueue.push({
    type: "token_update",
    used: tokenCost,
    estimate: DEPTH_TOKEN_ESTIMATES[depth],
  });

  return {
    ...state,
    insights,
    tokenUsed: state.tokenUsed + tokenCost,
    step: "done",
  };
}

// =============================================================================
// Public API: streamCustomAgent
// =============================================================================

export interface CustomAgentInput {
  config: CustomAgentConfig;
  /** Max stocks allowed by user's plan tier */
  maxStocks: number;
}

/**
 * Run the custom agent and yield SSE events.
 * The caller is responsible for auth, quota, and usage tracking.
 */
export async function* streamCustomAgent(
  input: CustomAgentInput
): AsyncGenerator<CustomAgentEvent> {
  const eventQueue: EventQueue = [];

  let state: GraphState = {
    config: input.config,
    resolvedStocks: [],
    backtestResults: [],
    ranking: [],
    insights: "",
    tokenUsed: 0,
    step: "validateConfig",
  };

  const startTime = performance.now();

  // Node 1: validateConfig
  state = validateConfigNode(state, eventQueue);
  yield* flushQueue(eventQueue);

  if (state.step === "error") {
    yield { type: "error", message: state.error ?? "配置验证失败", code: "CONFIG_ERROR" };
    return;
  }

  // Node 2: resolveTargets
  try {
    state = await resolveTargetsNode(state, eventQueue, input.maxStocks);
    yield* flushQueue(eventQueue);
  } catch (err) {
    yield* flushQueue(eventQueue);
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "解析标的时发生错误",
      code: "RESOLVE_ERROR",
    };
    return;
  }

  if (state.step === "error") {
    yield { type: "error", message: state.error ?? "解析标的失败", code: "RESOLVE_ERROR" };
    return;
  }

  // Emit estimated tokens
  const estimatedTokens = DEPTH_TOKEN_ESTIMATES[state.config.analysisDepth];
  yield {
    type: "token_update",
    used: 0,
    estimate: estimatedTokens,
  };

  // Node 3: parallelBacktest
  try {
    state = await parallelBacktestNode(state, eventQueue);
    yield* flushQueue(eventQueue);
  } catch (err) {
    yield* flushQueue(eventQueue);
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "回测过程中发生错误",
      code: "BACKTEST_ERROR",
    };
    return;
  }

  if (state.backtestResults.length === 0) {
    yield {
      type: "error",
      message: "所有标的回测均失败，请检查策略参数或日期范围",
      code: "NO_RESULTS",
    };
    return;
  }

  // Node 4: rankAndAggregate
  state = rankAndAggregateNode(state, eventQueue);
  yield* flushQueue(eventQueue);

  // Node 5: generateInsights
  try {
    state = await generateInsightsNode(state, eventQueue);
    yield* flushQueue(eventQueue);
  } catch (err) {
    console.error("[CustomAgent] generateInsights failed:", err);
    yield* flushQueue(eventQueue);
    // Non-fatal: continue with results
  }

  // Emit completion
  const durationMs = Math.round(performance.now() - startTime);
  const ranking = state.ranking;
  const best = ranking[0];

  const summary: RunSummary = {
    totalStocks: state.resolvedStocks.length,
    analyzed: state.backtestResults.length,
    failed: state.resolvedStocks.length - state.backtestResults.length,
    topN: ranking.slice(0, 10),
    avgReturn:
      ranking.length > 0
        ? ranking.reduce((s, r) => s + r.totalReturn, 0) / ranking.length
        : 0,
    avgSharpe:
      ranking.length > 0
        ? ranking.reduce((s, r) => s + r.sharpeRatio, 0) / ranking.length
        : 0,
    bestSymbol: best ? `${best.name}(${best.symbol})` : "N/A",
    totalTokenCost: state.tokenUsed,
    durationMs,
  };

  yield { type: "complete", summary };
}

function* flushQueue(queue: EventQueue): Generator<CustomAgentEvent> {
  while (queue.length > 0) {
    yield queue.shift()!;
  }
}
