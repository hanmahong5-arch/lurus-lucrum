'use client';

/**
 * SmartTooltip - Contextual financial term explanations via Radix Tooltip.
 *
 * Renders an inline label with optional help icon. On hover, a rich
 * explanation card appears with term name, description, "why it matters",
 * and optional suggested range.
 *
 * Supports two modes:
 * 1. `termKey` - looks up from the FINANCIAL_TERMS dictionary
 * 2. Explicit `term`/`explanation`/`whyItMatters` props
 *
 * Uses Radix UI Tooltip for accessible hover/focus behavior.
 */

import { type ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FINANCIAL_TERMS,
  type FinancialTermEntry,
} from '@/lib/i18n/financial-terms';

// =============================================================================
// Props
// =============================================================================

interface SmartTooltipProps {
  /** Key in FINANCIAL_TERMS dictionary */
  termKey?: string;
  /** Explicit term name (overrides dictionary) */
  term?: string;
  /** Explicit explanation (overrides dictionary) */
  explanation?: string;
  /** Explicit "why it matters" hint (overrides dictionary) */
  whyItMatters?: string;
  /** Explicit suggested range (overrides dictionary) */
  suggestedRange?: string;
  /** Trigger element; falls back to term label if omitted */
  children: ReactNode;
  /** Show a small ? icon next to children (default: true) */
  showIcon?: boolean;
  /** Extra class on the trigger wrapper */
  className?: string;
}

// =============================================================================
// Tooltip content delay (ms)
// =============================================================================

const OPEN_DELAY_MS = 300;
const SKIP_DELAY_MS = 150;

// =============================================================================
// Component
// =============================================================================

export function SmartTooltip({
  termKey,
  term,
  explanation,
  whyItMatters,
  suggestedRange,
  children,
  showIcon = true,
  className,
}: SmartTooltipProps) {
  // Resolve dictionary entry: termKey takes priority, then fall back to term
  // (backward compat: existing callers pass dictionary keys via `term` prop)
  const dictKey = termKey ?? term;
  const entry: FinancialTermEntry | undefined = dictKey
    ? FINANCIAL_TERMS[dictKey]
    : undefined;

  // Merge explicit props with dictionary fallback
  const resolvedTerm = entry?.term ?? term;
  const resolvedExplanation = explanation ?? entry?.explanation;
  const resolvedWhy = whyItMatters ?? entry?.whyItMatters;
  const resolvedRange = suggestedRange ?? entry?.suggestedRange;

  // If no explanation available, render children without tooltip
  if (!resolvedExplanation) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Tooltip.Provider delayDuration={OPEN_DELAY_MS} skipDelayDuration={SKIP_DELAY_MS}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 cursor-help',
              className,
            )}
            tabIndex={0}
          >
            {children}
            {showIcon && (
              <HelpCircle
                className="w-3 h-3 text-white/20 shrink-0"
                aria-hidden="true"
              />
            )}
          </span>
        </Tooltip.Trigger>

        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={8}
            className={cn(
              'z-50 w-64 p-3 rounded-lg',
              'bg-surface border border-border shadow-lg',
              'text-left',
              'animate-in fade-in-0 zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            )}
          >
            {/* Term name */}
            {resolvedTerm && (
              <span className="block text-xs font-medium text-accent mb-1">
                {resolvedTerm}
              </span>
            )}

            {/* Explanation */}
            <span className="block text-[11px] text-white/70 leading-relaxed">
              {resolvedExplanation}
            </span>

            {/* Why it matters */}
            {resolvedWhy && (
              <span className="block mt-1.5 pt-1.5 border-t border-white/5">
                <span className="block text-[10px] text-white/30 mb-0.5">
                  为什么重要
                </span>
                <span className="block text-[11px] text-white/60 leading-relaxed">
                  {resolvedWhy}
                </span>
              </span>
            )}

            {/* Suggested range */}
            {resolvedRange && (
              <span className="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-white/5">
                <span className="text-[10px] text-white/30">建议范围</span>
                <span className="text-[10px] font-mono tabular-nums text-accent/70">
                  {resolvedRange}
                </span>
              </span>
            )}

            <Tooltip.Arrow className="fill-surface" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// =============================================================================
// Convenience wrapper: dictionary-driven (by key)
// =============================================================================

interface SmartTooltipTermProps {
  /** Dictionary key from FINANCIAL_TERMS, e.g. "sharpe" */
  termKey: string;
  /** Trigger element */
  children: ReactNode;
  /** Additional className */
  className?: string;
  /** Show help icon (default: true) */
  showIcon?: boolean;
}

/**
 * Convenience wrapper that looks up the term from the financial dictionary by key.
 * If the key is not found, renders children without tooltip.
 */
export function SmartTooltipTerm({
  termKey,
  children,
  className,
  showIcon,
}: SmartTooltipTermProps) {
  return (
    <SmartTooltip termKey={termKey} showIcon={showIcon} className={className}>
      {children}
    </SmartTooltip>
  );
}

// =============================================================================
// Utility
// =============================================================================

/**
 * Get tooltip data for a metric key without rendering a component.
 */
export function getFinancialTermInfo(term: string) {
  return FINANCIAL_TERMS[term] ?? null;
}
