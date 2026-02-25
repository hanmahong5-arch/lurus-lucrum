/**
 * Dashboard Header Component
 * 仪表板头部组件
 *
 * Shared header component for all dashboard pages with:
 * - Navigation tabs for all dashboard sections
 * - User account status and role display
 * - Auto-save indicator
 * - Login/logout functionality
 *
 * 所有仪表板页面共享的头部组件，包含：
 * - 所有仪表板部分的导航标签
 * - 用户账户状态和角色显示
 * - 自动保存指示器
 * - 登录/登出功能
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';
import { useCurrentUser } from '@/hooks/use-user-workspace';
import { AutoSaveIndicator } from '@/components/strategy-editor/auto-save-indicator';
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

// Navigation items for dashboard tabs
// 仪表板标签的导航项
// Professional-grade tabs for institutional investors
// 面向机构投资者的专业级标签
const NAV_ITEMS = [
  { href: '/dashboard', label: '策略编辑器', labelEn: 'Strategy Editor' },
  { href: '/dashboard/strategy-validation', label: '策略验证', labelEn: 'Validation' },
  { href: '/dashboard/trading', label: '交易面板', labelEn: 'Trading' },
  { href: '/dashboard/insights', label: '机构洞察', labelEn: 'Insights' },
  { href: '/dashboard/advisor', label: '投资顾问', labelEn: 'Advisor' },
  { href: '/backtest-agent', label: 'AI 回测', labelEn: 'AI Backtest' },
  { href: '/dashboard/history', label: '历史记录', labelEn: 'History' },
];

// Role display mapping
// 角色显示映射
const DEFAULT_ROLE_INFO = { label: '免费版', color: 'text-white/50' } as const;

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  free: DEFAULT_ROLE_INFO,
  standard: { label: '标准版', color: 'text-accent' },
  premium: { label: '专业版', color: 'text-profit' },
};

/**
 * Get role info with fallback to default
 * 获取角色信息，如果不存在则使用默认值
 */
function getRoleInfo(role: string | undefined | null): { label: string; color: string } {
  const key = role || 'free';
  return ROLE_LABELS[key] ?? DEFAULT_ROLE_INFO;
}

/**
 * Get user initials from name or email
 * 从名称或邮箱获取用户首字母
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
 * Dashboard Header Component
 */
export function DashboardHeader() {
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const autoSaveStatus = useStrategyWorkspaceStore(selectAutoSaveStatus);
  const workspace = useStrategyWorkspaceStore(selectWorkspace);
  const { saveDraft } = useStrategyWorkspaceStore();

  const roleInfo = getRoleInfo(user?.role);
  const userInitials = getUserInitials(user?.name, user?.email);

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-400 flex items-center justify-center">
              <span className="text-primary-600 font-bold">G</span>
            </div>
            <span className="text-lg font-bold text-white">
              GuShen<span className="text-accent">.</span>
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition ${
                    isActive
                      ? 'text-accent'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side - Auto-save & Account */}
          <div className="flex items-center gap-3">
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
                    <span className={`text-xs ${roleInfo.color}`}>
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

                <DropdownMenuContent align="end" className="w-56">
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
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
