"use client";

/**
 * Login Page
 *
 * User authentication page for GuShen platform.
 * Supports email/password login with future OIDC integration.
 */

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, Lock, AlertCircle, Loader2, LogIn } from "lucide-react";
import { RiskDisclaimer, RiskAgreementCheckbox } from "@/components/auth";
import { redirectToLurusLogin } from "@/lib/auth/login-redirect";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");
  const resetSuccess = searchParams.get("reset") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(error || "");
  const [showResetSuccess, setShowResetSuccess] = useState(resetSuccess);
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  // Risk agreement state - user must agree to investment risks before login
  // 风险声明同意状态 - 用户必须同意投资风险才能登录
  const [agreedToRisk, setAgreedToRisk] = useState(false);

  const handleSSOLogin = () => {
    redirectToLurusLogin(callbackUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    // Validate risk agreement before proceeding
    // 验证风险声明同意状态
    if (!agreedToRisk) {
      setErrorMessage("请先阅读并同意投资风险提示");
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setErrorMessage(result.error);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setErrorMessage("登录失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Password Reset Success Message */}
      {showResetSuccess && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center justify-between text-green-400 text-sm">
          <span>✓ 密码已重置成功，请使用新密码登录</span>
          <button
            onClick={() => setShowResetSuccess(false)}
            className="text-green-400/60 hover:text-green-400 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Primary SSO Login Button */}
      <Button
        type="button"
        onClick={handleSSOLogin}
        className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-semibold text-base shadow-lg shadow-amber-500/20 transition-all"
      >
        <LogIn className="w-5 h-5 mr-2" />
        使用 Lurus 账户登录
      </Button>

      <p className="text-center text-xs text-slate-500 mt-2">
        统一登录到 Lurus 平台，享受跨产品服务
      </p>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-slate-800/50 text-slate-500">或</span>
        </div>
      </div>

      {/* Toggle Local Login */}
      <button
        type="button"
        onClick={() => setShowLocalLogin(!showLocalLogin)}
        className="w-full py-2 text-sm text-slate-400 hover:text-slate-300 transition"
      >
        {showLocalLogin ? "隐藏" : "显示"}本地账户登录（演示）
      </button>

      {/* Local Login Form (Collapsible) */}
      {showLocalLogin && (
        <form onSubmit={handleSubmit} className="space-y-4 mt-4 p-4 bg-slate-700/20 rounded-lg border border-slate-600/50">
        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            邮箱地址
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-300">
              密码
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-amber-500 hover:text-amber-400 transition"
            >
              忘记密码？
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Risk Disclaimer - Investment risk warning */}
        {/* 风险声明 - 投资风险提示 */}
        <RiskDisclaimer compact className="mt-4" />

        {/* Risk Agreement Checkbox */}
        {/* 风险协议同意复选框 */}
        <RiskAgreementCheckbox
          checked={agreedToRisk}
          onChange={setAgreedToRisk}
          disabled={isLoading}
          className="mt-3"
        />

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full py-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold mt-4"
            disabled={isLoading || !agreedToRisk}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                登录中...
              </>
            ) : (
              "使用本地账户登录"
            )}
          </Button>

          {/* Demo Account Info */}
          <div className="mt-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
            <p className="text-xs text-slate-400 mb-2">演示账户:</p>
            <p className="text-sm text-slate-300">
              邮箱: <code className="text-amber-400">demo@lurus.cn</code>
            </p>
            <p className="text-sm text-slate-300">
              密码: <code className="text-amber-400">demo123</code>
            </p>
          </div>
        </form>
      )}

      {/* Register Link */}
      <p className="mt-6 text-center text-sm text-slate-400">
        还没有账户？{" "}
        <Link
          href="/auth/register"
          className="text-amber-500 hover:text-amber-400 font-medium"
        >
          立即注册
        </Link>
      </p>
    </>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-4">
      <div className="h-12 bg-slate-700/50 rounded-lg animate-pulse" />
      <div className="h-12 bg-slate-700/50 rounded-lg animate-pulse" />
      <div className="h-12 bg-slate-700/50 rounded-lg animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white">
              谷神 <span className="text-amber-500">GuShen</span>
            </h1>
          </Link>
          <p className="text-slate-400 mt-2">AI投资决策平台</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            登录您的账户
          </h2>

          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Back to Home */}
        <p className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-400"
          >
            ← 返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}
