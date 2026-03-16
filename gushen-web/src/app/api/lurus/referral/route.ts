/**
 * Referral Stats Proxy API
 *
 * GET /api/lurus/referral
 * Resolves identity account, then fetches referral stats.
 * Uses internal API key pattern (same as overview proxy).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const IDENTITY_URL =
  process.env.LURUS_IDENTITY_URL ?? "https://identity.lurus.cn";
const IDENTITY_INTERNAL_KEY =
  process.env.LURUS_IDENTITY_INTERNAL_KEY ?? "";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const zitadelSub = session.user.id;
  const headers = { Authorization: `Bearer ${IDENTITY_INTERNAL_KEY}` };

  try {
    // Resolve identity account ID from Zitadel subject
    const accountRes = await fetch(
      `${IDENTITY_URL}/internal/v1/accounts/by-zitadel-sub/${encodeURIComponent(zitadelSub)}`,
      { headers, next: { revalidate: 0 } }
    );
    if (!accountRes.ok) {
      return NextResponse.json(
        { error: "account not found" },
        { status: 404 }
      );
    }
    const account = (await accountRes.json()) as {
      id: number;
      aff_code: string;
    };

    // Fetch referral stats via internal API
    const refRes = await fetch(
      `${IDENTITY_URL}/internal/v1/accounts/${account.id}/referral`,
      { headers, next: { revalidate: 0 } }
    );

    if (!refRes.ok) {
      // Fallback: return basic info from account
      return NextResponse.json({
        aff_code: account.aff_code ?? "",
        total_referrals: 0,
        total_rewarded_lb: 0,
      });
    }

    const refData = await refRes.json();
    return NextResponse.json({
      aff_code: account.aff_code ?? refData.aff_code ?? "",
      total_referrals: refData.total_referrals ?? 0,
      total_rewarded_lb: refData.total_rewarded_lb ?? 0,
    });
  } catch (err) {
    console.error("[referral] proxy error:", err);
    return NextResponse.json(
      { error: "identity service unavailable" },
      { status: 503 }
    );
  }
}
