"use client";

/**
 * Investment Advisor Page
 * 投资顾问页面
 *
 * Main page for the 3-Dao 6-Shu investment decision framework
 * 三道六术投资决策框架的主页面
 *
 * Supports URL params: ?symbol=600519&name=贵州茅台
 * to pre-inject stock context (from drag-and-drop or cross-page navigation)
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { useUpgradeGate } from "@/hooks/use-upgrade-gate";

// Dynamic import to avoid SSR issues with chat component
// 动态导入以避免聊天组件的SSR问题
const AdvisorChat = dynamic(() => import("@/components/advisor/advisor-chat"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400">加载中...</div>
    </div>
  ),
});

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

      <main className="max-w-5xl mx-auto h-[calc(100vh-56px)]">
        {!canAccess ? (
          /* Upgrade gate for free users */
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="max-w-md text-center space-y-4">
              <div className="text-5xl">🧠</div>
              <h2 className="text-xl font-bold text-white">AI 投资顾问</h2>
              <p className="text-sm text-white/50">
                11 位专业 AI 分析师，涵盖 7 大投资流派，多空辩论模式帮你全面分析投资决策
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
                进阶版 ¥49/月 · 基础单 Agent 模式 | 专业版 ¥149/月 · 完整 11 Agent + 辩论
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <FrameworkOverview />
            <div className="flex-1 min-h-0">
              <AdvisorChat
                className="h-full"
                initialSymbol={symbol}
                initialSymbolName={name}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-gray-400">加载中...</div>
      </div>
    }>
      <AdvisorPageContent />
    </Suspense>
  );
}

/**
 * Framework Overview Component (Redesigned)
 * 框架概览组件（重新设计）
 *
 * Changed: Removed explicit "三道六术" labels, now shows compact philosophy hint
 * 修改：移除了明确的"三道六术"标签，现在显示紧凑的投资理念提示
 */
function FrameworkOverview() {
  return (
    <div className="px-4 py-2 bg-surface/30 border-b border-border">
      <div className="flex items-center justify-between text-xs gap-2">
        {/* Core Philosophy Hint */}
        {/* 核心理念提示 */}
        <div className="flex items-center gap-2 sm:gap-4 text-white/50 min-w-0">
          <span className="text-accent shrink-0">💡</span>
          <span className="truncate sm:whitespace-normal">
            <span className="text-white/70">决策质量</span> &gt; 执行速度 ·{" "}
            <span className="text-white/70 hidden sm:inline">深度理解</span><span className="hidden sm:inline"> &gt; 快速反应 ·{" "}</span>
            <span className="text-white/70 hidden sm:inline">系统思考</span><span className="hidden sm:inline"> &gt; 碎片信息</span>
          </span>
        </div>

        {/* Powered By */}
        {/* 技术支持 */}
        <div className="text-white/30 hidden sm:block shrink-0">
          Powered by DeepSeek + Multi-Agent
        </div>
      </div>
    </div>
  );
}
