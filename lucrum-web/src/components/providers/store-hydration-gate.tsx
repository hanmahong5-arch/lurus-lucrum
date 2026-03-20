'use client';

/**
 * Store Hydration Gate
 *
 * Wraps children and delays rendering until all persisted Zustand stores
 * have finished rehydrating from localStorage. Prevents flash of default
 * state when navigating between dashboard pages.
 *
 * Shows a minimal loading skeleton while stores hydrate (typically < 50ms
 * for localStorage-backed stores).
 */

import { useStoreHydration } from '@/hooks/use-store-hydration';

interface StoreHydrationGateProps {
  children: React.ReactNode;
}

/**
 * Minimal loading skeleton shown during store hydration.
 * Intentionally lightweight to avoid layout shift.
 */
function HydrationSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-void">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface border-t-primary" />
        <span className="text-sm text-muted-foreground animate-pulse">
          Loading workspace...
        </span>
      </div>
    </div>
  );
}

export function StoreHydrationGate({ children }: StoreHydrationGateProps) {
  const { isHydrated } = useStoreHydration();

  if (!isHydrated) {
    return <HydrationSkeleton />;
  }

  return <>{children}</>;
}
