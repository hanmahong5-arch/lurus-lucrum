"use client";

/**
 * Strategy Scanner Page
 * 策略扫描选板页面
 *
 * Route: /dashboard/strategy-scanner
 * Route guard: requires NextAuth session; redirects to login if unauthenticated.
 *
 * Layout:
 *   DashboardHeader (shared nav)
 *   └─ ScannerPanel (left config + right results)
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

// Dynamic import avoids SSR issues with browser-only hooks in ScannerPanel
const ScannerPanel = dynamic(
  () =>
    import("@/components/agent/ScannerPanel").then((m) => m.ScannerPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        加载扫描面板...
      </div>
    ),
  }
);

export default function StrategyScannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(
        "/auth/login?callbackUrl=/dashboard/strategy-scanner"
      );
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white/40 text-sm">验证登录状态...</div>
      </div>
    );
  }

  if (!session) {
    return null; // Redirect in progress
  }

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <DashboardHeader />
      <main className="flex-1 p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-white">扫描选板</h1>
              <p className="text-sm text-white/40 mt-0.5">
                并行扫描多个板块 / 个股，AI 自动给出选板洞察
              </p>
            </div>
          </div>
          <div className="h-[calc(100vh-160px)]">
            <ScannerPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
