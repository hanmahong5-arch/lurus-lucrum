"use client";

/**
 * Email Verification Page
 * 邮箱验证页面
 *
 * Handles email verification via token from URL.
 * 通过 URL 中的令牌处理邮箱验证
 */

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// =============================================================================
// INNER COMPONENT (with useSearchParams)
// =============================================================================

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  // State
  const [status, setStatus] = useState<
    "loading" | "verifying" | "success" | "error" | "no-token"
  >(token ? "loading" : "no-token");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  /**
   * Verify email with token
   * 使用令牌验证邮箱
   */
  const verifyEmail = useCallback(async () => {
    if (!token) return;

    setStatus("verifying");

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage(data.message);
        setEmail(data.email || "");

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/auth/login?verified=success");
        }, 3000);
      } else {
        setStatus("error");
        setMessage(data.message || "验证失败");
      }
    } catch (err) {
      setStatus("error");
      setMessage("网络错误，请检查您的连接");
    }
  }, [token, router]);

  // Auto-verify on mount if token exists
  useEffect(() => {
    if (token && status === "loading") {
      verifyEmail();
    }
  }, [token, status, verifyEmail]);

  // No token state
  if (status === "no-token") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-800 to-primary-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
            {/* Info Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white text-center mb-2">
              验证您的邮箱
            </h1>
            <p className="text-white/60 text-center mb-6">
              请通过邮件中的验证链接访问此页面，或在下方输入您的邮箱重新发送验证邮件。
            </p>

            {/* Resend Form */}
            <ResendVerificationForm />

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

  // Loading/Verifying state
  if (status === "loading" || status === "verifying") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-800 to-primary-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">
            {status === "loading" ? "加载中..." : "正在验证您的邮箱..."}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (status === "success") {
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

            <h1 className="text-2xl font-bold text-white text-center mb-2">
              验证成功！
            </h1>
            <p className="text-white/60 text-center mb-2">{message}</p>
            {email && (
              <p className="text-accent text-center text-sm mb-6">{email}</p>
            )}
            <p className="text-white/40 text-center text-sm mb-6">
              正在跳转到登录页面...
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

  // Error state
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

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            验证失败
          </h1>
          <p className="text-white/60 text-center mb-6">{message}</p>

          {/* Resend Form */}
          <ResendVerificationForm />

          {/* Actions */}
          <div className="mt-6 space-y-3">
            <button
              onClick={verifyEmail}
              className="w-full text-sm text-white/50 hover:text-white transition"
            >
              重新尝试验证
            </button>
            <Link
              href="/auth/login"
              className="block text-center text-sm text-white/50 hover:text-accent transition"
            >
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// RESEND VERIFICATION FORM
// =============================================================================

function ResendVerificationForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success || data.verified) {
        setMessage({
          type: "success",
          text: data.message || "验证邮件已发送",
        });
      } else {
        setMessage({
          type: "error",
          text: data.message || "发送失败",
        });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: "网络错误，请检查您的连接",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleResend} className="space-y-3">
      <div>
        <label
          htmlFor="resend-email"
          className="block text-xs text-white/50 mb-1"
        >
          邮箱地址
        </label>
        <input
          id="resend-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-accent/50 transition"
        />
      </div>

      {message && (
        <div
          className={`p-2 rounded-lg text-xs ${
            message.type === "success"
              ? "bg-gain/10 border border-gain/30 text-gain"
              : "bg-loss/10 border border-loss/30 text-loss"
          }`}
        >
          {message.text}
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading || !email}
        className="w-full"
        variant="outline"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            发送中...
          </span>
        ) : (
          "重新发送验证邮件"
        )}
      </Button>
    </form>
  );
}

// =============================================================================
// MAIN COMPONENT (with Suspense wrapper)
// =============================================================================

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
