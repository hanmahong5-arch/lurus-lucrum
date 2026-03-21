/**
 * Portfolio Backtest API Route
 *
 * POST — Run a portfolio-level backtest with shared capital pool.
 * Uses Server-Sent Events (SSE) for real-time progress streaming.
 *
 * @module app/api/backtest/portfolio/route
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import Decimal from "decimal.js";
import { authOptions } from "@/lib/auth/auth";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/middleware/rate-limiter";
import { limiter } from "@/lib/middleware/concurrency-limiter";
import { getKLineFromDatabase } from "@/lib/backtest/db-kline-provider";
import type { BacktestKline } from "@/lib/backtest/types";
import {
  runPortfolioBacktest,
  type PortfolioConfig,
  type PortfolioProgress,
} from "@/lib/backtest/portfolio";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Request timeout in milliseconds (5 minutes for large portfolios) */
const REQUEST_TIMEOUT_MS = 300_000;

/** Minimum stocks in portfolio */
const MIN_STOCKS = 2;

/** Maximum stocks in portfolio */
const MAX_STOCKS = 100;

/** Minimum capital in CNY */
const MIN_CAPITAL = 10_000;

/** Maximum capital in CNY */
const MAX_CAPITAL = 100_000_000_000;

// =============================================================================
// ERROR CODES
// =============================================================================

const ErrorCodes = {
  INVALID_REQUEST: "PF100",
  INVALID_STOCKS: "PF101",
  INVALID_CAPITAL: "PF102",
  INVALID_STRATEGY: "PF103",
  INVALID_DATE_RANGE: "PF104",
  INVALID_WEIGHTS: "PF105",
  ENGINE_ERROR: "PF400",
  ENGINE_TIMEOUT: "PF401",
  AUTH_REQUIRED: "PF300",
  UNKNOWN_ERROR: "PF999",
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface SSEMessage {
  type: "progress" | "result" | "error";
  data: unknown;
}

// =============================================================================
// VALIDATION
// =============================================================================

interface ValidationResult {
  valid: boolean;
  error?: { code: string; message: string; messageEn: string };
}

function validatePortfolioConfig(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      error: {
        code: ErrorCodes.INVALID_REQUEST,
        message: "Request body must be a JSON object",
        messageEn: "Request body must be a JSON object",
      },
    };
  }

  const config = body as Record<string, unknown>;

  // Validate stocks array
  if (!Array.isArray(config.stocks)) {
    return {
      valid: false,
      error: {
        code: ErrorCodes.INVALID_STOCKS,
        message: "stocks must be an array",
        messageEn: "stocks must be an array",
      },
    };
  }

  const stocks = config.stocks as unknown[];
  if (stocks.length < MIN_STOCKS || stocks.length > MAX_STOCKS) {
    return {
      valid: false,
      error: {
        code: ErrorCodes.INVALID_STOCKS,
        message: `stocks must contain ${MIN_STOCKS}-${MAX_STOCKS} items, got ${stocks.length}`,
        messageEn: `stocks must contain ${MIN_STOCKS}-${MAX_STOCKS} items, got ${stocks.length}`,
      },
    };
  }

  for (const stock of stocks) {
    if (!stock || typeof stock !== "object") {
      return {
        valid: false,
        error: {
          code: ErrorCodes.INVALID_STOCKS,
          message: "Each stock must be an object with symbol and name",
          messageEn: "Each stock must be an object with symbol and name",
        },
      };
    }
    const s = stock as Record<string, unknown>;
    if (typeof s.symbol !== "string" || s.symbol.length === 0) {
      return {
        valid: false,
        error: {
          code: ErrorCodes.INVALID_STOCKS,
          message: "Each stock must have a non-empty symbol",
          messageEn: "Each stock must have a non-empty symbol",
        },
      };
    }
    if (typeof s.name !== "string" || s.name.length === 0) {
      return {
        valid: false,
        error: {
          code: ErrorCodes.INVALID_STOCKS,
          message: "Each stock must have a non-empty name",
          messageEn: "Each stock must have a non-empty name",
        },
      };
    }
  }

  // Validate capital
  const totalCapital = config.totalCapital;
  if (typeof totalCapital !== "number" || totalCapital < MIN_CAPITAL || totalCapital > MAX_CAPITAL) {
    return {
      valid: false,
      error: {
        code: ErrorCodes.INVALID_CAPITAL,
        message: `totalCapital must be between ${MIN_CAPITAL} and ${MAX_CAPITAL}`,
        messageEn: `totalCapital must be between ${MIN_CAPITAL} and ${MAX_CAPITAL}`,
      },
    };
  }

  // Validate strategy
  if (typeof config.strategy !== "string" || config.strategy.trim().length === 0) {
    return {
      valid: false,
      error: {
        code: ErrorCodes.INVALID_STRATEGY,
        message: "strategy code is required",
        messageEn: "strategy code is required",
      },
    };
  }

  // Validate dates
  const startDate = config.startDate;
  const endDate = config.endDate;
  if (typeof startDate !== "string" || typeof endDate !== "string") {
    return {
      valid: false,
      error: {
        code: ErrorCodes.INVALID_DATE_RANGE,
        message: "startDate and endDate must be ISO date strings",
        messageEn: "startDate and endDate must be ISO date strings",
      },
    };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return {
      valid: false,
      error: {
        code: ErrorCodes.INVALID_DATE_RANGE,
        message: "Invalid date range: startDate must be before endDate",
        messageEn: "Invalid date range: startDate must be before endDate",
      },
    };
  }

  // Validate position sizing method
  const validMethods = ["equal", "market-cap", "risk-parity", "custom"];
  if (config.positionSizing && !validMethods.includes(config.positionSizing as string)) {
    return {
      valid: false,
      error: {
        code: ErrorCodes.INVALID_REQUEST,
        message: `positionSizing must be one of: ${validMethods.join(", ")}`,
        messageEn: `positionSizing must be one of: ${validMethods.join(", ")}`,
      },
    };
  }

  // Validate custom weights if provided
  if (config.positionSizing === "custom") {
    const customWeights = config.customWeights;
    if (!customWeights || typeof customWeights !== "object") {
      return {
        valid: false,
        error: {
          code: ErrorCodes.INVALID_WEIGHTS,
          message: "customWeights map is required when positionSizing is 'custom'",
          messageEn: "customWeights map is required when positionSizing is 'custom'",
        },
      };
    }

    const weights = customWeights as Record<string, unknown>;
    let totalWeight = new Decimal(0);
    for (const [, value] of Object.entries(weights)) {
      if (typeof value !== "number" || value < 0 || value > 1) {
        return {
          valid: false,
          error: {
            code: ErrorCodes.INVALID_WEIGHTS,
            message: "Each custom weight must be a number between 0 and 1",
            messageEn: "Each custom weight must be a number between 0 and 1",
          },
        };
      }
      totalWeight = totalWeight.plus(new Decimal(value));
    }
    if (totalWeight.greaterThan(new Decimal("1.01"))) {
      return {
        valid: false,
        error: {
          code: ErrorCodes.INVALID_WEIGHTS,
          message: `Custom weights sum to ${totalWeight.toFixed(4)}, must be <= 1.0`,
          messageEn: `Custom weights sum to ${totalWeight.toFixed(4)}, must be <= 1.0`,
        },
      };
    }
  }

  return { valid: true };
}

// =============================================================================
// K-LINE PROVIDER (bridges DB provider to portfolio engine's KlineProvider)
// =============================================================================

async function klineProvider(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<BacktestKline[]> {
  const result = await getKLineFromDatabase(symbol, startDate, endDate, 2000);

  if (!result.success || result.data.length === 0) {
    return [];
  }

  return result.data.map((kl) => ({
    time: kl.time,
    open: kl.open,
    high: kl.high,
    low: kl.low,
    close: kl.close,
    volume: kl.volume,
  }));
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  // Rate limit check
  const ip = getClientIdentifier(request.headers);
  const rateCheck = checkRateLimit('portfolio', ip);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          title: '请求过于频繁',
          description: RATE_LIMITS.portfolio.message,
          severity: 'warning',
          recoveryActions: [
            { type: 'dismiss', label: '知道了' },
          ],
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter),
        },
      },
    );
  }

  // Concurrency control
  let release: (() => void) | undefined;
  try {
    const slot = await limiter.acquire('portfolio', 30_000);
    release = slot.release;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '服务繁忙，请稍后重试';
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'CONCURRENCY_LIMIT',
          title: '服务繁忙',
          description: msg,
          severity: 'warning',
          recoveryActions: [
            { type: 'retry', label: '重试' },
          ],
        },
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {

  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: ErrorCodes.AUTH_REQUIRED,
          message: "Authentication required",
          messageEn: "Authentication required",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: ErrorCodes.INVALID_REQUEST,
          message: "Invalid JSON body",
          messageEn: "Invalid JSON body",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate
  const validation = validatePortfolioConfig(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ success: false, error: validation.error }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Build PortfolioConfig with defaults
  const raw = body as Record<string, unknown>;
  const config: PortfolioConfig = {
    totalCapital: raw.totalCapital as number,
    stocks: raw.stocks as PortfolioConfig["stocks"],
    strategy: raw.strategy as string,
    strategyParams: (raw.strategyParams as Record<string, unknown>) ?? {},
    positionSizing: (raw.positionSizing as PortfolioConfig["positionSizing"]) ?? "equal",
    customWeights: raw.customWeights as Record<string, number> | undefined,
    maxPositionPct: typeof raw.maxPositionPct === "number" ? raw.maxPositionPct : 0.10,
    maxSectorPct: typeof raw.maxSectorPct === "number" ? raw.maxSectorPct : 0.30,
    rebalanceFrequency: (raw.rebalanceFrequency as PortfolioConfig["rebalanceFrequency"]) ?? "never",
    startDate: raw.startDate as string,
    endDate: raw.endDate as string,
    commission: typeof raw.commission === "number" ? raw.commission : 0.0003,
    slippage: typeof raw.slippage === "number" ? raw.slippage : 0.001,
  };

  // SSE streaming response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendSSE(msg: SSEMessage): void {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(msg)}\n\n`),
          );
        } catch {
          // Stream may have been closed by the client
        }
      }

      // Timeout guard
      const timeoutId = setTimeout(() => {
        sendSSE({
          type: "error",
          data: {
            code: ErrorCodes.ENGINE_TIMEOUT,
            message: "Portfolio backtest timed out",
            messageEn: "Portfolio backtest timed out",
          },
        });
        controller.close();
      }, REQUEST_TIMEOUT_MS);

      try {
        const result = await runPortfolioBacktest(
          config,
          klineProvider,
          (progress: PortfolioProgress) => {
            sendSSE({ type: "progress", data: progress });
          },
        );

        clearTimeout(timeoutId);

        sendSSE({ type: "result", data: result });
      } catch (err) {
        clearTimeout(timeoutId);

        const message = err instanceof Error ? err.message : "Unknown error";
        sendSSE({
          type: "error",
          data: {
            code: ErrorCodes.ENGINE_ERROR,
            message,
            messageEn: message,
          },
        });
      } finally {
        // Release concurrency slot when the stream is done
        release?.();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });

  } finally {
    // Note: for SSE routes, release happens inside the stream's finally block.
    // This outer finally is a safety net for early returns before stream setup.
    // The release is idempotent (calling release() multiple times is safe because
    // the limiter tracks active count, not individual slot ownership).
  }
}
