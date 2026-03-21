/**
 * Reusable skeleton components for lazy-loaded dashboard modules.
 *
 * Each skeleton mirrors the visual layout of its real component so the
 * transition from placeholder to loaded content feels seamless.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Base pulse bar (shared primitive)
// ---------------------------------------------------------------------------

function Bar({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-white/[0.06] rounded", className)} />
  );
}

// ---------------------------------------------------------------------------
// Page-level skeleton (generic full-page placeholder)
// ---------------------------------------------------------------------------

export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 p-6", className)}>
      <Bar className="h-8 w-48" />
      <Bar className="h-64 w-full" />
      <Bar className="h-32 w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card grid skeleton (marketplace, agent grid, etc.)
// ---------------------------------------------------------------------------

export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Bar key={i} className="h-48 rounded-lg" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table skeleton (trade history, order list, etc.)
// ---------------------------------------------------------------------------

export function TableSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 p-4", className)}>
      {/* Header row */}
      <div className="flex gap-4">
        <Bar className="h-4 w-24" />
        <Bar className="h-4 w-32" />
        <Bar className="h-4 w-20" />
        <Bar className="h-4 flex-1" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <Bar className="h-5 w-24" />
          <Bar className="h-5 w-32" />
          <Bar className="h-5 w-20" />
          <Bar className="h-5 flex-1" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart skeleton (K-line, sparklines, equity curves)
// ---------------------------------------------------------------------------

export function ChartSkeleton({
  height = 320,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface rounded-xl border border-border flex items-center justify-center",
        className,
      )}
      style={{ height }}
    >
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin mx-auto" />
        <Bar className="h-3 w-20 mx-auto" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form skeleton (order panel, config panels)
// ---------------------------------------------------------------------------

export function FormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 p-4", className)}>
      <Bar className="h-4 w-20" />
      <Bar className="h-10 w-full rounded-lg" />
      <Bar className="h-4 w-24" />
      <Bar className="h-10 w-full rounded-lg" />
      <Bar className="h-4 w-16" />
      <Bar className="h-10 w-full rounded-lg" />
      <Bar className="h-10 w-full rounded-lg mt-4" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel skeleton (sidebar, right panel, split panel child)
// ---------------------------------------------------------------------------

export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 p-3", className)}>
      <Bar className="h-10 w-full rounded-lg" />
      <Bar className="h-32 w-full rounded-xl" />
      <Bar className="h-24 w-full rounded-xl" />
      <Bar className="h-48 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab content skeleton (spinner + text, matching existing TabSkeleton style)
// ---------------------------------------------------------------------------

export function TabContentSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center h-64",
        className,
      )}
    >
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workbench skeleton (strategy editor split-panel layout)
// ---------------------------------------------------------------------------

export function WorkbenchSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar placeholder */}
      <Bar className="h-10 w-full rounded-lg" />
      {/* Split panel placeholder */}
      <div className="flex gap-4 h-[calc(100vh-200px)]">
        <div className="flex-1 space-y-3 p-3">
          <Bar className="h-28 w-full rounded-xl" />
          <Bar className="h-20 w-full rounded-xl" />
          <Bar className="h-40 w-full rounded-xl" />
        </div>
        <div className="flex-1 space-y-3 p-3">
          <Bar className="h-48 w-full rounded-xl" />
          <Bar className="h-32 w-full rounded-xl" />
          <Bar className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
