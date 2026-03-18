"use client";

/**
 * Backtest Agent Page
 *
 * Route: /backtest-agent
 * Route guard: requires NextAuth session; redirects to login if unauthenticated.
 *
 * Layout:
 *   DashboardHeader (shared nav)
 *   └─ BacktestAgentPanel (two-column: chat + results)
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

// Dynamic import avoids SSR issues with the panel's browser-only hooks
const BacktestAgentPanel = dynamic(
  () =>
    import("@/components/agent/BacktestAgentPanel").then(
      (m) => m.BacktestAgentPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        加载中...
      </div>
    ),
  },
);

export default function BacktestAgentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/backtest-agent");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-slate-400 text-sm">验证登录状态...</div>
      </div>
    );
  }

  if (!session) {
    return null; // Redirect in progress
  }

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <DashboardHeader />
      <main className="flex-1 min-h-0 h-[calc(100vh-56px)]">
        <BacktestAgentPanel />
      </main>
    </div>
  );
}
