'use client';

/**
 * ErrorCard - Renders a structured error with actionable recovery buttons.
 *
 * Replaces generic "Something went wrong" with context-specific guidance.
 * Follows the design system: bg-surface, border-border, semantic colors.
 */

import { useRouter } from 'next/navigation';
import type { AppError, RecoveryAction } from '@/lib/errors/error-types';
import { cn } from '@/lib/utils';

interface ErrorCardProps {
  error: AppError;
  /** Additional CSS classes for the container */
  className?: string;
  /** Override default action handlers */
  onAction?: (action: RecoveryAction) => void;
  /** Compact mode — single line for inline use */
  compact?: boolean;
}

const SEVERITY_STYLES = {
  error: {
    border: 'border-loss/30',
    bg: 'bg-loss/5',
    icon: 'text-loss',
    title: 'text-loss',
  },
  warning: {
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
    icon: 'text-yellow-400',
    title: 'text-yellow-400',
  },
  info: {
    border: 'border-accent/30',
    bg: 'bg-accent/5',
    icon: 'text-accent',
    title: 'text-accent',
  },
} as const;

function SeverityIcon({ severity }: { severity: AppError['severity'] }) {
  if (severity === 'error') {
    return (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    );
  }
  if (severity === 'warning') {
    return (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function ErrorCard({ error, className, onAction, compact = false }: ErrorCardProps) {
  const router = useRouter();
  const styles = SEVERITY_STYLES[error.severity];

  function handleAction(action: RecoveryAction) {
    if (onAction) {
      onAction(action);
      return;
    }
    if (action.type === 'navigate' && action.href) {
      if (typeof window !== 'undefined') {
        router.push(action.href);
      }
    }
    if (action.onClick) {
      action.onClick();
    }
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs', styles.bg, styles.border, 'border', className)}>
        <span className={styles.icon}>
          <SeverityIcon severity={error.severity} />
        </span>
        <span className="text-white/70 flex-1 min-w-0 truncate">{error.description}</span>
        {error.recoveryActions.slice(0, 1).map((action, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleAction(action)}
            className={cn('text-xs font-medium px-2 py-1 rounded transition flex-shrink-0', styles.title, 'hover:bg-white/5')}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border p-4', styles.bg, styles.border, className)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className={styles.icon}>
          <SeverityIcon severity={error.severity} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className={cn('text-sm font-medium', styles.title)}>{error.title}</h3>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">{error.description}</p>
        </div>
      </div>

      {/* Recovery Actions */}
      {error.recoveryActions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pl-8">
          {error.recoveryActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleAction(action)}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-lg border transition btn-tactile',
                i === 0
                  ? `${styles.title} border-current/20 bg-white/5 hover:bg-white/10`
                  : 'text-white/50 border-white/10 hover:text-white/70 hover:bg-white/5',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Error code (subtle) */}
      {error.code && (
        <div className="mt-2 pl-8">
          <span className="text-[10px] text-white/20 font-mono">{error.code}</span>
        </div>
      )}
    </div>
  );
}
