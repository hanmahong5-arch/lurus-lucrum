'use client';

/**
 * DisabledWithReason - Wraps a button/element, showing a tooltip when disabled.
 *
 * Instead of a greyed-out button with no explanation, the user sees
 * a brief Chinese-language reason on hover/focus explaining WHY it is disabled,
 * and optionally what action would enable it.
 *
 * Uses Radix UI Tooltip for accessible hover/focus behavior.
 */

import { type ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

// =============================================================================
// Props
// =============================================================================

interface DisabledWithReasonProps {
  /** Whether the wrapped element is disabled */
  disabled: boolean;
  /** Chinese-language reason shown when disabled (e.g. "请先选择股票") */
  reason?: string;
  /** Actionable hint for how to enable it (e.g. "去选择 ->") */
  action?: string;
  /** Optional link for the action hint */
  actionHref?: string;
  /** The child element to wrap (typically a button) */
  children: ReactNode;
  /** Extra class on the outer wrapper */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function DisabledWithReason({
  disabled,
  reason,
  action,
  actionHref,
  children,
  className,
}: DisabledWithReasonProps) {
  // When not disabled, render children directly with no wrapper overhead
  if (!disabled) {
    return <>{children}</>;
  }

  // When disabled but no reason provided, just dim the element
  if (!reason) {
    return (
      <span className={cn('relative inline-flex', className)}>
        <span className="opacity-50 pointer-events-none">{children}</span>
        <span className="absolute inset-0 cursor-not-allowed" aria-hidden="true" />
      </span>
    );
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={cn('relative inline-flex', className)}>
            {/* Dimmed, non-interactive children */}
            <span className="opacity-50 pointer-events-none">{children}</span>
            {/* Invisible overlay to capture hover when children are pointer-events-none */}
            <span className="absolute inset-0 cursor-not-allowed" aria-hidden="true" />
          </span>
        </Tooltip.Trigger>

        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={8}
            className={cn(
              'z-50 rounded-lg bg-surface border border-border shadow-lg text-xs text-left',
              'animate-in fade-in-0 zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              action ? 'w-56 px-3 py-2' : 'whitespace-nowrap px-3 py-2',
            )}
            role="tooltip"
          >
            <span className="block text-white/70">{reason}</span>

            {action && (
              <span className="block mt-1.5 pt-1.5 border-t border-white/5">
                {actionHref ? (
                  <a
                    href={actionHref}
                    className="text-accent hover:text-accent/80 transition"
                  >
                    {action}
                  </a>
                ) : (
                  <span className="text-accent/70">{action}</span>
                )}
              </span>
            )}

            <Tooltip.Arrow className="fill-surface" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
