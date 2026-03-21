"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import {
  PLAN_DISPLAY,
  getLimitsForPlan,
  normalizePlanTier,
  type PlanTier,
  type PlanDisplayInfo,
} from "@/lib/config/plan-limits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { showToast } from "@/lib/toast";

// Feature comparison rows for the plan table
const FEATURE_ROWS: Array<{
  label: string;
  key: string;
  getValue: (tier: PlanTier) => string;
}> = [
  {
    label: "AI 策略生成",
    key: "aiCalls",
    getValue: (t) => {
      const v = getLimitsForPlan(t).dailyAiCalls;
      return v === Infinity ? "无限" : `${v} 次/天`;
    },
  },
  {
    label: "单股回测",
    key: "backtests",
    getValue: (t) => {
      const v = getLimitsForPlan(t).dailyBacktests;
      return v === Infinity ? "无限" : `${v} 次/天`;
    },
  },
  {
    label: "历史数据",
    key: "history",
    getValue: (t) => {
      const v = getLimitsForPlan(t).historyYears;
      return v === Infinity ? "全量" : `近 ${v} 年`;
    },
  },
  {
    label: "多股验证",
    key: "multiStock",
    getValue: (t) => {
      const v = getLimitsForPlan(t).maxMultiStocks;
      if (v === 0) return "—";
      if (v === Infinity) return "无限";
      return `${v} 只/次`;
    },
  },
  {
    label: "AI 投资顾问",
    key: "advisor",
    getValue: (t) => {
      const m = getLimitsForPlan(t).advisorMode;
      if (m === "none") return "—";
      if (m === "single") return "基础模式";
      return "完整版 (11 Agent + 辩论)";
    },
  },
  {
    label: "策略诊断",
    key: "diagnostic",
    getValue: (t) => {
      const v = getLimitsForPlan(t).diagnosticRules;
      if (v === 0) return "—";
      if (v === Infinity) return "完整";
      return `${v} 条规则`;
    },
  },
  {
    label: "策略市场",
    key: "marketplace",
    getValue: (t) => {
      const m = getLimitsForPlan(t).marketplace;
      if (m === "browse") return "只读浏览";
      if (m === "subscribe") return "可订阅 (3个)";
      return "无限订阅 + 上架";
    },
  },
  {
    label: "数据导出",
    key: "export",
    getValue: (t) => {
      const m = getLimitsForPlan(t).dataExport;
      if (m === "none") return "—";
      if (m === "csv") return "CSV";
      return "CSV + JSON + PDF";
    },
  },
  {
    label: "结果保存",
    key: "saved",
    getValue: (t) => {
      const v = getLimitsForPlan(t).maxSavedResults;
      return v === Infinity ? "无限" : `${v} 份`;
    },
  },
  {
    label: "AI Token (月)",
    key: "tokens",
    getValue: (t) => {
      const map: Record<string, string> = {
        free: "50K",
        basic: "500K",
        pro: "5M",
        enterprise: "无限",
      };
      return map[t] ?? "50K";
    },
  },
];

function formatPrice(plan: PlanDisplayInfo, cycle: "monthly" | "yearly"): string {
  if (plan.priceMonthly === 0) return "免费";
  if (plan.priceMonthly < 0) return "联系我们";
  if (cycle === "yearly") {
    const monthlyEquiv = Math.round(plan.priceYearly / 12);
    return `¥${monthlyEquiv}`;
  }
  return `¥${plan.priceMonthly}`;
}

function PriceSuffix({ plan, cycle }: { plan: PlanDisplayInfo; cycle: "monthly" | "yearly" }) {
  if (plan.priceMonthly <= 0) return null;
  return (
    <span className="text-xs text-white/40">/月</span>
  );
}

function YearlySaving({ plan }: { plan: PlanDisplayInfo }) {
  if (plan.priceMonthly <= 0) return null;
  const monthlyTotal = plan.priceMonthly * 12;
  const saved = monthlyTotal - plan.priceYearly;
  const pct = Math.round((saved / monthlyTotal) * 100);
  return (
    <span className="text-xs text-profit">
      年付省 {pct}%
    </span>
  );
}

type PaymentMethod = "wallet" | "alipay" | "wechat";

interface CheckoutResponse {
  success?: boolean;
  order_no?: string;
  subscription?: {
    plan_code: string;
    status: string;
    expires_at?: string;
  };
  pay_url?: string;
  error?: string;
  topup_url?: string;
  message?: string;
}

/**
 * Subscription Settings Component
 * 4-tier pricing: Explorer (free) / Trader (49) / Pro (149) / Enterprise
 */
export function SubscriptionSettings() {
  const { data: overview, isLoading } = useAccountOverview();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Checkout dialog state
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanDisplayInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showInsufficientDialog, setShowInsufficientDialog] = useState(false);
  const [topupUrl, setTopupUrl] = useState("https://identity.lurus.cn/wallet/topup");

  const currentPlan = normalizePlanTier(overview?.subscription?.plan_code);
  const currentDisplay = PLAN_DISPLAY.find((p) => p.code === currentPlan) ?? PLAN_DISPLAY[0]!;

  const handleUpgrade = useCallback((code: PlanTier) => {
    if (code === currentPlan) return;
    if (code === "enterprise") {
      window.open("mailto:sales@lurus.cn?subject=Lucrum 企业版咨询", "_blank");
      return;
    }
    const plan = PLAN_DISPLAY.find((p) => p.code === code);
    if (!plan) return;
    setSelectedPlan(plan);
    setCheckoutError(null);
    setPaymentMethod("wallet");
    setIsCheckoutDialogOpen(true);
  }, [currentPlan]);

  const handleConfirmCheckout = useCallback(async () => {
    if (!selectedPlan) return;
    setIsUpgrading(true);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/lurus/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_code: selectedPlan.code,
          billing_cycle: billingCycle,
          payment_method: paymentMethod,
        }),
      });

      const data = (await res.json()) as CheckoutResponse;

      if (!res.ok) {
        if (res.status === 402 && data.error === "insufficient_balance") {
          // Insufficient balance — show topup dialog
          setTopupUrl(data.topup_url ?? "https://identity.lurus.cn/wallet/topup");
          setIsCheckoutDialogOpen(false);
          setShowInsufficientDialog(true);
          return;
        }
        setCheckoutError(data.message ?? data.error ?? "Checkout failed");
        return;
      }

      // Success path
      if (data.subscription) {
        // Wallet payment — immediate activation
        setIsCheckoutDialogOpen(false);
        void queryClient.invalidateQueries({ queryKey: ["account-overview"] });
        showToast.success(
          `Upgraded to ${selectedPlan.name}!`,
        );
      } else if (data.pay_url) {
        // External payment — redirect to payment gateway
        setIsCheckoutDialogOpen(false);
        window.location.href = data.pay_url;
      } else if (data.order_no) {
        // Order created but needs external confirmation — redirect to callback
        setIsCheckoutDialogOpen(false);
        window.location.href = `/dashboard/checkout/callback?order_no=${encodeURIComponent(data.order_no)}`;
      }
    } catch {
      setCheckoutError("Network error, please try again");
    } finally {
      setIsUpgrading(false);
    }
  }, [selectedPlan, billingCycle, paymentMethod, queryClient]);

  // Computed price for checkout dialog
  const selectedPrice = selectedPlan
    ? billingCycle === "yearly"
      ? selectedPlan.priceYearly
      : selectedPlan.priceMonthly
    : 0;

  // Usage stats from account overview
  const walletBalance = overview?.wallet?.balance ?? 0;
  const subStatus = overview?.subscription?.status;
  const subExpires = overview?.subscription?.expires_at;

  return (
    <div className="space-y-8">
      {/* Current plan banner */}
      <div className="p-6 bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl border border-accent/30">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center text-3xl">
              {currentDisplay.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">
                  {currentDisplay.name}
                </h3>
                <span className="text-sm text-white/50">
                  {currentDisplay.nameEn}
                </span>
              </div>
              <p className="text-sm text-white/60 mt-1">
                {currentDisplay.tagline}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span className="px-2 py-0.5 text-xs rounded-full bg-profit/20 text-profit border border-profit/30">
                  当前套餐
                </span>
                {subStatus === "active" && subExpires && (
                  <span className="text-xs text-white/40">
                    到期: {new Date(subExpires).toLocaleDateString("zh-CN")}
                  </span>
                )}
                {currentPlan === "free" && (
                  <span className="text-xs text-white/40">永久免费</span>
                )}
              </div>
            </div>
          </div>
          {/* LuBell balance + topup */}
          <div className="text-right hidden sm:block">
            <span className="text-xs text-white/40">鹿贝余额</span>
            <div className="text-lg font-mono tabular-nums text-amber-400 mt-0.5">
              {walletBalance.toFixed(2)} <span className="text-xs">LB</span>
            </div>
            {(overview?.wallet?.frozen ?? 0) > 0 && (
              <div className="text-xs font-mono tabular-nums text-white/30 mt-0.5">
                冻结: {overview!.wallet.frozen.toFixed(2)} LB
              </div>
            )}
            <a
              href={overview?.topup_url ?? "https://identity.lurus.cn/wallet/topup"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 px-3 py-1 text-xs font-medium rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition border border-amber-500/30"
            >
              充值
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Plan comparison */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-medium text-white flex items-center gap-2">
            套餐对比
          </h3>

          {/* Billing cycle toggle */}
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-lg">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                billingCycle === "monthly"
                  ? "bg-accent text-primary-600 font-medium"
                  : "text-white/60 hover:text-white"
              }`}
            >
              月付
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                billingCycle === "yearly"
                  ? "bg-accent text-primary-600 font-medium"
                  : "text-white/60 hover:text-white"
              }`}
            >
              年付
            </button>
          </div>
        </div>

        {/* 4-column pricing grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLAN_DISPLAY.map((plan) => {
            const isCurrent = plan.code === currentPlan;
            return (
              <div
                key={plan.code}
                className={`relative p-4 rounded-xl border transition ${
                  plan.highlighted
                    ? "bg-accent/5 border-accent/40"
                    : "bg-white/5 border-white/10"
                } ${isCurrent ? "ring-2 ring-accent" : ""}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[10px] rounded-full bg-accent text-primary-600 font-medium">
                    推荐
                  </div>
                )}

                {/* Header */}
                <div className="text-center mb-3">
                  <div className="text-2xl mb-1">{plan.icon}</div>
                  <h4 className="text-base font-bold text-white">{plan.name}</h4>
                  <p className="text-[10px] text-white/40">{plan.nameEn}</p>
                </div>

                {/* Price */}
                <div className="text-center mb-1">
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    {formatPrice(plan, billingCycle)}
                  </span>
                  <PriceSuffix plan={plan} cycle={billingCycle} />
                </div>
                <div className="text-center mb-4 h-4">
                  {billingCycle === "yearly" && <YearlySaving plan={plan} />}
                </div>

                {/* Tagline */}
                <p className="text-[11px] text-white/50 text-center mb-4 min-h-[2rem]">
                  {plan.tagline}
                </p>

                {/* Action */}
                <button
                  onClick={() => handleUpgrade(plan.code)}
                  disabled={isCurrent || isUpgrading || isLoading}
                  className={`w-full py-2 text-sm rounded-lg font-medium transition ${
                    isCurrent
                      ? "bg-white/10 text-white/50 cursor-not-allowed"
                      : plan.highlighted
                      ? "bg-accent text-primary-600 hover:bg-accent/90"
                      : plan.code === "enterprise"
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {isCurrent
                    ? "当前套餐"
                    : plan.code === "enterprise"
                    ? "联系销售"
                    : "升级"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Feature comparison table */}
      <div>
        <h3 className="text-base font-medium text-white mb-4">
          功能对比详情
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/50 py-2 pr-4 font-normal">功能</th>
                {PLAN_DISPLAY.map((plan) => (
                  <th
                    key={plan.code}
                    className={`text-center py-2 px-2 font-medium ${
                      plan.code === currentPlan ? "text-accent" : "text-white/70"
                    }`}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-white/5">
                  <td className="py-2.5 pr-4 text-white/60 whitespace-nowrap">
                    {row.label}
                  </td>
                  {PLAN_DISPLAY.map((plan) => {
                    const val = row.getValue(plan.code);
                    const isUnavailable = val === "—";
                    return (
                      <td
                        key={plan.code}
                        className={`text-center py-2.5 px-2 font-mono tabular-nums text-xs ${
                          isUnavailable
                            ? "text-white/20"
                            : plan.code === currentPlan
                            ? "text-accent"
                            : "text-white/70"
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* FAQ */}
      <div className="p-4 bg-white/5 rounded-lg border border-white/10">
        <h4 className="text-sm font-medium text-white mb-3">
          常见问题
        </h4>
        <div className="space-y-3 text-xs">
          <details className="group">
            <summary className="text-white/70 cursor-pointer hover:text-white transition">
              如何升级套餐？
            </summary>
            <p className="text-white/50 mt-1 pl-4">
              选择您需要的套餐并点击升级按钮，支持支付宝和微信支付。
            </p>
          </details>
          <details className="group">
            <summary className="text-white/70 cursor-pointer hover:text-white transition">
              可以随时取消订阅吗？
            </summary>
            <p className="text-white/50 mt-1 pl-4">
              是的，您可以随时取消订阅。取消后可继续使用到当前计费周期结束。
            </p>
          </details>
          <details className="group">
            <summary className="text-white/70 cursor-pointer hover:text-white transition">
              AI Token 用完后怎么办？
            </summary>
            <p className="text-white/50 mt-1 pl-4">
              付费用户超出月度配额后会自动从鹿贝余额扣款（1 LB = 10,000 tokens），免费用户需升级。
            </p>
          </details>
          <details className="group">
            <summary className="text-white/70 cursor-pointer hover:text-white transition">
              年付可以退款吗？
            </summary>
            <p className="text-white/50 mt-1 pl-4">
              年付开始 7 天内可全额退款，之后按已使用月数折算退还剩余部分。
            </p>
          </details>
        </div>
      </div>

      {/* Checkout Confirmation Dialog */}
      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent className="bg-surface border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              Confirm Subscription
            </DialogTitle>
            <DialogDescription className="text-white/60">
              You are upgrading to {selectedPlan?.name} ({selectedPlan?.nameEn}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Plan summary */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedPlan?.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{selectedPlan?.name}</p>
                  <p className="text-xs text-white/50">
                    {billingCycle === "yearly" ? "Annual" : "Monthly"} billing
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold font-mono tabular-nums text-white">
                  ¥{selectedPrice}
                </p>
                <p className="text-xs text-white/40">
                  {billingCycle === "yearly" ? "/year" : "/month"}
                </p>
              </div>
            </div>

            {/* Payment method selector */}
            <div>
              <label className="text-sm text-white/70 mb-2 block">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "wallet" as const, label: "Wallet", sub: `${walletBalance.toFixed(2)} LB` },
                    { key: "alipay" as const, label: "Alipay", sub: "" },
                    { key: "wechat" as const, label: "WeChat", sub: "" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key)}
                    className={`p-3 rounded-lg border text-center transition ${
                      paymentMethod === m.key
                        ? "border-accent bg-accent/10 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                    }`}
                  >
                    <span className="text-sm font-medium block">{m.label}</span>
                    {m.sub && (
                      <span className="text-[10px] text-white/40 font-mono tabular-nums block mt-0.5">
                        {m.sub}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Wallet balance warning */}
            {paymentMethod === "wallet" && selectedPrice > walletBalance && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                Current wallet balance (¥{walletBalance.toFixed(2)}) is less than ¥{selectedPrice}.
                You may need to top up first.
              </p>
            )}

            {/* Error message */}
            {checkoutError && (
              <p className="text-xs text-loss bg-loss/10 border border-loss/20 rounded-lg p-2">
                {checkoutError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setIsCheckoutDialogOpen(false)}
              disabled={isUpgrading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleConfirmCheckout()}
              disabled={isUpgrading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-primary-600 hover:bg-accent/90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isUpgrading && (
                <div className="w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
              )}
              {isUpgrading ? "Processing..." : `Pay ¥${selectedPrice}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insufficient Balance Dialog */}
      <Dialog open={showInsufficientDialog} onOpenChange={setShowInsufficientDialog}>
        <DialogContent className="bg-surface border-white/10 text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              Insufficient Balance
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Your wallet balance is not enough for this subscription.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-sm text-white/70">Current Balance</span>
              <span className="text-sm font-mono tabular-nums text-amber-400">
                ¥{walletBalance.toFixed(2)} LB
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-sm text-white/70">Required</span>
              <span className="text-sm font-mono tabular-nums text-white">
                ¥{selectedPrice}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowInsufficientDialog(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
            >
              Cancel
            </button>
            <a
              href={topupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition border border-amber-500/30"
            >
              Top Up Wallet
            </a>
            <button
              onClick={() => {
                setShowInsufficientDialog(false);
                setPaymentMethod("alipay");
                setIsCheckoutDialogOpen(true);
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-primary-600 hover:bg-accent/90 transition"
            >
              Pay with Alipay
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
