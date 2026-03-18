"use client";

import { useState } from "react";

/**
 * Notification preference item
 */
interface NotificationPreference {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
  category: "trading" | "account" | "marketing";
}

/**
 * Notification Settings Component
 * 通知设置组件
 *
 * Features:
 * - Email notification toggles
 * - Push notification toggles
 * - In-app notification toggles
 * - Category-based organization
 * - Quiet hours setting
 */
export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    // Trading notifications
    {
      id: "price_alert",
      title: "价格提醒",
      titleEn: "Price Alerts",
      description: "当关注的股票达到设定价格时通知",
      email: true,
      push: true,
      inApp: true,
      category: "trading",
    },
    {
      id: "strategy_signal",
      title: "策略信号",
      titleEn: "Strategy Signals",
      description: "当策略产生买卖信号时通知",
      email: true,
      push: true,
      inApp: true,
      category: "trading",
    },
    {
      id: "position_change",
      title: "持仓变动",
      titleEn: "Position Changes",
      description: "持仓发生变化时通知",
      email: false,
      push: true,
      inApp: true,
      category: "trading",
    },
    {
      id: "risk_warning",
      title: "风险预警",
      titleEn: "Risk Warnings",
      description: "当投资组合风险超过阈值时通知",
      email: true,
      push: true,
      inApp: true,
      category: "trading",
    },
    // Account notifications
    {
      id: "login_alert",
      title: "登录提醒",
      titleEn: "Login Alerts",
      description: "新设备登录时通知",
      email: true,
      push: false,
      inApp: true,
      category: "account",
    },
    {
      id: "security_change",
      title: "安全变更",
      titleEn: "Security Changes",
      description: "密码或安全设置变更时通知",
      email: true,
      push: false,
      inApp: true,
      category: "account",
    },
    {
      id: "subscription_update",
      title: "订阅更新",
      titleEn: "Subscription Updates",
      description: "订阅状态或账单相关通知",
      email: true,
      push: false,
      inApp: true,
      category: "account",
    },
    // Marketing notifications
    {
      id: "weekly_report",
      title: "周报推送",
      titleEn: "Weekly Report",
      description: "每周投资总结和市场分析",
      email: true,
      push: false,
      inApp: false,
      category: "marketing",
    },
    {
      id: "product_updates",
      title: "产品更新",
      titleEn: "Product Updates",
      description: "新功能发布和产品改进通知",
      email: false,
      push: false,
      inApp: true,
      category: "marketing",
    },
    {
      id: "educational_content",
      title: "学习内容",
      titleEn: "Educational Content",
      description: "投资教育文章和视频推荐",
      email: false,
      push: false,
      inApp: true,
      category: "marketing",
    },
  ]);

  const [quietHours, setQuietHours] = useState({
    enabled: true,
    start: "22:00",
    end: "08:00",
  });

  const [isSaving, setIsSaving] = useState(false);

  /**
   * Toggle notification preference
   */
  const togglePreference = (
    id: string,
    channel: "email" | "push" | "inApp"
  ) => {
    setPreferences(
      preferences.map((pref) =>
        pref.id === id ? { ...pref, [channel]: !pref[channel] } : pref
      )
    );
  };

  /**
   * Toggle all preferences in a category
   */
  const toggleCategory = (
    category: NotificationPreference["category"],
    channel: "email" | "push" | "inApp",
    value: boolean
  ) => {
    setPreferences(
      preferences.map((pref) =>
        pref.category === category ? { ...pref, [channel]: value } : pref
      )
    );
  };

  /**
   * Handle save
   */
  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  /**
   * Render notification group
   */
  const renderNotificationGroup = (
    category: NotificationPreference["category"],
    title: string,
    titleEn: string,
    icon: string
  ) => {
    const categoryPrefs = preferences.filter((p) => p.category === category);
    const allEmail = categoryPrefs.every((p) => p.email);
    const allPush = categoryPrefs.every((p) => p.push);
    const allInApp = categoryPrefs.every((p) => p.inApp);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white flex items-center gap-2">
            <span>{icon}</span>
            {title}
            <span className="text-white/40 font-normal">{titleEn}</span>
          </h4>
          <div className="flex items-center gap-6 text-xs text-white/50">
            <button
              onClick={() => toggleCategory(category, "email", !allEmail)}
              className={`hover:text-white transition ${allEmail ? "text-accent" : ""}`}
            >
              全部邮件
            </button>
            <button
              onClick={() => toggleCategory(category, "push", !allPush)}
              className={`hover:text-white transition ${allPush ? "text-accent" : ""}`}
            >
              全部推送
            </button>
            <button
              onClick={() => toggleCategory(category, "inApp", !allInApp)}
              className={`hover:text-white transition ${allInApp ? "text-accent" : ""}`}
            >
              全部应用内
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {categoryPrefs.map((pref) => (
            <div
              key={pref.id}
              className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="text-sm text-white font-medium">
                    {pref.title}
                    <span className="text-white/40 font-normal ml-1">
                      {pref.titleEn}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">
                    {pref.description}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Email toggle */}
                  <label className="flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-xs text-white/40">邮件</span>
                    <button
                      onClick={() => togglePreference(pref.id, "email")}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        pref.email ? "bg-accent" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          pref.email ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </label>
                  {/* Push toggle */}
                  <label className="flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-xs text-white/40">推送</span>
                    <button
                      onClick={() => togglePreference(pref.id, "push")}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        pref.push ? "bg-accent" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          pref.push ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </label>
                  {/* In-app toggle */}
                  <label className="flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-xs text-white/40">应用</span>
                    <button
                      onClick={() => togglePreference(pref.id, "inApp")}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        pref.inApp ? "bg-accent" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          pref.inApp ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Trading notifications */}
      {renderNotificationGroup("trading", "交易通知", "Trading", "📈")}

      <div className="border-t border-border" />

      {/* Account notifications */}
      {renderNotificationGroup("account", "账户通知", "Account", "👤")}

      <div className="border-t border-border" />

      {/* Marketing notifications */}
      {renderNotificationGroup("marketing", "推广通知", "Marketing", "📣")}

      <div className="border-t border-border" />

      {/* Quiet hours */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              🌙 免打扰时段
              <span className="text-white/40 font-normal">Quiet Hours</span>
            </h4>
            <p className="text-xs text-white/50 mt-1">
              在此时段内暂停推送通知（紧急安全通知除外）
            </p>
          </div>
          <button
            onClick={() => setQuietHours({ ...quietHours, enabled: !quietHours.enabled })}
            className={`w-14 h-7 rounded-full transition-colors relative ${
              quietHours.enabled ? "bg-accent" : "bg-white/10"
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                quietHours.enabled ? "translate-x-7" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {quietHours.enabled && (
          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2">
              <label className="text-sm text-white/70">开始</label>
              <input
                type="time"
                value={quietHours.start}
                onChange={(e) =>
                  setQuietHours({ ...quietHours, start: e.target.value })
                }
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
            <span className="text-white/30">→</span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-white/70">结束</label>
              <input
                type="time"
                value={quietHours.end}
                onChange={(e) =>
                  setQuietHours({ ...quietHours, end: e.target.value })
                }
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 text-sm rounded-lg bg-accent text-primary-600 font-medium hover:bg-accent/90 transition disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
              保存中...
            </>
          ) : (
            "保存设置"
          )}
        </button>
      </div>

      {/* Premium hint */}
      <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-xl">💎</span>
          <div>
            <h4 className="text-sm font-medium text-accent mb-1">
              升级到 Lucrum Pro 会员
            </h4>
            <p className="text-xs text-white/50 mb-2">
              解锁每日邮件推送、实时信号通知、私人投顾服务等高级功能
            </p>
            <button className="text-sm text-accent hover:text-accent/80 transition">
              了解更多 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
