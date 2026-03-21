/**
 * AsyncButton — Button with built-in loading / success / error states.
 *
 * - Click → immediate spinner + text change
 * - Success → green checkmark flash for 1.5s
 * - Error → red border + error tooltip
 * - Reuses `btn-tactile` class from design system
 *
 * @module components/ui/async-button
 */

"use client";

import { useState, useCallback, useRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

type ButtonPhase = "idle" | "loading" | "success" | "error";

export interface AsyncButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** Click handler — must return a promise */
  onClick: () => Promise<void>;
  /** Label when idle */
  children: ReactNode;
  /** Label while loading (default: "处理中...") */
  loadingText?: string;
  /** Label on success (default: "完成") */
  successText?: string;
  /** Duration to show success state in ms (default: 1500) */
  successDuration?: number;
  /** Variant: primary gradient or secondary */
  variant?: "primary" | "secondary";
  /** Optional error message override */
  errorMessage?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AsyncButton({
  onClick,
  children,
  loadingText = "处理中...",
  successText = "完成",
  successDuration = 1500,
  variant = "primary",
  errorMessage,
  className,
  disabled,
  ...rest
}: AsyncButtonProps) {
  const [phase, setPhase] = useState<ButtonPhase>("idle");
  const [errorText, setErrorText] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout>();

  const handleClick = useCallback(async () => {
    if (phase === "loading") return;

    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    setPhase("loading");
    setErrorText("");

    try {
      await onClick();
      setPhase("success");
      timerRef.current = setTimeout(() => setPhase("idle"), successDuration);
    } catch (err) {
      const msg =
        errorMessage ??
        (err instanceof Error ? err.message : "操作失败，请重试");
      setErrorText(msg);
      setPhase("error");
      timerRef.current = setTimeout(() => {
        setPhase("idle");
        setErrorText("");
      }, 3000);
    }
  }, [onClick, phase, successDuration, errorMessage]);

  const isDisabled = disabled || phase === "loading";

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all btn-tactile",
          // Variant styles
          variant === "primary" && [
            "bg-gradient-to-r from-primary to-accent text-white",
            "hover:shadow-lg hover:shadow-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
          ],
          variant === "secondary" && [
            "bg-surface border border-white/10 text-neutral-200",
            "hover:bg-surface-hover hover:border-white/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ],
          // Phase-specific styles
          phase === "success" && "!border-profit/50 !shadow-profit/10 !shadow-lg",
          phase === "error" && "!border-loss/50 !shadow-loss/10 !shadow-lg",
          className,
        )}
        {...rest}
      >
        {/* Spinner */}
        {phase === "loading" && (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
        )}

        {/* Checkmark */}
        {phase === "success" && (
          <svg
            className="w-4 h-4 text-profit shrink-0 animate-in zoom-in-50 duration-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}

        {/* Error X */}
        {phase === "error" && (
          <svg
            className="w-4 h-4 text-loss shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}

        {/* Label */}
        <span>
          {phase === "loading"
            ? loadingText
            : phase === "success"
              ? successText
              : phase === "error"
                ? "失败"
                : children}
        </span>
      </button>

      {/* Error tooltip */}
      {phase === "error" && errorText && (
        <div className="absolute top-full mt-2 px-3 py-1.5 text-xs text-loss bg-loss/10 border border-loss/20 rounded-lg whitespace-nowrap z-20 animate-in fade-in slide-in-from-top-1 duration-200">
          {errorText}
        </div>
      )}
    </div>
  );
}
