/**
 * POST /api/lurus/marketplace/fork
 *
 * Body: { marketplaceId: number }
 * Copies the marketplace strategy into the caller's strategy_history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import { forkStrategy } from '@/lib/services/marketplace-service';

export async function POST(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    let body: { marketplaceId?: number };
    try {
      body = (await req.json()) as { marketplaceId?: number };
    } catch {
      return NextResponse.json(
        { success: false, error: 'invalid json body' },
        { status: 400 },
      );
    }
    const marketplaceId = body.marketplaceId;
    if (!marketplaceId || !Number.isFinite(marketplaceId)) {
      return NextResponse.json(
        { success: false, error: 'marketplaceId is required' },
        { status: 400 },
      );
    }
    const result = await forkStrategy(user.userId, marketplaceId);
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'fork failed' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: result });
  });
}

export const dynamic = 'force-dynamic';
