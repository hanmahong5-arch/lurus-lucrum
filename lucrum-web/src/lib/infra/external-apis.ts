/**
 * External API Wrappers with Circuit Breaker Protection
 *
 * Every call to an external data provider should go through these wrappers.
 * When a provider's circuit breaker is open, the call fast-fails with a
 * CircuitOpenError, allowing callers to immediately fall back.
 *
 * @module lib/infra/external-apis
 */

import {
  eastmoneyBreaker,
  sinaBreaker,
  eastmoneySectorBreaker,
  CircuitOpenError,
} from './circuit-breaker';
import type { ApiResponse, KLineData, KLineTimeFrame, StockQuote, IndexQuote } from '@/lib/data-service/types';
import {
  getStockQuote as rawEastmoneyQuote,
  getKLineData as rawEastmoneyKLine,
  getMajorIndices as rawEastmoneyIndices,
} from '@/lib/data-service/sources/eastmoney';
import {
  getStockQuote as rawSinaQuote,
  getKLineData as rawSinaKLine,
  getMajorIndices as rawSinaIndices,
} from '@/lib/data-service/sources/sina';
import {
  getSectorStocks as rawGetSectorStocks,
  getSectorIndexKline as rawGetSectorIndexKline,
  type SectorStocksResponse,
} from '@/lib/data-service/sources/eastmoney-sector';

// =============================================================================
// HELPERS
// =============================================================================

/** Build a well-formed error ApiResponse with all required fields */
function errorResponse<T>(error: string, source: string): ApiResponse<T> {
  return {
    success: false,
    data: null,
    error,
    source,
    cached: false,
    timestamp: Date.now(),
    latency: 0,
  };
}

// =============================================================================
// PROTECTED EASTMONEY CALLS
// =============================================================================

/** Fetch a stock quote from EastMoney, protected by circuit breaker */
export async function getEastmoneyQuote(
  symbol: string,
): Promise<ApiResponse<StockQuote>> {
  return eastmoneyBreaker.execute(() => rawEastmoneyQuote(symbol));
}

/** Fetch K-line data from EastMoney, protected by circuit breaker */
export async function getEastmoneyKLine(
  symbol: string,
  timeframe: KLineTimeFrame = '1d',
  limit = 200,
): Promise<ApiResponse<KLineData[]>> {
  return eastmoneyBreaker.execute(() =>
    rawEastmoneyKLine(symbol, timeframe, limit),
  );
}

/** Fetch major indices from EastMoney, protected by circuit breaker */
export async function getEastmoneyIndices(): Promise<
  ApiResponse<IndexQuote[]>
> {
  return eastmoneyBreaker.execute(() => rawEastmoneyIndices());
}

// =============================================================================
// PROTECTED SINA CALLS
// =============================================================================

/** Fetch a stock quote from Sina, protected by circuit breaker */
export async function getSinaQuote(
  symbol: string,
): Promise<ApiResponse<StockQuote>> {
  return sinaBreaker.execute(() => rawSinaQuote(symbol));
}

/** Fetch K-line data from Sina, protected by circuit breaker */
export async function getSinaKLine(
  symbol: string,
  timeframe: KLineTimeFrame = '1d',
  limit = 200,
): Promise<ApiResponse<KLineData[]>> {
  return sinaBreaker.execute(() => rawSinaKLine(symbol, timeframe, limit));
}

/** Fetch major indices from Sina, protected by circuit breaker */
export async function getSinaIndices(): Promise<ApiResponse<IndexQuote[]>> {
  return sinaBreaker.execute(() => rawSinaIndices());
}

// =============================================================================
// PROTECTED EASTMONEY SECTOR CALLS
// =============================================================================

/** Fetch sector constituent stocks, protected by circuit breaker */
export async function getSectorStocksProtected(
  sectorCode: string,
  maxStocks: number,
): Promise<ApiResponse<SectorStocksResponse>> {
  return eastmoneySectorBreaker.execute(() =>
    rawGetSectorStocks(sectorCode, maxStocks),
  );
}

/** Fetch sector index kline, protected by circuit breaker */
export async function getSectorIndexKlineProtected(
  sectorCode: string,
  timeframe: KLineTimeFrame,
  limit: number,
): Promise<ApiResponse<KLineData[]>> {
  return eastmoneySectorBreaker.execute(() =>
    rawGetSectorIndexKline(sectorCode, timeframe, limit),
  );
}

// =============================================================================
// UNIFIED FALLBACK HELPERS
// =============================================================================

/**
 * Get K-line data with circuit-breaker-protected fallback chain:
 * EastMoney -> Sina
 *
 * If EastMoney's breaker is open, skips directly to Sina without waiting.
 * If both breakers are open, returns an error response.
 */
export async function getKLineDataWithBreaker(
  symbol: string,
  timeframe: KLineTimeFrame = '1d',
  limit = 200,
): Promise<ApiResponse<KLineData[]>> {
  // Attempt EastMoney first
  try {
    const result = await getEastmoneyKLine(symbol, timeframe, limit);
    if (result.success) return result;
  } catch (err) {
    if (!(err instanceof CircuitOpenError)) {
      // Unexpected error -- still try Sina
      console.warn(
        `[ExternalAPIs] EastMoney kline error for ${symbol}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Fallback to Sina
  try {
    return await getSinaKLine(symbol, timeframe, limit);
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return errorResponse(
        `All data providers unavailable (eastmoney: ${eastmoneyBreaker.getState()}, sina: ${sinaBreaker.getState()})`,
        'circuit-breaker',
      );
    }
    throw err;
  }
}

/**
 * Get stock quote with circuit-breaker-protected fallback:
 * EastMoney -> Sina
 */
export async function getStockQuoteWithBreaker(
  symbol: string,
): Promise<ApiResponse<StockQuote>> {
  try {
    const result = await getEastmoneyQuote(symbol);
    if (result.success) return result;
  } catch (err) {
    if (!(err instanceof CircuitOpenError)) {
      console.warn(
        `[ExternalAPIs] EastMoney quote error for ${symbol}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  try {
    return await getSinaQuote(symbol);
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return errorResponse(
        'All quote providers unavailable',
        'circuit-breaker',
      );
    }
    throw err;
  }
}

/**
 * Get major indices with circuit-breaker-protected fallback:
 * EastMoney -> Sina
 */
export async function getMajorIndicesWithBreaker(): Promise<
  ApiResponse<IndexQuote[]>
> {
  try {
    const result = await getEastmoneyIndices();
    if (result.success) return result;
  } catch (err) {
    if (!(err instanceof CircuitOpenError)) {
      console.warn(
        '[ExternalAPIs] EastMoney indices error:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  try {
    return await getSinaIndices();
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return errorResponse(
        'All index providers unavailable',
        'circuit-breaker',
      );
    }
    throw err;
  }
}
