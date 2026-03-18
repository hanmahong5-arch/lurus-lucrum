"use client";

/**
 * Reset Password Page
 * 重置密码页面
 *
 * Allows users to set a new password using the reset token.
 * 允许用户使用重置令牌设置新密码
 */

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// =============================================================================
// INNER COMPONENT (with useSearchParams)
// =============================================================================

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password strength indicators
  const passwordStrength = {
    length: password.length >= 6,
    hasNumber: /[0-9]/.test(password),
    hasLetter: /[a-zA-Z]/.test(password),
  };

  const strengthScore = Object.values(passwordStrength).filter(Boolean).length;

  /**
   * Validate token on mount
   * 组件挂载时验证令牌
   */
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setTokenError("缺少重置令牌，请从邮件中的链接访问此页面");
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/auth/reset-password?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();

        if (!data.valid) {
          setTokenError(data.message || "无效或已过期的重置链接");
        }
      } catch (err) {
        setTokenError("验证失败，请稍后再试");
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  /**
   * Handle form submission
   * 处理表单提交
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate passwords match
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }

      // Validate password strength
      if (password.length < 6) {
        setError("密码至少需要6个字符");
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/reset-password", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "重置失败，请稍后再试");
          return;
        }

        setSuccess(true);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/auth/login?reset=success");
        }, 3000);
      } catch (err) {
        setError("网络错误，请检查您的连接");
      } finally {
        setIsLoading(false);
      }
    },
    [password, confirmPassword, token, router]
  );

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-800 to-primary-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">验证重置链接...</p>
        </div>
      </div>
    );
  }

  // Token error state
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-800 to-primary-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-loss/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-loss"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              链接无效
            </h1>
            <p className="text-white/60 text-center mb-6">{tokenError}</p>

            {/* Actions */}
            <div className="space-y-3">
              <Link href="/auth/forgot-password" className="block">
                <Button className="w-full">重新申请重置链接</Button>
              </Link>
              <Link
                href="/auth/login"
                className="block text-center text-sm text-white/50 hover:text-white transition"
              >
                返回登录
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-800 to-primary-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gain/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gain"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* Success Message */}
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              密码已重置
            </h1>
            <p className="text-white/60 text-center mb-6">
              您的密码已成功重置。正在跳转到登录页面...
            </p>

            {/* Loading indicator */}
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white mb-2">
              谷神 <span className="text-accent">Lucrum</span>
            </h1>
          </Link>
          <p className="text-white/60">AI 量化投资决策助手</p>
        </div>

        {/* Form Card */}
        <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-2">设置新密码</h2>
          <p className="text-white/50 text-sm mb-6">请输入您的新密码</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm text-white/70 mb-2"
              >
                新密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition ${
                          strengthScore >= level
                            ? strengthScore === 1
                              ? "bg-loss"
                              : strengthScore === 2
                                ? "bg-yellow-500"
                                : "bg-gain"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-white/40 space-y-0.5">
                    <p
                      className={
                        passwordStrength.length ? "text-gain" : "text-white/40"
                      }
                    >
                      {passwordStrength.length ? "✓" : "○"} 至少6个字符
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm text-white/70 mb-2"
              >
                确认密码
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-1 transition ${
                  confirmPassword && password !== confirmPassword
                    ? "border-loss/50 focus:border-loss focus:ring-loss/50"
                    : "border-white/10 focus:border-accent/50 focus:ring-accent/50"
                }`}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-loss">密码不匹配</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg">
                <p className="text-sm text-loss">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={
                isLoading ||
                !password ||
                !confirmPassword ||
                password !== confirmPassword ||
                password.length < 6
              }
              className="w-full"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
                  重置中...
                </span>
              ) : (
                "重置密码"
              )}
            </Button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-white/50 hover:text-accent transition"
            >
              ← 返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT (with Suspense wrapper)
// =============================================================================

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-primary via-primary-800 to-primary-900 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60">加载中...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
