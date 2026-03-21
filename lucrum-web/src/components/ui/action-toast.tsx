'use client';

/**
 * ActionToast - A transient notification with actionable buttons.
 *
 * Appears at the bottom of the viewport and auto-dismisses after a timeout.
 * Supports error, warning, info, and success severities.
 */

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { AppError, RecoveryAction } from '@/lib/errors/error-types';
import { cn } from '@/lib/utils';

interface ActionToastProps {
  error: AppError | null;
  /** Auto-dismiss after this many milliseconds (0 = manual only) */
  autoHideMs?: number;
  /** Called when the toast is dismissed */
  onDismiss?: () => void;
  /** Override default action handlers */
  onAction?: (action: RecoveryAction) => void;
}

const SEVERITY_BG = {
  error: 'bg-loss/90 border-loss/40',
  warning: 'bg-yellow-600/90 border-yellow-500/40',
  info: 'bg-accent/90 border-accent/40',
} as const;

/**
 * Show an actionable toast via the sonner toast system (the <ToastSystem> in layout).
 *
 * This is the recommended imperative API for showing error toasts from event
 * handlers, fetch callbacks, etc. The toast will render inline within the
 * existing sonner container (bottom-right, max 3 visible).
 *
 * Dismiss policy:
 *  - info:    auto-dismiss 5s
 *  - warning: auto-dismiss 8s
 *  - error:   sticky — user must interact
 *
 * @example
 * ```ts
 * import { showActionToast } from '@/components/ui/action-toast';
 * import { ErrorCatalog } from '@/lib/errors';
 *
 * showActionToast(ErrorCatalog.networkOffline(), {
 *   onAction: (action) => { if (action.type === 'retry') refetch(); },
 * });
 * ```
 */
export function showActionToast(
  error: AppError,
  opts?: {
    onAction?: (action: RecoveryAction) => void;
    duration?: number;
  },
): string | number {
  const DISMISS_MS: Record<AppError['severity'], number> = {
    info: 5_000,
    warning: 8_000,
    error: Infinity,
  };
  const duration = opts?.duration ?? DISMISS_MS[error.severity];

  return toast(error.title, {
    description: error.description,
    duration,
    closeButton: true,
    action: error.recoveryActions[0]
      ? {
          label: error.recoveryActions[0].label,
          onClick: () => {
            const action = error.recoveryActions[0]!;
            if (opts?.onAction) {
              opts.onAction(action);
            } else if (action.type === 'navigate' && action.href) {
              window.location.href = action.href;
            } else if (action.onClick) {
              action.onClick();
            }
          },
        }
      : undefined,
  });
}

/**
 * ActionToast component — standalone positioned toast with action buttons.
 *
 * Use this as a controlled React component when you need a toast that is NOT
 * managed by sonner (e.g. in contexts where the sonner Toaster is not mounted).
 * For most cases, prefer `showActionToast()` instead.
 */
export function ActionToast({ error, autoHideMs = 6000, onDismiss, onAction }: ActionToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setVisible(true);
      if (autoHideMs > 0) {
        const timer = setTimeout(() => {
          setVisible(false);
          onDismiss?.();
        }, autoHideMs);
        return () => clearTimeout(timer);
      }
      return undefined;
    }
    setVisible(false);
    return undefined;
  }, [error, autoHideMs, onDismiss]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleAction = useCallback((action: RecoveryAction) => {
    if (onAction) {
      onAction(action);
    } else if (action.onClick) {
      action.onClick();
    }
    handleDismiss();
  }, [onAction, handleDismiss]);

  if (!visible || !error) return null;

  const bgStyle = SEVERITY_BG[error.severity] ?? SEVERITY_BG.error;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm',
        'max-w-lg w-[calc(100vw-2rem)] animate-slide-up',
        bgStyle,
      )}
      role="alert"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{error.title}</p>
        <p className="text-xs text-white/70 mt-0.5 truncate">{error.description}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {error.recoveryActions.slice(0, 2).map((action, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleAction(action)}
            className="text-xs font-medium text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition btn-tactile"
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleDismiss}
          className="text-white/50 hover:text-white transition p-1"
          aria-label="关闭"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
