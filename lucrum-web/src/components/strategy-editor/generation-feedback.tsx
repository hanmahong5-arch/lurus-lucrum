/**
 * Generation Feedback Component
 *
 * Real-time visual feedback during AI strategy code generation:
 * - Typewriter streaming animation on code lines
 * - Token count and estimated cost display
 * - Cache hit badge when strategy was served from cache
 *
 * @module components/strategy-editor/generation-feedback
 */

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface GenerationFeedbackProps {
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** The generated code (streams in progressively) */
  generatedCode: string;
  /** Whether the result came from cache */
  fromCache?: boolean;
  /** Estimated cost saved if from cache (CNY) */
  savedCost?: number;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Approximate token count: ~4 chars per token for code
const CHARS_PER_TOKEN = 4;
// DeepSeek pricing: ~0.0014 CNY per 1K output tokens
const COST_PER_1K_TOKENS = 0.0014;

// =============================================================================
// COMPONENT
// =============================================================================

export function GenerationFeedback({
  isGenerating,
  generatedCode,
  fromCache = false,
  savedCost,
  className,
}: GenerationFeedbackProps) {
  const [displayedLines, setDisplayedLines] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const prevCodeLenRef = useRef(0);

  // Estimate token count
  const estimatedTokens = useMemo(() => {
    if (!generatedCode) return 0;
    return Math.ceil(generatedCode.length / CHARS_PER_TOKEN);
  }, [generatedCode]);

  // Estimate cost
  const estimatedCost = useMemo(() => {
    return (estimatedTokens / 1000) * COST_PER_1K_TOKENS;
  }, [estimatedTokens]);

  // Typewriter effect: animate line count
  useEffect(() => {
    if (!generatedCode) {
      setDisplayedLines(0);
      return undefined;
    }

    const totalLines = generatedCode.split("\n").length;

    // If code appeared at once (not streaming), show instantly
    if (
      generatedCode.length > 0 &&
      prevCodeLenRef.current === 0 &&
      !isGenerating
    ) {
      setDisplayedLines(totalLines);
      prevCodeLenRef.current = generatedCode.length;
      return undefined;
    }

    // Animate lines appearing
    if (displayedLines < totalLines) {
      const timer = setTimeout(
        () => {
          setDisplayedLines((prev) => Math.min(prev + 3, totalLines));
        },
        isGenerating ? 50 : 20
      );
      return () => clearTimeout(timer);
    }

    prevCodeLenRef.current = generatedCode.length;
    return undefined;
  }, [generatedCode, displayedLines, isGenerating]);

  // Blinking cursor
  useEffect(() => {
    if (!isGenerating) {
      setShowCursor(false);
      return;
    }
    const timer = setInterval(() => setShowCursor((p) => !p), 530);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Nothing to show
  if (!isGenerating && !generatedCode) return null;

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      {/* Streaming indicator */}
      {isGenerating && (
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-[10px] text-primary font-mono">
            生成中...
          </span>
          {showCursor && (
            <span className="w-0.5 h-3 bg-primary animate-pulse" />
          )}
        </div>
      )}

      {/* Token count */}
      {generatedCode && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface border border-white/5">
          <svg
            className="w-3 h-3 text-neutral-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <span className="text-[10px] font-mono tabular-nums text-neutral-400">
            ~{estimatedTokens.toLocaleString()} tokens
          </span>
          <span className="text-[10px] text-neutral-600">|</span>
          <span className="text-[10px] font-mono tabular-nums text-neutral-500">
            ~&yen;{estimatedCost.toFixed(4)}
          </span>
        </div>
      )}

      {/* Cache hit badge */}
      {fromCache && !isGenerating && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-profit/10 border border-profit/20">
          <svg
            className="w-3 h-3 text-profit"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="text-[10px] font-medium text-profit">
            从缓存加载
          </span>
          {savedCost != null && savedCost > 0 && (
            <span className="text-[10px] font-mono tabular-nums text-profit/70">
              节省 &yen;{savedCost.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Line counter (during streaming) */}
      {isGenerating && generatedCode && (
        <span className="text-[10px] font-mono tabular-nums text-neutral-600">
          {displayedLines}/{generatedCode.split("\n").length} 行
        </span>
      )}
    </div>
  );
}
