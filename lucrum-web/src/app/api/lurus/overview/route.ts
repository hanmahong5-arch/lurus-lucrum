/**
 * Identity Overview API Route
 *
 * Server-side proxy to lurus-platform internal endpoint.
 * Uses withUser() to support both NextAuth session and mobile JWT auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser } from '@/lib/auth';
import {
  getAccountByZitadelSub,
  getAccountOverview,
  PlatformError,
} from '@/lib/platform/client';

export async function GET(request: NextRequest) {
  return withUser(request, async (req, user): Promise<NextResponse> => {
    const productId = req.nextUrl.searchParams.get('product_id') ?? 'lurus-lucrum';

    try {
      const account = await getAccountByZitadelSub(user.userId);
      const overview = await getAccountOverview(account.id, productId);
      return NextResponse.json({
        ...overview,
        topup_url: 'https://identity.lurus.cn/wallet/topup',
      });
    } catch (err) {
      if (err instanceof PlatformError) {
        if (err.code === 'not_found') {
          return NextResponse.json({ error: 'account not found' }, { status: 404 });
        }
        return NextResponse.json(
          { error: 'identity service unavailable' },
          { status: err.statusCode },
        );
      }
      return NextResponse.json({ error: 'identity service unavailable' }, { status: 503 });
    }
  });
}
