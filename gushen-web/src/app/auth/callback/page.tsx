/**
 * OAuth Callback Page
 *
 * Handles the redirect from Lurus API after Zitadel OAuth login.
 * At this point, lurus-api has set a session cookie on Domain=.lurus.cn.
 * We trigger NextAuth signIn("lurus-sso") to verify the cookie and create
 * a local NextAuth session, then redirect to the final destination.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const finalDestination = searchParams.get("callbackUrl") || "/dashboard";

      try {
        // Verify the .lurus.cn session cookie via lurus-api
        const result = await signIn("lurus-sso", {
          redirect: false,
          callbackUrl: finalDestination,
        });

        if (cancelled) return;

        if (result?.ok) {
          router.push(finalDestination);
          router.refresh();
        } else {
          setError(result?.error || "登录验证失败");
          setTimeout(() => {
            if (!cancelled) router.push("/auth/login?error=callback_failed");
          }, 3000);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("OAuth callback error:", err);
        setError("登录过程中发生错误");
        setTimeout(() => {
          if (!cancelled) router.push("/auth/login?error=callback_error");
        }, 3000);
      }
    }

    handleCallback();
    return () => { cancelled = true; };
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center p-8 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl max-w-md w-full">
        {!error ? (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-amber-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-2 text-white">
              正在登录...
            </h2>
            <p className="text-slate-400">
              请稍候，我们正在验证您的身份
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-2xl">!</span>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-white">
              登录失败
            </h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <p className="text-sm text-slate-500">正在返回登录页...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-amber-500" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
