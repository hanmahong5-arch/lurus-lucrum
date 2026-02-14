"use client";

/**
 * Smart Question Chips Component
 *
 * Displays 3 context-aware recommended questions as clickable chips
 * based on backtest score breakdown and metrics. Clicking a chip
 * auto-fills and sends the question to the AI advisor chat.
 *
 * Design:
 * - Badge variant=outline styling with AI visual language
 * - Purple AI accent for chip container
 * - Hover feedback with smooth transitions
 * - No chips when context is absent; optional fallback text
 *
 * @module components/advisor/smart-question-chips
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  generateSmartQuestions,
  type QuestionContext,
} from "@/lib/advisor/question-generator";

// =============================================================================
// TYPES
// =============================================================================

interface SmartQuestionChipsProps {
  /** Backtest context for question generation (null = no context) */
  context: QuestionContext | null | undefined;
  /** Callback when user clicks a question chip */
  onQuestionSelect: (questionText: string) => void;
  /** Show fallback guidance text when no context (default: false) */
  showFallback?: boolean;
  /** Additional CSS class */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SmartQuestionChips({
  context,
  onQuestionSelect,
  showFallback = false,
  className,
}: SmartQuestionChipsProps) {
  // Generate questions from context (memoized to avoid recalculation)
  const questions = useMemo(
    () => generateSmartQuestions(context),
    [context]
  );

  // No context: optionally show fallback text
  if (!context || questions.length === 0) {
    if (showFallback) {
      return (
        <div className={cn("text-center py-2", className)}>
          <p className="text-sm text-neutral-400">
            输入任何投资相关问题
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      data-testid="smart-question-chips"
      className={cn(
        // Container layout
        "flex flex-wrap gap-2 py-3 px-1",
        className
      )}
    >
      {questions.map((q) => (
        <button
          key={q.id}
          type="button"
          onClick={() => onQuestionSelect(q.text)}
          className={cn(
            // Badge outline styling
            "inline-flex items-center",
            "px-3 py-1.5 rounded-full",
            "text-xs leading-relaxed",
            "transition-all duration-200",
            // AI visual language: purple outline theme
            "border border-ai-border text-ai",
            "bg-transparent",
            // Hover: elevated with AI background
            "hover:bg-ai-bg hover:border-ai hover:text-white",
            // Focus
            "focus:outline-none focus:ring-2 focus:ring-ai/50",
            // Cursor
            "cursor-pointer",
            // Text alignment for longer questions
            "text-left max-w-full"
          )}
        >
          <span className="truncate">{q.text}</span>
        </button>
      ))}
    </div>
  );
}

export default SmartQuestionChips;
