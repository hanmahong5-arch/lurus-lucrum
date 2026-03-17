/**
 * Daily Check-in Hooks
 *
 * Check-in status and perform daily check-in via lurus-platform.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "@/lib/api/client";
import type { CheckinStatus, CheckinResult } from "@shared/types";

export function useCheckinStatus() {
  return useQuery({
    queryKey: ["checkin", "status"],
    queryFn: async () => {
      const { data } = await platformApi.get<CheckinStatus>("/checkin/status");
      return data;
    },
    staleTime: 60_000,
  });
}

export function useDoCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await platformApi.post<CheckinResult>("/checkin");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin", "status"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "wallet"] });
      queryClient.invalidateQueries({ queryKey: ["account", "overview"] });
    },
  });
}
