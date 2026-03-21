"use client";

/**
 * AI Advisor Hub
 *
 * Merges the former advisor + agents pages into a single tabbed view:
 *   - Intelligent chat      (original advisor + context sidebar)
 *   - Bull/Bear debate      (visual split debate mode)
 *   - Agent configuration   (visual agent card grid)
 *
 * Tab state is persisted in the URL via `?tab=` for deep-linking.
 *
 * Supports URL params: ?symbol=600519&name=贵州茅台
 * to pre-inject stock context (from drag-and-drop or cross-page navigation)
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageTabs } from "@/components/ui/page-tabs";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { useUpgradeGate } from "@/hooks/use-upgrade-gate";

// Dynamic imports to avoid SSR issues
const AdvisorChatWithSidebar = dynamic(
  () =>
    import("@/components/advisor/advisor-chat-with-sidebar").then(
      (m) => m.AdvisorChatWithSidebar
    ),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  }
);

const DebatePanel = dynamic(
  () =>
    import("@/components/advisor/debate-panel").then((m) => m.DebatePanel),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  }
);

const AgentGrid = dynamic(
  () =>
    import("@/components/advisor/agent-grid").then((m) => m.AgentGrid),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  }
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
  { value: "chat", label: "智能对话" },
  { value: "debate", label: "多空辩论" },
  { value: "agents", label: "代理配置" },
];

function AdvisorPageContent() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get("symbol") ?? undefined;
  const name = searchParams.get("name") ?? undefined;
  const { data: overview } = useAccountOverview();
  const { hasAccess } = useUpgradeGate(overview?.subscription?.plan_code);

  const canAccess = hasAccess("ai_advisor");

  return (
    <div className="min-h-screen bg-background text-white">
      <DashboardHeader />

      <main className="max-w-[1920px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {!canAccess ? (
          /* Upgrade gate for free users */
          <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] px-4">
            <div className="max-w-md text-center space-y-4">
              <h2 className="text-xl font-bold text-white">AI 投资顾问</h2>
              <p className="text-sm text-white/50">
                11 位专业 AI 分析师，涵盖 7
                大投资流派，多空辩论模式帮你全面分析投资决策
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-white/40">
                <div className="p-2 bg-white/5 rounded-lg">巴菲特价值派</div>
                <div className="p-2 bg-white/5 rounded-lg">彼得林奇成长派</div>
                <div className="p-2 bg-white/5 rounded-lg">西蒙斯量化派</div>
                <div className="p-2 bg-white/5 rounded-lg">利弗莫尔技术派</div>
                <div className="p-2 bg-white/5 rounded-lg">宏观经济分析</div>
                <div className="p-2 bg-white/5 rounded-lg">多空辩论模式</div>
              </div>
              <Link
                href="/dashboard/settings"
                className="inline-block px-6 py-2.5 bg-accent text-primary-600 rounded-lg font-medium text-sm hover:bg-accent/90 transition"
              >
                升级到进阶版解锁
              </Link>
              <p className="text-xs text-white/30">
                进阶版 ¥49/月 · 基础单 Agent 模式 | 专业版 ¥149/月 · 完整 11
                Agent + 辩论
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
                AI 顾问
              </h1>
              <p className="text-sm text-white/50">
                多 Agent 投资顾问 — 智能对话、多空辩论与自定义分析代理
              </p>
            </div>

            <Suspense fallback={<TabSkeleton />}>
              <PageTabs tabs={TABS}>
                {(activeTab) => {
                  switch (activeTab) {
                    case "chat":
                      return (
                        <AdvisorChatWithSidebar
                          initialSymbol={symbol}
                          initialSymbolName={name}
                        />
                      );
                    case "debate":
                      return (
                        <DebatePanel
                          initialSymbol={symbol}
                          initialSymbolName={name}
                        />
                      );
                    case "agents":
                      return <AgentGrid />;
                    default:
                      return null;
                  }
                }}
              </PageTabs>
            </Suspense>
          </>
        )}
      </main>
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-gray-400">加载中...</div>
        </div>
      }
    >
      <AdvisorPageContent />
    </Suspense>
  );
}
