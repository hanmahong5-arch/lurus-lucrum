/**
 * Market Indices API Route
 *
 * GET /api/market/indices
 *
 * Features:
 * - Fetches real market index data from EastMoney/Sina
 * - Returns error when data sources are unavailable
 */

import { NextResponse } from "next/server";
import { getMajorIndices } from "@/lib/data-service";

// Timeout for external API calls (ms)
const API_TIMEOUT = 8000;

export async function GET() {
  try {
    // Fetch real data with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("API timeout")), API_TIMEOUT);
    });

    const result = await Promise.race([getMajorIndices(), timeoutPromise]);

    // If real data fetch succeeded, return it
    if (result.success && result.data) {
      return NextResponse.json(result);
    }

    // Real data fetch returned but with error
    return NextResponse.json(
      {
        success: false,
        error: result.error ?? "Unable to fetch index data. Please try again later.",
      },
      { status: 502 }
    );
  } catch (err) {
    console.error("Indices API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unable to fetch index data. Please try again later.",
      },
      { status: 502 }
    );
  }
}

// Enable dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 5;
