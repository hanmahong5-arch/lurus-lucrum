/**
 * POST /api/lurus/marketplace/rate
 *
 * Body: { marketplaceId: number, stars: 1-5, review?: string }
 * Upserts the caller's rating and refreshes the cached avg/count.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import { rateStrategy } from '@/lib/services/marketplace-service';

export async function POST(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    let body: { marketplaceId?: number; stars?: number; review?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { success: false, error: 'invalid json body' },
        { status: 400 },
      );
    }
    const { marketplaceId, stars, review } = body;
    if (!marketplaceId || !stars) {
      return NextResponse.json(
        { success: false, error: 'marketplaceId and stars are required' },
        { status: 400 },
      );
    }
    const result = await rateStrategy(user.userId, marketplaceId, stars, review);
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'rate failed' },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, data: result });
  });
}

export const dynamic = 'force-dynamic';
