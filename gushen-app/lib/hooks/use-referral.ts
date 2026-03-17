/**
 * Referral Hook
 *
 * Fetches user's referral code and stats from lurus-platform.
 */

import { useQuery } from "@tanstack/react-query";
import { platformApi } from "@/lib/api/client";
import type { ReferralInfo } from "@shared/types";

export function useReferral() {
  return useQuery({
    queryKey: ["account", "referral"],
    queryFn: async () => {
      const { data } = await platformApi.get<ReferralInfo>("/account/me/referral");
      return data;
    },
    staleTime: 120_000,
  });
}
