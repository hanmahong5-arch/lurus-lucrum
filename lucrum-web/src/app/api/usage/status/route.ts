/**
 * Usage Status API
 * Returns current feature usage for the authenticated user.
 *
 * GET /api/usage/status
 *
 * @module app/api/usage/status/route
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { checkUsage } from "@/lib/middleware/usage-tracker";
import type { UsageFeature } from "@/lib/config/plan-limits";

const TRACKED_FEATURES: UsageFeature[] = ["backtest", "ai_call"];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user.email ?? session.user.name ?? "anonymous";
    const plan = (session.user as { role?: string }).role ?? "free";

    const result: Record<string, Awaited<ReturnType<typeof checkUsage>>> = {};
    for (const feature of TRACKED_FEATURES) {
      result[feature] = await checkUsage(userId, feature, plan);
    }

    return NextResponse.json({
      success: true,
      data: result,
      plan,
    });
  } catch (error) {
    console.error("[Usage Status API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
