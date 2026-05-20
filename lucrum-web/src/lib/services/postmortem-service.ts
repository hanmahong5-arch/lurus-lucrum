/**
 * Postmortem dispatcher service.
 *
 * Server-only. Given a (user, backtest, persona-set), runs each persona in
 * parallel against the LLM router, persists the structured result, and
 * debits the user's wallet by `POSTMORTEM_COST_PER_PERSONA_LB`. Cache hits
 * on `(backtest_id, persona_id)` skip both LLM and wallet — re-opening a
 * postmortem is free.
 *
 * Failure isolation: one persona's failure must not kill the others. Each
 * persona is wrapped in its own try/catch; the dispatcher returns whichever
 * succeeded, plus a failure list the caller surfaces in the UI.
 *
 * @module lib/services/postmortem-service
 */

// Server-only — imports `db`, `chatComplete`, and the platform wallet client.
// Never import this from a client component; the bundle will break at build.
import { db } from "@/lib/db";
import {
  postmortemRuns,
  postmortemPersonaResults,
  backtestHistory,
} from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { chatComplete } from "@/lib/llm";
import {
  buildPostmortemSystemPrompt,
  buildPostmortemUserPrompt,
  parsePersonaOutput,
  type PostmortemContext,
  type PersonaOutput,
  type TradeRow,
} from "@/lib/agent/postmortem-prompts";
import {
  POSTMORTEM_PERSONAS,
  POSTMORTEM_COST_PER_PERSONA_LB,
  getPostmortemPersona,
  type PostmortemPersona,
  type PostmortemPersonaId,
  type PostmortemVerdict,
} from "@/lib/services/postmortem-personas";
import {
  debitWallet,
  resolveAccountId,
  PlatformError,
} from "@/lib/platform/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PersonaResultPayload {
  personaId: PostmortemPersonaId;
  label: string;
  viewpoint: string;
  verdict: PostmortemVerdict;
  summary: string;
  evidence: Array<{ point: string; data: string }>;
  improvements: string[];
  confidence: number;
  costLb: number;
  cached: boolean;
}

export interface PersonaFailure {
  personaId: PostmortemPersonaId;
  label: string;
  error: string;
}

export interface PostmortemDispatchSummary {
  runId: number;
  divergenceSummary: string;
  totalCostLb: number;
  results: PersonaResultPayload[];
  failures: PersonaFailure[];
}

// ---------------------------------------------------------------------------
// Context loader — pulls the slimmed-down summary the LLM needs.
// ---------------------------------------------------------------------------

interface BacktestRow {
  id: number;
  userId: string;
  symbol: string;
  stockName: string | null;
  startDate: string;
  endDate: string;
  config: string;
  result: string;
  totalReturn: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
}

interface SafeTrade {
  symbol?: string;
  symbolName?: string;
  entryDate?: string;
  exitDate?: string;
  date?: string;
  pnlPercent?: number;
  pnl?: number;
  netReturnPercent?: number;
  holdingDays?: number;
  type?: string;
}

interface SafeEquityPoint {
  date?: string;
  equity?: number;
  value?: number;
}

const MAX_TOP_TRADES = 5;

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function clampString(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

/** Build the structured context the prompt builder consumes. */
export async function buildBacktestContext(
  backtestId: number,
  ownerUserId: string,
  strategyNameHint?: string,
): Promise<PostmortemContext> {
  const rows = await db
    .select()
    .from(backtestHistory)
    .where(
      and(
        eq(backtestHistory.id, backtestId),
        eq(backtestHistory.userId, ownerUserId),
      ),
    )
    .limit(1);
  const row = rows[0] as BacktestRow | undefined;
  if (!row) {
    throw new Error(`postmortem: backtest ${backtestId} not found for user`);
  }

  let parsedResult: Record<string, unknown> = {};
  try {
    parsedResult = JSON.parse(row.result);
  } catch (err) {
    throw new Error(
      `postmortem: backtest ${backtestId} result is not valid JSON: ${String(err)}`,
    );
  }

  let parsedConfig: Record<string, unknown> = {};
  try {
    parsedConfig = JSON.parse(row.config);
  } catch {
    /* config is non-essential; fall through */
  }

  const trades: SafeTrade[] = Array.isArray(parsedResult.trades)
    ? (parsedResult.trades as SafeTrade[])
    : [];
  const closedTrades = trades.filter(
    (t) => typeof t.pnlPercent === "number" || typeof t.netReturnPercent === "number",
  );
  const tradeToRow = (t: SafeTrade): TradeRow => ({
    symbol: t.symbol ?? t.symbolName ?? row.symbol,
    entry: (t.entryDate ?? t.date ?? "").slice(0, 10),
    exit: (t.exitDate ?? t.date ?? "").slice(0, 10),
    pnlPercent: (t.pnlPercent ?? t.netReturnPercent ?? 0) / 100,
    holdDays: typeof t.holdingDays === "number" ? t.holdingDays : 0,
  });

  const wins = [...closedTrades]
    .filter((t) => (t.pnlPercent ?? t.netReturnPercent ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.pnlPercent ?? b.netReturnPercent ?? 0) -
        (a.pnlPercent ?? a.netReturnPercent ?? 0),
    )
    .slice(0, MAX_TOP_TRADES)
    .map(tradeToRow);
  const losses = [...closedTrades]
    .filter((t) => (t.pnlPercent ?? t.netReturnPercent ?? 0) < 0)
    .sort(
      (a, b) =>
        (a.pnlPercent ?? a.netReturnPercent ?? 0) -
        (b.pnlPercent ?? b.netReturnPercent ?? 0),
    )
    .slice(0, MAX_TOP_TRADES)
    .map(tradeToRow);

  // Equity curve sampling — most engines store {date, equity} array.
  const rawCurve: SafeEquityPoint[] = Array.isArray(parsedResult.equityCurve)
    ? (parsedResult.equityCurve as SafeEquityPoint[])
    : [];
  const equitySeries = rawCurve
    .map((p) => p.equity ?? p.value ?? null)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const equityCtx = (() => {
    if (equitySeries.length < 2) {
      return {
        start: 1,
        peak: 1,
        peakDay: 0,
        trough: 1,
        troughDay: 0,
        end: 1,
      };
    }
    const start = equitySeries[0]!;
    const last = equitySeries[equitySeries.length - 1]!;
    let peak = -Infinity;
    let peakIdx = 0;
    let trough = Infinity;
    let troughIdx = 0;
    equitySeries.forEach((v, i) => {
      if (v > peak) {
        peak = v;
        peakIdx = i;
      }
      if (v < trough) {
        trough = v;
        troughIdx = i;
      }
    });
    const norm = (v: number) => v / start;
    return {
      start: 1,
      peak: norm(peak),
      peakDay: peakIdx,
      trough: norm(trough),
      troughDay: troughIdx,
      end: norm(last),
    };
  })();

  const codeRaw =
    typeof parsedConfig.strategyCode === "string"
      ? parsedConfig.strategyCode
      : "";

  const symbol = row.stockName ? `${row.symbol} ${row.stockName}` : row.symbol;
  const totalTradesRaw = parsedResult.totalTrades;
  const totalTrades = toNumberOrNull(totalTradesRaw);
  const annualReturn = toNumberOrNull(parsedResult.annualizedReturn);

  return {
    strategyName:
      strategyNameHint ??
      (typeof parsedConfig.strategyName === "string"
        ? (parsedConfig.strategyName as string)
        : `回测 #${row.id}`),
    codeSummary: clampString(codeRaw.replace(/\s+/g, " ").trim(), 200) || "(无代码摘要)",
    symbol,
    startDate: row.startDate,
    endDate: row.endDate,
    metrics: {
      sharpe: toNumberOrNull(row.sharpeRatio ?? parsedResult.sharpeRatio),
      maxDrawdown: toNumberOrNull(row.maxDrawdown ?? parsedResult.maxDrawdown),
      winRate: toNumberOrNull(row.winRate ?? parsedResult.winRate),
      annualReturn,
      totalReturn: toNumberOrNull(row.totalReturn ?? parsedResult.totalReturn),
      totalTrades,
    },
    topWins: wins,
    topLosses: losses,
    equity: equityCtx,
  };
}

// ---------------------------------------------------------------------------
// LLM call — one persona
// ---------------------------------------------------------------------------

interface PersonaCallResult {
  output: PersonaOutput;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
}

async function callPersona(
  persona: PostmortemPersona,
  ctx: PostmortemContext,
): Promise<PersonaCallResult> {
  const system = buildPostmortemSystemPrompt(persona);
  const user = buildPostmortemUserPrompt(persona, ctx);

  const completion = await chatComplete(
    "analytic",
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { caller: `postmortem:${persona.id}` },
  );

  // One stricter retry on parse failure — the model usually wraps JSON in
  // markdown despite our instructions.
  try {
    return {
      output: parsePersonaOutput(completion.content),
      model: completion.model ?? null,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
    };
  } catch (err) {
    const retry = await chatComplete(
      "analytic",
      [
        { role: "system", content: system },
        { role: "user", content: user },
        {
          role: "system",
          content:
            "上一条回复未通过 JSON 校验：" +
            String(err) +
            "。请只输出一个合法 JSON 对象，不要 markdown 包裹。",
        },
      ],
      { caller: `postmortem:${persona.id}:retry` },
    );
    return {
      output: parsePersonaOutput(retry.content),
      model: retry.model ?? null,
      promptTokens: retry.promptTokens,
      completionTokens: retry.completionTokens,
    };
  }
}

// ---------------------------------------------------------------------------
// Cache + persistence
// ---------------------------------------------------------------------------

async function loadCachedPersonaRows(
  backtestId: number,
  personaIds: ReadonlyArray<PostmortemPersonaId>,
) {
  if (personaIds.length === 0) return [];
  return db
    .select()
    .from(postmortemPersonaResults)
    .where(
      and(
        eq(postmortemPersonaResults.backtestId, backtestId),
        inArray(postmortemPersonaResults.personaId, personaIds as string[]),
      ),
    );
}

function buildDivergence(results: PersonaResultPayload[]): string {
  if (results.length === 0) return "尚无结论";
  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topVerdict, topCount] = sorted[0]!;
  if (topCount === results.length) {
    return `${topCount}/${results.length} 共识：${verdictLabel(topVerdict as PostmortemVerdict)}`;
  }
  return `意见分歧（${sorted
    .map(([v, c]) => `${verdictLabel(v as PostmortemVerdict)} ${c}/${results.length}`)
    .join("，")}）`;
}

function verdictLabel(v: PostmortemVerdict): string {
  switch (v) {
    case "strong_win":
      return "强胜";
    case "weak_win":
      return "弱胜";
    case "neutral":
      return "中性";
    case "weak_loss":
      return "弱负";
    case "strong_loss":
      return "强负";
  }
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

export interface DispatchInput {
  userId: string;
  backtestId: number;
  personaIds: ReadonlyArray<PostmortemPersonaId>;
  /** Optional human strategy name (otherwise pulled from config blob). */
  strategyName?: string;
}

export async function dispatchPostmortem(
  input: DispatchInput,
): Promise<PostmortemDispatchSummary> {
  if (input.personaIds.length === 0) {
    throw new Error("postmortem: at least one persona required");
  }

  const personas: PostmortemPersona[] = [];
  for (const id of input.personaIds) {
    const p = getPostmortemPersona(id);
    if (!p) throw new Error(`postmortem: unknown persona id ${id}`);
    personas.push(p);
  }

  // 1) Build a single context up front (one DB read, shared by all personas).
  const ctx = await buildBacktestContext(
    input.backtestId,
    input.userId,
    input.strategyName,
  );

  // 2) Hit the cache. Cache rows are persisted with backtest_id only — they
  // belong to *whoever* runs the postmortem; if user A's run cached value
  // matches user B's backtest, that's fine (the backtest is owned, the
  // analysis isn't private).
  const cachedRows = await loadCachedPersonaRows(
    input.backtestId,
    personas.map((p) => p.id),
  );
  const cachedById = new Map(cachedRows.map((r) => [r.personaId, r]));

  // 3) Insert a `running` run row so the persona rows have a parent FK.
  const runRows = await db
    .insert(postmortemRuns)
    .values({
      userId: input.userId,
      backtestId: input.backtestId,
      status: "running",
      totalCostLb: "0",
    })
    .returning();
  const runId = runRows[0]!.id;

  const results: PersonaResultPayload[] = [];
  const failures: PersonaFailure[] = [];
  let accumulatedCost = 0;

  // 4) Settle persona-by-persona. Run misses in parallel; hits are read.
  const missPersonas = personas.filter((p) => !cachedById.has(p.id));

  // Resolve wallet account once if we have any misses to charge.
  let accountId: string | null = null;
  if (missPersonas.length > 0) {
    try {
      accountId = await resolveAccountId(input.userId);
    } catch (err) {
      const msg = err instanceof PlatformError ? err.message : String(err);
      throw new Error(`postmortem: wallet account resolution failed: ${msg}`);
    }
  }

  // Cached personas — emit directly.
  for (const persona of personas) {
    const cached = cachedById.get(persona.id);
    if (!cached) continue;
    results.push({
      personaId: persona.id,
      label: persona.label,
      viewpoint: persona.viewpoint,
      verdict: cached.verdict as PostmortemVerdict,
      summary: cached.summary,
      evidence: cached.evidence as Array<{ point: string; data: string }>,
      improvements: cached.improvements as string[],
      confidence: Number(cached.confidence),
      costLb: 0,
      cached: true,
    });
  }

  // Misses — run in parallel; debit + insert per persona on success.
  await Promise.all(
    missPersonas.map(async (persona) => {
      try {
        // Debit BEFORE calling the LLM. If the wallet refuses, we never
        // burn tokens. Failure → caller sees this persona in `failures`.
        if (accountId) {
          await debitWallet(
            accountId,
            POSTMORTEM_COST_PER_PERSONA_LB,
            "postmortem",
            `复盘 · ${persona.label}（回测 #${input.backtestId}）`,
          );
        }

        const call = await callPersona(persona, ctx);

        await db.insert(postmortemPersonaResults).values({
          runId,
          backtestId: input.backtestId,
          personaId: persona.id,
          verdict: call.output.verdict,
          summary: call.output.summary,
          evidence: call.output.evidence,
          improvements: call.output.improvements,
          confidence: call.output.confidence.toFixed(2),
          costLb: String(POSTMORTEM_COST_PER_PERSONA_LB),
          modelUsed: call.model,
          promptTokens: call.promptTokens,
          completionTokens: call.completionTokens,
        });

        results.push({
          personaId: persona.id,
          label: persona.label,
          viewpoint: persona.viewpoint,
          verdict: call.output.verdict,
          summary: call.output.summary,
          evidence: call.output.evidence,
          improvements: call.output.improvements,
          confidence: call.output.confidence,
          costLb: POSTMORTEM_COST_PER_PERSONA_LB,
          cached: false,
        });
        accumulatedCost += POSTMORTEM_COST_PER_PERSONA_LB;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({
          personaId: persona.id,
          label: persona.label,
          error: msg,
        });
      }
    }),
  );

  // 5) Finalize run row.
  const divergence = buildDivergence(results);
  const finalStatus =
    failures.length === personas.length
      ? "failed"
      : failures.length > 0
        ? "done"
        : "done";
  await db
    .update(postmortemRuns)
    .set({
      status: finalStatus,
      totalCostLb: accumulatedCost.toFixed(4),
      divergenceSummary: divergence,
    })
    .where(eq(postmortemRuns.id, runId));

  return {
    runId,
    divergenceSummary: divergence,
    totalCostLb: accumulatedCost,
    // Sort by the canonical persona order so the UI lays them out
    // deterministically regardless of which finished first.
    results: results.sort(
      (a, b) => personaOrder(a.personaId) - personaOrder(b.personaId),
    ),
    failures: failures.sort(
      (a, b) => personaOrder(a.personaId) - personaOrder(b.personaId),
    ),
  };
}

function personaOrder(id: PostmortemPersonaId): number {
  return POSTMORTEM_PERSONAS.findIndex((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// History reader — for the GET /api/postmortem/[runId] endpoint
// ---------------------------------------------------------------------------

export async function loadPostmortemRun(
  runId: number,
  userId: string,
): Promise<PostmortemDispatchSummary | null> {
  const runRows = await db
    .select()
    .from(postmortemRuns)
    .where(and(eq(postmortemRuns.id, runId), eq(postmortemRuns.userId, userId)))
    .limit(1);
  const run = runRows[0];
  if (!run) return null;

  const personaRows = await db
    .select()
    .from(postmortemPersonaResults)
    .where(eq(postmortemPersonaResults.runId, runId))
    .orderBy(desc(postmortemPersonaResults.id));

  const results: PersonaResultPayload[] = personaRows
    .map((r) => {
      const persona = getPostmortemPersona(r.personaId);
      if (!persona) return null;
      return {
        personaId: persona.id,
        label: persona.label,
        viewpoint: persona.viewpoint,
        verdict: r.verdict as PostmortemVerdict,
        summary: r.summary,
        evidence: r.evidence as Array<{ point: string; data: string }>,
        improvements: r.improvements as string[],
        confidence: Number(r.confidence),
        costLb: Number(r.costLb),
        cached: true,
      };
    })
    .filter((r): r is PersonaResultPayload => r != null)
    .sort((a, b) => personaOrder(a.personaId) - personaOrder(b.personaId));

  return {
    runId: run.id,
    divergenceSummary: run.divergenceSummary ?? buildDivergence(results),
    totalCostLb: Number(run.totalCostLb),
    results,
    failures: [],
  };
}
