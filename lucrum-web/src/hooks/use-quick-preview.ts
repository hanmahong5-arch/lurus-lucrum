/**
 * Quick Preview Hook
 *
 * Runs a simplified backtest for strategy quick preview.
 * Uses default stock (600519) and 1-year period.
 *
 * Story 3.3: Strategy Detail Panel & Quick Preview
 *
 * @module hooks/use-quick-preview
 */

"use client";

import { useState, useCallback, useRef } from "react";
import type { StrategyScore } from "@/lib/backtest/score/types";

// =============================================================================
// TYPES
// =============================================================================

/** Quick preview result data */
export interface QuickPreviewData {
  /** Strategy score from backtest */
  score: StrategyScore | null;
  /** Total return as decimal string */
  totalReturn: string;
  /** Maximum drawdown as decimal string */
  maxDrawdown: string;
  /** Number of trades executed */
  tradeCount: number;
}

/** Preview execution state */
export type QuickPreviewState = "idle" | "loading" | "success" | "error";

/** Hook return value */
export interface UseQuickPreviewReturn {
  result: QuickPreviewData | null;
  state: QuickPreviewState;
  error: string | null;
  runPreview: (code: string, params: Record<string, number | string>) => Promise<void>;
  reset: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default stock for quick preview (Kweichow Moutai) */
const DEFAULT_PREVIEW_SYMBOL = "600519";

/** Default initial capital for preview */
const DEFAULT_PREVIEW_CAPITAL = 100000;

/** Default commission rate */
const DEFAULT_COMMISSION = 0.0003;

/** Default slippage rate */
const DEFAULT_SLIPPAGE = 0.001;

/** Default timeframe */
const DEFAULT_TIMEFRAME = "1d" as const;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate date range for 1-year backtest ending today.
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return {
    startDate: start.toISOString().split("T")[0] ?? "",
    endDate: end.toISOString().split("T")[0] ?? "",
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useQuickPreview(): UseQuickPreviewReturn {
  const [result, setResult] = useState<QuickPreviewData | null>(null);
  const [state, setState] = useState<QuickPreviewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    setResult(null);
    setState("idle");
    setError(null);
    abortRef.current = true;
  }, []);

  const runPreview = useCallback(
    async (code: string, _params: Record<string, number | string>) => {
      abortRef.current = false;
      setState("loading");
      setError(null);
      setResult(null);

      try {
        // Dynamically import backtest modules to avoid SSR issues
        const [{ runBacktest }, { calculateScore }] =
          await Promise.all([
            import("@/lib/backtest"),
            import("@/lib/backtest/score"),
          ]);

        const { startDate, endDate } = getDefaultDateRange();

        const config = {
          symbol: DEFAULT_PREVIEW_SYMBOL,
          initialCapital: DEFAULT_PREVIEW_CAPITAL,
          commission: DEFAULT_COMMISSION,
          slippage: DEFAULT_SLIPPAGE,
          startDate,
          endDate,
          timeframe: DEFAULT_TIMEFRAME,
        };

        // Fetch real K-line data from API for preview
        const { getKLineData } = await import("@/lib/data-service");
        const klineResult = await getKLineData(DEFAULT_PREVIEW_SYMBOL, "1d", 300);

        if (abortRef.current) return;

        if (!klineResult.success || !klineResult.data || klineResult.data.length === 0) {
          throw new Error("Unable to fetch market data for preview. Please try again later.");
        }

        const klines = klineResult.data.map((k) => ({
          time: typeof k.time === "number" ? k.time : Math.floor(new Date(String(k.time)).getTime() / 1000),
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
        }));

        if (abortRef.current) return;

        // Run backtest
        const backtestResult = await runBacktest(code, klines, config);

        if (abortRef.current) return;

        // Convert BacktestResult to BacktestSummary for scoring
        const summary = {
          startDate: config.startDate,
          endDate: config.endDate,
          tradingDays: klines.length,
          executionTime: backtestResult.executionTime,
          initialCapital: config.initialCapital,
          finalCapital:
            config.initialCapital * (1 + backtestResult.totalReturn / 100),
          peakCapital: config.initialCapital,
          troughCapital: config.initialCapital,
          totalReturn: backtestResult.totalReturn,
          annualizedReturn: backtestResult.annualizedReturn,
          monthlyReturn: backtestResult.totalReturn / 12,
          dailyReturn: backtestResult.totalReturn / klines.length,
          maxDrawdown: backtestResult.maxDrawdown,
          maxDrawdownDuration: 0,
          volatility: 0,
          sharpeRatio: backtestResult.sharpeRatio,
          sortinoRatio: backtestResult.sortinoRatio,
          calmarRatio:
            backtestResult.maxDrawdown > 0
              ? backtestResult.annualizedReturn / backtestResult.maxDrawdown
              : 0,
          totalTrades: backtestResult.totalTrades,
          winningTrades: Math.round(
            backtestResult.totalTrades * backtestResult.winRate
          ),
          losingTrades: Math.round(
            backtestResult.totalTrades * (1 - backtestResult.winRate)
          ),
          winRate: backtestResult.winRate,
          profitFactor: backtestResult.profitFactor,
          avgWin: backtestResult.avgWin,
          avgLoss: backtestResult.avgLoss,
          avgWinLossRatio:
            backtestResult.avgLoss !== 0
              ? backtestResult.avgWin / Math.abs(backtestResult.avgLoss)
              : 0,
          maxConsecutiveWins: backtestResult.maxConsecutiveWins,
          maxConsecutiveLosses: backtestResult.maxConsecutiveLosses,
          avgHoldingPeriod: backtestResult.avgHoldingPeriod,
          maxSingleWin: backtestResult.maxSingleWin,
          maxSingleWinDate: "",
          maxSingleLoss: backtestResult.maxSingleLoss,
          maxSingleLossDate: "",
          totalCommission: 0,
          totalSlippage: 0,
          totalTradingCost: 0,
          tradingCostPercent: 0,
        };

        // Calculate score
        const score = calculateScore(summary);

        setResult({
          score,
          totalReturn: backtestResult.totalReturn.toFixed(4),
          maxDrawdown: backtestResult.maxDrawdown.toFixed(4),
          tradeCount: backtestResult.totalTrades,
        });
        setState("success");
      } catch (err) {
        if (abortRef.current) return;
        const message =
          err instanceof Error ? err.message : "Preview backtest failed";
        setError(message);
        setState("error");
      }
    },
    []
  );

  return { result, state, error, runPreview, reset };
}
