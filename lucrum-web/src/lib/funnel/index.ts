/**
 * Funnel barrel exports.
 *
 * Consumer pattern:
 *   import { runPipeline, buildPipeline, createFunnelContext } from '@/lib/funnel';
 *   import { makeStageUniverse, makeStageHardFilter, ... } from '@/lib/funnel/stages';
 *
 * @module lib/funnel
 */

export type {
  Candidate,
  FunnelContext,
  FunnelError,
  FunnelEvent,
  FunnelEventListener,
  FunnelResult,
  Stage,
  StageEval,
  StageRunOutput,
} from './types';

export { buildPipeline, runPipeline } from './pipeline';
export type { RunPipelineOptions } from './pipeline';

export { buildStageEval, sampleCandidates } from './eval-collector';

export { createFunnelContext } from './context';
export type { CreateContextArgs } from './context';
