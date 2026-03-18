"use client";

/**
 * Landing Page Header Component
 * 首页头部组件
 *
 * Unified header design matching DashboardHeader style
 * 与仪表板头部风格统一的设计
 */

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

// Role display configuration
// 角色显示配置
const DEFAULT_ROLE_INFO = { label: '免费版', color: 'text-white/50' } as const;

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  free: DEFAULT_ROLE_INFO,
  standard: { label: '标准版', color: 'text-accent' },
  premium: { label: '专业版', color: 'text-profit' },
};

function getRoleInfo(role: string | undefined | null): { label: string; color: string } {
  const key = role || 'free';
  return ROLE_LABELS[key] ?? DEFAULT_ROLE_INFO;
}

export function Header() {
  const { data: session, status } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const roleInfo = getRoleInfo((session?.user as any)?.role);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo - matches DashboardHeader style / 与仪表板头部风格一致 */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-400 flex items-center justify-center">
              <span className="text-primary-600 font-bold">G</span>
            </div>
            <span className="text-lg font-bold text-white">
              Lucrum<span className="text-accent">.</span>
            </span>
          </Link>

          {/* Navigation - simplified for landing page / 首页简化导航 */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-white/60 hover:text-white transition"
            >
              策略编辑器
            </Link>
            <Link
              href="/dashboard/trading"
              className="text-sm text-white/60 hover:text-white transition"
            >
              交易面板
            </Link>
            <Link
              href="/dashboard/advisor"
              className="text-sm text-white/60 hover:text-white transition"
            >
              投资顾问
            </Link>
            <Link
              href="/dashboard/history"
              className="text-sm text-white/60 hover:text-white transition"
            >
              历史记录
            </Link>
          </nav>

          {/* Actions - matches DashboardHeader style / 与仪表板头部风格一致 */}
          <div className="flex items-center gap-3">
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-surface animate-pulse" />
            ) : session ? (
              // Logged in state - matching dashboard style
              // 登录状态 - 与仪表板风格一致
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface/50 transition"
                >
                  {/* Role badge */}
                  <span className={`text-xs ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                    {session.user?.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-accent text-sm font-medium">
                        {(session.user?.name || session.user?.email || 'U').substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                </button>

                {/* Dropdown Menu - consistent styling */}
                {/* 下拉菜单 - 一致的样式 */}
                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium text-white truncate">
                        {session.user?.name || '未设置名称'}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        {session.user?.email}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${roleInfo.color} font-medium`}>
                          {roleInfo.label}
                        </span>
                        <span className="text-xs text-white/30">会员</span>
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm text-white/70 hover:bg-surface/50 transition"
                      onClick={() => setShowDropdown(false)}
                    >
                      控制台
                    </Link>
                    <Link
                      href="/dashboard/account"
                      className="block px-4 py-2 text-sm text-white/70 hover:bg-surface/50 transition"
                      onClick={() => setShowDropdown(false)}
                    >
                      账户设置
                    </Link>
                    <Link
                      href="/dashboard/strategies"
                      className="block px-4 py-2 text-sm text-white/70 hover:bg-surface/50 transition"
                      onClick={() => setShowDropdown(false)}
                    >
                      我的策略
                    </Link>
                    <div className="border-t border-border">
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-loss hover:bg-surface/50 transition flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Logged out state - simpler buttons
              // 未登录状态 - 简洁按钮
              <Link href="/auth/login">
                <Button variant="outline" size="sm" className="text-sm">
                  登录
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
