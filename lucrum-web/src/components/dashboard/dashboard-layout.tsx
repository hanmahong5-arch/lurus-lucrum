/**
 * Dashboard Layout Component
 * 仪表板布局组件
 *
 * Provides consistent layout and user workspace initialization for all dashboard pages.
 * 为所有仪表板页面提供一致的布局和用户工作空间初始化。
 *
 * Features:
 * - Automatic user workspace initialization
 * - Shared header with account status
 * - Loading state handling
 * - User data isolation
 */

'use client';

import { ReactNode } from 'react';
import { useUserWorkspace } from '@/hooks/use-user-workspace';
import { DashboardHeader } from './dashboard-header';
import { MAIN_CONTENT_ID } from '@/lib/accessibility/skip-link';

interface DashboardLayoutProps {
  children: ReactNode;
  /** Optional title for the page / 页面的可选标题 */
  title?: string;
  /** Optional subtitle / 可选副标题 */
  subtitle?: string;
  /** Whether to show loading state / 是否显示加载状态 */
  showLoading?: boolean;
}

/**
 * Loading skeleton for dashboard content
 * 仪表板内容的加载骨架
 */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="w-24 h-6 bg-surface rounded animate-pulse" />
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-16 h-4 bg-surface rounded animate-pulse" />
              ))}
            </div>
            <div className="w-8 h-8 rounded-full bg-surface animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <div className="w-64 h-8 bg-surface rounded animate-pulse" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="h-64 bg-surface rounded-xl animate-pulse" />
            <div className="h-64 bg-surface rounded-xl animate-pulse" />
            <div className="h-64 bg-surface rounded-xl animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Dashboard Layout Component
 *
 * Wraps dashboard pages with:
 * - User workspace initialization
 * - Shared header
 * - Loading state
 */
export function DashboardLayout({
  children,
  title,
  subtitle,
  showLoading = true,
}: DashboardLayoutProps) {
  const { isReady, isAuthenticated, user } = useUserWorkspace();

  // Show loading skeleton while initializing
  // 初始化时显示加载骨架
  if (!isReady && showLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Shared Dashboard Header */}
      <DashboardHeader />

      {/* Main Content */}
      <main id={MAIN_CONTENT_ID} className="max-w-7xl mx-auto px-6 py-8" role="main">
        {/* Optional Page Title */}
        {title && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              {title}
              {subtitle && (
                <span className="text-base font-normal text-white/50 ml-2">
                  / {subtitle}
                </span>
              )}
            </h1>
          </div>
        )}

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
}

/**
 * Higher-order component to wrap pages with dashboard layout
 * 用仪表板布局包装页面的高阶组件
 */
export function withDashboardLayout<P extends object>(
  Component: React.ComponentType<P>,
  layoutProps?: Omit<DashboardLayoutProps, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <DashboardLayout {...layoutProps}>
        <Component {...props} />
      </DashboardLayout>
    );
  };
}

export default DashboardLayout;
