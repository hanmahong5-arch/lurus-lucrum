/**
 * Identity Overview API Route
 *
 * Server-side proxy to lurus-identity internal endpoint.
 * Uses session.user.id (Zitadel sub) to look up the identity account,
 * then fetches the aggregated account overview.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const IDENTITY_URL = process.env.LURUS_IDENTITY_URL ?? 'https://identity.lurus.cn';
const IDENTITY_INTERNAL_KEY = process.env.LURUS_IDENTITY_INTERNAL_KEY ?? '';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const productId = request.nextUrl.searchParams.get('product_id') ?? 'lurus-gushen';
  const zitadelSub = session.user.id;
  const headers = { Authorization: `Bearer ${IDENTITY_INTERNAL_KEY}` };

  // Resolve identity account ID from Zitadel subject
  const accountRes = await fetch(
    `${IDENTITY_URL}/internal/v1/accounts/by-zitadel-sub/${encodeURIComponent(zitadelSub)}`,
    { headers, next: { revalidate: 0 } },
  );
  if (!accountRes.ok) {
    return NextResponse.json({ error: 'account not found' }, { status: 404 });
  }
  const account = (await accountRes.json()) as { id: number };

  // Fetch aggregated overview
  const ovRes = await fetch(
    `${IDENTITY_URL}/internal/v1/accounts/${account.id}/overview?product_id=${encodeURIComponent(productId)}`,
    { headers, next: { revalidate: 0 } },
  );
  if (!ovRes.ok) {
    return NextResponse.json({ error: 'identity service unavailable' }, { status: 503 });
  }

  return NextResponse.json(await ovRes.json());
}
