"use client";

/**
 * Strategy Validation Hub
 *
 * Merges the former standalone pages into a single tabbed view:
 *   - Strategy validation    (from strategy-validation)
 *   - AI-powered backtest    (from /backtest-agent)
 *
 * Tab state is persisted in the URL via `?tab=` for deep-linking.
 */

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageTabs } from "@/components/ui/page-tabs";

// Import extracted content component (no DashboardHeader inside)
const StrategyValidationContent = dynamic(
  () =>
    import("@/components/pages/strategy-validation-content").then((m) => m.StrategyValidationContent),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  },
);

const BacktestAgentPanel = dynamic(
  () =>
    import("@/components/agent/BacktestAgentPanel").then((m) => m.BacktestAgentPanel),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  },
);

const PortfolioContent = dynamic(
  () =>
    import("@/components/pages/portfolio-content").then((m) => m.PortfolioContent),
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
  { value: "validation", label: "策略验证" },
  { value: "portfolio", label: "组合分仓" },
  { value: "ai", label: "AI 智能回测" },
];

function ValidationPageContent() {
  return (
    <div className="min-h-screen bg-background text-white">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            策略验证
          </h1>
          <p className="text-sm text-white/50">
            多维度验证交易策略的有效性 — 单股回测、组合分仓、多股验证与 AI 智能分析
          </p>
        </div>

        <Suspense fallback={<TabSkeleton />}>
          <PageTabs tabs={TABS}>
            {(activeTab) => {
              switch (activeTab) {
                case "validation":
                  return <StrategyValidationContent />;
                case "portfolio":
                  return <PortfolioContent />;
                case "ai":
                  return (
                    <div className="h-[calc(100vh-280px)] min-h-[500px]">
                      <BacktestAgentPanel />
                    </div>
                  );
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

export default function ValidationPage() {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <ValidationPageContent />
    </Suspense>
  );
}
