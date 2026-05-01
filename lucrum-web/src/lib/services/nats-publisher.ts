/**
 * NATS JetStream publisher for LUCRUM_EVENTS.
 *
 * Publishes user-facing notification events to the platform notification
 * consumer (`2l-svc-platform/modules/notification`). The consumer treats
 * these as the unified inbox; lucrum-web also keeps its own DB-backed
 * notification system + Redis SSE pub/sub — the two coexist by design.
 *
 * Envelope shape mirrors `event.LucrumEvent` in
 * `2l-svc-platform/modules/notification/internal/pkg/event/types.go`:
 *
 *   {
 *     event_id:    string (uuid),
 *     event_type:  string (subject, e.g. "lucrum.advisor.output"),
 *     user_id:     string (Zitadel sub),
 *     account_id:  number (lurus-platform numeric account id),
 *     payload:     subject-specific object,
 *     occurred_at: string (ISO8601),
 *   }
 *
 * Activation: `NATS_URL` environment variable. Unset = no-op (matches the
 * newapi pattern; safe for local dev / CI without a NATS broker).
 *
 * Reliability model (intentional, not a TODO):
 *   - Lazy connect on first publish. Connect failure leaves the publisher
 *     in a "disabled" state for the duration of the process — a future
 *     publish retries the connect (rate-limited).
 *   - Bounded async queue + single worker, fire-and-forget at call site.
 *     Buffer full → drop with warn log; we prefer dropped events over
 *     blocking the user request path.
 *   - At-least-once via JetStream `publish` (ack required). Per-event
 *     retry with exponential backoff; final failure logged + dropped.
 *   - Failures NEVER propagate to the caller.
 *
 * See `2b-svc-newapi/service/nats_publisher.go` for the reference Go
 * implementation; this file mirrors its semantics.
 */
import {
  connect,
  JSONCodec,
  type Codec,
  type JetStreamClient,
  type NatsConnection,
} from 'nats';

// ============================================================================
// Constants (no magic numbers)
// ============================================================================

const STREAM_LUCRUM_EVENTS = 'LUCRUM_EVENTS';

export const SUBJECT_ADVISOR_OUTPUT = 'lucrum.advisor.output';
export const SUBJECT_MARKET_EVENT = 'lucrum.market.event';

const DEFAULT_QUEUE_CAPACITY = 256;
const DEFAULT_PUBLISH_RETRIES = 2;             // 1 + 2 retries = 3 attempts
const PUBLISH_ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 5_000;
const BACKOFF_INITIAL_MS = 100;
const BACKOFF_MAX_MS = 2_000;
const RECONNECT_WAIT_MS = 2_000;
const SUMMARY_MAX_LEN = 200;
const HEADLINE_MAX_LEN = 200;

// ============================================================================
// Public payload types
// ============================================================================

/** Input for `publishAdvisorOutput`. */
export interface AdvisorOutputInput {
  userId: string;
  accountId: number;
  advisorId: string;
  advisorName: string;
  symbol: string;
  summary: string;
}

/** Input for `publishMarketEvent`. */
export interface MarketEventInput {
  userId: string;
  accountId: number;
  symbol: string;
  headline: string;
  /** "info" | "warning" | "critical" — only "warning" / "critical" publish. */
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Wire envelope. Snake_case property names mirror the Go consumer struct
 * tags exactly (`event.LucrumEvent`); do NOT rename.
 */
interface LucrumEventEnvelope<P> {
  event_id: string;
  event_type: string;
  user_id: string;
  account_id: number;
  payload: P;
  occurred_at: string;
}

interface AdvisorOutputPayload {
  advisor_id: string;
  advisor_name: string;
  symbol: string;
  summary: string;
}

interface MarketEventPayload {
  symbol: string;
  headline: string;
  severity: string;
}

// ============================================================================
// Internal queue + connection state
// ============================================================================

interface PublishJob {
  subject: string;
  data: Uint8Array;
}

type PublisherState = 'disabled' | 'connecting' | 'ready' | 'failed';

interface PublisherSingleton {
  state: PublisherState;
  url: string | null;
  conn: NatsConnection | null;
  js: JetStreamClient | null;
  queue: PublishJob[];
  capacity: number;
  retries: number;
  workerRunning: boolean;
  connectPromise: Promise<void> | null;
  codec: Codec<unknown>;
}

let singleton: PublisherSingleton | null = null;

function getSingleton(): PublisherSingleton {
  if (!singleton) {
    const url = process.env.NATS_URL ?? '';
    singleton = {
      state: url ? 'connecting' : 'disabled',
      url: url || null,
      conn: null,
      js: null,
      queue: [],
      capacity: parseIntOrDefault(process.env.NATS_PUBLISH_BUFFER, DEFAULT_QUEUE_CAPACITY),
      retries: parseIntOrDefault(process.env.NATS_PUBLISH_RETRIES, DEFAULT_PUBLISH_RETRIES),
      workerRunning: false,
      connectPromise: null,
      codec: JSONCodec(),
    };
    if (singleton.state === 'disabled') {
      // One-time log so deploys without NATS_URL are obvious.
      console.info('[nats-publisher] NATS_URL not set; publisher disabled (no-op)');
    } else {
      // Wire graceful drain on Next.js runtime shutdown when available.
      registerShutdownHook();
    }
  }
  return singleton;
}

function parseIntOrDefault(v: string | undefined, def: number): number {
  if (!v) return def;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

// ============================================================================
// Lifecycle: connect + shutdown
// ============================================================================

function isReady(s: PublisherSingleton): boolean {
  return s.state === 'ready';
}

async function ensureConnected(s: PublisherSingleton): Promise<boolean> {
  if (s.state === 'disabled') return false;
  if (s.state === 'ready') return true;
  if (s.connectPromise) {
    await s.connectPromise;
    return isReady(s);
  }
  if (!s.url) {
    s.state = 'disabled';
    return false;
  }

  s.connectPromise = (async () => {
    try {
      const conn = await connect({
        servers: s.url ?? undefined,
        timeout: CONNECT_TIMEOUT_MS,
        reconnect: true,
        reconnectTimeWait: RECONNECT_WAIT_MS,
        maxReconnectAttempts: -1,
        name: 'lucrum-web-event-publisher',
      });
      s.conn = conn;
      s.js = conn.jetstream();
      s.state = 'ready';
      console.info(
        `[nats-publisher] connected url=${s.url ?? '<unknown>'} stream=${STREAM_LUCRUM_EVENTS} capacity=${s.capacity} retries=${s.retries}`,
      );

      // Surface async lifecycle errors so failures aren't silent in logs.
      void (async () => {
        for await (const status of conn.status()) {
          if (status.type === 'error' || status.type === 'disconnect') {
            console.warn(`[nats-publisher] connection ${status.type}:`, status.data);
          }
        }
      })().catch(() => {
        /* status iterator close is benign */
      });
    } catch (err) {
      s.state = 'failed';
      console.error('[nats-publisher] connect failed:', err);
    } finally {
      s.connectPromise = null;
    }
  })();

  await s.connectPromise;
  return isReady(s);
}

let shutdownRegistered = false;

function registerShutdownHook(): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;
  if (typeof process === 'undefined' || typeof process.on !== 'function') return;
  const drain = (): void => {
    const s = singleton;
    if (!s || !s.conn) return;
    s.conn
      .drain()
      .catch((err: unknown) => console.warn('[nats-publisher] drain error:', err));
  };
  process.once('SIGTERM', drain);
  process.once('SIGINT', drain);
  process.once('beforeExit', drain);
}

// ============================================================================
// Core publish path
// ============================================================================

/**
 * Enqueue a JSON-encoded payload for publish to the given subject.
 * Returns immediately. Failures are logged, never thrown.
 */
export function publish<T>(subject: string, payload: T): void {
  const s = getSingleton();
  if (s.state === 'disabled') return;

  let data: Uint8Array;
  try {
    data = s.codec.encode(payload);
  } catch (err) {
    console.warn(`[nats-publisher] marshal error subject=${subject}:`, err);
    return;
  }

  if (s.queue.length >= s.capacity) {
    // Buffer full: drop oldest? No — drop new (matches newapi semantics).
    // Inbox is best-effort; never block billing/relay paths.
    console.warn(
      `[nats-publisher] buffer full, dropping subject=${subject} bytes=${data.byteLength}`,
    );
    return;
  }
  s.queue.push({ subject, data });
  void runWorker(s);
}

async function runWorker(s: PublisherSingleton): Promise<void> {
  if (s.workerRunning) return;
  s.workerRunning = true;
  try {
    while (s.queue.length > 0) {
      // Connect lazily before draining each batch — handles "connect on first
      // publish" + recovery from transient failure.
      const ready = await ensureConnected(s);
      const job = s.queue.shift();
      if (!job) break;
      if (!ready || !s.js) {
        // Connect failed; drop with single log so we don't loop hot.
        console.warn(
          `[nats-publisher] dropping subject=${job.subject} (connect failed, state=${s.state})`,
        );
        // After a connect failure, allow future publishes to retry.
        if (s.state === 'failed') s.state = 'connecting';
        continue;
      }
      await publishWithRetry(s, job);
    }
  } finally {
    s.workerRunning = false;
  }
}

async function publishWithRetry(s: PublisherSingleton, job: PublishJob): Promise<void> {
  const js = s.js;
  if (!js) return;
  let backoff = BACKOFF_INITIAL_MS;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= s.retries; attempt++) {
    try {
      await js.publish(job.subject, job.data, {
        timeout: PUBLISH_ACK_TIMEOUT_MS,
      });
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < s.retries) {
        console.info(
          `[nats-publisher] retry subject=${job.subject} attempt=${attempt + 1} err=${describeError(err)}`,
        );
        await sleep(backoff);
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
      }
    }
  }
  console.error(
    `[nats-publisher] giving up subject=${job.subject} attempts=${s.retries + 1} err=${describeError(lastErr)}`,
  );
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Envelope helpers
// ============================================================================

function makeEnvelope<P>(
  subject: string,
  userId: string,
  accountId: number,
  payload: P,
): LucrumEventEnvelope<P> {
  return {
    event_id: newEventId(),
    event_type: subject,
    user_id: userId,
    account_id: accountId,
    payload,
    occurred_at: new Date().toISOString(),
  };
}

function newEventId(): string {
  // Node 14.17+ / modern browsers expose crypto.randomUUID. Fall back to a
  // sufficiently-unique pseudo-id if absent (test environments without
  // webcrypto; collision risk is irrelevant for an event id).
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function truncate(s: string, max: number): string {
  if (typeof s !== 'string') return '';
  return s.length > max ? s.slice(0, max) : s;
}

function isPositiveAccountId(accountId: unknown): accountId is number {
  return typeof accountId === 'number' && Number.isFinite(accountId) && accountId > 0;
}

// ============================================================================
// Public publish helpers (one per subject)
// ============================================================================

/**
 * Publish `lucrum.advisor.output`.
 *
 * Fire-and-forget: returns immediately, errors are logged not thrown.
 * Drops silently when accountId is missing/0/negative — the consumer
 * would drop it anyway (`AccountID <= 0` → skipNoAccount), so we save
 * the round trip.
 */
export function publishAdvisorOutput(input: AdvisorOutputInput): void {
  if (!input.userId || !isPositiveAccountId(input.accountId)) return;
  if (!input.symbol || !input.advisorId) return;

  const payload: AdvisorOutputPayload = {
    advisor_id: input.advisorId,
    advisor_name: input.advisorName ?? '',
    symbol: input.symbol,
    summary: truncate(input.summary ?? '', SUMMARY_MAX_LEN),
  };
  publish(
    SUBJECT_ADVISOR_OUTPUT,
    makeEnvelope(SUBJECT_ADVISOR_OUTPUT, input.userId, input.accountId, payload),
  );
}

/**
 * Publish `lucrum.market.event`.
 *
 * Significance gate: only `warning` / `critical` severity publish; `info`
 * is a no-op (consumer would deliver as in-app notification, but for the
 * unified inbox we keep the signal-to-noise high).
 */
export function publishMarketEvent(input: MarketEventInput): void {
  if (!input.userId || !isPositiveAccountId(input.accountId)) return;
  if (!input.symbol) return;
  if (input.severity !== 'warning' && input.severity !== 'critical') return;

  const payload: MarketEventPayload = {
    symbol: input.symbol,
    headline: truncate(input.headline ?? '', HEADLINE_MAX_LEN),
    severity: input.severity,
  };
  publish(
    SUBJECT_MARKET_EVENT,
    makeEnvelope(SUBJECT_MARKET_EVENT, input.userId, input.accountId, payload),
  );
}

// ============================================================================
// Test hooks (NOT for production callers)
// ============================================================================

/** @internal — reset module state for unit tests. */
export function __resetPublisherForTesting(): void {
  if (singleton?.conn) {
    singleton.conn.close().catch(() => undefined);
  }
  singleton = null;
  shutdownRegistered = false;
}

/** @internal — inspect publisher state in unit tests. */
export function __getPublisherStateForTesting(): {
  state: PublisherState;
  queueLength: number;
} | null {
  if (!singleton) return null;
  return { state: singleton.state, queueLength: singleton.queue.length };
}
