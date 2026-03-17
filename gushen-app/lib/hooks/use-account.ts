/**
 * Account Overview Hook
 *
 * Fetches aggregated user account info directly from lurus-platform.
 * Platform JWT middleware auto-resolves Zitadel sub → account ID.
 */

import { useQuery } from "@tanstack/react-query";
import { platformApi } from "@/lib/api/client";
import type { AccountOverview } from "@shared/types";

interface PlatformOverviewResponse {
  account: {
    id: number;
    lurus_id: string;
    display_name: string;
    avatar_url: string;
  };
  vip: {
    level: number;
    level_name: string;
    level_en: string;
    points: number;
    level_expires_at: string | null;
  };
  wallet: {
    balance: number;
    frozen: number;
  };
  subscription: {
    product_id: string;
    plan_code: string;
    status: string;
    expires_at: string | null;
    auto_renew: boolean;
    features?: string[];
  } | null;
  topup_url: string;
}

function mapOverviewResponse(raw: PlatformOverviewResponse): AccountOverview {
  return {
    account: {
      id: raw.account.id,
      lurusId: raw.account.lurus_id,
      displayName: raw.account.display_name,
      avatarUrl: raw.account.avatar_url,
    },
    vip: {
      level: raw.vip.level,
      levelName: raw.vip.level_name,
      points: raw.vip.points,
      expiresAt: raw.vip.level_expires_at,
    },
    wallet: {
      balance: raw.wallet.balance,
      frozen: raw.wallet.frozen,
    },
    subscription: raw.subscription
      ? {
          plan: raw.subscription.plan_code,
          status: raw.subscription.status as AccountOverview["subscription"] extends null ? never : NonNullable<AccountOverview["subscription"]>["status"],
          expiresAt: raw.subscription.expires_at ?? "",
          autoRenew: raw.subscription.auto_renew,
          features: raw.subscription.features ?? [],
        }
      : null,
    topupUrl: raw.topup_url,
  };
}

export function useAccountOverview() {
  return useQuery({
    queryKey: ["account", "overview"],
    queryFn: async () => {
      const { data } = await platformApi.get<PlatformOverviewResponse>(
        "/account/me/overview?product_id=lurus-gushen",
      );
      return mapOverviewResponse(data);
    },
    staleTime: 60_000,
    retry: 1,
  });
}
