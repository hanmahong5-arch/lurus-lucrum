/**
 * Dashboard Header Component
 * Shared header for all dashboard pages with:
 * - 7-module flat navigation (no "more" dropdown)
 * - Responsive hamburger menu for mobile
 * - User account status and role display
 * - Auto-save indicator
 * - Settings gear icon on the right
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
import { TaskNotificationBell } from '@/components/task/task-notification-bell';
import { useI18n } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/dictionaries/zh';
import {
  PenTool,
  Store,
  FlaskConical,
  TrendingUp,
  Radar,
  Bot,
  History,
  Trophy,
  Settings,
  Star,
  Users,
} from 'lucide-react';
import { useWatchlistStore, selectIsPanelOpen, selectTotalStockCount } from '@/lib/stores/watchlist-store';
import { cn } from '@/lib/utils';
import { StreakBadge } from '@/components/dashboard/streak-badge';
import { NotificationBell } from '@/components/team/notification-bell';

// ---------------------------------------------------------------------------
// Navigation definition — 7 focused modules, always visible
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  key: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', key: 'nav.strategyEditor', icon: PenTool },
  { href: '/dashboard/marketplace', key: 'nav.marketplace', icon: Store },
  { href: '/dashboard/validation', key: 'nav.validation', icon: FlaskConical },
  { href: '/dashboard/trading', key: 'nav.trading', icon: TrendingUp },
  { href: '/dashboard/analysis', key: 'nav.analysis', icon: Radar },
  { href: '/dashboard/advisor', key: 'nav.advisor', icon: Bot },
  { href: '/dashboard/history', key: 'nav.history', icon: History },
  { href: '/dashboard/leaderboard', key: 'nav.leaderboard', icon: Trophy },
  { href: '/dashboard/team', key: 'nav.team', icon: Users },
];

// Role display mapping — keys reference i18n translation keys
const ROLE_COLORS: Record<string, string> = {
  free: 'text-white/50',
  basic: 'text-accent',
  pro: 'text-profit',
  enterprise: 'text-cyan-400',
  standard: 'text-accent',
  premium: 'text-profit',
};

const ROLE_I18N_KEYS: Record<string, TranslationKey> = {
  free: 'upgrade.explorer',
  basic: 'upgrade.trader',
  pro: 'upgrade.pro',
  enterprise: 'upgrade.enterprise',
  standard: 'upgrade.trader',
  premium: 'upgrade.pro',
};

/**
 * Get role color and i18n key with fallback
 */
function getRoleColor(role: string | undefined | null): string {
  return ROLE_COLORS[role || 'free'] ?? 'text-white/50';
}

function getRoleI18nKey(role: string | undefined | null): TranslationKey {
  return ROLE_I18N_KEYS[role || 'free'] ?? 'upgrade.explorer';
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
  const { t } = useI18n();

  // Pro/Enterprise users have no limits — hide bar
  if (plan === 'pro' || plan === 'enterprise' || plan === 'premium' || loading || total <= 0) return null;

  const usedPercent = Math.min(100, Math.round(((total - remaining) / total) * 100));
  const remainingPercent = 100 - usedPercent;

  return (
    <div className="flex items-center gap-2 text-xs text-white/50" title={`${t('header.quota')}: ${remaining} / ${total} tokens`}>
      <span className="hidden sm:inline">{t('header.quota')}</span>
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
  const watchlistPanelOpen = useWatchlistStore(selectIsPanelOpen);
  const watchlistCount = useWatchlistStore(selectTotalStockCount);
  const { togglePanel: toggleWatchlistPanel } = useWatchlistStore();

  const { t } = useI18n();
  const roleColor = getRoleColor(user?.role);
  const roleLabel = t(getRoleI18nKey(user?.role));
  const userInitials = getUserInitials(user?.name, user?.email);
  const { data: accountOverview } = useAccountOverview();

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-400 flex items-center justify-center">
                <span className="text-primary-600 font-bold">L</span>
              </div>
              <span className="text-lg font-bold text-white hidden sm:inline">
                Lucrum<span className="text-accent">.</span>
              </span>
            </Link>

            {/* Desktop Navigation — 7 modules, always visible */}
            <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
              {NAV_ITEMS.map((item) => {
                const isActive = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                      isActive
                        ? 'text-accent bg-accent/10'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden lg:inline">{t(item.key)}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right side — Settings, Notifications, Quota & Account */}
            <div className="flex items-center gap-2">
              {/* Daily streak badge */}
              <StreakBadge />

              {/* Watchlist toggle */}
              <button
                onClick={toggleWatchlistPanel}
                className={cn(
                  'relative p-1.5 rounded-md transition',
                  watchlistPanelOpen
                    ? 'text-accent bg-accent/10'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                )}
                title="自选股 (f)"
                aria-label="Toggle watchlist panel"
              >
                <Star className="w-4.5 h-4.5" />
                {watchlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center px-0.5 rounded-full bg-accent text-void text-[9px] font-bold font-mono tabular-nums">
                    {watchlistCount > 99 ? '99+' : watchlistCount}
                  </span>
                )}
              </button>

              {/* Task notification bell */}
              <TaskNotificationBell />

              {/* Team notification bell */}
              <NotificationBell />

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

              {/* Settings gear */}
              <Link
                href="/dashboard/settings"
                className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition"
                title={t('nav.settings')}
              >
                <Settings className="w-4.5 h-4.5" />
              </Link>

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
                      <span className={`text-xs ${roleColor} hidden sm:inline`}>
                        {roleLabel}
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
                          {user.name || t('role.noName')}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs ${roleColor} font-medium`}>
                            {roleLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t('role.member')}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings">
                        {t('nav.settings')}
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings?tab=account">
                        {t('nav.account')}
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/strategies">
                        {t('nav.strategies')}
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings?tab=referral">
                        {t('nav.referral')}
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="text-loss focus:text-loss cursor-pointer"
                      onClick={() => signOut({ callbackUrl: '/' })}
                    >
                      {t('nav.logout')}
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
                  {t('nav.login')}
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
            {NAV_ITEMS.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'text-accent bg-accent/10'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(item.key)}
                </Link>
              );
            })}

            {/* Settings in mobile menu */}
            <Link
              href="/dashboard/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                isNavActive(pathname, '/dashboard/settings')
                  ? 'text-accent bg-accent/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" />
              {t('nav.settings')}
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}

export default DashboardHeader;
