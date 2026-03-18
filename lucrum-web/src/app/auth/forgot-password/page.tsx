"use client";

/**
 * Forgot Password Page
 * 忘记密码页面
 *
 * Allows users to request a password reset link via email.
 * 允许用户通过邮箱请求密码重置链接
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export default function ForgotPasswordPage() {
  // Form state
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Handle form submission
   * 处理表单提交
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "请求失败，请稍后再试");
          return;
        }

        setSuccess(true);
      } catch (err) {
        setError("网络错误，请检查您的连接");
      } finally {
        setIsLoading(false);
      }
    },
    [email]
  );

  // Success state UI
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
              邮件已发送
            </h1>
            <p className="text-white/60 text-center mb-6">
              如果该邮箱已注册，您将收到一封包含重置链接的邮件。请检查您的收件箱（包括垃圾邮件文件夹）。
            </p>

            {/* Actions */}
            <div className="space-y-3">
              <Link href="/auth/login" className="block">
                <Button className="w-full">返回登录</Button>
              </Link>
              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
                className="w-full text-sm text-white/50 hover:text-white transition"
              >
                使用其他邮箱重试
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <h2 className="text-xl font-semibold text-white mb-2">忘记密码</h2>
          <p className="text-white/50 text-sm mb-6">
            输入您的注册邮箱，我们将发送密码重置链接
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm text-white/70 mb-2"
              >
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition"
              />
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
              disabled={isLoading || !email}
              className="w-full"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
                  发送中...
                </span>
              ) : (
                "发送重置链接"
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

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-white/30 text-xs">
            没有账户？{" "}
            <Link href="/auth/register" className="text-accent hover:underline">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
