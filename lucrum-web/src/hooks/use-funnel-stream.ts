'use client';

/**
 * useFunnelStream — React hook over POST /api/strategy-packs/run SSE.
 *
 * Keeps a rolling view of:
 *   - status      ("idle" | "running" | "done" | "error")
 *   - packMeta    (set once on pack-meta event)
 *   - events      (full event log for debugging)
 *   - stageEvals  (each stage-end eval)
 *   - candidates  (latest sampleCandidates from most recent stage-end)
 *   - result      (final FunnelResult from run-complete)
 *   - error       (last error message)
 *
 * Abort is supported via the returned `abort()` callback and on unmount.
 *
 * @module hooks/use-funnel-stream
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FunnelEvent, FunnelResult, StageEval } from '@/lib/funnel';
import type { StrategyPackId } from '@/lib/strategy-packs';

export interface PackMeta {
  readonly id: StrategyPackId;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly riskLevel: string;
  readonly holdingHorizon: string;
  readonly regimeFit: ReadonlyArray<string>;
  readonly expectedProfile: {
    readonly annualReturn: string;
    readonly maxDrawdown: string;
    readonly winRate?: string;
    readonly turnover: string;
  };
}

export interface FunnelCandidateView {
  readonly symbol: string;
  readonly name?: string;
  readonly score?: number;
  readonly tags?: ReadonlyArray<string>;
  readonly scoreBreakdown?: Record<string, number>;
  readonly notes?: Record<string, string>;
}

type FunnelStatus = 'idle' | 'running' | 'done' | 'error';

interface FunnelStreamState {
  readonly status: FunnelStatus;
  readonly packMeta: PackMeta | null;
  readonly events: ReadonlyArray<FunnelEvent>;
  readonly stageEvals: ReadonlyArray<StageEval>;
  readonly candidates: ReadonlyArray<FunnelCandidateView>;
  readonly result: FunnelResult | null;
  readonly error: string | null;
}

const INITIAL_STATE: FunnelStreamState = {
  status: 'idle',
  packMeta: null,
  events: [],
  stageEvals: [],
  candidates: [],
  result: null,
  error: null,
};

export interface RunPackRequest {
  readonly packId: StrategyPackId;
  readonly universe: {
    readonly kind: 'sector' | 'symbols';
    readonly sectorCode?: string;
    readonly symbols?: ReadonlyArray<string>;
  };
  readonly asOfDate?: string;
  readonly topN?: number;
}

export function useFunnelStream() {
  const [state, setState] = useState<FunnelStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => abort, [abort]);

  const run = useCallback(
    async (request: RunPackRequest) => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...INITIAL_STATE, status: 'running' });

      try {
        const response = await fetch('/api/strategy-packs/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames terminated by blank line.
          let sep = buffer.indexOf('\n\n');
          while (sep !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            sep = buffer.indexOf('\n\n');

            const dataLine = frame
              .split('\n')
              .find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            const payloadRaw = dataLine.slice(5).trim();
            if (!payloadRaw) continue;

            let payload: unknown;
            try {
              payload = JSON.parse(payloadRaw);
            } catch {
              continue;
            }
            applyEvent(setState, payload);
          }
        }

        setState((s) =>
          s.status === 'running' ? { ...s, status: 'done' } : s
        );
      } catch (err) {
        if (controller.signal.aborted) {
          setState((s) => ({ ...s, status: 'idle' }));
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, status: 'error', error: message }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [abort]
  );

  return { ...state, run, abort };
}

function applyEvent(
  setState: React.Dispatch<React.SetStateAction<FunnelStreamState>>,
  payload: unknown
): void {
  if (!payload || typeof payload !== 'object') return;
  const kind = (payload as { kind?: string }).kind;

  if (kind === 'pack-meta') {
    const pack = (payload as { pack?: PackMeta }).pack;
    if (pack) setState((s) => ({ ...s, packMeta: pack }));
    return;
  }

  if (kind === 'error') {
    const message = (payload as { message?: string }).message ?? 'unknown error';
    setState((s) => ({ ...s, status: 'error', error: message }));
    return;
  }

  if (
    kind === 'run-start' ||
    kind === 'stage-start' ||
    kind === 'stage-end' ||
    kind === 'run-complete' ||
    kind === 'run-error'
  ) {
    const event = payload as FunnelEvent;
    setState((s) => {
      const baseEvents: FunnelStreamState = {
        ...s,
        events: [...s.events, event],
      };
      if (event.kind === 'stage-end') {
        return {
          ...baseEvents,
          stageEvals: [...s.stageEvals, event.eval],
          candidates: event.sampleCandidates as FunnelCandidateView[],
        };
      }
      if (event.kind === 'run-complete') {
        const err = event.result.error;
        return {
          ...baseEvents,
          result: event.result,
          candidates: event.result.candidates as FunnelCandidateView[],
          status: err ? 'error' : 'done',
          error: err ? err.message : baseEvents.error,
        };
      }
      if (event.kind === 'run-error') {
        return {
          ...baseEvents,
          status: 'error',
          error: event.error.message,
        };
      }
      return baseEvents;
    });
  }
}
