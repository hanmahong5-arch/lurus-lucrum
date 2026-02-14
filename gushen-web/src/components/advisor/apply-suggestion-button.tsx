"use client";

/**
 * Apply Suggestion Button Component
 *
 * Renders a structured AI parameter suggestion card with:
 * - Display text (what to change)
 * - Rationale (why)
 * - Expected impact (what happens)
 * - One-click apply button with state machine
 * - Optional re-run backtest prompt after applying
 *
 * Uses AI visual language (ai-mark) for consistent styling.
 *
 * @module components/advisor/apply-suggestion-button
 */

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";
import { useStrategyWorkspaceStore } from "@/lib/stores/strategy-workspace-store";
import type { AiSuggestion } from "@/lib/advisor/suggestion-parser";

// =============================================================================
// TYPES
// =============================================================================

type ButtonState = "default" | "applying" | "applied";

interface ApplySuggestionButtonProps {
  /** The parsed suggestion to display and apply */
  suggestion: AiSuggestion;
  /** Callback after suggestion is applied (optional) */
  onApply?: (suggestion: AiSuggestion) => void;
  /** Callback to trigger backtest re-run (optional) */
  onRerunBacktest?: () => void;
  /** Additional CSS class */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Delay before resetting applied state back to default (ms) */
const APPLIED_RESET_DELAY_MS = 1200;

// =============================================================================
// COMPONENT
// =============================================================================

export function ApplySuggestionButton({
  suggestion,
  onApply,
  onRerunBacktest,
  className,
}: ApplySuggestionButtonProps) {
  const [buttonState, setButtonState] = useState<ButtonState>("default");
  const [showRerunPrompt, setShowRerunPrompt] = useState(false);

  // Get workspace store actions
  const parameters = useStrategyWorkspaceStore(
    (state) => state.current.parameters
  );
  const updateParameters = useStrategyWorkspaceStore(
    (state) => state.updateParameters
  );

  // Reset applied state after timeout
  useEffect(() => {
    if (buttonState !== "applied") return;

    const timer = setTimeout(() => {
      setButtonState("default");
    }, APPLIED_RESET_DELAY_MS);

    return () => clearTimeout(timer);
  }, [buttonState]);

  // Handle apply click
  const handleApply = useCallback(() => {
    if (buttonState === "applying" || buttonState === "applied") return;

    setButtonState("applying");

    try {
      // Update the matching parameter in workspace store
      const updatedParams = parameters.map((p) => {
        if (p.name === suggestion.param) {
          return { ...p, value: suggestion.value };
        }
        return p;
      });

      updateParameters(updatedParams);

      // Show success toast
      showToast.success(`Parameter applied: ${suggestion.display}`);

      // Transition to applied state
      setButtonState("applied");
      setShowRerunPrompt(true);

      // Notify parent
      onApply?.(suggestion);
    } catch {
      setButtonState("default");
      showToast.error("Failed to apply parameter change.");
    }
  }, [
    buttonState,
    parameters,
    suggestion,
    updateParameters,
    onApply,
  ]);

  // Handle re-run backtest
  const handleRerun = useCallback(() => {
    setShowRerunPrompt(false);
    onRerunBacktest?.();
  }, [onRerunBacktest]);

  return (
    <div
      data-testid="apply-suggestion-card"
      role="region"
      aria-label="AI parameter suggestion"
      className={cn(
        // AI visual language
        "ai-mark",
        "rounded-lg p-3 my-2",
        "border border-ai-border",
        className
      )}
    >
      {/* Suggestion content */}
      <div className="space-y-1.5">
        {/* Display text */}
        <p className="text-sm font-medium text-neutral-200">
          {suggestion.display}
        </p>

        {/* Rationale */}
        <p className="text-xs text-neutral-400">
          <span className="text-neutral-500 mr-1">Rationale:</span>
          {suggestion.rationale}
        </p>

        {/* Impact */}
        <p className="text-xs text-neutral-400">
          <span className="text-neutral-500 mr-1">Impact:</span>
          {suggestion.impact}
        </p>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-3">
        {/* Apply button */}
        <button
          type="button"
          onClick={handleApply}
          disabled={buttonState === "applying"}
          aria-label={
            buttonState === "applied"
              ? "Applied"
              : "Apply suggestion to strategy"
          }
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md",
            "text-xs font-medium transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-ai/50",
            buttonState === "default" && [
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90",
              "btn-tactile",
            ],
            buttonState === "applying" && [
              "bg-primary/60 text-primary-foreground/80",
              "cursor-wait",
            ],
            buttonState === "applied" && [
              "bg-emerald-600 text-white",
              "cursor-default",
            ]
          )}
        >
          {/* Button content with state indicator */}
          <span data-testid="apply-button-state">
            {buttonState === "default" && "Apply to Strategy"}
            {buttonState === "applying" && "Applying..."}
            {buttonState === "applied" && (
              <>
                <svg
                  className="w-3 h-3 inline mr-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Applied
              </>
            )}
          </span>
        </button>

        {/* Re-run backtest prompt */}
        {showRerunPrompt && (
          <button
            type="button"
            onClick={handleRerun}
            aria-label="Re-run backtest with updated parameters"
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md",
              "text-xs font-medium transition-colors",
              "border border-ai-border text-ai",
              "hover:bg-ai-bg hover:text-white",
              "focus:outline-none focus:ring-2 focus:ring-ai/50"
            )}
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Re-run Backtest
          </button>
        )}
      </div>
    </div>
  );
}

export default ApplySuggestionButton;
