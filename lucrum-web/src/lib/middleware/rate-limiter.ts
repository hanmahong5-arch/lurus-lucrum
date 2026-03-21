/**
 * Simple in-memory rate limiter for backtest endpoints.
 * Uses a sliding window counter per user (by IP or session).
 *
 * Limits:
 *   - Single stock backtest: 30/minute (light)
 *   - Sector backtest: 5/minute (heavy)
 *   - Portfolio backtest: 3/minute (heaviest)
 *   - Strategy recommend: 5/minute (heavy)
 *   - Quick preview: no limit (runs in browser)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  backtest: {
    windowMs: 60_000,
    maxRequests: 30,
    message: '回测请求过于频繁，请稍后再试 (每分钟最多30次)',
  },
  sector: {
    windowMs: 60_000,
    maxRequests: 5,
    message: '板块回测请求过于频繁，请稍后再试 (每分钟最多5次)',
  },
  portfolio: {
    windowMs: 60_000,
    maxRequests: 3,
    message: '组合回测请求过于频繁，请稍后再试 (每分钟最多3次)',
  },
  recommend: {
    windowMs: 60_000,
    maxRequests: 5,
    message: '策略推荐请求过于频繁，请稍后再试 (每分钟最多5次)',
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitEndpoint = keyof typeof RATE_LIMITS;

// ─── In-memory window store ───────────────────────────────────────────────────

// Key format: `${endpoint}:${identifier}` (identifier is IP or user ID)
const windows = new Map<string, WindowEntry>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether a request from the given identifier is within rate limits.
 *
 * @param endpoint  Which rate limit tier to apply
 * @param identifier  IP address or user ID for per-user tracking
 * @returns  Object with `allowed`, `remaining`, and optional `retryAfter` (seconds)
 */
export function checkRateLimit(
  endpoint: RateLimitEndpoint,
  identifier: string,
): RateLimitResult {
  const config = RATE_LIMITS[endpoint];
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();

  let window = windows.get(key);
  if (!window || now > window.resetAt) {
    window = { count: 0, resetAt: now + config.windowMs };
    windows.set(key, window);
  }

  window.count++;

  if (window.count > config.maxRequests) {
    const retryAfter = Math.ceil((window.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: config.maxRequests - window.count };
}

/**
 * Extract a client identifier from a Next.js request.
 * Prefers x-forwarded-for (set by reverse proxy), falls back to x-real-ip,
 * then to a generic "unknown" value.
 */
export function getClientIdentifier(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}

// ─── Periodic cleanup (every 5 min) ──────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 300_000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  windows.forEach((_window, key) => {
    if (now > _window.resetAt) {
      windows.delete(key);
    }
  });
}, CLEANUP_INTERVAL_MS);

// Allow Node.js process to exit without waiting for the timer
if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
  cleanupTimer.unref();
}
