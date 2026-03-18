"use client";

import Link from "next/link";
import { useQuotaStatus } from "@/hooks/use-quota-status";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { normalizePlanTier, getPlanDisplay } from "@/lib/config/plan-limits";

interface WorkspaceStatusBarProps {
  userId: string;
  dataSource?: string;
}

/**
 * Bottom status bar for the strategy workspace.
 * Shows: data source | current plan | quota usage | quick actions
 */
export function WorkspaceStatusBar({ userId, dataSource = "A股日线" }: WorkspaceStatusBarProps) {
  const { remaining, total, plan, loading } = useQuotaStatus(userId);
  const { data: overview } = useAccountOverview();

  const tier = normalizePlanTier(plan || overview?.subscription?.plan_code);
  const display = getPlanDisplay(tier);
  const walletBalance = overview?.wallet?.balance ?? 0;
  const isUnlimited = tier === "pro" || tier === "enterprise";

  const usedPercent = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0;
  const barColor = usedPercent > 80 ? "bg-loss" : usedPercent > 60 ? "bg-amber-400" : "bg-accent";

  return (
    <div className="flex items-center justify-between h-7 px-4 bg-surface/90 border-t border-border text-[11px] text-white/40 shrink-0">
      {/* Left: data source + plan badge */}
      <div className="flex items-center gap-3">
        <span title="数据源">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-profit mr-1 align-middle" />
          {dataSource}
        </span>
        <span className="text-white/20">|</span>
        <span className={`font-medium ${tier === "free" ? "text-white/50" : "text-accent"}`}>
          {display.icon} {display.name}
        </span>
      </div>

      {/* Center: quota bar */}
      <div className="flex items-center gap-2">
        {loading ? (
          <span className="text-white/20">加载中...</span>
        ) : isUnlimited ? (
          <span className="text-profit">Token 无限</span>
        ) : (
          <>
            <span>Token 配额</span>
            <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${100 - usedPercent}%` }}
              />
            </div>
            <span className="font-mono tabular-nums text-white/50">
              {remaining.toLocaleString()} / {total.toLocaleString()}
            </span>
          </>
        )}
      </div>

      {/* Right: wallet + quick link */}
      <div className="flex items-center gap-3">
        <span className="font-mono tabular-nums text-amber-400/70">
          {walletBalance.toFixed(1)} LB
        </span>
        <span className="text-white/20">|</span>
        <Link
          href="/dashboard/settings"
          className="hover:text-white/60 transition"
        >
          升级
        </Link>
      </div>
    </div>
  );
}
