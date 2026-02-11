/**
 * API Keys Management Hooks
 *
 * React hooks for managing API keys via Lurus API.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ApiKey {
  id: number;
  name: string;
  key: string;
  remain_quota: number;
  used_quota: number;
  unlimited_quota: boolean;
  status: number;
  created_time: number;
}

interface TokensResponse {
  tokens: ApiKey[];
  total: number;
  page: number;
  page_size: number;
}

interface CreateApiKeyParams {
  name: string;
  quota?: number;
  unlimited_quota?: boolean;
  expired_time?: number;
  group?: string;
}

/**
 * Hook for managing API keys
 */
export function useApiKeys() {
  const queryClient = useQueryClient();

  // Fetch API keys
  const {
    data: tokensData,
    isLoading,
    error,
  } = useQuery<TokensResponse>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/lurus/tokens?page=1&page_size=50");
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch API keys");
      }

      return data.data || { tokens: [], total: 0, page: 1, page_size: 50 };
    },
  });

  const tokens = tokensData?.tokens || [];

  // Calculate total quota across all tokens
  const totalQuota = tokens.reduce(
    (sum, token) => sum + (token.remain_quota || 0),
    0
  );

  // Calculate total used quota
  const totalUsedQuota = tokens.reduce(
    (sum, token) => sum + (token.used_quota || 0),
    0
  );

  // Create API key
  const createKey = useMutation({
    mutationFn: async (params: CreateApiKeyParams) => {
      const res = await fetch("/api/lurus/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: params.name,
          remain_quota: params.quota || 1000000,
          unlimited_quota: params.unlimited_quota || false,
          expired_time: params.expired_time || -1,
          group: params.group || "gushen",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create API key");
      }

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  // Delete API key
  const deleteKey = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/lurus/tokens/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to delete API key");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  // Update API key (e.g., modify quota)
  const updateKey = useMutation({
    mutationFn: async (params: { id: number; name?: string; quota?: number }) => {
      const res = await fetch(`/api/lurus/tokens/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: params.name,
          remain_quota: params.quota,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to update API key");
      }

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  return {
    tokens,
    totalQuota,
    totalUsedQuota,
    isLoading,
    error,
    createKey,
    deleteKey,
    updateKey,
  };
}
