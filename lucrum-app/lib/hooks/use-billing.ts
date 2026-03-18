/**
 * Billing Hooks — Direct Platform API
 *
 * Plans, wallet, transactions, topup, subscription management.
 * All calls go directly to lurus-platform /api/v1/* with Zitadel JWT.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "@/lib/api/client";
import type {
  ProductPlan,
  PlatformWallet,
  WalletTransaction,
  TopupInfo,
  TopupOrder,
  PlatformSubscription,
} from "@shared/types";

// ============================================================
// Plans
// ============================================================

export function usePlans() {
  return useQuery({
    queryKey: ["billing", "plans"],
    queryFn: async () => {
      const { data } = await platformApi.get<{ plans: ProductPlan[] }>(
        "/products/lurus-lucrum/plans",
      );
      return data.plans;
    },
    staleTime: 300_000,
  });
}

// ============================================================
// Wallet
// ============================================================

export function useWallet() {
  return useQuery({
    queryKey: ["billing", "wallet"],
    queryFn: async () => {
      const { data } = await platformApi.get<PlatformWallet>("/wallet");
      return data;
    },
    staleTime: 30_000,
  });
}

export function useWalletTransactions(page = 1) {
  return useQuery({
    queryKey: ["billing", "wallet-transactions", page],
    queryFn: async () => {
      const { data } = await platformApi.get<{
        data: WalletTransaction[];
        total: number;
      }>(`/wallet/transactions?page=${page}&page_size=20`);
      return data;
    },
    staleTime: 30_000,
  });
}

// ============================================================
// Topup
// ============================================================

export function useTopupInfo() {
  return useQuery({
    queryKey: ["billing", "topup-info"],
    queryFn: async () => {
      const { data } = await platformApi.get<TopupInfo>("/wallet/topup/info");
      return data;
    },
    staleTime: 300_000,
  });
}

export function useCreateTopup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      amount_cny: number;
      payment_method: string;
      return_url?: string;
    }) => {
      const { data } = await platformApi.post<TopupOrder>("/wallet/topup", params);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "wallet"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "wallet-transactions"] });
    },
  });
}

// ============================================================
// Subscription
// ============================================================

export function useSubscription() {
  return useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: async () => {
      try {
        const { data } = await platformApi.get<PlatformSubscription>(
          "/subscriptions/lurus-lucrum",
        );
        return data;
      } catch (err: unknown) {
        // 404 = no active subscription, return null
        if (err && typeof err === "object" && "status" in err && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useSubscriptionCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      product_id: string;
      plan_id: number;
      payment_method: string;
    }) => {
      const { data } = await platformApi.post("/subscriptions/checkout", params);
      return data as { subscription?: PlatformSubscription; order_no?: string; pay_url?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "wallet"] });
      queryClient.invalidateQueries({ queryKey: ["account", "overview"] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await platformApi.post("/subscriptions/lurus-lucrum/cancel");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
      queryClient.invalidateQueries({ queryKey: ["account", "overview"] });
    },
  });
}
