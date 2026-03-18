"use client";

import { useState } from "react";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import {
  PLAN_DISPLAY,
  getLimitsForPlan,
  normalizePlanTier,
  type PlanTier,
  type PlanDisplayInfo,
} from "@/lib/config/plan-limits";

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

/**
 * Subscription Settings Component
 * 4-tier pricing: Explorer (free) / Trader (49) / Pro (149) / Enterprise
 */
export function SubscriptionSettings() {
  const { data: overview, isLoading } = useAccountOverview();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isUpgrading, setIsUpgrading] = useState(false);

  const currentPlan = normalizePlanTier(overview?.subscription?.plan_code);
  const currentDisplay = PLAN_DISPLAY.find((p) => p.code === currentPlan) ?? PLAN_DISPLAY[0]!;

  const handleUpgrade = async (code: PlanTier) => {
    if (code === currentPlan) return;
    if (code === "enterprise") {
      window.open("mailto:sales@lurus.cn?subject=Lucrum 企业版咨询", "_blank");
      return;
    }
    setIsUpgrading(true);
    // TODO: integrate with real payment API
    await new Promise((resolve) => setTimeout(resolve, 1500));
    alert(`升级到${PLAN_DISPLAY.find((p) => p.code === code)?.name}功能即将推出！`);
    setIsUpgrading(false);
  };

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
          {/* LuBell balance */}
          <div className="text-right hidden sm:block">
            <span className="text-xs text-white/40">鹿贝余额</span>
            <div className="text-lg font-mono tabular-nums text-amber-400 mt-0.5">
              {walletBalance.toFixed(2)} <span className="text-xs">LB</span>
            </div>
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
    </div>
  );
}
