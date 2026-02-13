"use client";

/**
 * Billing API Integration Test Content (Client Component)
 *
 * This component tests the billing API integration with lurus-api.
 * Used for development and testing purposes only.
 */

import { useState } from "react";
import { useBilling } from "@/hooks/useBilling";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function BillingTestContent() {
  const { data: session, status: sessionStatus } = useSession();
  const {
    plans,
    plansLoading,
    plansError,
    topups,
    topupsLoading,
    topupsError,
    createTopup,
    initiatePayment,
  } = useBilling();

  const {
    tokens,
    totalQuota,
    totalUsedQuota,
    isLoading: tokensLoading,
    error: tokensError,
    createKey,
    deleteKey,
  } = useApiKeys();

  const [testResults, setTestResults] = useState<Array<{
    name: string;
    status: "success" | "error" | "pending";
    message: string;
    data?: any;
  }>>([]);

  const addTestResult = (name: string, status: "success" | "error" | "pending", message: string, data?: any) => {
    setTestResults(prev => [...prev, { name, status, message, data }]);
  };

  // Test 1: Fetch subscription plans
  const testFetchPlans = async () => {
    addTestResult("Fetch Plans", "pending", "Fetching subscription plans...");

    try {
      const response = await fetch("/api/lurus/billing/plans");
      const data = await response.json();

      if (data.success) {
        addTestResult("Fetch Plans", "success", `Retrieved ${data.data?.length || 0} plans`, data.data);
      } else {
        addTestResult("Fetch Plans", "error", data.error || "Failed to fetch plans", data);
      }
    } catch (error) {
      addTestResult("Fetch Plans", "error", error instanceof Error ? error.message : "Unknown error");
    }
  };

  // Test 2: Fetch API tokens
  const testFetchTokens = async () => {
    addTestResult("Fetch Tokens", "pending", "Fetching API tokens...");

    try {
      const response = await fetch("/api/lurus/tokens?page=1&page_size=10");
      const data = await response.json();

      if (data.success) {
        addTestResult("Fetch Tokens", "success", `Retrieved ${data.data?.tokens?.length || 0} tokens`, data.data);
      } else {
        addTestResult("Fetch Tokens", "error", data.error || "Failed to fetch tokens", data);
      }
    } catch (error) {
      addTestResult("Fetch Tokens", "error", error instanceof Error ? error.message : "Unknown error");
    }
  };

  // Test 3: Create API key
  const testCreateApiKey = async () => {
    addTestResult("Create API Key", "pending", "Creating test API key...");

    try {
      const result = await createKey.mutateAsync({
        name: `Test Key ${Date.now()}`,
        quota: 100000,
      });

      addTestResult("Create API Key", "success", "API key created successfully", result);
    } catch (error) {
      addTestResult("Create API Key", "error", error instanceof Error ? error.message : "Unknown error");
    }
  };

  // Test 4: Fetch topup history
  const testFetchTopups = async () => {
    addTestResult("Fetch Topups", "pending", "Fetching topup history...");

    try {
      const response = await fetch("/api/lurus/billing/topups?page=1&page_size=10");
      const data = await response.json();

      if (data.success) {
        addTestResult("Fetch Topups", "success", `Retrieved ${data.data?.topups?.length || 0} topups`, data.data);
      } else {
        addTestResult("Fetch Topups", "error", data.error || "Failed to fetch topups", data);
      }
    } catch (error) {
      addTestResult("Fetch Topups", "error", error instanceof Error ? error.message : "Unknown error");
    }
  };

  // Test 5: Test unauthorized access
  const testUnauthorizedAccess = async () => {
    addTestResult("Unauthorized Access", "pending", "Testing unauthorized access handling...");

    try {
      const response = await fetch("/api/lurus/billing/plans", {
        credentials: "omit",
      });
      const data = await response.json();

      if (response.status === 401) {
        addTestResult("Unauthorized Access", "success", "Correctly returned 401 for unauthorized access", data);
      } else {
        addTestResult("Unauthorized Access", "error", `Expected 401, got ${response.status}`, data);
      }
    } catch (error) {
      addTestResult("Unauthorized Access", "error", error instanceof Error ? error.message : "Unknown error");
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setTestResults([]);
    await testFetchPlans();
    await testFetchTokens();
    await testFetchTopups();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Billing API Integration Test
          </h1>
          <p className="text-slate-400">
            Test page for verifying lurus-api billing and token endpoints
          </p>
        </div>

        {/* Session Status */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Session Status</h2>
          {sessionStatus === "loading" ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading session...
            </div>
          ) : sessionStatus === "authenticated" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                Authenticated
              </div>
              <div className="text-sm text-slate-300">
                <p>Email: {session?.user?.email}</p>
                <p>User ID: {session?.user?.id}</p>
                <p>Lurus User ID: {(session?.user as any)?.lurusUserId || "N/A"}</p>
                <p>Role: {(session?.user as any)?.role || "N/A"}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="w-5 h-5" />
              Not authenticated - Please login first
            </div>
          )}
        </div>

        {/* Test Controls */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Test Controls</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={runAllTests}
              disabled={sessionStatus !== "authenticated"}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              Run All Tests
            </Button>
            <Button
              onClick={testFetchPlans}
              disabled={sessionStatus !== "authenticated"}
              className="bg-blue-500 hover:bg-blue-600"
            >
              Test Plans API
            </Button>
            <Button
              onClick={testFetchTokens}
              disabled={sessionStatus !== "authenticated"}
              className="bg-blue-500 hover:bg-blue-600"
            >
              Test Tokens API
            </Button>
            <Button
              onClick={testFetchTopups}
              disabled={sessionStatus !== "authenticated"}
              className="bg-blue-500 hover:bg-blue-600"
            >
              Test Topups API
            </Button>
            <Button
              onClick={testCreateApiKey}
              disabled={sessionStatus !== "authenticated"}
              className="bg-green-500 hover:bg-green-600"
            >
              Test Create Key
            </Button>
            <Button
              onClick={() => setTestResults([])}
              className="bg-slate-600 hover:bg-slate-500"
            >
              Clear Results
            </Button>
          </div>
        </div>

        {/* React Query Data Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Plans */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Subscription Plans (React Query)
            </h3>
            {plansLoading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : plansError ? (
              <div className="text-red-400 text-sm">
                Error: {plansError.message}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-300">
                  Plans: {plans?.length || 0}
                </p>
                {plans && plans.length > 0 && (
                  <pre className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded overflow-auto max-h-40">
                    {JSON.stringify(plans, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Tokens */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              API Tokens (React Query)
            </h3>
            {tokensLoading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : tokensError ? (
              <div className="text-red-400 text-sm">
                Error: {tokensError.message}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-300">
                  Tokens: {tokens?.length || 0}
                </p>
                <p className="text-sm text-slate-300">
                  Total Quota: {totalQuota.toLocaleString()}
                </p>
                <p className="text-sm text-slate-300">
                  Used Quota: {totalUsedQuota.toLocaleString()}
                </p>
                {tokens && tokens.length > 0 && (
                  <pre className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded overflow-auto max-h-40">
                    {JSON.stringify(tokens, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Topups */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Topup History (React Query)
            </h3>
            {topupsLoading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : topupsError ? (
              <div className="text-red-400 text-sm">
                Error: {topupsError.message}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-300">
                  Topups: {topups?.length || 0}
                </p>
                {topups && topups.length > 0 && (
                  <pre className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded overflow-auto max-h-40">
                    {JSON.stringify(topups, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>
          {testResults.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No tests run yet. Click &quot;Run All Tests&quot; to begin.
            </p>
          ) : (
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="border border-slate-600 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">
                        {result.name}
                      </h3>
                      <p className="text-sm text-slate-300 mb-2">
                        {result.message}
                      </p>
                      {result.data && (
                        <details className="text-xs">
                          <summary className="text-slate-400 cursor-pointer hover:text-slate-300">
                            View Response Data
                          </summary>
                          <pre className="mt-2 text-slate-400 bg-slate-900/50 p-3 rounded overflow-auto max-h-60">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Endpoint Reference */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            API Endpoint Reference
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-green-400 font-mono">GET</span>
              <span className="text-slate-300 ml-3">/api/lurus/billing/plans</span>
              <p className="text-slate-400 text-xs ml-16 mt-1">
                Fetch subscription plans
              </p>
            </div>
            <div>
              <span className="text-green-400 font-mono">GET</span>
              <span className="text-slate-300 ml-3">/api/lurus/tokens</span>
              <p className="text-slate-400 text-xs ml-16 mt-1">
                Fetch API tokens (page, page_size)
              </p>
            </div>
            <div>
              <span className="text-blue-400 font-mono">POST</span>
              <span className="text-slate-300 ml-2">/api/lurus/tokens</span>
              <p className="text-slate-400 text-xs ml-16 mt-1">
                Create new API token (name, remain_quota)
              </p>
            </div>
            <div>
              <span className="text-red-400 font-mono">DELETE</span>
              <span className="text-slate-300 ml-2">/api/lurus/tokens/:id</span>
              <p className="text-slate-400 text-xs ml-16 mt-1">
                Delete API token
              </p>
            </div>
            <div>
              <span className="text-green-400 font-mono">GET</span>
              <span className="text-slate-300 ml-3">/api/lurus/billing/topups</span>
              <p className="text-slate-400 text-xs ml-16 mt-1">
                Fetch topup history (page, page_size)
              </p>
            </div>
            <div>
              <span className="text-blue-400 font-mono">POST</span>
              <span className="text-slate-300 ml-2">/api/lurus/billing/topup</span>
              <p className="text-slate-400 text-xs ml-16 mt-1">
                Create topup order (amount, payment_method, money, currency)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
