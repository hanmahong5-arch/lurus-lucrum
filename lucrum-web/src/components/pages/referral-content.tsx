"use client";

/**
 * Referral Content (extracted from original page)
 *
 * Renders without DashboardHeader so it can be embedded in Settings tabs.
 */

import { useState, useEffect, useCallback } from "react";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { Copy, Users, Gift, TrendingUp, Share2, Check } from "lucide-react";

interface ReferralStats {
  aff_code: string;
  total_referrals: number;
  total_rewarded_lb: number;
}

export function ReferralContent() {
  const { data: overview } = useAccountOverview();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    async function fetchReferral() {
      try {
        const res = await fetch("/api/lurus/referral");
        if (res.ok) setStats((await res.json()) as ReferralStats);
      } catch (err) { console.error("[referral] fetch error:", err); }
      finally { setLoading(false); }
    }
    void fetchReferral();
  }, []);

  const inviteLink = stats?.aff_code
    ? `${typeof window !== "undefined" ? window.location.origin : "https://lucrum.lurus.cn"}/register?ref=${stats.aff_code}`
    : "";

  const handleCopyCode = useCallback(async () => {
    if (!stats?.aff_code) return;
    await navigator.clipboard.writeText(stats.aff_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [stats?.aff_code]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [inviteLink]);

  const handleShare = useCallback(async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try { await navigator.share({ title: "Lucrum AI 量化投资平台", text: "注册即享 5 鹿贝奖励", url: inviteLink }); return; } catch { /* fallback to copy */ }
    }
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [inviteLink]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Gift className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">邀请好友，共享奖励</h2>
        <p className="text-sm text-white/50 max-w-md mx-auto">每成功邀请一位好友注册，你将获得 5 鹿贝奖励。好友首次充值还可享受额外奖励。</p>
      </div>

      {loading ? (
        <div className="space-y-4"><div className="h-32 bg-surface rounded-xl animate-pulse" /><div className="h-24 bg-surface rounded-xl animate-pulse" /></div>
      ) : (
        <div className="space-y-4">
          {/* Referral code card */}
          <div className="p-6 bg-surface rounded-xl border border-border">
            <label className="block text-xs text-white/50 mb-2">你的邀请码</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 bg-white/5 rounded-lg font-mono text-lg text-accent tracking-widest text-center border border-accent/20">{stats?.aff_code ?? "---"}</div>
              <button onClick={() => void handleCopyCode()} className="px-4 py-3 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition flex items-center gap-2 shrink-0">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="text-sm">{copied ? "已复制" : "复制"}</span>
              </button>
            </div>
            <label className="block text-xs text-white/50 mt-4 mb-2">邀请链接</label>
            <div className="flex items-center gap-2">
              <input readOnly value={inviteLink} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 truncate" />
              <button onClick={() => void handleCopyLink()} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition text-xs text-white/60 shrink-0">{linkCopied ? "已复制" : "复制"}</button>
              <button onClick={() => void handleShare()} className="px-3 py-2 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition shrink-0"><Share2 className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-surface rounded-xl border border-border text-center">
              <Users className="w-5 h-5 text-accent mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono tabular-nums text-white">{stats?.total_referrals ?? 0}</div>
              <div className="text-xs text-white/50 mt-1">成功邀请</div>
            </div>
            <div className="p-4 bg-surface rounded-xl border border-border text-center">
              <TrendingUp className="w-5 h-5 text-profit mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono tabular-nums text-profit">{stats?.total_rewarded_lb ?? 0}</div>
              <div className="text-xs text-white/50 mt-1">累计奖励 (LB)</div>
            </div>
          </div>

          {/* Rules */}
          <div className="p-4 bg-surface/30 rounded-xl border border-border">
            <h3 className="text-sm font-medium text-white/70 mb-3">奖励规则</h3>
            <div className="space-y-2 text-xs text-white/50">
              <div className="flex items-start gap-2"><span className="text-accent shrink-0">1.</span><span>好友通过你的邀请链接注册成功，你获得 <span className="text-accent font-medium">5 LB</span></span></div>
              <div className="flex items-start gap-2"><span className="text-accent shrink-0">2.</span><span>好友首次充值，你额外获得 <span className="text-accent font-medium">10 LB</span></span></div>
              <div className="flex items-start gap-2"><span className="text-accent shrink-0">3.</span><span>好友首次订阅，你获得 <span className="text-accent font-medium">30 LB</span></span></div>
            </div>
          </div>

          {overview?.wallet && (
            <div className="text-center text-xs text-white/30">当前鹿贝余额: <span className="text-accent font-mono">{overview.wallet.balance}</span> LB</div>
          )}
        </div>
      )}
    </div>
  );
}
