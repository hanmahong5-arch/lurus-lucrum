/**
 * Referral Stats Proxy API
 *
 * GET /api/lurus/referral
 * Resolves identity account, then fetches referral stats.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAccountByZitadelSub,
  getReferralStats,
  PlatformError,
} from "@/lib/platform/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const account = await getAccountByZitadelSub(session.user.id);
    const stats = await getReferralStats(account.id);

    return NextResponse.json({
      aff_code: account.aff_code ?? stats.aff_code ?? "",
      total_referrals: stats.total_referrals,
      total_rewarded_lb: stats.total_rewarded_lb,
    });
  } catch (err) {
    if (err instanceof PlatformError) {
      if (err.code === "not_found") {
        return NextResponse.json({ error: "account not found" }, { status: 404 });
      }
      console.error("[referral] platform error:", err.code, err.message);
    } else {
      console.error("[referral] proxy error:", err);
    }
    return NextResponse.json(
      { error: "identity service unavailable" },
      { status: 503 },
    );
  }
}
