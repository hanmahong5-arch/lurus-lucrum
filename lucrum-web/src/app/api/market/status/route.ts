/**
 * Data Service Status API Route
 * 数据服务状态API路由
 *
 * GET /api/market/status - Get service health and statistics
 */

import { NextResponse } from "next/server";
import {
  getServiceStats,
  getServiceHealth,
  getRecentLogs,
  getRecentMetrics,
} from "@/lib/data-service";

export async function GET() {
  try {
    const stats = getServiceStats();
    const health = getServiceHealth();
    const recentLogs = getRecentLogs({ limit: 20, level: "info" });
    const recentMetrics = getRecentMetrics({ limit: 20 });

    return NextResponse.json({
      success: true,
      data: {
        stats,
        health,
        recentLogs,
        recentMetrics,
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Status API error:", err);

    // Return a default status instead of error
    // 返回默认状态而不是错误
    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageLatency: 0,
          cacheHitRate: 0,
          healthStatus: [],
          uptime: 0,
        },
        health: [],
        recentLogs: [],
        recentMetrics: [],
      },
      timestamp: Date.now(),
      warning: err instanceof Error ? err.message : "Status unavailable",
    });
  }
}

export const dynamic = "force-dynamic";
