'use client';

/**
 * ErrorRecoveryPage — full-page fallback for critical / page-blocking errors.
 *
 * Shows a centered panel with:
 *  - Large severity icon
 *  - Chinese title + multi-line description
 *  - Numbered recovery steps
 *  - Action buttons (retry, go home, check status)
 *  - Subtle error code + timestamp footer
 *
 * Intended to replace the entire page content when an error makes the page
 * unusable (e.g. database down, auth failure, render crash).
 *
 * @module components/ui/error-recovery-page
 */

import { useRouter } from 'next/navigation';
import type { AppError, RecoveryAction } from '@/lib/errors/error-types';
import { cn } from '@/lib/utils';

// =============================================================================
// Props
// =============================================================================

interface ErrorRecoveryPageProps {
  /** The error to display. */
  error: AppError;
  /** Override default action handlers. */
  onAction?: (action: RecoveryAction) => void;
  /** Additional CSS classes for the outer wrapper. */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ErrorRecoveryPage({
  error,
  onAction,
  className,
}: ErrorRecoveryPageProps) {
  const router = useRouter();

  function handleAction(action: RecoveryAction) {
    if (onAction) {
      onAction(action);
      return;
    }
    if (action.type === 'navigate' && action.href) {
      router.push(action.href);
    }
    if (action.type === 'retry') {
      window.location.reload();
    }
    if (action.onClick) {
      action.onClick();
    }
  }

  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={cn(
        'min-h-[60vh] flex items-center justify-center p-6',
        className,
      )}
    >
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Large icon */}
        <div className="flex justify-center">
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center',
              error.severity === 'error'
                ? 'bg-loss/10'
                : error.severity === 'warning'
                  ? 'bg-yellow-500/10'
                  : 'bg-accent/10',
            )}
          >
            <LargeIcon severity={error.severity} />
          </div>
        </div>

        {/* Title */}
        <h1
          className={cn(
            'text-xl font-bold',
            error.severity === 'error'
              ? 'text-loss'
              : error.severity === 'warning'
                ? 'text-yellow-400'
                : 'text-accent',
          )}
        >
          {error.title}
        </h1>

        {/* Description */}
        <p className="text-sm text-white/60 leading-relaxed max-w-md mx-auto">
          {error.description}
        </p>

        {/* Recovery steps */}
        <div className="text-left mx-auto max-w-sm space-y-2 text-sm text-white/50">
          <p className="text-white/70 font-medium">你可以尝试:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1">
            {error.recoveryActions.map((action, i) => (
              <li key={i}>{getStepText(action)}</li>
            ))}
            {error.recoveryActions.length === 0 && (
              <li>刷新页面重试</li>
            )}
          </ol>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          {error.recoveryActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleAction(action)}
              className={cn(
                'px-5 py-2.5 rounded-lg font-medium text-sm transition-all btn-tactile',
                i === 0
                  ? 'bg-accent text-primary-600 hover:bg-accent/90 shadow-lg shadow-accent/20'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10',
              )}
            >
              {action.label}
            </button>
          ))}
          {error.recoveryActions.length === 0 && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg font-medium text-sm bg-accent text-primary-600 hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all btn-tactile"
            >
              刷新页面
            </button>
          )}
        </div>

        {/* Footer: error code + timestamp */}
        <div className="pt-4 space-y-1">
          <p className="text-[11px] font-mono text-white/20">
            错误代码: {error.code}
          </p>
          <p className="text-[11px] font-mono text-white/20">
            时间: {timestamp}
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getStepText(action: RecoveryAction): string {
  switch (action.type) {
    case 'retry':
      return `点击"${action.label}"重试操作`;
    case 'navigate':
      return `前往${action.label}`;
    case 'dismiss':
      return '关闭此提示';
    case 'custom':
      return action.label;
  }
}

function LargeIcon({ severity }: { severity: AppError['severity'] }) {
  const color =
    severity === 'error'
      ? 'text-loss'
      : severity === 'warning'
        ? 'text-yellow-400'
        : 'text-accent';

  if (severity === 'error') {
    return (
      <svg className={cn('w-10 h-10', color)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    );
  }

  if (severity === 'warning') {
    return (
      <svg className={cn('w-10 h-10', color)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  return (
    <svg className={cn('w-10 h-10', color)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default ErrorRecoveryPage;
