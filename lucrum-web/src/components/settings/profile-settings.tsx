"use client";

import { useState } from "react";

/**
 * User profile data structure
 */
interface ProfileData {
  displayName: string;
  email: string;
  phone: string;
  timezone: string;
  locale: string;
  avatarUrl: string | null;
}

/**
 * Available timezone options
 */
const TIMEZONE_OPTIONS = [
  { value: "Asia/Shanghai", label: "中国标准时间 (UTC+8)" },
  { value: "Asia/Hong_Kong", label: "香港时间 (UTC+8)" },
  { value: "Asia/Tokyo", label: "东京时间 (UTC+9)" },
  { value: "America/New_York", label: "美东时间 (UTC-5)" },
  { value: "America/Los_Angeles", label: "美西时间 (UTC-8)" },
  { value: "Europe/London", label: "伦敦时间 (UTC+0)" },
] as const;

/**
 * Available locale options
 */
const LOCALE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en-US", label: "English (US)" },
] as const;

/**
 * Profile Settings Component
 * 个人资料设置组件
 *
 * Features:
 * - Display name editing
 * - Avatar upload (placeholder)
 * - Timezone selection
 * - Language preference
 * - Email display (read-only, verified status)
 */
export function ProfileSettings() {
  // Mock user data - in production, this would come from auth context or API
  const [profile, setProfile] = useState<ProfileData>({
    displayName: "演示用户",
    email: "demo@lurus.cn",
    phone: "",
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    avatarUrl: null,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState<ProfileData>(profile);

  /**
   * Handle profile save
   */
  const handleSave = async () => {
    setIsSaving(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setProfile(editedProfile);
    setIsEditing(false);
    setIsSaving(false);
  };

  /**
   * Handle cancel editing
   */
  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  return (
    <div className="space-y-8">
      {/* Avatar section */}
      <div className="flex items-start gap-6">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center border-2 border-accent/30">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-3xl text-accent">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <button
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            onClick={() => alert("Avatar upload coming soon / 头像上传功能即将推出")}
          >
            <span className="text-white text-xs">更换头像</span>
          </button>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-white mb-1">
            {profile.displayName}
          </h3>
          <p className="text-sm text-white/50 mb-3">{profile.email}</p>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs rounded-full bg-profit/20 text-profit border border-profit/30">
              ✓ 邮箱已验证
            </span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent border border-accent/30">
              顾婶会员
            </span>
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition border border-white/10"
          >
            编辑资料
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Profile form */}
      <div className="space-y-6">
        {/* Display name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <label className="text-sm text-white/70 pt-2">
            显示名称
            <span className="block text-xs text-white/40">Display Name</span>
          </label>
          <div className="col-span-2">
            {isEditing ? (
              <input
                type="text"
                value={editedProfile.displayName}
                onChange={(e) =>
                  setEditedProfile({ ...editedProfile, displayName: e.target.value })
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                placeholder="请输入显示名称"
              />
            ) : (
              <p className="text-white py-2">{profile.displayName}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <label className="text-sm text-white/70 pt-2">
            邮箱地址
            <span className="block text-xs text-white/40">Email</span>
          </label>
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <p className="text-white py-2">{profile.email}</p>
              <span className="text-xs text-white/30">(不可修改)</span>
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <label className="text-sm text-white/70 pt-2">
            手机号码
            <span className="block text-xs text-white/40">Phone</span>
          </label>
          <div className="col-span-2">
            {isEditing ? (
              <input
                type="tel"
                value={editedProfile.phone}
                onChange={(e) =>
                  setEditedProfile({ ...editedProfile, phone: e.target.value })
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                placeholder="请输入手机号码 (可选)"
              />
            ) : (
              <p className="text-white py-2">
                {profile.phone || <span className="text-white/30">未设置</span>}
              </p>
            )}
          </div>
        </div>

        {/* Timezone */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <label className="text-sm text-white/70 pt-2">
            时区设置
            <span className="block text-xs text-white/40">Timezone</span>
          </label>
          <div className="col-span-2">
            {isEditing ? (
              <select
                value={editedProfile.timezone}
                onChange={(e) =>
                  setEditedProfile({ ...editedProfile, timezone: e.target.value })
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 appearance-none cursor-pointer"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value} className="bg-surface">
                    {tz.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-white py-2">
                {TIMEZONE_OPTIONS.find((tz) => tz.value === profile.timezone)?.label}
              </p>
            )}
          </div>
        </div>

        {/* Locale */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <label className="text-sm text-white/70 pt-2">
            语言偏好
            <span className="block text-xs text-white/40">Language</span>
          </label>
          <div className="col-span-2">
            {isEditing ? (
              <select
                value={editedProfile.locale}
                onChange={(e) =>
                  setEditedProfile({ ...editedProfile, locale: e.target.value })
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 appearance-none cursor-pointer"
              >
                {LOCALE_OPTIONS.map((loc) => (
                  <option key={loc.value} value={loc.value} className="bg-surface">
                    {loc.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-white py-2">
                {LOCALE_OPTIONS.find((loc) => loc.value === profile.locale)?.label}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {isEditing && (
        <>
          <div className="border-t border-border" />
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
            >
              取消
            </button>
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
                "保存更改"
              )}
            </button>
          </div>
        </>
      )}

      {/* Account danger zone */}
      <div className="border-t border-border pt-8">
        <h3 className="text-sm font-medium text-loss mb-2">危险操作</h3>
        <p className="text-xs text-white/50 mb-4">
          以下操作不可逆，请谨慎操作。
        </p>
        <button
          onClick={() => alert("Account deletion coming soon / 账户删除功能即将推出")}
          className="px-4 py-2 text-sm rounded-lg text-loss border border-loss/30 hover:bg-loss/10 transition"
        >
          删除账户
        </button>
      </div>
    </div>
  );
}
