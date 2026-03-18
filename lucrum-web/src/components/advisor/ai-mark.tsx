/**
 * AI Content Marker Component
 *
 * Wraps AI-generated content with the unified AI visual language:
 * - Purple left border accent (#a78bfa)
 * - Subtle purple background (10% opacity)
 * - Optional pulse animation for processing state
 * - Respects prefers-reduced-motion
 *
 * Uses design tokens from Epic 1 (Story 1-1):
 * - ai-mark: static AI content marker
 * - ai-mark-pulse: animated AI processing marker
 *
 * @module components/advisor/ai-mark
 */

import React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

type AiMarkElement = "div" | "section" | "aside" | "span";

interface AiMarkProps {
  /** Content to wrap with AI visual marker */
  children: React.ReactNode;
  /** Whether to show pulse animation (for processing state) */
  pulse?: boolean;
  /** Accessible label describing the AI content */
  label?: string;
  /** HTML element to render as (default: div) */
  as?: AiMarkElement;
  /** Additional CSS class names */
  className?: string;
  /** Data-testid for testing */
  "data-testid"?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_ARIA_LABEL = "AI generated content";

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * AiMark - Unified AI content visual marker
 *
 * Apply to any UI area containing AI-generated content to provide
 * consistent visual identification across the platform.
 *
 * @example
 * ```tsx
 * // Static AI content
 * <AiMark>
 *   <p>AI suggests increasing the stop-loss threshold...</p>
 * </AiMark>
 *
 * // Processing state with animation
 * <AiMark pulse>
 *   <p>Analyzing strategy parameters...</p>
 * </AiMark>
 * ```
 */
export function AiMark({
  children,
  pulse = false,
  label,
  as: Component = "div",
  className,
  "data-testid": testId,
}: AiMarkProps) {
  return (
    <Component
      className={cn(
        // Apply the correct ai-mark variant
        pulse ? "ai-mark-pulse" : "ai-mark",
        // Disable animation for users who prefer reduced motion
        "motion-reduce:animate-none",
        // Standard styling
        "py-2 rounded",
        className
      )}
      role="complementary"
      aria-label={label ?? DEFAULT_ARIA_LABEL}
      data-testid={testId}
    >
      {children}
    </Component>
  );
}

export default AiMark;
