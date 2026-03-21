/**
 * Strategy Recommendation API
 *
 * POST /api/strategy/recommend
 *
 * Given a sector code or list of symbols + holding period, runs all 9
 * strategy detectors and returns recommendations ranked by composite score.
 *
 * Request body:
 *   {
 *     sectorCode?: string,       // e.g., "BK0437"
 *     symbols?: string[],        // OR specific stock list
 *     holdingDays: number,       // e.g., 10
 *     dateRange?: { start: string, end: string }
 *   }
 *
 * Response:
 *   {
 *     recommendations: StrategyRecommendation[],
 *     meta: { totalStocks, holdingDays, sectorName?, scanTime }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSectorStocksProtected } from "@/lib/infra/external-apis";
import { getSectorName } from "@/lib/data-service/sources/eastmoney-sector";
import { batchGetKlinesWithDateRange } from "@/lib/data-service/batch-kline";
import { recommendStrategies, type StrategyRecommendation } from "@/lib/backtest/strategy-recommender";
import type { BacktestKline } from "@/lib/backtest/engine";
import { cacheGet, cacheSet } from "@/lib/redis";

const CACHE_TTL_SECONDS = 4 * 60 * 60; // 4 hours
const MAX_STOCKS = 50;
const DEFAULT_HOLDING_DAYS = 10;
const DEFAULT_LOOKBACK_YEARS = 3;
const MIN_KLINE_BARS = 100; // Minimum K-line bars for meaningful analysis

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      sectorCode,
      symbols: rawSymbols,
      holdingDays = DEFAULT_HOLDING_DAYS,
      dateRange,
    } = body as {
      sectorCode?: string;
      symbols?: string[];
      holdingDays?: number;
      dateRange?: { start: string; end: string };
    };

    // --- Validation ---
    if (!sectorCode && (!rawSymbols || rawSymbols.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECOMMEND_MISSING_INPUT",
            title: "缺少输入",
            description: "请提供板块代码(sectorCode)或股票列表(symbols)",
            severity: "error" as const,
            recoveryActions: [{ type: "custom" as const, label: "选择板块" }],
          },
        },
        { status: 400 },
      );
    }

    if (holdingDays <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECOMMEND_INVALID_DAYS",
            title: "持仓天数无效",
            description: "holdingDays必须大于0",
            severity: "error" as const,
            recoveryActions: [{ type: "custom" as const, label: "修改参数" }],
          },
        },
        { status: 400 },
      );
    }

    const clampedDays = Math.max(1, Math.min(60, holdingDays));

    // --- Cache check ---
    const cacheKey = sectorCode
      ? `recommend:${sectorCode}:${clampedDays}`
      : `recommend:symbols:${rawSymbols!.sort().join(",")}:${clampedDays}`;

    const cached = await cacheGet<{
      recommendations: StrategyRecommendation[];
      meta: Record<string, unknown>;
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

    // --- Resolve stock list ---
    let stockList: Array<{ symbol: string; name: string }> = [];
    let sectorName: string | undefined;

    if (sectorCode) {
      sectorName = getSectorName(sectorCode);

      const sectorResp = await getSectorStocksProtected(sectorCode, MAX_STOCKS);
      if (!sectorResp.success || !sectorResp.data) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RECOMMEND_SECTOR_FAILED",
              title: "获取板块成分股失败",
              description: sectorResp.error ?? "数据源暂不可用，请稍后重试",
              severity: "error" as const,
              recoveryActions: [
                { type: "retry" as const, label: "重试" },
                { type: "custom" as const, label: "更换板块" },
              ],
            },
          },
          { status: 502 },
        );
      }
      stockList = sectorResp.data.stocks
        .slice(0, MAX_STOCKS)
        .map((s) => ({ symbol: s.symbol, name: s.name }));
    } else if (rawSymbols) {
      stockList = rawSymbols
        .slice(0, MAX_STOCKS)
        .map((s) => ({ symbol: s, name: s }));
    }

    if (stockList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECOMMEND_NO_STOCKS",
            title: "该板块暂无成分股数据",
            description: "该板块没有符合条件的股票，请更换板块后重试",
            severity: "warning" as const,
            recoveryActions: [{ type: "custom" as const, label: "更换板块" }],
          },
        },
        { status: 422 },
      );
    }

    // --- Resolve date range ---
    const endDate = dateRange?.end ?? new Date().toISOString().split("T")[0]!;
    const startDate =
      dateRange?.start ??
      new Date(
        Date.now() - DEFAULT_LOOKBACK_YEARS * 365 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split("T")[0]!;

    // --- Fetch K-line data ---
    const symbols = stockList.map((s) => s.symbol);
    const klineResult = await batchGetKlinesWithDateRange(
      symbols,
      "1d",
      startDate,
      endDate,
      { concurrency: 10 },
    );

    if (klineResult.data.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECOMMEND_NO_KLINE",
            title: "无法获取K线数据，请稍后重试",
            description: "所有股票的K线数据获取失败，请检查网络后重试",
            severity: "error" as const,
            recoveryActions: [{ type: "retry" as const, label: "重试" }],
          },
        },
        { status: 422 },
      );
    }

    // --- Build stock data array ---
    const stocksWithKlines: Array<{
      symbol: string;
      name: string;
      klines: BacktestKline[];
    }> = [];

    for (const stock of stockList) {
      const klines = klineResult.data.get(stock.symbol);
      if (!klines || klines.length < MIN_KLINE_BARS) continue;

      const backtestKlines: BacktestKline[] = klines.map((k) => ({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      }));

      stocksWithKlines.push({
        symbol: stock.symbol,
        name: stock.name,
        klines: backtestKlines,
      });
    }

    if (stocksWithKlines.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECOMMEND_INSUFFICIENT_DATA",
            title: "K线数据不足",
            description: `所有股票的K线数据均不足${MIN_KLINE_BARS}根，无法进行策略推荐`,
            severity: "warning" as const,
            recoveryActions: [{ type: "custom" as const, label: "更换板块" }],
          },
        },
        { status: 422 },
      );
    }

    // --- Run recommender ---
    const recommendations = recommendStrategies({
      stocks: stocksWithKlines,
      holdingDays: clampedDays,
    });

    const scanTime = Date.now() - startTime;

    // Handle zero-signal case: return 200 with empty recommendations + message
    if (recommendations.length === 0) {
      const emptyResponse = {
        recommendations: [] as StrategyRecommendation[],
        meta: {
          totalStocks: stocksWithKlines.length,
          holdingDays: clampedDays,
          sectorName,
          scanTime,
          message: "该板块在指定周期内未产生任何策略信号",
        },
      };
      return NextResponse.json({ success: true, data: emptyResponse });
    }

    const responseData = {
      recommendations,
      meta: {
        totalStocks: stocksWithKlines.length,
        holdingDays: clampedDays,
        sectorName,
        scanTime,
      },
    };

    // Cache the result
    await cacheSet(cacheKey, responseData, CACHE_TTL_SECONDS);

    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error("[RecommendAPI] Error:", error);

    // Timeout detection
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECOMMEND_TIMEOUT",
            title: "策略推荐超时",
            description: "扫描时间过长，请减少股票数量后重试",
            severity: "error" as const,
            recoveryActions: [{ type: "retry" as const, label: "重试" }],
          },
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RECOMMEND_INTERNAL",
          title: "推荐服务异常",
          description: "内部处理错误，请稍后重试",
          severity: "error" as const,
          recoveryActions: [{ type: "retry" as const, label: "重试" }],
        },
      },
      { status: 500 },
    );
  }
}
