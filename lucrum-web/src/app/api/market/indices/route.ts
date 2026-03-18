/**
 * Market Indices API Route
 * 市场指数API路由
 *
 * GET /api/market/indices
 *
 * Features:
 * - Auto fallback to mock data on API failure
 * - Network error resilience
 */

import { NextResponse } from "next/server";
import { getMajorIndices, generateMockIndices } from "@/lib/data-service";

// Environment flag for using mock data
// 使用模拟数据的环境标志
const USE_MOCK = process.env.USE_MOCK_DATA === "true";

// Timeout for external API calls (ms)
const API_TIMEOUT = 8000;

export async function GET() {
  try {
    // If mock mode is enabled, return mock data directly
    if (USE_MOCK) {
      const mockIndices = generateMockIndices();
      return NextResponse.json({
        success: true,
        data: mockIndices,
        source: "mock",
        cached: false,
        timestamp: Date.now(),
        latency: 0,
      });
    }

    // Try to fetch real data with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("API timeout")), API_TIMEOUT);
    });

    const result = await Promise.race([getMajorIndices(), timeoutPromise]);

    // If real data fetch succeeded, return it
    if (result.success && result.data) {
      return NextResponse.json(result);
    }

    // If real data fetch failed, fallback to mock data
    console.warn("Indices API: Real data fetch failed, using mock data");
    const mockIndices = generateMockIndices();
    return NextResponse.json({
      success: true,
      data: mockIndices,
      source: "mock-fallback",
      cached: false,
      timestamp: Date.now(),
      latency: 0,
      warning: result.error ?? "Real data unavailable",
    });
  } catch (err) {
    console.error("Indices API error:", err);

    // On any error, fallback to mock data instead of failing
    const mockIndices = generateMockIndices();
    return NextResponse.json({
      success: true,
      data: mockIndices,
      source: "mock-fallback",
      cached: false,
      timestamp: Date.now(),
      latency: 0,
      warning:
        err instanceof Error ? err.message : "API error, using mock data",
    });
  }
}

// Enable static generation for better performance
export const dynamic = "force-dynamic";
export const revalidate = 5;
