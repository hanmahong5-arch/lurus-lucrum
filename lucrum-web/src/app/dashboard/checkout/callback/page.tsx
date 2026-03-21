"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

type CheckoutState = "polling" | "paid" | "expired" | "error";

const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 3_000;
const REDIRECT_DELAY_MS = 3_000;

interface StatusResponse {
  order_no: string;
  status: string;
  amount: number;
  error?: string;
}

export default function CheckoutCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderNo = searchParams.get("order_no");

  const [state, setState] = useState<CheckoutState>("polling");
  const [amount, setAmount] = useState<number>(0);
  const [attempts, setAttempts] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollStatus = useCallback(async (attempt: number) => {
    if (!orderNo) {
      setState("error");
      setErrorMessage("Missing order number");
      return;
    }

    try {
      const res = await fetch(
        `/api/lurus/subscription/status?order_no=${encodeURIComponent(orderNo)}`,
      );

      if (!res.ok) {
        // On 404/500 errors, stop polling
        if (res.status === 404 || res.status >= 500) {
          setState("error");
          setErrorMessage("Unable to verify payment status");
          return;
        }
      }

      const data = (await res.json()) as StatusResponse;

      if (data.status === "paid") {
        setState("paid");
        setAmount(data.amount);
        // Invalidate account-overview so settings page refreshes
        void queryClient.invalidateQueries({ queryKey: ["account-overview"] });
        // Auto-redirect to settings after delay
        redirectRef.current = setTimeout(() => {
          router.push("/dashboard/settings?tab=subscription");
        }, REDIRECT_DELAY_MS);
        return;
      }

      if (data.status === "expired" || data.status === "cancelled" || data.status === "failed") {
        setState("expired");
        return;
      }

      // Still pending — schedule next poll if under limit
      const nextAttempt = attempt + 1;
      setAttempts(nextAttempt);
      if (nextAttempt >= MAX_POLL_ATTEMPTS) {
        setState("expired");
        return;
      }

      pollingRef.current = setTimeout(() => {
        void pollStatus(nextAttempt);
      }, POLL_INTERVAL_MS);
    } catch {
      setState("error");
      setErrorMessage("Network error, please check your connection");
    }
  }, [orderNo, queryClient, router]);

  useEffect(() => {
    if (!orderNo) {
      setState("error");
      setErrorMessage("Missing order number in URL");
      return;
    }
    void pollStatus(0);

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (redirectRef.current) clearTimeout(redirectRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNo]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full p-8 bg-surface rounded-xl border border-white/10 text-center space-y-6">
        {state === "polling" && (
          <>
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Payment Verification
            </h2>
            <p className="text-sm text-white/60">
              Verifying your payment, please wait...
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-accent/60 rounded-full animate-pulse" />
              <span className="text-xs text-white/40 font-mono tabular-nums">
                Attempt {attempts + 1}/{MAX_POLL_ATTEMPTS}
              </span>
            </div>
          </>
        )}

        {state === "paid" && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-profit/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-profit"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">
              Payment Successful
            </h2>
            {amount > 0 && (
              <p className="text-lg font-mono tabular-nums text-profit">
                ¥{amount.toFixed(2)}
              </p>
            )}
            <p className="text-sm text-white/60">
              Your subscription has been activated. Redirecting to settings...
            </p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-profit rounded-full transition-all duration-[3000ms] ease-linear"
                style={{ width: "100%" }}
              />
            </div>
          </>
        )}

        {state === "expired" && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">
              Payment Not Confirmed
            </h2>
            <p className="text-sm text-white/60">
              The payment was not confirmed within the expected time. If you
              completed the payment, it may still be processing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setState("polling");
                  setAttempts(0);
                  void pollStatus(0);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-primary-600 hover:bg-accent/90 transition"
              >
                Retry Verification
              </button>
              <button
                onClick={() => router.push("/dashboard/settings?tab=subscription")}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
              >
                Back to Settings
              </button>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-loss/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-loss"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">
              Verification Failed
            </h2>
            <p className="text-sm text-white/60">
              {errorMessage || "An error occurred while verifying your payment."}
            </p>
            <button
              onClick={() => router.push("/dashboard/settings?tab=subscription")}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
            >
              Back to Settings
            </button>
          </>
        )}

        {/* Order reference */}
        {orderNo && (
          <p className="text-xs text-white/30 font-mono">
            Order: {orderNo}
          </p>
        )}
      </div>
    </div>
  );
}
