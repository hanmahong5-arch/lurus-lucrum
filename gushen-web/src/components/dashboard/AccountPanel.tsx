/**
 * Account Panel Component
 *
 * Displays Lurus identity overview: LurusID, VIP badge, Lubell wallet balance,
 * subscription status, and a top-up shortcut.
 * Follows gushen dark-first design system (bg-surface, font-mono tabular-nums).
 */

import type { AccountOverview } from '@/hooks/useAccountOverview';

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

function getVipColor(level: number): string {
  return VIP_COLORS[level] ?? VIP_COLORS[0]!;
}

function getSubStatus(status: string | undefined): { color: string; label: string } {
  if (!status) return { color: 'text-white/30', label: '免费' };
  return SUB_STATUS[status] ?? { color: 'text-white/40', label: status };
}

interface AccountPanelProps {
  overview: AccountOverview;
}

export function AccountPanel({ overview }: AccountPanelProps) {
  const { account, vip, wallet, subscription, topup_url } = overview;
  const vipColor = getVipColor(vip.level);
  const subStatus = getSubStatus(subscription?.status);

  const topupLink = `${topup_url}?redirect=${encodeURIComponent(window.location.href)}&from=lurus-gushen`;

  return (
    <div className="px-2 py-1.5 space-y-1.5 border-b border-border mb-1">
      {/* LurusID + VIP */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50 font-mono">{account.lurus_id}</span>
        <span className={`text-xs font-medium ${vipColor}`}>{vip.level_name}</span>
      </div>

      {/* Lubell wallet balance */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">鹿贝余额</span>
        <span className="text-sm font-mono tabular-nums text-amber-400">
          🦌 {wallet.balance.toFixed(2)} <span className="text-xs">LB</span>
        </span>
      </div>

      {/* Subscription status */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">订阅状态</span>
        <span className={`text-xs font-medium ${subStatus.color}`}>{subStatus.label}</span>
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
