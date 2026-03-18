/**
 * Memorus REST API client for lucrum-web.
 *
 * Mirrors the quota-check.ts pattern: fail-open on timeout/error,
 * never throws, gracefully degrades when service is unavailable.
 *
 * Config env vars:
 *   MEMORUS_SERVICE_URL  — e.g. http://memorus.lurus-system.svc.cluster.local:8880
 *   MEMORUS_API_KEY      — X-API-Key header value
 */

const MEMORUS_URL = (process.env.MEMORUS_SERVICE_URL ?? '').replace(/\/$/, '');
const MEMORUS_KEY = process.env.MEMORUS_API_KEY ?? '';

/** Request timeout for all memorus calls (ms). */
const MEMORUS_TIMEOUT_MS = 1_500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryResult {
  id: string;
  memory: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search memories relevant to a query for a given user.
 * Returns an empty array if memorus is unconfigured or unreachable.
 */
export async function searchMemories(
  userId: string,
  query: string,
  limit = 5,
): Promise<MemoryResult[]> {
  if (!MEMORUS_URL || !MEMORUS_KEY) return [];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), MEMORUS_TIMEOUT_MS);
  try {
    const url = new URL(`${MEMORUS_URL}/memories/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('user_id', userId);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      headers: { 'X-API-Key': MEMORUS_KEY },
      cache: 'no-store',
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const data = (await res.json()) as { results?: MemoryResult[] };
    return data.results ?? [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

/**
 * Store a memory entry for a user. Fire-and-forget — never awaited.
 *
 * @param userId  Zitadel sub (same as quota system)
 * @param content Plain-text content; ACE reflector distills it automatically
 * @param scope   Memory scope; defaults to "project:lucrum"
 */
export function addMemory(
  userId: string,
  content: string,
  scope = 'project:lucrum',
): void {
  if (!MEMORUS_URL || !MEMORUS_KEY) return;

  void fetch(`${MEMORUS_URL}/memories`, {
    method: 'POST',
    headers: {
      'X-API-Key': MEMORUS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, user_id: userId, metadata: { scope } }),
    cache: 'no-store',
  }).catch((err: unknown) => {
    console.error('[memorus] addMemory failed:', err);
  });
}

/**
 * Format retrieved memories into a system prompt section.
 * Returns an empty string if memories array is empty.
 */
export function buildMemoryPromptSection(memories: MemoryResult[]): string {
  if (memories.length === 0) return '';

  const bullets = memories
    .filter(m => m.memory && m.memory.trim().length > 0)
    .map(m => `- ${m.memory.trim()}`)
    .join('\n');

  if (!bullets) return '';

  return `\n\n## 用户历史偏好与记忆\n以下是该用户在过往对话中积累的投资偏好，请在回答时参考：\n${bullets}`;
}
