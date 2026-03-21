/**
 * Subscription Checkout Status API Route
 *
 * GET /api/lurus/subscription/status?order_no=xxx
 * Polls checkout order status from lurus-platform.
 * Invalidates entitlement cache when payment is confirmed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser } from '@/lib/auth';
import {
  getCheckoutStatus,
  PlatformError,
} from '@/lib/platform/client';
import { invalidateEntitlementCache } from '@/lib/platform/entitlements';

export async function GET(request: NextRequest) {
  return withUser(request, async (req, user): Promise<NextResponse> => {
    const orderNo = req.nextUrl.searchParams.get('order_no');

    if (!orderNo?.trim()) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'order_no query parameter is required' },
        { status: 400 },
      );
    }

    try {
      const status = await getCheckoutStatus(orderNo.trim());

      // When payment is confirmed, invalidate entitlement cache
      // so subsequent requests reflect the new subscription tier
      if (status.status === 'paid') {
        await invalidateEntitlementCache(user.userId).catch((cacheErr) => {
          console.warn('[checkout-status] failed to invalidate entitlement cache:', cacheErr);
        });
      }

      return NextResponse.json({
        order_no: status.order_no,
        status: status.status,
        amount: status.amount,
      });
    } catch (err) {
      if (err instanceof PlatformError) {
        if (err.code === 'not_found') {
          return NextResponse.json(
            { error: 'not_found', message: 'Order not found' },
            { status: 404 },
          );
        }
        console.error('[checkout-status] platform error:', err.code, err.message);
        return NextResponse.json(
          { error: 'platform_error', message: 'Unable to check order status' },
          { status: err.statusCode },
        );
      }
      console.error('[checkout-status] unexpected error:', err);
      return NextResponse.json(
        { error: 'internal_error', message: 'An unexpected error occurred' },
        { status: 500 },
      );
    }
  });
}
