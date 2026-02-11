/**
 * OAuth Callback Page
 *
 * Handles the callback from Lurus API OAuth login.
 * After successful login at api.lurus.cn, users are redirected here
 * with a session cookie (Domain=.lurus.cn).
 */

"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        // Get the redirect URL from query params (if any)
        const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

        // Trigger NextAuth signIn with lurus-sso provider
        // This will verify the session cookie set by lurus-api
        const result = await signIn("lurus-sso", {
          redirect: false,
          callbackUrl,
        });

        if (result?.ok) {
          // Login successful, redirect to dashboard or callback URL
          router.push(callbackUrl);
        } else {
          // Login failed
          setError(result?.error || "登录失败，请重试");
          setTimeout(() => {
            router.push("/auth/login?error=callback_failed");
          }, 2000);
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError("登录过程中发生错误");
        setTimeout(() => {
          router.push("/auth/login?error=callback_failed");
        }, 2000);
      }
    }

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
        {!error ? (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
              正在登录...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              请稍候，我们正在验证您的身份
            </p>
          </>
        ) : (
          <>
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
              登录失败
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <p className="text-sm text-gray-500">正在返回登录页...</p>
          </>
        )}
      </div>
    </div>
  );
}
