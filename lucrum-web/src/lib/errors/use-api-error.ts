/**
 * useApiError — single entry point for handling failed API calls.
 *
 * Why it exists: prior to this hook every component had its own try/catch
 * mapping HTTP status to toast / redirect / paywall, with inconsistent copy
 * and missing recovery actions. This hook routes the four categories that
 * matter to UX consistency:
 *
 *   401 / auth-expired → toast + jump to sign-in
 *   402 / quota / 'QUOTA_EXCEEDED' → toast + opts.onPaywall?.()
 *   429 / rate-limited → warning toast (carries Retry-After when present)
 *   anything else → error toast using parsed title from parseApiError
 *
 * Components keep their own try/catch but replace the body with a single
 * `handleApiError(err)` call. The helper returns the AppError so callers
 * that also want to render an inline ErrorCard can do so.
 *
 * @module lib/errors/use-api-error
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/lib/toast';
import { parseApiError, toAppError, type AppError } from './error-types';

export interface UseApiErrorOptions {
  /**
   * Called on 402 / quota-exceeded responses so the page can open its
   * local paywall dialog. If omitted, the helper falls back to a toast
   * with an upgrade link.
   */
  readonly onPaywall?: () => void;
  /**
   * Called on 401 responses. If omitted, the helper redirects to
   * /api/auth/signin after a short toast.
   */
  readonly onAuthRequired?: () => void;
}

export interface ApiErrorContext {
  /** The Response object (if the error came from a failed fetch). */
  readonly response?: Response;
  /** A caught exception (network error, JSON parse error, etc.). */
  readonly error?: unknown;
}

const QUOTA_CODES = new Set([
  'QUOTA_EXCEEDED',
  'PAYWALL_REQUIRED',
  'PAYMENT_REQUIRED',
  'INSUFFICIENT_QUOTA',
  'PLAN_LIMIT',
]);

export function useApiError(opts?: UseApiErrorOptions) {
  const router = useRouter();
  const { onPaywall, onAuthRequired } = opts ?? {};

  return useCallback(
    async (ctx: ApiErrorContext): Promise<AppError> => {
      const { response, error } = ctx;

      // ── Failed Response branch ────────────────────────────────────────
      if (response) {
        const appErr = await parseApiError(response);
        const status = response.status;

        if (status === 401) {
          showToast.warning('登录已过期，请重新登录', { duration: 4000 });
          if (onAuthRequired) {
            onAuthRequired();
          } else {
            // Defer slightly so the user sees the toast before navigating.
            setTimeout(() => {
              router.push('/api/auth/signin');
            }, 600);
          }
          return appErr;
        }

        if (status === 402 || QUOTA_CODES.has(appErr.code)) {
          if (onPaywall) {
            onPaywall();
            // Toast still useful for context but kept short — paywall is the
            // primary surface; we don't want to compete with it.
            showToast.warning(appErr.title || '配额已用完', { duration: 3000 });
          } else {
            showToast.warning(appErr.title || '配额已用完', {
              description: appErr.description,
              action: {
                label: '查看套餐',
                onClick: () => router.push('/pricing'),
              },
            });
          }
          return appErr;
        }

        if (status === 429) {
          // parseApiError already extracts Retry-After + builds title/description.
          showToast.warning(appErr.title, { description: appErr.description });
          return appErr;
        }

        showToast.error(appErr.title, { description: appErr.description });
        return appErr;
      }

      // ── Caught exception branch (network failure, etc.) ───────────────
      const appErr = toAppError(error);
      showToast.error(appErr.title, { description: appErr.description });
      return appErr;
    },
    [router, onPaywall, onAuthRequired],
  );
}
