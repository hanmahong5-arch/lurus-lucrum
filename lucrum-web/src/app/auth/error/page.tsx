"use client";

/**
 * Authentication Error Page
 *
 * Displays authentication errors with helpful messages.
 */

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Suspense } from "react";

const errorMessages: Record<string, string> = {
  Configuration: "服务器配置错误，请联系管理员",
  AccessDenied: "访问被拒绝",
  Verification: "验证链接已过期或无效",
  Default: "认证过程中发生错误",
  CredentialsSignin: "邮箱或密码错误",
  SessionRequired: "请先登录",
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessage = error
    ? errorMessages[error] || errorMessages.Default
    : errorMessages.Default;

  return (
    <>
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>

      <h2 className="text-xl font-semibold text-white mb-2">认证错误</h2>
      <p className="text-slate-400 mb-6">{errorMessage}</p>

      <div className="space-y-3">
        <Link href="/auth/login">
          <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900">
            重新登录
          </Button>
        </Link>

        <Link href="/">
          <Button
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            返回首页
          </Button>
        </Link>
      </div>
    </>
  );
}

function ErrorFallback() {
  return (
    <div className="animate-pulse">
      <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-4" />
      <div className="h-6 bg-slate-700 rounded w-32 mx-auto mb-2" />
      <div className="h-4 bg-slate-700 rounded w-48 mx-auto mb-6" />
      <div className="h-10 bg-slate-700 rounded mb-3" />
      <div className="h-10 bg-slate-700 rounded" />
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white">
              谷神 <span className="text-amber-500">Lucrum</span>
            </h1>
          </Link>
        </div>

        {/* Error Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          <Suspense fallback={<ErrorFallback />}>
            <ErrorContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
