"use client";

import { useState } from "react";

/**
 * Session device information
 */
interface SessionDevice {
  id: string;
  deviceName: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: Date;
  isCurrent: boolean;
}

/**
 * Mock session data
 */
const MOCK_SESSIONS: SessionDevice[] = [
  {
    id: "1",
    deviceName: "Windows PC",
    browser: "Chrome 120",
    ip: "192.168.1.100",
    location: "北京, 中国",
    lastActive: new Date(),
    isCurrent: true,
  },
  {
    id: "2",
    deviceName: "iPhone 15 Pro",
    browser: "Safari Mobile",
    ip: "10.0.0.50",
    location: "北京, 中国",
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    isCurrent: false,
  },
  {
    id: "3",
    deviceName: "MacBook Pro",
    browser: "Firefox 121",
    ip: "172.16.0.25",
    location: "上海, 中国",
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    isCurrent: false,
  },
];

/**
 * Security Settings Component
 * 安全设置组件
 *
 * Features:
 * - Password change
 * - Two-factor authentication (2FA) toggle
 * - Active sessions management
 * - Login history
 */
export function SecuritySettings() {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [sessions, setSessions] = useState<SessionDevice[]>(MOCK_SESSIONS);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle password change submission
   */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    // Validate passwords
    if (passwordForm.new.length < 8) {
      setPasswordError("新密码至少需要8个字符");
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("两次输入的密码不一致");
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Reset form
    setPasswordForm({ current: "", new: "", confirm: "" });
    setIsChangingPassword(false);
    setIsSubmitting(false);
  };

  /**
   * Handle session revocation
   */
  const handleRevokeSession = async (sessionId: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSessions(sessions.filter((s) => s.id !== sessionId));
  };

  /**
   * Handle revoke all sessions
   */
  const handleRevokeAllSessions = async () => {
    if (!confirm("确定要登出所有其他设备吗？")) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
    setSessions(sessions.filter((s) => s.isCurrent));
  };

  /**
   * Format relative time
   */
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return `${diffDays}天前`;
  };

  return (
    <div className="space-y-8">
      {/* Password section */}
      <div>
        <h3 className="text-base font-medium text-white mb-1 flex items-center gap-2">
          🔐 密码管理
        </h3>
        <p className="text-sm text-white/50 mb-4">
          定期更换密码可以提高账户安全性
        </p>

        {isChangingPassword ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                当前密码
              </label>
              <input
                type="password"
                value={passwordForm.current}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, current: e.target.value })
                }
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                placeholder="请输入当前密码"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                新密码
              </label>
              <input
                type="password"
                value={passwordForm.new}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, new: e.target.value })
                }
                required
                minLength={8}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                placeholder="至少8个字符"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                确认新密码
              </label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirm: e.target.value })
                }
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                placeholder="再次输入新密码"
              />
            </div>

            {passwordError && (
              <p className="text-sm text-loss">{passwordError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(false);
                  setPasswordForm({ current: "", new: "", confirm: "" });
                  setPasswordError(null);
                }}
                className="px-4 py-2 text-sm rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-sm rounded-lg bg-accent text-primary-600 font-medium hover:bg-accent/90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
                    更新中...
                  </>
                ) : (
                  "更新密码"
                )}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsChangingPassword(true)}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition border border-white/10"
          >
            更改密码
          </button>
        )}
      </div>

      <div className="border-t border-border" />

      {/* 2FA section */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-medium text-white mb-1 flex items-center gap-2">
              🛡️ 两步验证 (2FA)
            </h3>
            <p className="text-sm text-white/50">
              启用后，登录时需要输入验证码，提供额外的安全保护
            </p>
          </div>
          <button
            onClick={() => {
              if (is2FAEnabled) {
                if (confirm("确定要关闭两步验证吗？这会降低账户安全性。")) {
                  setIs2FAEnabled(false);
                }
              } else {
                alert("两步验证设置向导即将推出 / 2FA setup wizard coming soon");
                // In production, this would open a setup wizard
              }
            }}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              is2FAEnabled ? "bg-profit" : "bg-white/10"
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                is2FAEnabled ? "translate-x-7" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {is2FAEnabled && (
          <div className="mt-4 p-4 bg-profit/10 border border-profit/30 rounded-lg">
            <p className="text-sm text-profit">
              ✓ 两步验证已启用，您的账户受到额外保护
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Active sessions section */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-medium text-white mb-1 flex items-center gap-2">
              📱 登录设备
            </h3>
            <p className="text-sm text-white/50">
              管理您账户的登录设备，可以登出可疑设备
            </p>
          </div>
          {sessions.filter((s) => !s.isCurrent).length > 0 && (
            <button
              onClick={handleRevokeAllSessions}
              className="text-sm text-loss hover:text-loss/80 transition"
            >
              登出所有其他设备
            </button>
          )}
        </div>

        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-lg border ${
                session.isCurrent
                  ? "bg-accent/5 border-accent/30"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg">
                    {session.deviceName.includes("iPhone") || session.deviceName.includes("Android")
                      ? "📱"
                      : session.deviceName.includes("Mac")
                      ? "💻"
                      : "🖥️"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {session.deviceName}
                      </span>
                      {session.isCurrent && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-accent/20 text-accent">
                          当前设备
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">
                      {session.browser} • {session.ip}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {session.location} • {formatRelativeTime(session.lastActive)}
                    </p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    className="text-sm text-white/50 hover:text-loss transition"
                  >
                    登出
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Login history hint */}
      <div className="p-4 bg-white/5 rounded-lg border border-white/10">
        <h4 className="text-sm font-medium text-white mb-1">
          📋 登录历史
        </h4>
        <p className="text-xs text-white/50 mb-3">
          查看账户的详细登录历史记录，帮助您识别异常登录活动
        </p>
        <button
          onClick={() => alert("登录历史功能即将推出 / Login history coming soon")}
          className="text-sm text-accent hover:text-accent/80 transition"
        >
          查看登录历史 →
        </button>
      </div>
    </div>
  );
}
