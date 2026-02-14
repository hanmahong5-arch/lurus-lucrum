"use client";

/**
 * Two-Layer Tooltip Component
 *
 * A dual-layer information component for strategy parameters:
 * - Layer 1 (Hover/Tap): Layman explanation via Radix Tooltip
 * - Layer 2 (Click/Long-press): Professional explanation via Radix Popover
 *
 * Designed for accessibility: keyboard navigable, ARIA compliant,
 * touch-device aware with long-press detection.
 *
 * @module components/ui/two-layer-tooltip
 */

import * as React from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// =============================================================================
// Constants
// =============================================================================

/** Threshold in ms for long-press to trigger professional layer on touch */
const LONG_PRESS_THRESHOLD_MS = 500;

// =============================================================================
// Props
// =============================================================================

export interface TwoLayerTooltipProps {
  /** Simple explanation for beginners (shown on hover) */
  layman: string;
  /** Technical explanation for experts (shown on click) */
  professional: string;
  /** Trigger element */
  children: React.ReactNode;
  /** Additional className for the wrapper */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function TwoLayerTooltip({
  layman,
  professional,
  children,
  className,
}: TwoLayerTooltipProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Handle touch start: start long-press timer for professional layer
  const handleTouchStart = React.useCallback(() => {
    if (!professional) return;
    longPressTimerRef.current = setTimeout(() => {
      setPopoverOpen(true);
    }, LONG_PRESS_THRESHOLD_MS);
  }, [professional]);

  // Handle touch end: clear long-press timer
  const handleTouchEnd = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // If both texts are empty, render children without any tooltip behavior
  if (!layman && !professional) {
    return <>{children}</>;
  }

  // If only professional text exists (no layman), use Popover only
  if (!layman && professional) {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <span
            className={cn("inline-flex cursor-pointer", className)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {children}
          </span>
        </PopoverTrigger>
        <PopoverContent
          className="max-w-xs sm:max-w-sm"
          side="bottom"
          aria-label="Professional parameter explanation"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white/60">
                Technical Details
              </span>
            </div>
            <p className="text-sm text-popover-foreground leading-relaxed break-words">
              {professional}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // If only layman text exists, use Tooltip only
  if (layman && !professional) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("inline-flex cursor-help", className)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm leading-relaxed break-words">{layman}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Both layers present: Tooltip (hover) + Popover (click)
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <span
              className={cn("inline-flex cursor-help", className)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {children}
            </span>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1.5">
            <p className="text-sm leading-relaxed break-words">{layman}</p>
            <p className="text-xs text-muted-foreground">
              Click for details
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="max-w-xs sm:max-w-sm"
        side="bottom"
        aria-label="Professional parameter explanation"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-white/60">
              Technical Details
            </span>
          </div>
          <p className="text-sm text-popover-foreground leading-relaxed break-words">
            {professional}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
