/**
 * Dashboard Header Component
 * Shared header for all dashboard pages with:
 * - Grouped navigation tabs (primary + "more" dropdown)
 * - Responsive hamburger menu for mobile
 * - User account status and role display
 * - Auto-save indicator
 * - Login/logout functionality
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';
import { useCurrentUser } from '@/hooks/use-user-workspace';
import { AutoSaveIndicator } from '@/components/strategy-editor/auto-save-indicator';
import { AccountPanel } from '@/components/dashboard/AccountPanel';
import { useAccountOverview } from '@/hooks/useAccountOverview';
import {
  useStrategyWorkspaceStore,
  selectAutoSaveStatus,
  selectWorkspace,
} from '@/lib/stores/strategy-workspace-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useQuotaStatus } from '@/hooks/use-quota-status';
import { LocaleSwitcher } from '@/components/i18n/locale-switcher';

// Primary navigation items (always visible on desktop)
const PRIMARY_NAV = [
  { href: '/dashboard', label: '策略编辑器' },
  { href: '/dashboard/marketplace', label: '策略市场' },
  { href: '/dashboard/strategy-validation', label: '策略验证' },
  { href: '/dashboard/trading', label: '交易面板' },
  { href: '/dashboard/strategy-scanner', label: '扫描选板' },
  { href: '/dashboard/agents', label: '分析任务' },
  { href: '/dashboard/history', label: '历史记录' },
];

// Secondary navigation items (inside "more" dropdown on desktop)
const MORE_NAV = [
  { href: '/dashboard/insights', label: '机构洞察' },
  { href: '/dashboard/advisor', label: '投资顾问' },
  { href: '/dashboard/diagnostics', label: '策略诊断' },
  { href: '/backtest-agent', label: '智能回测' },
];

// All items combined for mobile menu
const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV];

// Role display mapping (supports both new codes and legacy names)
const DEFAULT_ROLE_INFO = { label: '体验版', color: 'text-white/50' } as const;

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  free: DEFAULT_ROLE_INFO,
  basic: { label: '进阶版', color: 'text-accent' },
  pro: { label: '专业版', color: 'text-profit' },
  enterprise: { label: '企业版', color: 'text-cyan-400' },
  // Legacy names for backward compat
  standard: { label: '进阶版', color: 'text-accent' },
  premium: { label: '专业版', color: 'text-profit' },
};

/**
 * Get role info with fallback to default
 */
function getRoleInfo(role: string | undefined | null): { label: string; color: string } {
  const key = role || 'free';
  return ROLE_LABELS[key] ?? DEFAULT_ROLE_INFO;
}

/**
 * Get user initials from name or email
 */
function getUserInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.length > 0) {
    const parts = name.split(' ');
    const firstPart = parts[0];
    const secondPart = parts[1];
    if (parts.length >= 2 && firstPart && secondPart && firstPart.length > 0 && secondPart.length > 0) {
      const firstChar = firstPart[0];
      const secondChar = secondPart[0];
      if (firstChar && secondChar) {
        return (firstChar + secondChar).toUpperCase();
      }
    }
    return name.substring(0, Math.min(2, name.length)).toUpperCase();
  }
  if (email && email.length > 0) {
    return email.substring(0, Math.min(2, email.length)).toUpperCase();
  }
  return 'U';
}

/**
 * Check if a nav item is active
 */
function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
}

/**
 * Quota progress bar for free/standard users
 */
function QuotaBar({ userId, plan }: { userId: string; plan: string }) {
  const { remaining, total, loading } = useQuotaStatus(userId);

  // Pro/Enterprise users have no limits — hide bar
  if (plan === 'pro' || plan === 'enterprise' || plan === 'premium' || loading || total <= 0) return null;

  const usedPercent = Math.min(100, Math.round(((total - remaining) / total) * 100));
  const remainingPercent = 100 - usedPercent;

  return (
    <div className="flex items-center gap-2 text-xs text-white/50" title={`今日配额: 剩余 ${remaining} / ${total} tokens`}>
      <span className="hidden sm:inline">配额</span>
      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${remainingPercent < 20 ? 'bg-loss' : 'bg-accent'}`}
          style={{ width: `${remainingPercent}%` }}
        />
      </div>
      <span className="font-mono tabular-nums">{remaining}</span>
    </div>
  );
}

/**
 * Dashboard Header Component
 */
export function DashboardHeader() {
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const autoSaveStatus = useStrategyWorkspaceStore(selectAutoSaveStatus);
  const workspace = useStrategyWorkspaceStore(selectWorkspace);
  const { saveDraft } = useStrategyWorkspaceStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleInfo = getRoleInfo(user?.role);
  const userInitials = getUserInitials(user?.name, user?.email);
  const { data: accountOverview } = useAccountOverview();

  // Check if any "more" nav item is active
  const moreNavActive = MORE_NAV.some((item) => isNavActive(pathname, item.href));

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-400 flex items-center justify-center">
                <span className="text-primary-600 font-bold">G</span>
              </div>
              <span className="text-lg font-bold text-white">
                GuShen<span className="text-accent">.</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {PRIMARY_NAV.map((item) => {
                const isActive = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                      isActive
                        ? 'text-accent bg-accent/10'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* "More" dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1 ${
                      moreNavActive
                        ? 'text-accent bg-accent/10'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    更多
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {MORE_NAV.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={isNavActive(pathname, item.href) ? 'text-accent' : ''}
                      >
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            {/* Right side - Hamburger (mobile) + Auto-save, Quota & Account */}
            <div className="flex items-center gap-3">
              {/* Language switcher */}
              <LocaleSwitcher />

              {/* Quota progress bar (free/standard users only) */}
              {isAuthenticated && user?.id && !['pro', 'enterprise', 'premium'].includes(user.role ?? '') && (
                <QuotaBar userId={user.id} plan={user.role ?? 'free'} />
              )}

              {/* Auto-save indicator (only show on strategy editor) */}
              {pathname === '/dashboard' && (
                <AutoSaveIndicator
                  status={autoSaveStatus}
                  lastSavedAt={workspace.lastSavedAt}
                  onClick={() => {
                    if (autoSaveStatus === 'error') {
                      saveDraft();
                    }
                  }}
                />
              )}

              {/* Account Section */}
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-surface animate-pulse" />
                </div>
              ) : isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 px-2 py-1 h-auto hover:bg-surface/50"
                    >
                      {/* Role badge */}
                      <span className={`text-xs ${roleInfo.color} hidden sm:inline`}>
                        {roleInfo.label}
                      </span>

                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name || 'User'}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-accent text-sm font-medium">
                            {userInitials}
                          </span>
                        )}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-64">
                    {/* Identity overview: VIP badge + Lubell balance */}
                    {accountOverview && (
                      <AccountPanel overview={accountOverview} />
                    )}
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.name || '未设置名称'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs ${roleInfo.color} font-medium`}>
                            {roleInfo.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            会员
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/account">
                        账户设置
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings">
                        偏好设置
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/strategies">
                        我的策略
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/referral">
                        邀请返利
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="text-loss focus:text-loss cursor-pointer"
                      onClick={() => signOut({ callbackUrl: '/' })}
                    >
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signIn()}
                  className="text-sm"
                >
                  登录
                </Button>
              )}

              {/* Mobile hamburger button */}
              <button
                className="md:hidden p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile navigation overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Menu panel */}
          <nav className="absolute top-14 left-0 right-0 bg-surface border-b border-border p-4 space-y-1">
            {ALL_NAV.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'text-accent bg-accent/10'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}

export default DashboardHeader;
