/**
 * Eval Collector — builds StageEval records from raw stage output.
 *
 * Kept separate from the pipeline so tests can assert on eval shape in
 * isolation, and so future work can hook a Grafana/Prometheus exporter
 * here without touching the pipeline code.
 *
 * @module lib/funnel/eval-collector
 */

import type { Candidate, StageEval, StageRunOutput } from './types';

export interface BuildEvalArgs {
  readonly stageName: string;
  readonly stageIndex: number;
  readonly inputSize: number;
  readonly durationMs: number;
  readonly output: StageRunOutput;
}

export function buildStageEval(args: BuildEvalArgs): StageEval {
  const outputSize = args.output.candidates.length;
  const denom = Math.max(args.inputSize, 1);
  return {
    stageName: args.stageName,
    stageIndex: args.stageIndex,
    inputSize: args.inputSize,
    outputSize,
    keepRatio: outputSize / denom,
    durationMs: args.durationMs,
    metrics: args.output.metrics ?? {},
    warnings: args.output.warnings ?? [],
  };
}

/**
 * Return a small representative sample of candidates for event streams.
 * Avoids shipping 5000-item arrays in SSE frames while still letting the
 * UI show progress.
 */
export function sampleCandidates(
  candidates: ReadonlyArray<Candidate>,
  limit = 10
): ReadonlyArray<Candidate> {
  if (candidates.length <= limit) return candidates;
  return candidates.slice(0, limit);
}
