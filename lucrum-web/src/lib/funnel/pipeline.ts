/**
 * Funnel Pipeline — orchestrator that runs stages sequentially and emits
 * events for observability.
 *
 * Design:
 *   - Sequential by default; parallelism belongs inside a stage if useful.
 *   - Each stage runs in a try/catch; a thrown error short-circuits the
 *     pipeline and emits a `run-error` event. Earlier stage results are
 *     preserved in the result for debugging.
 *   - Listener pattern (not EventEmitter) keeps the surface minimal and
 *     test-friendly.
 *
 * @module lib/funnel/pipeline
 */

import { buildStageEval, sampleCandidates } from './eval-collector';
import type {
  Candidate,
  FunnelContext,
  FunnelError,
  FunnelEvent,
  FunnelEventListener,
  FunnelResult,
  Stage,
  StageEval,
} from './types';

export interface RunPipelineOptions {
  readonly stages: ReadonlyArray<Stage>;
  readonly initialCandidates?: ReadonlyArray<Candidate>;
  readonly context: FunnelContext;
  readonly onEvent?: FunnelEventListener;
  /** Sample size attached to stage-end events (default 10). */
  readonly eventSampleSize?: number;
}

function emit(
  listener: FunnelEventListener | undefined,
  event: FunnelEvent
): void {
  if (!listener) return;
  try {
    listener(event);
  } catch (err) {
    // Listeners must not break the pipeline.
    // eslint-disable-next-line no-console
    console.error('[funnel] listener error', err);
  }
}

/** Assign stage indices in one place so callers don't have to. */
export function buildPipeline(stages: ReadonlyArray<Stage>): ReadonlyArray<Stage> {
  return stages.map((s, i) => {
    s.index = i;
    return s;
  });
}

export async function runPipeline(
  options: RunPipelineOptions
): Promise<FunnelResult> {
  const { stages, context, onEvent } = options;
  const sampleSize = options.eventSampleSize ?? 10;
  const evals: StageEval[] = [];
  let candidates: ReadonlyArray<Candidate> = options.initialCandidates ?? [];

  emit(onEvent, {
    kind: 'run-start',
    runId: context.runId,
    asOfDate: context.asOfDate,
  });

  const pipelineStart = Date.now();
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!stage) continue;
    stage.index = i;
    const inputSize = candidates.length;

    emit(onEvent, {
      kind: 'stage-start',
      runId: context.runId,
      stageName: stage.name,
      stageIndex: i,
      inputSize,
    });

    const stageStart = Date.now();
    try {
      const output = await stage.run(candidates, context);
      const durationMs = Date.now() - stageStart;
      const stageEval = buildStageEval({
        stageName: stage.name,
        stageIndex: i,
        inputSize,
        durationMs,
        output,
      });
      evals.push(stageEval);
      candidates = output.candidates;

      emit(onEvent, {
        kind: 'stage-end',
        runId: context.runId,
        eval: stageEval,
        sampleCandidates: sampleCandidates(candidates, sampleSize),
      });
    } catch (err) {
      const fe: FunnelError = {
        stageName: stage.name,
        stageIndex: i,
        message: err instanceof Error ? err.message : String(err),
        code: 'STAGE_THREW',
      };
      emit(onEvent, { kind: 'run-error', runId: context.runId, error: fe });
      const result: FunnelResult = {
        runId: context.runId,
        asOfDate: context.asOfDate,
        durationMs: Date.now() - pipelineStart,
        candidates,
        evals,
        error: fe,
      };
      emit(onEvent, { kind: 'run-complete', runId: context.runId, result });
      return result;
    }
  }

  const result: FunnelResult = {
    runId: context.runId,
    asOfDate: context.asOfDate,
    durationMs: Date.now() - pipelineStart,
    candidates,
    evals,
    error: null,
  };
  emit(onEvent, { kind: 'run-complete', runId: context.runId, result });
  return result;
}
