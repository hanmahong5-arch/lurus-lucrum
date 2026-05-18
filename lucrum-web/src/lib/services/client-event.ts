/**
 * Client-side timeline event helper.
 *
 * Sends a single event to POST /api/timeline. Failures are swallowed —
 * UI telemetry must never break the user flow it instruments.
 *
 * @module lib/services/client-event
 */

import type { UserEventType } from './user-event-types';

export interface ClientEventInput {
  type: UserEventType;
  entityType?: string;
  entityId?: string | number;
  metadata?: Record<string, unknown>;
}

export function recordClientEvent(input: ClientEventInput): void {
  void fetch('/api/timeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch((err) => {
    console.warn('[client-event] recordClientEvent failed:', err);
  });
}
