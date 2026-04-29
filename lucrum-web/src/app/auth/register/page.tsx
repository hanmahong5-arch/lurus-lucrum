"use client";

/**
 * Registration Page
 *
 * Redirects to Lurus SSO for account creation.
 * Zitadel supports registration within the OAuth login flow.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2 } from "lucide-react";
import { RiskDisclaimer, RiskAgreementCheckbox } from "@/components/auth";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function RegisterPage() {
  const [agreedToRisk, setAgreedToRisk] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Same SSO flow as /auth/login — Zitadel's hosted page exposes a
  // "Create account" link, so registration and login share one entry.
  // The previous implementation pointed at api.lurus.cn/api/v2/lurus/auth/login
  // which was decommissioned during the platform consolidation, so the click
  // landed on a dead host and silently failed.
  const handleRegister = async () => {
    setIsLoading(true);
    try {
      await signIn("zitadel", { callbackUrl: "/dashboard" });
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white">
              谷神 <span className="text-amber-500">Lucrum</span>
            </h1>
          </Link>
          <p className="text-slate-400 mt-2">AI投资决策平台</p>
        </div>

        {/* Register Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            创建新账户
          </h2>

          <p className="text-slate-400 text-sm mb-6 text-center">
            通过 Lurus 统一账户体系注册，享受跨产品服务
          </p>

          {/* Risk Disclaimer */}
          <RiskDisclaimer compact className="mb-4" />

          {/* Risk Agreement Checkbox */}
          <RiskAgreementCheckbox
            checked={agreedToRisk}
            onChange={setAgreedToRisk}
            className="mb-6"
          />

          {/* SSO Register Button */}
          <Button
            type="button"
            onClick={handleRegister}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-semibold text-base shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!agreedToRisk || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                跳转中...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                注册 Lurus 账户
              </>
            )}
          </Button>

          <p className="text-center text-xs text-slate-500 mt-3">
            点击后将跳转到 Lurus 统一登录页面完成注册
          </p>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-slate-400">
            已有账户？{" "}
            <Link
              href="/auth/login"
              className="text-amber-500 hover:text-amber-400 font-medium"
            >
              立即登录
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <p className="mt-4 text-center">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-400">
            ← 返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}
