/**
 * Spend / health report aggregation over `kind:"llm.call"` telemetry lines.
 *
 * Pure functions (no IO) so they're trivially testable. The script entry
 * point lives in `scripts/llm-spend-report.ts` and just wires stdin →
 * `parseTelemetryLine` → `aggregate` → `formatReport`.
 *
 * Why this lives in `src/lib/llm/` instead of `scripts/`:
 *   - vitest's `include` glob is `src/**`, so tests must live here.
 *   - keeps the domain logic close to the producer (`observability.ts`),
 *     so a schema change in one is visible to the other.
 *
 * @module lib/llm/spend-report
 */

import type { LlmCallTelemetry, TaskClass } from './types';

// =============================================================================
// Parsing
// =============================================================================

/**
 * Best-effort parse of a single log line.
 * Returns null for non-JSON / wrong-kind / structurally-bad lines — never throws.
 * Logs containing telemetry are typically interleaved with framework output,
 * so resilience to noise is the whole point.
 */
export function parseTelemetryLine(line: string): LlmCallTelemetry | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  if (r.kind !== 'llm.call') return null;
  // Minimum required fields for a meaningful aggregation.
  if (typeof r.taskClass !== 'string') return null;
  if (typeof r.modelRequested !== 'string') return null;
  if (typeof r.latencyMs !== 'number' || !Number.isFinite(r.latencyMs)) return null;
  if (typeof r.success !== 'boolean') return null;
  return r as unknown as LlmCallTelemetry;
}

// =============================================================================
// Aggregation
// =============================================================================

export type GroupBy = 'caller' | 'taskClass' | 'modelActual' | 'modelRequested';

export interface AggregateOptions {
  /** Field to bucket events on. Default: `caller`. */
  readonly groupBy?: GroupBy;
  /** Drop events whose `taskClass` is not in this list. Default: keep all. */
  readonly taskClassFilter?: ReadonlyArray<TaskClass>;
  /** Drop events whose `caller` doesn't match this substring. Default: keep all. */
  readonly callerSubstring?: string;
}

export interface BucketStats {
  /** Bucket key — e.g. `advisor.chat:diagnose` when groupBy=caller. */
  readonly key: string;
  readonly count: number;
  readonly successCount: number;
  readonly cancelledCount: number;
  readonly erroredCount: number;
  readonly fallbackCount: number;
  readonly maxTokensFlooredCount: number;
  /** Sum of total tokens across all `success:true` calls in this bucket. */
  readonly totalTokens: number;
  /** Mean total tokens across `success:true` calls (null if zero successes). */
  readonly avgTokens: number | null;
  /** Median latency in ms across all calls in the bucket. */
  readonly p50LatencyMs: number;
  /** 95th-percentile latency in ms (uses linear interpolation). */
  readonly p95LatencyMs: number;
  /** Map from modelActual string → count, lets you see fallback flow. */
  readonly modelActualBreakdown: Readonly<Record<string, number>>;
}

export interface SpendReport {
  readonly groupBy: GroupBy;
  readonly totalEvents: number;
  readonly droppedNonTelemetryLines: number;
  readonly buckets: ReadonlyArray<BucketStats>;
}

/**
 * Compute percentile of a sorted ascending array using linear interpolation.
 * Defined as: position = p * (n - 1); take floor + interp toward ceil.
 * For n=1 returns the single value; n=0 returns 0.
 */
export function percentile(sortedAsc: ReadonlyArray<number>, p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const idx = p * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = idx - lo;
  return sortedAsc[lo]! * (1 - frac) + sortedAsc[hi]! * frac;
}

function bucketKeyFor(t: LlmCallTelemetry, by: GroupBy): string {
  switch (by) {
    case 'caller':
      return t.caller ?? '<no-caller>';
    case 'taskClass':
      return t.taskClass;
    case 'modelActual':
      return t.modelActual ?? t.modelRequested;
    case 'modelRequested':
      return t.modelRequested;
  }
}

export function aggregate(
  events: ReadonlyArray<LlmCallTelemetry>,
  opts: AggregateOptions = {},
): SpendReport {
  const groupBy: GroupBy = opts.groupBy ?? 'caller';

  const filtered = events.filter((e) => {
    if (opts.taskClassFilter && !opts.taskClassFilter.includes(e.taskClass)) return false;
    if (opts.callerSubstring && !(e.caller ?? '').includes(opts.callerSubstring)) return false;
    return true;
  });

  // Group events by bucket key (preserves first-seen order for stable output).
  const buckets = new Map<string, LlmCallTelemetry[]>();
  for (const e of filtered) {
    const key = bucketKeyFor(e, groupBy);
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(e);
  }

  const stats: BucketStats[] = [];
  const bucketEntries = Array.from(buckets.entries());
  for (const entry of bucketEntries) {
    const key: string = entry[0];
    const list: LlmCallTelemetry[] = entry[1];
    const successes = list.filter((e: LlmCallTelemetry) => e.success);
    const cancelled = list.filter((e: LlmCallTelemetry) => e.cancelled);
    const errored = list.filter((e: LlmCallTelemetry) => !e.success && !e.cancelled);
    const fallbacks = list.filter((e: LlmCallTelemetry) => e.fallbackUsed);
    const floored = list.filter((e: LlmCallTelemetry) => e.maxTokensFloored);

    const totalTokens = successes.reduce((s: number, e: LlmCallTelemetry) => s + (e.totalTokens ?? 0), 0);
    const tokensWithUsage = successes.filter((e: LlmCallTelemetry) => typeof e.totalTokens === 'number');
    const avgTokens =
      tokensWithUsage.length > 0
        ? tokensWithUsage.reduce((s: number, e: LlmCallTelemetry) => s + (e.totalTokens ?? 0), 0) / tokensWithUsage.length
        : null;

    const latencies = list.map((e: LlmCallTelemetry) => e.latencyMs).sort((a: number, b: number) => a - b);
    const p50 = percentile(latencies, 0.5);
    const p95 = percentile(latencies, 0.95);

    const modelActualBreakdown: Record<string, number> = {};
    for (const e of list) {
      const m = e.modelActual ?? e.modelRequested;
      modelActualBreakdown[m] = (modelActualBreakdown[m] ?? 0) + 1;
    }

    stats.push({
      key,
      count: list.length,
      successCount: successes.length,
      cancelledCount: cancelled.length,
      erroredCount: errored.length,
      fallbackCount: fallbacks.length,
      maxTokensFlooredCount: floored.length,
      totalTokens,
      avgTokens,
      p50LatencyMs: Math.round(p50),
      p95LatencyMs: Math.round(p95),
      modelActualBreakdown,
    });
  }

  // Sort buckets by total token volume descending — the answer to "who spent
  // most" is what someone running this report most often needs first.
  stats.sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    groupBy,
    totalEvents: filtered.length,
    droppedNonTelemetryLines: 0, // populated by the script wrapper, not here
    buckets: stats,
  };
}

// =============================================================================
// Formatting
// =============================================================================

export interface FormatOptions {
  /** "table" (human) or "json" (machine). Default: "table". */
  readonly format?: 'table' | 'json';
  /** Limit table rows; null shows all. Default: 20. */
  readonly limit?: number | null;
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function padNum(n: number | null, width: number): string {
  const s = n === null ? '-' : String(n);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function pct(part: number, whole: number): string {
  if (whole === 0) return '   -';
  return `${((part / whole) * 100).toFixed(0).padStart(3, ' ')}%`;
}

export function formatReport(report: SpendReport, opts: FormatOptions = {}): string {
  if ((opts.format ?? 'table') === 'json') {
    return JSON.stringify(report, null, 2);
  }

  const limit = opts.limit ?? 20;
  const rows = limit === null ? report.buckets : report.buckets.slice(0, limit);

  const header =
    pad(report.groupBy, 36) +
    padNum(0, 6).replace('0', 'cnt') +
    padNum(0, 6).replace('0', 'ok') +
    padNum(0, 6).replace('0', 'cncl') +
    padNum(0, 6).replace('0', 'err') +
    padNum(0, 6).replace('0', 'fb') +
    padNum(0, 11).replace('0', 'tokens') +
    padNum(0, 8).replace('0', 'p50ms') +
    padNum(0, 8).replace('0', 'p95ms');

  const lines: string[] = [];
  lines.push(`-- LLM spend report (groupBy=${report.groupBy}, ${report.totalEvents} events) --`);
  if (report.droppedNonTelemetryLines > 0) {
    lines.push(`   (skipped ${report.droppedNonTelemetryLines} non-telemetry lines)`);
  }
  lines.push(header);
  lines.push('-'.repeat(header.length));

  for (const b of rows) {
    lines.push(
      pad(b.key, 36) +
        padNum(b.count, 6) +
        padNum(b.successCount, 6) +
        padNum(b.cancelledCount, 6) +
        padNum(b.erroredCount, 6) +
        padNum(b.fallbackCount, 6) +
        padNum(b.totalTokens, 11) +
        padNum(b.p50LatencyMs, 8) +
        padNum(b.p95LatencyMs, 8),
    );
  }

  if (limit !== null && report.buckets.length > limit) {
    lines.push(`   … ${report.buckets.length - limit} more buckets (use --limit 0 for all)`);
  }

  // Aggregate totals row at the end.
  const totalCount = report.buckets.reduce((s, b) => s + b.count, 0);
  const totalSuccess = report.buckets.reduce((s, b) => s + b.successCount, 0);
  const totalCancel = report.buckets.reduce((s, b) => s + b.cancelledCount, 0);
  const totalErr = report.buckets.reduce((s, b) => s + b.erroredCount, 0);
  const totalFb = report.buckets.reduce((s, b) => s + b.fallbackCount, 0);
  const totalTokens = report.buckets.reduce((s, b) => s + b.totalTokens, 0);
  lines.push('-'.repeat(header.length));
  lines.push(
    pad('TOTAL', 36) +
      padNum(totalCount, 6) +
      padNum(totalSuccess, 6) +
      padNum(totalCancel, 6) +
      padNum(totalErr, 6) +
      padNum(totalFb, 6) +
      padNum(totalTokens, 11),
  );
  lines.push(
    `   success=${pct(totalSuccess, totalCount)} cancel=${pct(totalCancel, totalCount)} err=${pct(totalErr, totalCount)} fallback=${pct(totalFb, totalCount)}`,
  );

  return lines.join('\n');
}
