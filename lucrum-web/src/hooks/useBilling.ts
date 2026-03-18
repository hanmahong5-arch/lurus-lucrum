/**
 * Billing Hooks
 *
 * React hooks for interacting with Lurus API billing endpoints.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SubscriptionPlan {
  code: string;
  name: string;
  price: number;
  period_days: number;
  daily_quota: number;
  total_quota: number;
  features: string[];
}

interface TopupOrder {
  id: number;
  trade_no: string;
  amount: number;
  money: number;
  payment_method: string;
  status: string;
  created_time: number;
}

interface TopupsResponse {
  topups: TopupOrder[];
  total: number;
  page: number;
  page_size: number;
}

interface CreateTopupParams {
  amount: number;
  payment_method: string;
  money?: number;
  currency?: string;
}

interface InitiatePaymentParams {
  trade_no: string;
  payment_method: string;
}

/**
 * Hook for managing billing operations
 */
export function useBilling() {
  const queryClient = useQueryClient();

  // Fetch subscription plans
  const {
    data: plans,
    isLoading: plansLoading,
    error: plansError,
  } = useQuery<SubscriptionPlan[]>({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const res = await fetch("/api/lurus/billing/plans");
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch plans");
      }

      return data.data || [];
    },
  });

  // Fetch topup history
  const {
    data: topupsData,
    isLoading: topupsLoading,
    error: topupsError,
  } = useQuery<TopupsResponse>({
    queryKey: ["billing-topups"],
    queryFn: async () => {
      const res = await fetch("/api/lurus/billing/topups?page=1&page_size=20");
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch topups");
      }

      return data.data || { topups: [], total: 0, page: 1, page_size: 20 };
    },
  });

  // Create topup order
  const createTopup = useMutation({
    mutationFn: async (params: CreateTopupParams) => {
      const res = await fetch("/api/lurus/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: params.amount,
          payment_method: params.payment_method,
          money: params.money || params.amount / 100,
          currency: params.currency || "CNY",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create topup");
      }

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-topups"] });
    },
  });

  // Initiate payment
  const initiatePayment = useMutation({
    mutationFn: async (params: InitiatePaymentParams) => {
      const res = await fetch("/api/lurus/billing/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to initiate payment");
      }

      return data.data;
    },
  });

  return {
    // Plans
    plans,
    plansLoading,
    plansError,

    // Topups
    topups: topupsData?.topups || [],
    topupsTotal: topupsData?.total || 0,
    topupsLoading,
    topupsError,

    // Mutations
    createTopup,
    initiatePayment,
  };
}
