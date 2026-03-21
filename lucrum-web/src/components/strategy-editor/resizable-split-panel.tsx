/**
 * Resizable Split Panel Component
 *
 * Professional split-panel layout with draggable divider.
 * Persists user-preferred ratio via user-preferences-store.
 *
 * @module components/strategy-editor/resizable-split-panel
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface ResizableSplitPanelProps {
  /** Content for the left (input) panel */
  left: React.ReactNode;
  /** Content for the right (preview/results) panel */
  right: React.ReactNode;
  /** Initial split ratio (left panel width as percentage, 25-75) */
  initialRatio?: number;
  /** Callback when ratio changes (for persistence) */
  onRatioChange?: (ratio: number) => void;
  /** Minimum panel width percentage */
  minRatio?: number;
  /** Maximum panel width percentage */
  maxRatio?: number;
  /** Additional CSS classes for the container */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_RATIO = 42;
const MIN_RATIO = 25;
const MAX_RATIO = 75;
const DIVIDER_WIDTH = 8; // px

// =============================================================================
// COMPONENT
// =============================================================================

export function ResizableSplitPanel({
  left,
  right,
  initialRatio = DEFAULT_RATIO,
  onRatioChange,
  minRatio = MIN_RATIO,
  maxRatio = MAX_RATIO,
  className,
}: ResizableSplitPanelProps) {
  const [ratio, setRatio] = useState(
    Math.max(minRatio, Math.min(maxRatio, initialRatio))
  );
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ratioRef = useRef(ratio);

  // Keep ref in sync with state
  ratioRef.current = ratio;

  // Handle mouse drag for resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    []
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newRatio = (x / rect.width) * 100;
      const clamped = Math.max(minRatio, Math.min(maxRatio, newRatio));

      setRatio(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Persist ratio on drag end
      onRatioChange?.(ratioRef.current);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Prevent text selection during drag
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, minRatio, maxRatio, onRatioChange]);

  return (
    <div
      ref={containerRef}
      className={cn("flex w-full h-full min-h-0", className)}
    >
      {/* Left panel */}
      <div
        className="overflow-y-auto overflow-x-hidden min-w-0"
        style={{ width: `${ratio}%` }}
      >
        {left}
      </div>

      {/* Drag divider */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "relative flex-shrink-0 cursor-col-resize group",
          "flex items-center justify-center",
          "transition-colors duration-150"
        )}
        style={{ width: `${DIVIDER_WIDTH}px` }}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={minRatio}
        aria-valuemax={maxRatio}
        aria-label="Resize panels"
      >
        {/* Visual divider line */}
        <div
          className={cn(
            "absolute inset-y-0 left-1/2 -translate-x-1/2 w-px",
            "bg-white/5 group-hover:bg-primary/40 transition-colors",
            isDragging && "bg-primary/60"
          )}
        />
        {/* Drag handle dots */}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "flex flex-col gap-1 py-2 px-0.5 rounded-full",
            "bg-surface/80 border border-white/10",
            "group-hover:border-primary/30 group-hover:bg-surface transition-all",
            isDragging && "border-primary/50 bg-surface"
          )}
        >
          <div className="w-0.5 h-0.5 rounded-full bg-white/30 group-hover:bg-primary/60" />
          <div className="w-0.5 h-0.5 rounded-full bg-white/30 group-hover:bg-primary/60" />
          <div className="w-0.5 h-0.5 rounded-full bg-white/30 group-hover:bg-primary/60" />
        </div>
      </div>

      {/* Right panel */}
      <div
        className="overflow-y-auto overflow-x-hidden min-w-0 flex-1"
      >
        {right}
      </div>
    </div>
  );
}
