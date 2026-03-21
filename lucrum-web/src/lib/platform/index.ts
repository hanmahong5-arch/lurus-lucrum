export {
  // Client functions
  getAccountByZitadelSub,
  getAccountOverview,
  getEntitlements,
  getWalletBalance,
  debitWallet,
  creditWallet,
  preAuthorize,
  settlePreAuth,
  releasePreAuth,
  createCheckout,
  getCheckoutStatus,
  getReferralStats,
  resolveAccountId,
  // Error types
  PlatformError,
  // Types
  type PlatformErrorCode,
  type PlatformAccount,
  type AccountOverview,
  type WalletBalance,
  type DebitResult,
  type CreditResult,
  type PreAuthResult,
  type CheckoutRequest,
  type CheckoutResult,
  type CheckoutStatus,
  type ReferralStats,
} from './client';

export {
  getEntitlementTier,
  invalidateEntitlementCache,
  type EntitlementTier,
} from './entitlements';
