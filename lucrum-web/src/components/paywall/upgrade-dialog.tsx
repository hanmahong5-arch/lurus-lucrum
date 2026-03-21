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

export type UpgradeDialogVariant = "limit" | "lock" | "aha" | "upsell" | "balance" | "multistock";

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
  /** Topup URL for balance variant */
  topupUrl?: string;
  /** Current wallet balance for balance variant */
  currentBalance?: number;
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
  const isAi = featureName === "ai_call" || featureName === "ai";
  const featureLabel = isAi ? "AI 策略生成" : "回测";
  const proFeature = isAi ? "无限 AI 策略生成" : "无限回测次数";
  const nudge = isAi
    ? "Pro 用户的夏普比率平均高 40%"
    : "Pro 用户的策略验证更充分，收益更稳定";
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white">
          今日{featureLabel}次数已用完
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          今日已使用 <span className="font-mono text-yellow-400">{used}/{limit}</span> 次{featureLabel}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="text-center p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-sm text-gray-400 mb-1">额度将在以下时间重置</p>
          <p className="font-mono text-2xl text-blue-400">{countdown || "计算中..."}</p>
        </div>
        <div className="p-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-700/20">
          <p className="text-xs text-blue-300 mb-1">{nudge}</p>
          <p className="text-sm text-gray-300">
            升级 Pro 可解锁{proFeature}，不再等待。
          </p>
        </div>
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

function BalanceContent({
  currentBalance,
}: {
  currentBalance: number;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white flex items-center gap-2">
          <span className="text-2xl">💰</span>
          鹿贝余额不足
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          当前余额 <span className="font-mono text-yellow-400">{currentBalance.toFixed(2)} LB</span>，不足以完成此操作
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-sm text-gray-400">
            请先充值鹿贝（LuBell），充值后即可继续使用策略订阅、AI 调用等付费功能。
          </p>
        </div>
      </div>
    </>
  );
}

function MultistockContent() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white flex items-center gap-2">
          <span className="text-2xl">🔒</span>
          此功能需要 Pro 版
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          免费版最多验证 3 只股票，Pro 版支持 50+
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="p-4 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-700/20">
          <p className="text-sm text-gray-300 mb-2">
            多股票验证能帮你发现策略在不同标的上的真实表现，避免过拟合。
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <span className="text-blue-400">+</span> 50+ 股票同时验证
            </div>
            <div className="flex items-center gap-1">
              <span className="text-blue-400">+</span> 批量回测报告
            </div>
            <div className="flex items-center gap-1">
              <span className="text-blue-400">+</span> 板块级别分析
            </div>
            <div className="flex items-center gap-1">
              <span className="text-blue-400">+</span> 失败归因分析
            </div>
          </div>
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
  topupUrl,
  currentBalance = 0,
}: UpgradeDialogProps) {
  const countdown = useCountdown(resetAt);

  const handleUpgrade = () => {
    if (variant === "balance") {
      // Open topup page in new tab
      window.open(
        topupUrl ?? "https://identity.lurus.cn/wallet/topup",
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
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
        {variant === "balance" && <BalanceContent currentBalance={currentBalance} />}
        {variant === "multistock" && <MultistockContent />}
        {variant === "upsell" && <UpsellContent />}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-600 text-gray-400 hover:text-white"
          >
            {variant === "limit" ? "明天再来" : "稍后再说"}
          </Button>
          <Button
            onClick={handleUpgrade}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            {variant === "balance"
              ? "前往充值"
              : variant === "aha"
              ? "解锁 Pro 版"
              : variant === "multistock"
              ? "升级 Pro，无限验证"
              : "查看升级方案"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeDialog;
