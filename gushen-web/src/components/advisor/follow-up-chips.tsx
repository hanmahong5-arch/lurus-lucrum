"use client";

/**
 * Follow-up question chips for AI responses
 * AI 回复后的后续问题建议芯片
 *
 * Renders 3–5 clickable question chips below each assistant message.
 * Clicking a chip triggers immediate send without typing.
 */

import { cn } from "@/lib/utils";

interface FollowUpChipsProps {
  questions: string[];
  onSelect: (question: string) => void;
  className?: string;
}

export function FollowUpChips({
  questions,
  onSelect,
  className,
}: FollowUpChipsProps) {
  if (!questions || questions.length === 0) return null;

  // Limit to 5 chips max
  const displayQuestions = questions.slice(0, 5);

  return (
    <div className={cn("flex flex-wrap gap-2 mt-3", className)}>
      {displayQuestions.map((q, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(q)}
          className={cn(
            "px-3 py-1.5 text-xs rounded-lg border transition-all text-left",
            "bg-[#f5a623]/10 border-[#f5a623]/20 text-[#f5a623]/80",
            "hover:bg-[#f5a623]/20 hover:border-[#f5a623]/40 hover:text-[#f5a623]",
            "btn-tactile",
          )}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
