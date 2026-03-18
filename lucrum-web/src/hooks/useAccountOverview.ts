/**
 * Account Overview Hook
 *
 * Fetches aggregated identity overview (VIP level, Lubell wallet, subscription)
 * via the local /api/lurus/overview proxy which calls lurus-platform internally.
 * Data is cached for 2 minutes to reduce API calls.
 */

import { useQuery } from '@tanstack/react-query';

export interface AccountOverview {
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
  } | null;
  topup_url: string;
}

async function fetchAccountOverview(): Promise<AccountOverview> {
  const res = await fetch('/api/lurus/overview?product_id=lurus-lucrum');
  if (!res.ok) {
    throw new Error(`Failed to fetch account overview: ${res.status}`);
  }
  return res.json() as Promise<AccountOverview>;
}

export function useAccountOverview() {
  return useQuery<AccountOverview>({
    queryKey: ['account-overview'],
    queryFn: fetchAccountOverview,
    staleTime: 2 * 60 * 1000, // 2 minutes, matches identity Redis TTL
    retry: false,
  });
}
