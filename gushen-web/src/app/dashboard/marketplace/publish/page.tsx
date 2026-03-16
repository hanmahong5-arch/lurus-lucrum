"use client";

/**
 * Strategy Marketplace Publish Page
 *
 * Pro users can publish their strategies to the marketplace.
 * Requires staking 10 LB to prevent spam.
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { useUpgradeGate } from "@/hooks/use-upgrade-gate";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface UserStrategy {
  id: number;
  strategyName: string;
  description: string | null;
  version: number;
  createdAt: string;
}

type PriceType = "free" | "per_run" | "subscription";

// =============================================================================
// PAGE
// =============================================================================

export default function PublishPage() {
  const router = useRouter();
  const { data: overview } = useAccountOverview();
  const upgradeGate = useUpgradeGate(overview?.subscription?.plan_code);

  const canPublish = upgradeGate.hasAccess("strategy_publish");

  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("free");
  const [pricePerRun, setPricePerRun] = useState("5");
  const [priceMonthly, setPriceMonthly] = useState("29");

  // Fetch user's strategies
  useEffect(() => {
    async function loadStrategies() {
      try {
        const res = await fetch("/api/strategies/mine");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { strategies: UserStrategy[] };
        setStrategies(data.strategies ?? []);
      } catch {
        setStrategies([]);
      } finally {
        setLoading(false);
      }
    }
    if (canPublish) {
      void loadStrategies();
    } else {
      setLoading(false);
    }
  }, [canPublish]);

  // Auto-fill title from selected strategy
  useEffect(() => {
    if (selectedStrategyId) {
      const strategy = strategies.find((s) => s.id === selectedStrategyId);
      if (strategy) {
        if (!title) setTitle(strategy.strategyName);
        if (!description && strategy.description) setDescription(strategy.description);
      }
    }
  }, [selectedStrategyId, strategies, title, description]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedStrategyId || !title.trim()) return;

      setSubmitting(true);
      setError(null);

      try {
        const body = {
          strategy_history_id: selectedStrategyId,
          title: title.trim(),
          description: description.trim() || null,
          price_type: priceType,
          price_per_run: priceType === "per_run" ? parseFloat(pricePerRun) : 0,
          price_monthly: priceType === "subscription" ? parseFloat(priceMonthly) : 0,
        };

        const res = await fetch("/api/lurus/marketplace/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error: string };
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        setSuccess(true);
        setTimeout(() => router.push("/dashboard/marketplace"), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "发布失败");
      } finally {
        setSubmitting(false);
      }
    },
    [selectedStrategyId, title, description, priceType, pricePerRun, priceMonthly, router],
  );

  // Gate for non-Pro users
  if (!canPublish) {
    return (
      <div className="min-h-screen bg-background text-white">
        <DashboardHeader />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] px-4">
          <div className="max-w-md text-center space-y-4">
            <div className="text-5xl">🏪</div>
            <h2 className="text-xl font-bold text-white">发布策略</h2>
            <p className="text-sm text-white/50">
              成为专业版用户，将你的策略上架到策略市场，赚取 70% 分润收入
            </p>
            <div className="grid grid-cols-2 gap-3 text-[11px] text-white/40">
              <div className="p-2 bg-white/5 rounded-lg">质押 10 LB 防垃圾</div>
              <div className="p-2 bg-white/5 rounded-lg">作者获得 70% 收入</div>
              <div className="p-2 bg-white/5 rounded-lg">自由/按次/订阅定价</div>
              <div className="p-2 bg-white/5 rounded-lg">实时收入仪表盘</div>
            </div>
            <Link
              href="/dashboard/settings"
              className="inline-block px-6 py-2.5 bg-accent text-primary-600 rounded-lg font-medium text-sm hover:bg-accent/90 transition"
            >
              升级到专业版
            </Link>
          </div>
        </div>
        <UpgradeDialog
          open={upgradeGate.dialogState.open}
          onOpenChange={upgradeGate.setDialogOpen}
          variant={upgradeGate.dialogState.variant}
          featureName={upgradeGate.dialogState.featureName}
          templateName={upgradeGate.dialogState.templateName}
          sharpeRatio={upgradeGate.dialogState.sharpeRatio}
          used={upgradeGate.dialogState.used}
          limit={upgradeGate.dialogState.limit}
          resetAt={upgradeGate.dialogState.resetAt}
        />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-background text-white">
        <DashboardHeader />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-white mb-2">策略已发布！</h2>
          <p className="text-sm text-white/50">正在跳转到策略市场...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <DashboardHeader />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">发布策略到市场</h1>
          <p className="text-sm text-white/50">
            上架你的策略，其他用户订阅后你将获得 70% 的收入分润
          </p>
        </div>

        {/* Staking notice */}
        <div className="p-3 mb-6 bg-amber-500/10 rounded-lg border border-amber-500/20 text-sm text-amber-400 flex items-start gap-2">
          <span>💎</span>
          <span>
            发布策略需质押 <strong className="font-mono">10 LB</strong> 作为信誉保证金。
            策略下架时退还。当前余额:{" "}
            <strong className="font-mono">
              {overview?.wallet?.balance?.toFixed(2) ?? "0.00"} LB
            </strong>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Strategy selection */}
          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              选择策略 *
            </label>
            {loading ? (
              <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
            ) : strategies.length === 0 ? (
              <div className="p-4 text-center text-sm text-white/40 bg-white/5 rounded-lg border border-white/10">
                暂无可发布的策略。请先在策略工坊中创建并保存策略。
              </div>
            ) : (
              <select
                value={selectedStrategyId ?? ""}
                onChange={(e) =>
                  setSelectedStrategyId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-accent/50"
              >
                <option value="">请选择...</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.strategyName} (v{s.version})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              策略标题 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="例如：双均线趋势追踪 V3"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              策略描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="描述策略的核心逻辑和适用场景..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>

          {/* Price type */}
          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              定价模式 *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { value: "free", label: "免费", desc: "开放共享" },
                { value: "per_run", label: "按次付费", desc: "每次运行收费" },
                { value: "subscription", label: "月度订阅", desc: "按月收费" },
              ] as const).map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriceType(value)}
                  className={`p-3 rounded-lg border text-left transition ${
                    priceType === value
                      ? "border-accent bg-accent/10 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-white/40 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Price input */}
          {priceType === "per_run" && (
            <div>
              <label className="block text-sm text-white/70 mb-1.5">
                单次运行价格 (LB)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={pricePerRun}
                onChange={(e) => setPricePerRun(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-accent/50"
              />
              <p className="text-xs text-white/30 mt-1">
                你将获得每次 {(parseFloat(pricePerRun || "0") * 0.7).toFixed(1)} LB (70% 分润)
              </p>
            </div>
          )}

          {priceType === "subscription" && (
            <div>
              <label className="block text-sm text-white/70 mb-1.5">
                月订阅价格 (LB)
              </label>
              <input
                type="number"
                min="5"
                max="500"
                step="1"
                value={priceMonthly}
                onChange={(e) => setPriceMonthly(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-accent/50"
              />
              <p className="text-xs text-white/30 mt-1">
                你将获得每月 {(parseFloat(priceMonthly || "0") * 0.7).toFixed(1)} LB (70% 分润)
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-loss/10 rounded-lg border border-loss/20 text-sm text-loss">
              {error === "insufficient_balance"
                ? "余额不足，需要至少 10 LB 作为质押保证金"
                : error === "already_published"
                  ? "该策略版本已经发布过了"
                  : error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !selectedStrategyId || !title.trim()}
            className="w-full py-3 bg-accent text-primary-600 rounded-lg font-medium text-sm hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "发布中..." : "发布策略 (质押 10 LB)"}
          </button>
        </form>
      </main>

      <UpgradeDialog
        open={upgradeGate.dialogState.open}
        onOpenChange={upgradeGate.setDialogOpen}
        variant={upgradeGate.dialogState.variant}
        featureName={upgradeGate.dialogState.featureName}
        templateName={upgradeGate.dialogState.templateName}
        sharpeRatio={upgradeGate.dialogState.sharpeRatio}
        used={upgradeGate.dialogState.used}
        limit={upgradeGate.dialogState.limit}
        resetAt={upgradeGate.dialogState.resetAt}
      />
    </div>
  );
}
