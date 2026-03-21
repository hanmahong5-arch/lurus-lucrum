/**
 * Subscription Checkout API Route
 *
 * POST /api/lurus/subscription/checkout
 * Server-side proxy to lurus-platform subscription checkout.
 * Uses withUser() to support both NextAuth session and mobile JWT auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser } from '@/lib/auth';
import {
  getAccountByZitadelSub,
  subscriptionCheckout,
  PlatformError,
} from '@/lib/platform/client';

const TOPUP_URL = 'https://identity.lurus.cn/wallet/topup';
const VALID_BILLING_CYCLES = ['monthly', 'yearly'] as const;
const VALID_PAYMENT_METHODS = ['wallet', 'alipay', 'wechat'] as const;

interface CheckoutBody {
  plan_code: string;
  billing_cycle: string;
  payment_method: string;
}

export async function POST(request: NextRequest) {
  return withUser(request, async (req, user): Promise<NextResponse> => {
    let body: CheckoutBody;
    try {
      body = (await req.json()) as CheckoutBody;
    } catch {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!body.plan_code?.trim()) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'plan_code is required' },
        { status: 400 },
      );
    }

    if (!VALID_BILLING_CYCLES.includes(body.billing_cycle as typeof VALID_BILLING_CYCLES[number])) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'billing_cycle must be "monthly" or "yearly"' },
        { status: 400 },
      );
    }

    if (!VALID_PAYMENT_METHODS.includes(body.payment_method as typeof VALID_PAYMENT_METHODS[number])) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'payment_method must be "wallet", "alipay", or "wechat"' },
        { status: 400 },
      );
    }

    try {
      // Resolve Zitadel sub to platform account
      const account = await getAccountByZitadelSub(user.userId);

      // Call platform subscription checkout
      const result = await subscriptionCheckout(account.id, {
        product_id: 'lurus-lucrum',
        plan_code: body.plan_code.trim(),
        billing_cycle: body.billing_cycle,
        payment_method: body.payment_method,
        return_url: `${req.nextUrl.origin}/dashboard/checkout/callback`,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (err) {
      if (err instanceof PlatformError) {
        if (err.code === 'insufficient_balance') {
          return NextResponse.json(
            {
              error: 'insufficient_balance',
              message: 'Wallet balance insufficient for this subscription',
              topup_url: TOPUP_URL,
            },
            { status: 402 },
          );
        }
        if (err.code === 'not_found') {
          return NextResponse.json(
            { error: 'not_found', message: 'Account or plan not found' },
            { status: 404 },
          );
        }
        console.error('[checkout] platform error:', err.code, err.message);
        return NextResponse.json(
          { error: 'platform_error', message: 'Subscription service error' },
          { status: err.statusCode },
        );
      }
      console.error('[checkout] unexpected error:', err);
      return NextResponse.json(
        { error: 'internal_error', message: 'An unexpected error occurred' },
        { status: 500 },
      );
    }
  });
}
