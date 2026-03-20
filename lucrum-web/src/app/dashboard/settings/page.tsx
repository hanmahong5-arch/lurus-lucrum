"use client";

/**
 * Unified Settings Page
 *
 * Merges the former standalone pages into a single tabbed view:
 *   - Profile & preferences  (original settings)
 *   - Subscription management
 *   - Referral program       (from /dashboard/referral)
 *   - Trading account        (from /dashboard/account)
 *
 * Tab state is persisted in the URL via `?tab=` for deep-linking.
 */

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageTabs } from "@/components/ui/page-tabs";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { SubscriptionSettings } from "@/components/settings/subscription-settings";

// Dynamic imports from extracted content components (no DashboardHeader inside)
const AccountContent = dynamic(
  () =>
    import("@/components/pages/account-content").then((m) => m.AccountContent),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  },
);

const ReferralContent = dynamic(
  () =>
    import("@/components/pages/referral-content").then((m) => m.ReferralContent),
  {
    ssr: false,
    loading: () => <TabSkeleton />,
  },
);

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/40 text-sm">加载中...</p>
      </div>
    </div>
  );
}

const TABS = [
  { value: "profile", label: "账户设置" },
  { value: "subscription", label: "订阅管理" },
  { value: "referral", label: "推荐计划" },
  { value: "account", label: "交易账户" },
];

function SettingsPageContent() {
  return (
    <div className="min-h-screen bg-background text-white">
      <DashboardHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            偏好设置
          </h1>
          <p className="text-sm text-white/50">
            管理您的账户信息、安全设置、订阅服务与推荐计划
          </p>
        </div>

        <Suspense fallback={<TabSkeleton />}>
          <PageTabs tabs={TABS}>
            {(activeTab) => {
              switch (activeTab) {
                case "profile":
                  return (
                    <div className="space-y-6">
                      <div className="bg-surface rounded-xl border border-border p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">
                          个人资料
                        </h2>
                        <ProfileSettings />
                      </div>
                      <div className="bg-surface rounded-xl border border-border p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">
                          安全设置
                        </h2>
                        <SecuritySettings />
                      </div>
                      <div className="bg-surface rounded-xl border border-border p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">
                          通知设置
                        </h2>
                        <NotificationSettings />
                      </div>
                    </div>
                  );
                case "subscription":
                  return (
                    <div className="bg-surface rounded-xl border border-border p-6">
                      <SubscriptionSettings />
                    </div>
                  );
                case "referral":
                  return <ReferralContent />;
                case "account":
                  return <AccountContent />;
                default:
                  return null;
              }
            }}
          </PageTabs>
        </Suspense>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  );
}
