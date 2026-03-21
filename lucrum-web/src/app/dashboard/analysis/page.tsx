"use client";

/**
 * Analysis Center
 *
 * Merges the former standalone pages into a single tabbed view:
 *   - Sector scanner      (from strategy-scanner)
 *   - Market insights     (from insights)
 *   - Strategy diagnostics (from diagnostics)
 *
 * Tab state is persisted in the URL via `?tab=` for deep-linking.
 */

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageTabs } from "@/components/ui/page-tabs";

// Dynamic imports from extracted content components (no DashboardHeader inside)
const ScannerPanel = dynamic(
  () =>
    import("@/components/agent/ScannerPanel").then((m) => m.ScannerPanel),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  },
);

const InsightsContent = dynamic(
  () =>
    import("@/components/pages/insights-content").then((m) => m.InsightsContent),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  },
);

const DiagnosticsContent = dynamic(
  () =>
    import("@/components/pages/diagnostics-content").then((m) => m.DiagnosticsContent),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  },
);

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/40 text-sm">加载中...</p>
      </div>
    </div>
  );
}

const TABS = [
  { value: "scanner", label: "板块扫描" },
  { value: "insights", label: "市场洞察" },
  { value: "diagnostics", label: "策略诊断" },
];

function AnalysisPageContent() {
  return (
    <div className="min-h-screen bg-background text-white">
      <DashboardHeader />

      <main className="max-w-[1920px] mx-auto px-3 sm:p-4">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            分析中心
          </h1>
          <p className="text-sm text-white/50">
            板块扫描、市场情报与策略诊断 — 一站式量化分析工具集
          </p>
        </div>

        <Suspense fallback={<TabSkeleton />}>
          <PageTabs tabs={TABS}>
            {(activeTab) => {
              switch (activeTab) {
                case "scanner":
                  return <ScannerPanel />;
                case "insights":
                  return <InsightsContent />;
                case "diagnostics":
                  return <DiagnosticsContent />;
                default:
                  return null;
              }
            }}
          </PageTabs>
        </Suspense>
      </main>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <AnalysisPageContent />
    </Suspense>
  );
}
