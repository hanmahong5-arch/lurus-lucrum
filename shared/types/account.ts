/**
 * Shared Account Types
 */

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: "free" | "silver" | "gold" | "diamond";
  createdAt: string;
}

export interface SubscriptionInfo {
  plan: string;
  status: "active" | "expired" | "cancelled" | "pending" | "trial" | "grace" | "suspended";
  expiresAt: string;
  autoRenew: boolean;
  features: string[];
}

export interface VipInfo {
  level: number;
  levelName: string;
  points: number;
  expiresAt: string | null;
}

export interface WalletInfo {
  balance: number;
  frozen: number;
}

export interface AccountOverview {
  account: {
    id: number;
    lurusId: string;
    displayName: string;
    avatarUrl: string;
  };
  vip: VipInfo;
  wallet: WalletInfo;
  subscription: SubscriptionInfo | null;
  topupUrl: string;
}

// Platform API direct response types

export interface PlatformWallet {
  id: number;
  account_id: number;
  balance: number;
  frozen: number;
  lifetime_topup: number;
  lifetime_spend: number;
}

export interface WalletTransaction {
  id: number;
  wallet_id: number;
  account_id: number;
  type: string;
  amount: number;
  balance_after: number;
  product_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ProductPlan {
  id: number;
  product_id: string;
  code: string;
  name: string;
  billing_cycle: string;
  price_cny: number;
  price_usd: number;
  is_default: boolean;
  sort_order: number;
  status: number;
  features: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformSubscription {
  id: number;
  account_id: number;
  product_id: string;
  plan_id: number;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  grace_until: string | null;
  auto_renew: boolean;
  payment_method: string;
  created_at: string;
  updated_at: string;
}

export interface TopupInfo {
  payment_methods: Array<{
    id: string;
    name: string;
    provider: string;
  }>;
}

export interface TopupOrder {
  order_no: string;
  pay_url: string;
}

export interface PaymentOrder {
  id: number;
  account_id: number;
  order_no: string;
  order_type: string;
  product_id: string | null;
  plan_id: number | null;
  amount_cny: number;
  currency: string;
  payment_method: string;
  status: string;
  external_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckinStatus {
  checked_in_today: boolean;
  streak: number;
  last_checkin: string | null;
  reward_amount: number;
}

export interface CheckinResult {
  reward: number;
  streak: number;
  balance_after: number;
}

export interface ReferralInfo {
  aff_code: string;
  referral_url: string;
  stats: {
    total_referrals: number;
    total_rewarded_lb: number;
  };
}
