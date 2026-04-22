/**
 * Helpers for constructing a FunnelContext. Centralized so callers
 * (API routes, tests, cron jobs) don't duplicate the boilerplate.
 *
 * @module lib/funnel/context
 */

import type { FunnelContext } from './types';

export interface CreateContextArgs {
  readonly asOfDate?: string;
  readonly options?: Record<string, unknown>;
  readonly userId?: string;
  readonly flags?: Record<string, boolean>;
  readonly runIdPrefix?: string;
}

function today(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function makeRunId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export function createFunnelContext(args: CreateContextArgs = {}): FunnelContext {
  return {
    runId: makeRunId(args.runIdPrefix ?? 'funnel'),
    asOfDate: args.asOfDate ?? today(),
    startTime: Date.now(),
    options: Object.freeze({ ...(args.options ?? {}) }),
    userId: args.userId,
    flags: Object.freeze({ ...(args.flags ?? {}) }),
  };
}
