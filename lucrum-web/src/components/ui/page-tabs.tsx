"use client";

/**
 * Reusable URL-synced tab component for merged dashboard pages.
 *
 * Reads the active tab from `?tab=<value>` search param and updates the URL
 * on tab change so that deep linking works. Falls back to the first tab if
 * the param is missing or invalid.
 *
 * Built on top of Radix Tabs for accessibility (keyboard nav, ARIA).
 */

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageTab {
  /** URL-safe identifier persisted in `?tab=` */
  value: string;
  /** Display label shown in the tab trigger */
  label: string;
}

export interface PageTabsProps {
  /** Ordered list of tabs. First tab is the default. */
  tabs: PageTab[];
  /** Render function called for the active tab content */
  children: (activeTab: string) => React.ReactNode;
  /** Extra className applied to the root Tabs wrapper */
  className?: string;
  /** Extra className applied to the TabsList bar */
  listClassName?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PageTabs({
  tabs,
  children,
  className,
  listClassName,
}: PageTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const firstTab = tabs[0]?.value ?? "";
  const rawTab = searchParams.get("tab");
  const activeTab =
    rawTab && tabs.some((t) => t.value === rawTab) ? rawTab : firstTab;

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === firstTab) {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams, firstTab],
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className={cn("w-full", className)}
    >
      <TabsList
        className={cn(
          "w-full justify-start gap-1 bg-surface/50 border border-border rounded-lg p-1 overflow-x-auto scrollbar-hide",
          listClassName,
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="data-[state=active]:bg-accent/10 data-[state=active]:text-accent data-[state=active]:shadow-none text-white/60 hover:text-white/80 transition rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Only render the active tab's content */}
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4">
          {activeTab === tab.value ? children(tab.value) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
