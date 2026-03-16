/**
 * Upgrade Dialog Component
 * Paywall prompt with 4 variants for different trigger contexts.
 *
 * Variants:
 * - limit:  Quota exceeded (shows "today used X/Y" + countdown)
 * - lock:   Locked template (grey overlay + lock icon)
 * - aha:    Sharpe > 1.5 celebration (sparkle effect + upgrade nudge)
 * - upsell: Results page pro metrics teaser
 *
 * @module components/paywall/upgrade-dialog
 */

"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// =============================================================================
// TYPES
// =============================================================================

export type UpgradeDialogVariant = "limit" | "lock" | "aha" | "upsell";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: UpgradeDialogVariant;
  /** Feature name for display (e.g. "backtest", "ai_call") */
  featureName?: string;
  /** Current usage count */
  used?: number;
  /** Daily limit */
  limit?: number;
  /** Reset time ISO string */
  resetAt?: string;
  /** Locked template name */
  templateName?: string;
  /** Sharpe ratio for aha variant */
  sharpeRatio?: number;
}

// =============================================================================
// COUNTDOWN HOOK
// =============================================================================

function useCountdown(resetAt: string | undefined): string {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!resetAt) return;

    const update = () => {
      const now = Date.now();
      const target = new Date(resetAt).getTime();
      const diff = Math.max(0, target - now);

      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [resetAt]);

  return timeLeft;
}

// =============================================================================
// VARIANT CONTENT
// =============================================================================

function LimitContent({
  featureName,
  used,
  limit,
  countdown,
}: {
  featureName: string;
  used: number;
  limit: number;
  countdown: string;
}) {
  const featureLabel = featureName === "backtest" ? "回测" : "AI 调用";
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white">
          {featureLabel}额度已用完
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          今日已使用 <span className="font-mono text-yellow-400">{used}/{limit}</span> 次{featureLabel}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="text-center p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-sm text-gray-400 mb-1">额度将在以下时间重置</p>
          <p className="font-mono text-xl text-blue-400">{countdown || "计算中..."}</p>
        </div>
        <p className="text-sm text-gray-400">
          升级到进阶版可享受每日 50 次{featureLabel}，专业版则无限制。
        </p>
      </div>
    </>
  );
}

function LockContent({ templateName }: { templateName: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white flex items-center gap-2">
          <span className="text-2xl">🔒</span>
          模板需要升级解锁
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          <span className="text-white font-medium">{templateName}</span> 是进阶版及以上计划专属模板
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-sm text-gray-400">
            升级后解锁全部 6 个内置策略模板，包括 MACD 动量、布林带突破和多因子综合策略。
          </p>
        </div>
      </div>
    </>
  );
}

function AhaContent({ sharpeRatio }: { sharpeRatio: number }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white flex items-center gap-2">
          <span className="text-2xl animate-pulse">✨</span>
          策略表现出色！
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          夏普比率达到 <span className="font-mono text-green-400">{sharpeRatio.toFixed(2)}</span>，表现优异！
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="p-4 bg-gradient-to-br from-green-900/30 to-blue-900/30 rounded-lg border border-green-700/30">
          <p className="text-sm text-gray-300">
            升级到 Pro 版可以获得 30+ 专业量化指标、更多历史数据和无限回测次数，
            进一步优化你的高收益策略。
          </p>
        </div>
      </div>
    </>
  );
}

function UpsellContent() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white">
          解锁专业量化指标
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          Pro 版提供 30+ 专业指标，助你更精准地评估策略表现
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
            <div className="flex items-center gap-1"><span className="text-blue-400">+</span> Calmar 比率</div>
            <div className="flex items-center gap-1"><span className="text-blue-400">+</span> Sortino 比率</div>
            <div className="flex items-center gap-1"><span className="text-blue-400">+</span> 最大连续亏损</div>
            <div className="flex items-center gap-1"><span className="text-blue-400">+</span> 盈亏比分析</div>
            <div className="flex items-center gap-1"><span className="text-blue-400">+</span> 月度收益分布</div>
            <div className="flex items-center gap-1"><span className="text-blue-400">+</span> 滚动夏普比率</div>
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function UpgradeDialog({
  open,
  onOpenChange,
  variant,
  featureName = "backtest",
  used = 0,
  limit = 0,
  resetAt,
  templateName = "",
  sharpeRatio = 0,
}: UpgradeDialogProps) {
  const countdown = useCountdown(resetAt);

  const handleUpgrade = () => {
    // Navigate to subscription settings
    window.location.href = "/dashboard/settings/subscription";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        {variant === "limit" && (
          <LimitContent
            featureName={featureName}
            used={used}
            limit={limit}
            countdown={countdown}
          />
        )}
        {variant === "lock" && <LockContent templateName={templateName} />}
        {variant === "aha" && <AhaContent sharpeRatio={sharpeRatio} />}
        {variant === "upsell" && <UpsellContent />}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-600 text-gray-400 hover:text-white"
          >
            稍后再说
          </Button>
          <Button
            onClick={handleUpgrade}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            {variant === "aha" ? "解锁 Pro 版" : "查看升级方案"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeDialog;
