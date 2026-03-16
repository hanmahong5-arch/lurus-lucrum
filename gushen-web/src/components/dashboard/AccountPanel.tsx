/**
 * Account Panel Component
 *
 * Displays Lurus identity overview: LurusID, VIP badge, Lubell wallet balance,
 * subscription plan, discount tier, and top-up shortcut.
 * Follows gushen dark-first design system (bg-surface, font-mono tabular-nums).
 */

import Link from 'next/link';
import type { AccountOverview } from '@/hooks/useAccountOverview';
import { getPlanDisplay } from '@/lib/config/plan-limits';

// VIP level color classes (dark-first design)
const VIP_COLORS: Record<number, string> = {
  0: 'text-white/40',
  1: 'text-slate-300',    // Silver
  2: 'text-amber-400',    // Gold
  3: 'text-indigo-300',   // Platinum
  4: 'text-cyan-300',     // Diamond
};

// Subscription status color + label
const SUB_STATUS: Record<string, { color: string; label: string }> = {
  active:  { color: 'text-profit', label: '订阅中' },
  grace:   { color: 'text-orange-400', label: '宽限期' },
  expired: { color: 'text-loss', label: '已到期' },
};

// Discount tier info from identity (based on LB balance thresholds)
const DISCOUNT_TIERS: Array<{ min: number; name: string; rate: string; color: string }> = [
  { min: 2000, name: '钻石', rate: '85折', color: 'text-cyan-300' },
  { min: 500,  name: '黄金', rate: '9折',  color: 'text-amber-400' },
  { min: 100,  name: '白银', rate: '95折', color: 'text-slate-300' },
];

function getVipColor(level: number): string {
  return VIP_COLORS[level] ?? VIP_COLORS[0]!;
}

function getSubStatus(status: string | undefined): { color: string; label: string } {
  if (!status) return { color: 'text-white/30', label: '体验版' };
  return SUB_STATUS[status] ?? { color: 'text-white/40', label: status };
}

function getDiscountTier(balance: number): { name: string; rate: string; color: string } | null {
  for (const tier of DISCOUNT_TIERS) {
    if (balance >= tier.min) return tier;
  }
  return null;
}

interface AccountPanelProps {
  overview: AccountOverview;
}

export function AccountPanel({ overview }: AccountPanelProps) {
  const { account, vip, wallet, subscription, topup_url } = overview;
  const vipColor = getVipColor(vip?.level ?? 0);
  const subStatus = getSubStatus(subscription?.status);
  const planDisplay = getPlanDisplay(subscription?.plan_code);
  const balance = wallet?.balance ?? 0;
  const discountTier = getDiscountTier(balance);

  const topupLink = `${topup_url ?? ''}?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '/')}&from=lurus-gushen`;

  return (
    <div className="px-2 py-1.5 space-y-1.5 border-b border-border mb-1">
      {/* LurusID + VIP */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50 font-mono">{account?.lurus_id ?? '—'}</span>
        <span className={`text-xs font-medium ${vipColor}`}>{vip?.level_name ?? '免费'}</span>
      </div>

      {/* Plan badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">套餐</span>
        <Link href="/dashboard/settings" className="flex items-center gap-1 hover:opacity-80 transition">
          <span className="text-xs">{planDisplay.icon}</span>
          <span className={`text-xs font-medium ${subscription?.status === 'active' ? 'text-accent' : 'text-white/50'}`}>
            {planDisplay.name}
          </span>
          <span className={`text-[10px] ${subStatus.color}`}>
            {subStatus.label}
          </span>
        </Link>
      </div>

      {/* Lubell wallet balance */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">鹿贝</span>
        <div className="flex items-center gap-1.5">
          {discountTier && (
            <span className={`text-[10px] px-1 py-0.5 rounded ${discountTier.color} bg-white/5`}>
              {discountTier.rate}
            </span>
          )}
          <span className="text-sm font-mono tabular-nums text-amber-400">
            {balance.toFixed(2)}
            <span className="text-[10px] ml-0.5">LB</span>
          </span>
        </div>
      </div>

      {/* Top-up button */}
      <a
        href={topupLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center text-xs py-1 px-2 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
      >
        充值鹿贝
      </a>
    </div>
  );
}
