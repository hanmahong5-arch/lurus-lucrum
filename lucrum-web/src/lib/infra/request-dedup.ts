/**
 * Deduplicates identical concurrent API requests.
 * If a request with the same key is already in flight, returns
 * the same Promise instead of creating a new request.
 *
 * Useful for: stock search, market data, sector lists
 * NOT useful for: mutations (backtest, orders, saves)
 */

const pending = new Map<string, Promise<unknown>>();

export async function dedupRequest<T>(
  key: string,
  factory: () => Promise<T>
): Promise<T> {
  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = factory().finally(() => {
    pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
}
