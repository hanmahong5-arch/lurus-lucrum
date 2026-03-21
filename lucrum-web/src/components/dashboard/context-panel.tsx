'use client';

/**
 * Returning User Context Panel
 *
 * Shown on the dashboard when a returning user has no active editing
 * session. Displays:
 * - Greeting with date and day-of-week
 * - Today's market overview (major indices)
 * - User's strategy signals (from saved strategies + watchlist)
 * - Continue last work (latest draft / result from workspace store)
 * - Quick action buttons
 *
 * Auto-hides when the user starts editing (generates strategy,
 * loads template, has code in workspace).
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useMajorIndices } from '@/hooks/use-market-data';
import { useUserWorkspace } from '@/hooks/use-user-workspace';
import {
  useStrategyWorkspaceStore,
  selectGeneratedCode,
  selectStrategyInput,
} from '@/lib/stores/strategy-workspace-store';
import {
  PenTool,
  FlaskConical,
  Search,
  TrendingUp,
  ArrowRight,
  Calendar,
  BarChart3,
  FileText,
} from 'lucide-react';

// =============================================================================
// HELPERS
// =============================================================================

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** Format date as YYYY-MM-DD 周X */
function formatDateLine(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dayName = DAY_NAMES[date.getDay()] ?? '周一';
  return `${y}-${m}-${d} ${dayName}`;
}

/** Get time-of-day greeting in Chinese */
function getGreeting(hour: number): string {
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

/** Format index change with arrow indicator */
function formatChange(change: number): { text: string; className: string; arrow: string } {
  if (change >= 0) {
    return {
      text: `+${change.toFixed(2)}%`,
      className: 'text-profit',
      arrow: '\u25B2',
    };
  }
  return {
    text: `${change.toFixed(2)}%`,
    className: 'text-loss',
    arrow: '\u25BC',
  };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** Section header with icon and title */
function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-accent" />
      <h3 className="text-sm font-medium text-white/90">{title}</h3>
    </div>
  );
}

/** Market Indices Overview */
function MarketOverview() {
  const { data: indices, loading, isFallback } = useMajorIndices({ refreshInterval: 30_000 });

  // Show only 4 key indices: Shanghai Composite, Shenzhen Component, ChiNext, STAR50
  const keyIndices = useMemo(() => {
    if (!indices) return [];
    const targetSymbols = ['000001.SH', '399001.SZ', '399006.SZ', '000688.SH'];
    return targetSymbols
      .map((sym) => indices.find((idx) => idx.symbol === sym))
      .filter((idx): idx is NonNullable<typeof idx> => idx != null);
  }, [indices]);

  if (loading && !indices) {
    return (
      <div className="glass-panel rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-24 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4">
      <SectionHeader title="今日市场" icon={BarChart3} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {keyIndices.map((idx) => {
          const change = formatChange(idx.changePercent);
          return (
            <div
              key={idx.symbol}
              className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
            >
              <span className="text-xs text-white/50 truncate">{idx.name}</span>
              <span className="text-sm font-mono tabular-nums text-white/90">
                {idx.price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
              <span className={cn('text-xs font-mono tabular-nums', change.className)}>
                {change.arrow}{change.text}
              </span>
            </div>
          );
        })}
      </div>
      {isFallback && (
        <p className="text-[10px] text-white/20 mt-2 text-right">
          *示例数据 (市场数据加载中)
        </p>
      )}
    </div>
  );
}

/** Continue Last Work section */
function ContinueLastWork({ strategyInput, hasDraft }: { strategyInput: string; hasDraft: boolean }) {
  if (!hasDraft && !strategyInput) return null;

  return (
    <div className="glass-panel rounded-xl p-4">
      <SectionHeader title="继续上次的工作" icon={FileText} />
      <div className="space-y-2">
        {hasDraft && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <span className="text-sm text-white/70 truncate">
                {strategyInput
                  ? `策略草稿: ${strategyInput.length > 30 ? strategyInput.slice(0, 30) + '...' : strategyInput}`
                  : '未命名策略草稿'}
              </span>
              <span className="text-xs text-white/30 shrink-0">[草稿]</span>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors shrink-0 ml-2"
            >
              继续编辑
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Quick Actions grid */
function QuickActions() {
  const actions = [
    { label: '新建策略', href: '/dashboard', icon: PenTool },
    { label: '组合回测', href: '/dashboard/validation', icon: FlaskConical },
    { label: '扫描信号', href: '/dashboard/analysis', icon: Search },
    { label: '交易面板', href: '/dashboard/trading', icon: TrendingUp },
  ];

  return (
    <div className="glass-panel rounded-xl p-4">
      <SectionHeader title="快速操作" icon={PenTool} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-lg',
                'bg-white/[0.03] border border-white/[0.06]',
                'hover:bg-accent/5 hover:border-accent/20',
                'transition-all duration-150',
                'text-sm text-white/70 hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 text-accent/70" />
              <span>{action.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface ContextPanelProps {
  className?: string;
}

export function ContextPanel({ className }: ContextPanelProps) {
  const { user } = useUserWorkspace();
  const generatedCode = useStrategyWorkspaceStore(selectGeneratedCode);
  const strategyInput = useStrategyWorkspaceStore(selectStrategyInput);

  const now = useMemo(() => new Date(), []);
  const greeting = getGreeting(now.getHours());
  const dateStr = formatDateLine(now);

  // Determine display name (truncate if too long)
  const displayName = useMemo(() => {
    const name = user?.name;
    if (!name) return '';
    return name.length > 10 ? name.slice(0, 10) + '...' : name;
  }, [user?.name]);

  const hasDraft = !!generatedCode || !!strategyInput;

  return (
    <div className={cn('max-w-4xl mx-auto space-y-4 px-4 sm:px-6 py-6', className)}>
      {/* Greeting header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white/90">
          {greeting}{displayName ? `，${displayName}` : ''}
        </h2>
        <div className="flex items-center gap-1.5 text-sm text-white/40">
          <Calendar className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">{dateStr}</span>
        </div>
      </div>

      {/* Market overview */}
      <MarketOverview />

      {/* Continue last work */}
      <ContinueLastWork strategyInput={strategyInput} hasDraft={hasDraft} />

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}
