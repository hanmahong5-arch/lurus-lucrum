/**
 * Discovery Skeleton Component
 *
 * Loading skeleton placeholder for the discovery page card grid.
 * Shows animated placeholder cards while data is being fetched.
 *
 * Story 3.2: Discovery Page & Filter
 *
 * @module components/discovery/discovery-skeleton
 */

import React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// SKELETON CARD
// =============================================================================

function SkeletonCard() {
  return (
    <div
      className="rounded-lg border border-neutral-800 bg-surface p-4 animate-pulse"
      data-testid="discovery-skeleton-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="h-3 w-16 bg-neutral-700 rounded" />
        <div className="h-4 w-12 bg-neutral-700 rounded-full" />
      </div>

      {/* Title */}
      <div className="h-4 w-3/4 bg-neutral-700 rounded mb-2" />

      {/* Description */}
      <div className="space-y-1 mb-3">
        <div className="h-3 w-full bg-neutral-800 rounded" />
        <div className="h-3 w-2/3 bg-neutral-800 rounded" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-16 bg-neutral-700 rounded-full" />
        <div className="flex gap-3">
          <div className="h-3 w-10 bg-neutral-800 rounded" />
          <div className="h-3 w-10 bg-neutral-800 rounded" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN SKELETON GRID
// =============================================================================

interface DiscoverySkeletonProps {
  /** Number of skeleton cards to show */
  count?: number;
  className?: string;
}

export function DiscoverySkeleton({ count = 6, className }: DiscoverySkeletonProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
        className
      )}
      data-testid="discovery-skeleton"
      aria-label="加载中..."
      role="status"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}