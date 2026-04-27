/**
 * Strategy Scanner Agent — Parallel Sector/Stock Scanning
 * 并行扫描 Agent — 板块/个股策略扫描与排名
 *
 * LangGraph StateGraph workflow:
 *   configureScan → parallelBacktest → rankResults → generateInsights → END
 *
 * Each node streams SSE events to the caller via an async generator.
 */

import { Annotation, StateGraph, END, START } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import { getChatModel } from "@/lib/llm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import {
  getSectorStocks,
} from "@/lib/data-service/sources/eastmoney-sector";

// =============================================================================
// Types / 类型
// =============================================================================

export interface ScanTarget {
  type: "sector" | "stock";
  code: string;
  name: string;
}

export interface SectorScanResult {
  target: ScanTarget;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  stockCount: number;
  successCount: number;
}

export interface RankedResult extends SectorScanResult {
  rank: number;
  score: number; // composite score: 60% totalReturn + 40% sharpeRatio
}

export type ScannerStep =
  | "configuring"
  | "scanning"
  | "ranking"
  | "analyzing"
  | "done"
  | "error";

export type ScannerEvent =
  | { type: "progress"; done: number; total: number; current: string }
  | { type: "result"; target: ScanTarget; metrics: Omit<SectorScanResult, "target"> }
  | { type: "ranking"; items: RankedResult[] }
  | { type: "insights"; content: string }
  | { type: "error"; code: string; message: string };

// Scanner agent state
const ScannerStateAnnotation = Annotation.Root({
  strategy: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => "",
  }),
  strategyName: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => "自定义策略",
  }),
  scanTargets: Annotation<ScanTarget[]>({
    reducer: (_a, b) => b,
    default: () => [],
  }),
  dateRange: Annotation<{ start: string; end: string }>({
    reducer: (_a, b) => b,
    default: () => ({ start: "2023-01-01", end: "2024-12-31" }),
  }),
  capital: Annotation<number>({
    reducer: (_a, b) => b,
    default: () => 100000,
  }),
  results: Annotation<SectorScanResult[]>({
    reducer: (_a, b) => b,
    default: () => [],
  }),
  ranking: Annotation<RankedResult[]>({
    reducer: (_a, b) => b,
    default: () => [],
  }),
  insights: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => "",
  }),
  step: Annotation<ScannerStep>({
    reducer: (_a, b) => b,
    default: () => "configuring",
  }),
  errorMessage: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
});

export type ScannerState = typeof ScannerStateAnnotation.State;

// =============================================================================
// LLM Configuration
// =============================================================================

function createLLM(temperature = 0.4): ChatOpenAI {
  return getChatModel('analytic', { temperature, maxTokens: 2000 });
}

// =============================================================================
// Concurrency control
// =============================================================================

const SCANNER_CONCURRENCY = parseInt(
  process.env.SCANNER_CONCURRENCY ?? "5",
  10
);

/** Run an array of async tasks with bounded concurrency */
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

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// =============================================================================
// Internal: Run strategy on a single sector/stock via unified backtest API
// =============================================================================

async function runSectorScan(
  target: ScanTarget,
  strategy: string,
  dateRange: { start: string; end: string },
  capital: number
): Promise<Omit<SectorScanResult, "target">> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Determine backtest request structure
  const backtestBody =
    target.type === "sector"
      ? {
          target: { mode: "sector", sector: { code: target.code, name: target.name } },
          config: {
            startDate: dateRange.start,
            endDate: dateRange.end,
            initialCapital: capital,
            commission: 0.0003,
            slippage: 0.001,
          },
          strategy: { builtinId: strategy },
        }
      : {
          target: { mode: "stock", stock: { symbol: target.code, name: target.name } },
          config: {
            startDate: dateRange.start,
            endDate: dateRange.end,
            initialCapital: capital,
            commission: 0.0003,
            slippage: 0.001,
          },
          strategy: { builtinId: strategy },
        };

  const res = await fetch(`${baseUrl}/api/backtest/unified`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": process.env.INTERNAL_API_SECRET ?? "",
    },
    body: JSON.stringify(backtestBody),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    throw new Error(`Backtest API returned ${res.status} for ${target.code}`);
  }

  const json = (await res.json()) as {
    success: boolean;
    data?: {
      returnMetrics?: { totalReturn?: number };
      riskMetrics?: { sharpeRatio?: number; maxDrawdown?: number };
      tradingMetrics?: { winRate?: number; totalTrades?: number };
      stockResults?: unknown[];
    };
  };

  if (!json.success || !json.data) {
    throw new Error(`Backtest failed for ${target.code}`);
  }

  const d = json.data;
  const stockCount =
    target.type === "sector"
      ? (d.stockResults?.length ?? 1)
      : 1;

  return {
    totalReturn: d.returnMetrics?.totalReturn ?? 0,
    sharpeRatio: d.riskMetrics?.sharpeRatio ?? 0,
    maxDrawdown: d.riskMetrics?.maxDrawdown ?? 0,
    winRate: d.tradingMetrics?.winRate ?? 0,
    tradeCount: d.tradingMetrics?.totalTrades ?? 0,
    stockCount,
    successCount: stockCount,
  };
}

// =============================================================================
// Graph Nodes
// =============================================================================

// Event emitter pattern: nodes push to a shared queue
type EventQueue = ScannerEvent[];

async function configureScanNode(
  state: ScannerState
): Promise<Partial<ScannerState>> {
  // Validate we have targets
  if (state.scanTargets.length === 0) {
    return {
      step: "error",
      errorMessage: "扫描目标为空，请至少选择一个板块或股票",
    };
  }
  return { step: "scanning" };
}

async function parallelBacktestNode(
  state: ScannerState,
  eventQueue: EventQueue
): Promise<Partial<ScannerState>> {
  const results: SectorScanResult[] = [];
  let done = 0;
  const total = state.scanTargets.length;

  await runWithConcurrency(
    state.scanTargets,
    SCANNER_CONCURRENCY,
    async (target) => {
      try {
        const metrics = await runSectorScan(
          target,
          state.strategy,
          state.dateRange,
          state.capital
        );
        const result: SectorScanResult = { target, ...metrics };
        results.push(result);
        done++;

        eventQueue.push({ type: "result", target, metrics });
        eventQueue.push({
          type: "progress",
          done,
          total,
          current: target.name,
        });
      } catch (err) {
        done++;
        console.warn(`[ScannerAgent] Failed to scan ${target.code}:`, err);
        eventQueue.push({
          type: "progress",
          done,
          total,
          current: `${target.name} (失败)`,
        });
      }
    }
  );

  return { step: "ranking", results };
}

async function rankResultsNode(
  state: ScannerState,
  eventQueue: EventQueue
): Promise<Partial<ScannerState>> {
  // Composite score: 60% annualised return + 40% Sharpe ratio (normalised)
  const results = state.results;
  if (results.length === 0) {
    return { step: "analyzing", ranking: [] };
  }

  const maxReturn = Math.max(...results.map((r) => r.totalReturn), 1);
  const maxSharpe = Math.max(...results.map((r) => r.sharpeRatio), 1);

  const ranked: RankedResult[] = results
    .map((r) => ({
      ...r,
      rank: 0,
      score:
        0.6 * (r.totalReturn / maxReturn) + 0.4 * (r.sharpeRatio / maxSharpe),
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  eventQueue.push({ type: "ranking", items: ranked });

  return { step: "analyzing", ranking: ranked };
}

async function generateInsightsNode(
  state: ScannerState,
  eventQueue: EventQueue
): Promise<Partial<ScannerState>> {
  const top5 = state.ranking.slice(0, 5);

  if (top5.length === 0) {
    return { step: "done", insights: "暂无足够数据生成选板洞察。" };
  }

  const top5Text = top5
    .map(
      (r, i) =>
        `${i + 1}. ${r.target.name}（${r.target.code}）` +
        ` 总收益=${(r.totalReturn * 100).toFixed(1)}%` +
        ` 夏普=${r.sharpeRatio.toFixed(2)}` +
        ` 最大回撤=${(r.maxDrawdown * 100).toFixed(1)}%`
    )
    .join("\n");

  const llm = createLLM(0.6);
  const prompt = `你是一位资深A股量化投资分析师。

以下是使用「${state.strategyName}」策略在 ${state.dateRange.start} 至 ${state.dateRange.end} 期间对多个板块/个股的回测排名结果（Top 5）：

${top5Text}

请用中文写一份简洁的选板洞察报告（300-500字），包含：
1. 排名靠前的板块/个股表现分析
2. 当前市场环境下的行业配置建议
3. 使用该策略时需要注意的风险点

输出格式：纯 Markdown，不要包含标题外的序号。`;

  const response = await llm.invoke([
    new SystemMessage(
      "你是一位专业的A股量化投资分析师，擅长板块轮动和策略适配性分析。"
    ),
    new HumanMessage(prompt),
  ]);

  const insights = response.content as string;
  eventQueue.push({ type: "insights", content: insights });

  return { step: "done", insights };
}

// =============================================================================
// Public API: streamScannerAgent
// =============================================================================

export interface ScannerInput {
  strategy: string;
  strategyName?: string;
  scanTargets: ScanTarget[];
  dateRange: { start: string; end: string };
  capital: number;
}

/**
 * Run the scanner agent and yield SSE events as they are produced.
 * Compatible with the ReadableStream pattern used in /api/agent/backtest.
 */
export async function* streamScannerAgent(
  input: ScannerInput
): AsyncGenerator<ScannerEvent> {
  const eventQueue: EventQueue = [];

  // Initial state
  let state: ScannerState = {
    ...ScannerStateAnnotation.State,
    strategy: input.strategy,
    strategyName: input.strategyName ?? "自定义策略",
    scanTargets: input.scanTargets,
    dateRange: input.dateRange,
    capital: input.capital,
    results: [],
    ranking: [],
    insights: "",
    step: "configuring",
    errorMessage: undefined,
  };

  // configureScan
  const configResult = await configureScanNode(state);
  Object.assign(state, configResult);
  yield* flushQueue(eventQueue);

  if (state.step === "error") {
    yield { type: "error", code: "CONFIG_ERROR", message: state.errorMessage ?? "配置错误" };
    return;
  }

  // parallelBacktest (this is where most events are generated)
  const backtestResult = await parallelBacktestNode(state, eventQueue);
  Object.assign(state, backtestResult);
  yield* flushQueue(eventQueue);

  if (state.results.length === 0) {
    yield { type: "error", code: "NO_RESULTS", message: "所有目标扫描失败，请检查策略参数或日期范围" };
    return;
  }

  // rankResults
  const rankResult = await rankResultsNode(state, eventQueue);
  Object.assign(state, rankResult);
  yield* flushQueue(eventQueue);

  // generateInsights
  try {
    const insightResult = await generateInsightsNode(state, eventQueue);
    Object.assign(state, insightResult);
    yield* flushQueue(eventQueue);
  } catch (err) {
    console.error("[ScannerAgent] generateInsights failed:", err);
    // Non-fatal: yield whatever we have in the queue
    yield* flushQueue(eventQueue);
  }
}

function* flushQueue(queue: EventQueue): Generator<ScannerEvent> {
  while (queue.length > 0) {
    yield queue.shift()!;
  }
}
