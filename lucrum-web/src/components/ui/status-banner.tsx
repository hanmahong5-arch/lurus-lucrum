'use client';

/**
 * StatusBanner — persistent banner for long-running operations.
 *
 * Renders at the top of a content area (not fixed-position) to show progress
 * for backtest runs, sector scans, data imports, etc.
 *
 * States:
 *  - running  (blue): animated progress bar, cancel button
 *  - success  (green): auto-dismiss after 3 seconds
 *  - warning  (yellow): sticky, needs user acknowledgment
 *  - error    (red): sticky, shows recovery actions
 *
 * @module components/ui/status-banner
 */

import { useEffect, useState, useCallback } from 'react';
import type { AppError, RecoveryAction } from '@/lib/errors/error-types';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type BannerState = 'running' | 'success' | 'warning' | 'error';

export interface StatusBannerProps {
  /** Current state of the operation. */
  state: BannerState;
  /** Primary message (e.g. "板块回测进行中"). */
  title: string;
  /** Secondary detail (e.g. "当前: 000858 五粮液"). */
  detail?: string;
  /** Progress fraction 0-100 (only relevant for 'running' state). */
  progress?: number;
  /** Estimated time remaining (e.g. "预计剩余: 45秒"). */
  eta?: string;
  /** AppError to show recovery actions for 'error' state. */
  error?: AppError;
  /** Called when the user cancels the operation. */
  onCancel?: () => void;
  /** Called when the banner is dismissed (success auto-dismiss or manual). */
  onDismiss?: () => void;
  /** Override default action handlers for error state. */
  onAction?: (action: RecoveryAction) => void;
  /** Auto-dismiss success after N ms. Default: 3000. Set 0 to disable. */
  successDismissMs?: number;
  /** Additional CSS classes. */
  className?: string;
}

// =============================================================================
// State visual config
// =============================================================================

const STATE_STYLES: Record<BannerState, { bg: string; border: string; text: string; bar: string }> = {
  running: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    text: 'text-blue-300',
    bar: 'bg-blue-500',
  },
  success: {
    bg: 'bg-step-done/5',
    border: 'border-step-done/20',
    text: 'text-step-done',
    bar: 'bg-step-done',
  },
  warning: {
    bg: 'bg-yellow-500/5',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    bar: 'bg-yellow-400',
  },
  error: {
    bg: 'bg-loss/5',
    border: 'border-loss/20',
    text: 'text-loss',
    bar: 'bg-loss',
  },
};

// =============================================================================
// Component
// =============================================================================

export function StatusBanner({
  state,
  title,
  detail,
  progress,
  eta,
  error,
  onCancel,
  onDismiss,
  onAction,
  successDismissMs = 3000,
  className,
}: StatusBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss on success
  useEffect(() => {
    if (state === 'success' && successDismissMs > 0) {
      const timer = setTimeout(() => {
        setDismissed(true);
        onDismiss?.();
      }, successDismissMs);
      return () => clearTimeout(timer);
    }
    // Reset dismissed when state changes
    setDismissed(false);
    return undefined;
  }, [state, successDismissMs, onDismiss]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const handleAction = useCallback(
    (action: RecoveryAction) => {
      if (onAction) {
        onAction(action);
      } else if (action.onClick) {
        action.onClick();
      }
    },
    [onAction],
  );

  if (dismissed) return null;

  const styles = STATE_STYLES[state];
  const safeProgress = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-lg border p-3',
        styles.bg,
        styles.border,
        'animate-slide-down',
        className,
      )}
    >
      {/* Progress bar (running state only) */}
      {state === 'running' && typeof progress === 'number' && (
        <div className="h-1 w-full rounded-full bg-white/5 mb-2 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', styles.bar)}
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* State icon */}
        <StateIcon state={state} className={styles.text} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className={cn('text-sm font-medium', styles.text)}>
              {title}
            </p>
            {state === 'running' && typeof progress === 'number' && (
              <span className="text-xs font-mono text-white/40 tabular-nums">
                ({Math.round(safeProgress)}%)
              </span>
            )}
          </div>
          {detail && (
            <p className="text-xs text-white/50 mt-0.5 truncate">{detail}</p>
          )}
          {eta && state === 'running' && (
            <p className="text-xs text-white/30 mt-0.5 font-mono tabular-nums">{eta}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Error state: show recovery actions */}
          {state === 'error' && error && error.recoveryActions.slice(0, 2).map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleAction(action)}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-md transition btn-tactile',
                i === 0
                  ? `${styles.text} bg-white/5 hover:bg-white/10 border border-current/20`
                  : 'text-white/50 hover:text-white/70 hover:bg-white/5',
              )}
            >
              {action.label}
            </button>
          ))}

          {/* Running state: cancel button */}
          {state === 'running' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium text-white/50 hover:text-white/70 px-3 py-1.5 rounded-md hover:bg-white/5 transition"
            >
              取消
            </button>
          )}

          {/* Warning / success: dismiss */}
          {(state === 'warning' || state === 'success') && (
            <button
              type="button"
              onClick={handleDismiss}
              className="text-white/30 hover:text-white/60 p-1 transition"
              aria-label="关闭"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// State icon
// =============================================================================

function StateIcon({ state, className }: { state: BannerState; className?: string }) {
  if (state === 'running') {
    return (
      <svg className={cn('w-5 h-5 animate-spin flex-shrink-0', className)} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    );
  }

  if (state === 'success') {
    return (
      <svg className={cn('w-5 h-5 flex-shrink-0', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (state === 'warning') {
    return (
      <svg className={cn('w-5 h-5 flex-shrink-0', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    );
  }

  // error
  return (
    <svg className={cn('w-5 h-5 flex-shrink-0', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default StatusBanner;
