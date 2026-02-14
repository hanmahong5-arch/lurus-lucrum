"use client";

/**
 * AI Insight Sidebar Component
 *
 * Split-mode sidebar that embeds the AdvisorChat with contextual information
 * from backtest results or stock validation. Opens from the right side,
 * preserving the main content on the left.
 *
 * Features:
 * - Slide-in animation from right
 * - Context-aware: receives backtest or stock context
 * - Pre-filled questions for stock-level triggers
 * - AI visual language (purple theme, border accent)
 * - Accessible: ARIA labels, keyboard close (Escape)
 * - Respects prefers-reduced-motion
 *
 * @module components/advisor/ai-insight-sidebar
 */

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAiSidebarStore } from "@/lib/stores/ai-sidebar-store";
import { AdvisorChat } from "./advisor-chat";

// =============================================================================
// CONSTANTS
// =============================================================================

const SIDEBAR_WIDTH = "w-[420px]";
const ESCAPE_KEY = "Escape";

// =============================================================================
// COMPONENT
// =============================================================================

export function AiInsightSidebar() {
  const { isOpen, context, metadata, preFilledQuestion, questionContext, close } =
    useAiSidebarStore();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === ESCAPE_KEY && isOpen) {
        close();
      }
    },
    [isOpen, close]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Focus trap: focus sidebar when it opens
  useEffect(() => {
    if (isOpen && sidebarRef.current) {
      sidebarRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={sidebarRef}
      data-testid="ai-insight-sidebar"
      role="complementary"
      aria-label="AI Insight Panel"
      tabIndex={-1}
      className={cn(
        // Layout
        "fixed right-0 top-0 h-full z-50",
        SIDEBAR_WIDTH,
        // Visual styling with AI theme
        "bg-surface border-l border-ai-border",
        "shadow-card-lg",
        // Animation
        "animate-slide-in-right motion-reduce:animate-none",
        // Flex for internal layout
        "flex flex-col"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ai-border bg-ai-bg">
        <div className="flex items-center gap-2">
          {/* AI icon indicator */}
          <div className="w-2 h-2 rounded-full bg-ai animate-ai-pulse motion-reduce:animate-none" />
          <span className="text-ai font-semibold text-sm">AI Insight</span>
          {metadata?.stockInfo && (
            <span className="text-neutral-400 text-xs truncate max-w-[180px]">
              {metadata.stockInfo}
            </span>
          )}
        </div>
        <button
          onClick={close}
          aria-label="Close AI Insight Panel"
          className={cn(
            "p-1.5 rounded-md transition-colors",
            "text-neutral-400 hover:text-white hover:bg-surface-hover",
            "focus:outline-none focus:ring-2 focus:ring-ai/50"
          )}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Context summary (if available) */}
      {metadata?.backtestSummary && (
        <div className="px-4 py-2 border-b border-surface-border bg-surface-elevated text-xs text-neutral-400">
          <div className="flex items-center gap-1.5 mb-1">
            <svg
              className="w-3 h-3 text-ai"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-neutral-300 font-medium">Context</span>
          </div>
          <p className="truncate">{metadata.backtestSummary}</p>
        </div>
      )}

      {/* Pre-filled question banner (for stock-level triggers) */}
      {preFilledQuestion && (
        <div className="px-4 py-2 border-b border-surface-border bg-ai-bg">
          <p className="text-xs text-ai truncate">{preFilledQuestion}</p>
        </div>
      )}

      {/* Advisor Chat (takes remaining space) */}
      <div className="flex-1 overflow-hidden">
        <AdvisorChat
          className="h-full"
          initialContext={context ?? undefined}
          questionContext={questionContext}
        />
      </div>
    </div>
  );
}

export default AiInsightSidebar;
