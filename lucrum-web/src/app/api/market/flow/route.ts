/**
 * Capital Flow API Route
 *
 * GET /api/market/flow?symbol=600519 - Stock capital flow
 * GET /api/market/flow?type=northbound - North-bound capital flow
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCapitalFlow,
  getNorthBoundFlow,
} from "@/lib/data-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const type = searchParams.get("type");

  try {
    // North-bound flow request
    if (type === "northbound") {
      const result = await getNorthBoundFlow();
      return NextResponse.json(result);
    }

    // Stock capital flow request
    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: symbol or type=northbound",
        },
        { status: 400 },
      );
    }

    const result = await getCapitalFlow(symbol);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Flow API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
