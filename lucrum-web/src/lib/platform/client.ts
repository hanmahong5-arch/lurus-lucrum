/**
 * Lurus Platform Client
 *
 * Typed client for lurus-platform internal API.
 * Mirrors the Go SDK pattern (pkg/platformclient/client.go).
 *
 * All methods throw PlatformError on failure with well-known error codes.
 */

// ─── Configuration ──────────────────────────────────────────────────────────────

const PLATFORM_URL = process.env.LURUS_IDENTITY_URL ?? 'https://identity.lurus.cn';
const PLATFORM_KEY = process.env.LURUS_IDENTITY_INTERNAL_KEY ?? '';
const REQUEST_TIMEOUT_MS = 5_000;

// ─── Error Types ────────────────────────────────────────────────────────────────

export type PlatformErrorCode =
  | 'insufficient_balance'
  | 'not_found'
  | 'unauthorized'
  | 'rate_limited'
  | 'scope_denied'
  | 'unavailable'
  | 'unknown';

export class PlatformError extends Error {
  constructor(
    public readonly code: PlatformErrorCode,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

// ─── Response Types ─────────────────────────────────────────────────────────────

export interface PlatformAccount {
  id: number;
  zitadel_sub: string;
  username: string;
  email: string;
  aff_code?: string;
}

export interface AccountOverview {
  account: {
    id: number;
    username: string;
    email: string;
    vip_tier: string;
    vip_expires_at?: string;
  };
  wallet?: {
    available: number;
    frozen: number;
    total: number;
  };
  subscription?: {
    plan_code: string;
    status: string;
    expires_at?: string;
  } | null;
  entitlements?: Record<string, string>;
}

export interface WalletBalance {
  available: number;
  frozen: number;
  total: number;
}

export interface DebitResult {
  success: boolean;
  balance_after?: number;
  transaction_id?: number;
}

export interface CreditResult {
  success: boolean;
  balance_after?: number;
}

export interface PreAuthResult {
  preauth_id: number;
  amount: number;
  status: string;
  expires_at: string;
}

export interface CheckoutRequest {
  account_id: number;
  amount: number;
  product_id: string;
  description: string;
  return_url?: string;
}

export interface CheckoutResult {
  order_no: string;
  payment_url: string;
}

export interface CheckoutStatus {
  order_no: string;
  status: string;
  amount: number;
}

export interface SubscriptionCheckoutRequest {
  product_id: string;
  plan_code: string;
  billing_cycle: string;
  payment_method: string;
  return_url?: string;
}

export interface SubscriptionCheckoutResult {
  /** Order number for tracking */
  order_no?: string;
  /** Subscription record (present on wallet-paid immediate activation) */
  subscription?: {
    plan_code: string;
    status: string;
    expires_at?: string;
  };
  /** External payment URL (present for alipay/wechat) */
  pay_url?: string;
}

export interface ReferralStats {
  aff_code: string;
  total_referrals: number;
  total_rewarded_lb: number;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────────

async function platformFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${PLATFORM_URL}${path}`, {
      ...options,
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${PLATFORM_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new PlatformError('unavailable', 'platform request timed out', 504);
    }
    throw new PlatformError('unavailable', 'platform service unreachable', 503);
  }
}

function mapErrorCode(status: number, body?: string): PlatformErrorCode {
  if (status === 402) return 'insufficient_balance';
  if (status === 404) return 'not_found';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'scope_denied';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  if (body?.includes('insufficient_balance')) return 'insufficient_balance';
  return 'unknown';
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }

  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch {
    // ignore
  }

  const code = mapErrorCode(res.status, bodyText);
  throw new PlatformError(code, bodyText || `platform responded ${res.status}`, res.status);
}

// ─── Public API ─────────────────────────────────────────────────────────────────

// --- Account ---

export async function getAccountByZitadelSub(sub: string): Promise<PlatformAccount> {
  const res = await platformFetch(
    `/internal/v1/accounts/by-zitadel-sub/${encodeURIComponent(sub)}`,
  );
  return handleResponse<PlatformAccount>(res);
}

export async function getAccountOverview(
  accountId: number,
  productId: string,
): Promise<AccountOverview> {
  const res = await platformFetch(
    `/internal/v1/accounts/${accountId}/overview?product_id=${encodeURIComponent(productId)}`,
  );
  return handleResponse<AccountOverview>(res);
}

export async function getEntitlements(
  accountId: number,
  productId: string,
): Promise<Record<string, string>> {
  const res = await platformFetch(
    `/internal/v1/accounts/${accountId}/entitlements/${encodeURIComponent(productId)}`,
  );
  return handleResponse<Record<string, string>>(res);
}

// --- Wallet ---

export async function getWalletBalance(accountId: number): Promise<WalletBalance> {
  const res = await platformFetch(
    `/internal/v1/accounts/${accountId}/wallet/balance`,
  );
  return handleResponse<WalletBalance>(res);
}

export async function debitWallet(
  accountId: number | string,
  amount: number,
  type: string,
  description: string,
  productId = 'lurus-lucrum',
): Promise<DebitResult> {
  const res = await platformFetch(
    `/internal/v1/accounts/${accountId}/wallet/debit`,
    {
      method: 'POST',
      body: JSON.stringify({ amount, type, product_id: productId, description }),
    },
  );
  return handleResponse<DebitResult>(res);
}

export async function creditWallet(
  accountId: number | string,
  amount: number,
  type: string,
  description: string,
  productId = 'lurus-lucrum',
): Promise<CreditResult> {
  const res = await platformFetch(
    `/internal/v1/accounts/${accountId}/wallet/credit`,
    {
      method: 'POST',
      body: JSON.stringify({ amount, type, product_id: productId, description }),
    },
  );
  return handleResponse<CreditResult>(res);
}

// --- Pre-Auth ---

export async function preAuthorize(
  accountId: number,
  amount: number,
  productId: string,
  referenceId: string,
  description: string,
  ttlSeconds = 300,
): Promise<PreAuthResult> {
  const res = await platformFetch(
    `/internal/v1/accounts/${accountId}/wallet/pre-authorize`,
    {
      method: 'POST',
      body: JSON.stringify({
        amount,
        product_id: productId,
        reference_id: referenceId,
        description,
        ttl_seconds: ttlSeconds,
      }),
    },
  );
  return handleResponse<PreAuthResult>(res);
}

export async function settlePreAuth(
  preAuthId: number,
  actualAmount: number,
): Promise<{ preauth_id: number; status: string }> {
  const res = await platformFetch(
    `/internal/v1/wallet/pre-auth/${preAuthId}/settle`,
    {
      method: 'POST',
      body: JSON.stringify({ actual_amount: actualAmount }),
    },
  );
  return handleResponse(res);
}

export async function releasePreAuth(preAuthId: number): Promise<void> {
  const res = await platformFetch(
    `/internal/v1/wallet/pre-auth/${preAuthId}/release`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const code = mapErrorCode(res.status);
    throw new PlatformError(code, `release failed: ${res.status}`, res.status);
  }
}

// --- Checkout ---

export async function createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
  const res = await platformFetch('/internal/v1/checkout/create', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return handleResponse<CheckoutResult>(res);
}

export async function getCheckoutStatus(orderNo: string): Promise<CheckoutStatus> {
  const res = await platformFetch(
    `/internal/v1/checkout/status/${encodeURIComponent(orderNo)}`,
  );
  return handleResponse<CheckoutStatus>(res);
}

// --- Subscription ---

export async function subscriptionCheckout(
  accountId: number,
  req: SubscriptionCheckoutRequest,
): Promise<SubscriptionCheckoutResult> {
  const res = await platformFetch('/internal/v1/subscriptions/checkout', {
    method: 'POST',
    body: JSON.stringify({
      account_id: accountId,
      ...req,
    }),
  });
  return handleResponse<SubscriptionCheckoutResult>(res);
}

// --- Referral ---

export async function getReferralStats(accountId: number): Promise<ReferralStats> {
  const res = await platformFetch(
    `/internal/v1/accounts/${accountId}/referral`,
  );
  if (!res.ok) {
    // Referral endpoint may not exist yet; return defaults
    return { aff_code: '', total_referrals: 0, total_rewarded_lb: 0 };
  }
  return (await res.json()) as ReferralStats;
}

// --- Account Resolution Helper ---

export async function resolveAccountId(zitadelSub: string): Promise<string> {
  const account = await getAccountByZitadelSub(zitadelSub);
  return String(account.id);
}
