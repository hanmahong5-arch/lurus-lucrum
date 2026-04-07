/**
 * User-scoped storage key utilities (client-safe, no server dependencies)
 *
 * These functions are intentionally in a separate file from with-user.ts
 * to avoid pulling server-only dependencies (ioredis, etc.) into client bundles.
 */

/**
 * Generate a user-scoped storage key for isolating data per user
 *
 * @param baseKey - The base storage key
 * @param userId - The user's unique identifier
 * @returns A user-scoped key
 *
 * @example
 * ```typescript
 * const key = getUserScopedKey("strategy-workspace", userId);
 * // Returns: "lucrum:user123:strategy-workspace"
 * ```
 */
export function getUserScopedKey(baseKey: string, userId: string): string {
  return `lucrum:${userId}:${baseKey}`;
}

/**
 * Parse a user-scoped storage key to extract the base key and user ID
 *
 * @param scopedKey - The user-scoped key
 * @returns Object with baseKey and userId, or null if invalid
 */
export function parseUserScopedKey(
  scopedKey: string
): { baseKey: string; userId: string } | null {
  const match = scopedKey.match(/^lucrum:([^:]+):(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { userId: match[1], baseKey: match[2] };
}
