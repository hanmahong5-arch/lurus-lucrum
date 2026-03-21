/**
 * Locked Badge Component
 * Overlay badge indicating a feature requires a paid plan.
 *
 * Usage:
 * - Wrap or overlay on locked feature elements
 * - Shows a semi-transparent overlay with lock icon and label
 * - Clicking triggers an optional onUnlock callback
 *
 * @module components/paywall/locked-badge
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface LockedBadgeProps {
  /** Label text displayed next to lock icon (default: "Pro") */
  label?: string;
  /** Additional CSS classes for the overlay container */
  className?: string;
  /** Callback when the locked overlay is clicked */
  onClick?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Semi-transparent overlay badge with lock icon.
 *
 * Designed to be placed as a sibling inside a `relative` container,
 * covering the parent element with a click-intercepting overlay.
 *
 * Example:
 * ```tsx
 * <div className="relative">
 *   <TemplateCard ... />
 *   {isLocked && <LockedBadge onClick={handleUpgrade} />}
 * </div>
 * ```
 */
export function LockedBadge({
  label = "Pro",
  className,
  onClick,
}: LockedBadgeProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center",
        "bg-gray-900/60 backdrop-blur-[2px] rounded-lg cursor-pointer",
        "transition-all hover:bg-gray-900/70",
        className,
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`${label} - 点击升级解锁`}
    >
      {/* Lock icon */}
      <svg
        className="w-8 h-8 text-gray-400 mb-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>

      {/* Label badge */}
      <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600/80 to-purple-600/80 text-white text-xs font-medium shadow-lg">
        {label}
      </span>
    </div>
  );
}

// =============================================================================
// INLINE LOCKED BADGE (compact variant for inline use)
// =============================================================================

interface InlineLockedBadgeProps {
  /** Label text (default: "Pro") */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact inline locked badge for use within text or small UI elements.
 *
 * Example:
 * ```tsx
 * <span>高级模板 <InlineLockedBadge /></span>
 * ```
 */
export function InlineLockedBadge({
  label = "Pro",
  className,
}: InlineLockedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
        "bg-gray-700/60 text-gray-400 border border-gray-600/30",
        className,
      )}
    >
      <svg
        className="w-2.5 h-2.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
      {label}
    </span>
  );
}

export default LockedBadge;
