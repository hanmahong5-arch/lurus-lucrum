/**
 * Market Data Types with Branded Types and Zod Runtime Validation
 *
 * Design Philosophy (Two Sigma + NautilusTrader):
 * - Data validation at system boundaries prevents corrupt data propagation
 * - Strict numeric constraints ensure data integrity
 * - Event-driven architecture for real-time updates
 *
 * @module lib/types/market
 */

import { z } from 'zod';

// =============================================================================
// BRANDED TYPES - Compile-time type safety
// =============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

/** Stock symbol identifier (e.g., "000001.SZ", "600519.SH") */
export type StockSymbol = Brand<string, 'StockSymbol'>;

/** Price value with precision guarantees */
export type Price = Brand<number, 'Price'>;

/** Volume (number of shares) */
export type Volume = Brand<number, 'Volume'>;

/** Percentage value (-100 to +∞) */
export type Percentage = Brand<number, 'Percentage'>;

/** Unix timestamp in milliseconds */
export type Timestamp = Brand<number, 'Timestamp'>;

// =============================================================================
// STOCK SYMBOL VALIDATION
// =============================================================================

/**
 * Stock symbol schema with format validation
 * Supports: A-shares (SZ/SH), HK stocks, US stocks
 */
export const stockSymbolSchema = z
  .string()
  .min(1, 'Symbol is required')
  .max(20, 'Symbol too long')
  .regex(
    /^[A-Z0-9]{1,10}(\.[A-Z]{2,4})?$/i,
    'Invalid stock symbol format'
  )
  .transform((v) => v.toUpperCase() as StockSymbol);

/**
 * A-share symbol validation (Shanghai/Shenzhen)
 */
export const aShareSymbolSchema = z
  .string()
  .regex(/^[0-9]{6}\.(SH|SZ)$/, 'Invalid A-share symbol format')
  .transform((v) => v.toUpperCase() as StockSymbol);

// =============================================================================
// PRICE AND NUMERIC SCHEMAS
// =============================================================================

/**
 * Price schema with reasonable bounds
 * Allows 0 for suspended stocks, max 10M for extreme cases
 */
export const priceSchema = z
  .number()
  .nonnegative('Price cannot be negative')
  .max(10_000_000, 'Price exceeds maximum')
  .transform((v) => v as Price);

/**
 * Positive price schema (for active quotes)
 */
export const positivePriceSchema = z
  .number()
  .positive('Price must be positive')
  .max(10_000_000, 'Price exceeds maximum')
  .transform((v) => v as Price);

/**
 * Volume schema (integer, non-negative)
 */
export const volumeSchema = z
  .number()
  .int('Volume must be an integer')
  .nonnegative('Volume cannot be negative')
  .transform((v) => v as Volume);

/**
 * Percentage schema with reasonable bounds
 * A-shares: typically -10% to +10% daily limit
 * Extended bounds for special cases (IPO, resumption)
 */
export const percentageSchema = z
  .number()
  .min(-100, 'Percentage cannot be less than -100%')
  .max(10000, 'Percentage exceeds reasonable bounds')
  .transform((v) => v as Percentage);

/**
 * Change percentage with A-share daily limit consideration
 */
export const dailyChangePercentSchema = z
  .number()
  .min(-30, 'Daily change exceeds limit') // Extended for ST stocks and special cases
  .max(30, 'Daily change exceeds limit')
  .transform((v) => v as Percentage);

/**
 * Timestamp schema (Unix milliseconds)
 */
export const timestampSchema = z
  .number()
  .int()
  .positive()
  .transform((v) => v as Timestamp);

// =============================================================================
// STOCK QUOTE SCHEMA
// =============================================================================

/**
 * Complete stock quote with all standard fields
 * Includes data quality constraints
 */
export const stockQuoteSchema = z.object({
  symbol: stockSymbolSchema,
  name: z.string().min(1, 'Stock name is required').max(50),

  // Current price data
  price: priceSchema,
  open: priceSchema,
  high: priceSchema,
  low: priceSchema,
  close: priceSchema,
  prevClose: positivePriceSchema,

  // Change metrics
  change: z.number(),
  changePercent: dailyChangePercentSchema,

  // Volume and amount
  volume: volumeSchema,
  amount: z.number().nonnegative(), // Trading amount in currency

  // Timestamp
  timestamp: z.coerce.date(),

  // Optional fundamental data
  pe: z.number().nullable().optional(),
  pb: z.number().nullable().optional(),
  marketCap: z.number().nonnegative().nullable().optional(),
  turnoverRate: percentageSchema.nullable().optional(),

  // Data source tracking
  source: z.string().optional(),

}).refine(
  (data) => data.high >= data.low,
  { message: 'High price must be >= Low price', path: ['high'] }
).refine(
  (data) => data.price === 0 || (data.price >= data.low && data.price <= data.high),
  { message: 'Current price must be between High and Low', path: ['price'] }
);

export type StockQuote = z.infer<typeof stockQuoteSchema>;

// =============================================================================
// KLINE (CANDLESTICK) SCHEMA
// =============================================================================

/**
 * Kline/Candlestick data schema
 */
export const klineSchema = z.object({
  time: z.union([z.coerce.date(), timestampSchema]),
  open: priceSchema,
  high: priceSchema,
  low: priceSchema,
  close: priceSchema,
  volume: volumeSchema,
  amount: z.number().nonnegative().optional(),
  turnover: percentageSchema.optional(),
}).refine(
  (data) => data.high >= data.low,
  { message: 'High must be >= Low', path: ['high'] }
).refine(
  (data) => data.high >= data.open && data.high >= data.close,
  { message: 'High must be >= Open and Close', path: ['high'] }
).refine(
  (data) => data.low <= data.open && data.low <= data.close,
  { message: 'Low must be <= Open and Close', path: ['low'] }
);

export type Kline = z.infer<typeof klineSchema>;

/**
 * Kline time period enum
 */
export const klinePeriodSchema = z.enum([
  '1m', '5m', '15m', '30m', '60m',  // Intraday
  '1d', '1w', '1M',                   // Daily+
]);

export type KlinePeriod = z.infer<typeof klinePeriodSchema>;

// =============================================================================
// MARKET INDEX SCHEMA
// =============================================================================

/**
 * Market index data schema
 */
export const marketIndexSchema = z.object({
  symbol: stockSymbolSchema,
  name: z.string().min(1),

  price: priceSchema,
  prevClose: positivePriceSchema,
  change: z.number(),
  changePercent: percentageSchema,

  volume: volumeSchema,
  amount: z.number().nonnegative(),

  advanceCount: z.number().int().nonnegative(),
  declineCount: z.number().int().nonnegative(),
  unchangedCount: z.number().int().nonnegative(),

  timestamp: z.coerce.date(),
});

export type MarketIndex = z.infer<typeof marketIndexSchema>;

// =============================================================================
// FUND FLOW SCHEMA
// =============================================================================

/**
 * Fund flow data schema (North-bound, main force, retail)
 */
export const fundFlowSchema = z.object({
  symbol: stockSymbolSchema.optional(), // Optional for market-wide data

  // North-bound (沪深港通)
  northBoundInflow: z.number(),
  northBoundOutflow: z.number(),
  northBoundNet: z.number(),

  // Main force (主力)
  mainForceInflow: z.number(),
  mainForceOutflow: z.number(),
  mainForceNet: z.number(),

  // Retail (散户)
  retailInflow: z.number(),
  retailOutflow: z.number(),
  retailNet: z.number(),

  timestamp: z.coerce.date(),
});

export type FundFlow = z.infer<typeof fundFlowSchema>;

// =============================================================================
// MARKET EVENT SCHEMAS (Event Sourcing)
// =============================================================================

/**
 * Base event schema for market events
 */
const baseMarketEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  timestamp: z.coerce.date(),
  source: z.enum(['eastmoney', 'sina', 'tencent', 'manual', 'system']),
  version: z.literal(1),
});

/**
 * Price update event
 */
export const priceUpdateEventSchema = baseMarketEventSchema.extend({
  eventType: z.literal('PRICE_UPDATE'),
  payload: z.object({
    symbol: stockSymbolSchema,
    price: priceSchema,
    change: z.number(),
    changePercent: percentageSchema,
    volume: volumeSchema,
    amount: z.number().nonnegative(),
  }),
});

export type PriceUpdateEvent = z.infer<typeof priceUpdateEventSchema>;

/**
 * Kline update event
 */
export const klineUpdateEventSchema = baseMarketEventSchema.extend({
  eventType: z.literal('KLINE_UPDATE'),
  payload: z.object({
    symbol: stockSymbolSchema,
    period: klinePeriodSchema,
    kline: klineSchema,
  }),
});

export type KlineUpdateEvent = z.infer<typeof klineUpdateEventSchema>;

/**
 * Market event union type
 */
export const marketEventSchema = z.discriminatedUnion('eventType', [
  priceUpdateEventSchema,
  klineUpdateEventSchema,
]);

export type MarketEvent = z.infer<typeof marketEventSchema>;

// =============================================================================
// TECHNICAL INDICATORS
// =============================================================================

/**
 * Moving Average indicator
 */
export const movingAverageSchema = z.object({
  period: z.number().int().positive(),
  values: z.array(z.number().nullable()),
  type: z.enum(['SMA', 'EMA', 'WMA']),
});

export type MovingAverage = z.infer<typeof movingAverageSchema>;

/**
 * MACD indicator
 */
export const macdSchema = z.object({
  dif: z.array(z.number().nullable()),
  dea: z.array(z.number().nullable()),
  histogram: z.array(z.number().nullable()),
  fastPeriod: z.number().int().positive().default(12),
  slowPeriod: z.number().int().positive().default(26),
  signalPeriod: z.number().int().positive().default(9),
});

export type MACD = z.infer<typeof macdSchema>;

/**
 * RSI indicator
 */
export const rsiSchema = z.object({
  period: z.number().int().positive(),
  values: z.array(z.number().min(0).max(100).nullable()),
});

export type RSI = z.infer<typeof rsiSchema>;

/**
 * Bollinger Bands indicator
 */
export const bollingerBandsSchema = z.object({
  period: z.number().int().positive().default(20),
  stdDev: z.number().positive().default(2),
  upper: z.array(z.number().nullable()),
  middle: z.array(z.number().nullable()),
  lower: z.array(z.number().nullable()),
});

export type BollingerBands = z.infer<typeof bollingerBandsSchema>;

// =============================================================================
// WATCHLIST AND PORTFOLIO
// =============================================================================

/**
 * Watchlist item schema
 */
export const watchlistItemSchema = z.object({
  symbol: stockSymbolSchema,
  name: z.string(),
  addedAt: z.coerce.date(),
  notes: z.string().max(500).optional(),
  alertPrice: priceSchema.optional(),
  alertCondition: z.enum(['above', 'below']).optional(),
});

export type WatchlistItem = z.infer<typeof watchlistItemSchema>;

/**
 * Portfolio position schema
 */
export const portfolioPositionSchema = z.object({
  symbol: stockSymbolSchema,
  name: z.string(),
  quantity: z.number().int().positive(),
  averageCost: positivePriceSchema,
  currentPrice: priceSchema,
  marketValue: z.number().nonnegative(),
  unrealizedPnL: z.number(),
  unrealizedPnLPercent: percentageSchema,
  weight: percentageSchema,
  openedAt: z.coerce.date(),
});

export type PortfolioPosition = z.infer<typeof portfolioPositionSchema>;

// =============================================================================
// DATA SOURCE CONFIGURATION
// =============================================================================

/**
 * Data source status enum
 */
export const dataSourceStatusSchema = z.enum([
  'connected',
  'disconnected',
  'error',
  'rate_limited',
]);

export type DataSourceStatus = z.infer<typeof dataSourceStatusSchema>;

/**
 * Data source configuration
 */
export const dataSourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['rest', 'websocket', 'file']),
  baseUrl: z.string().url().optional(),
  status: dataSourceStatusSchema,
  priority: z.number().int().min(0).max(100),
  rateLimit: z.object({
    requestsPerSecond: z.number().positive(),
    requestsPerMinute: z.number().positive(),
  }).optional(),
  lastHealthCheck: z.coerce.date().optional(),
  errorCount: z.number().int().nonnegative().default(0),
});

export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate and parse stock quote data
 * Returns success/failure with typed result
 */
export function parseStockQuote(
  data: unknown
): { success: true; data: StockQuote } | { success: false; error: z.ZodError } {
  const result = stockQuoteSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}

/**
 * Validate and parse kline data array
 */
export function parseKlineArray(
  data: unknown[]
): { success: true; data: Kline[] } | { success: false; errors: z.ZodError[] } {
  const results = data.map((item) => klineSchema.safeParse(item));
  const errors = results
    .filter((r): r is { success: false; error: z.ZodError } => !r.success)
    .map((r) => r.error);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: results
      .filter((r): r is { success: true; data: Kline } => r.success)
      .map((r) => r.data),
  };
}

/**
 * Calculate price change from previous close
 */
export function calculateChange(
  currentPrice: number,
  prevClose: number
): { change: number; changePercent: number } {
  const change = currentPrice - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
  return { change, changePercent };
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals = 2): string {
  return price.toFixed(decimals);
}

/**
 * Format percentage for display
 */
export function formatPercentage(percent: number, includeSign = true): string {
  const formatted = percent.toFixed(2);
  if (includeSign && percent > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Format large numbers (volume, amount)
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}万亿`;
  }
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(2)}亿`;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(2)}万`;
  }
  return value.toFixed(0);
}

/**
 * Check if market is currently open (A-shares)
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();

  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }

  // Convert to Beijing time (UTC+8)
  const beijingOffset = 8 * 60;
  const localOffset = now.getTimezoneOffset();
  const beijingTime = new Date(now.getTime() + (beijingOffset + localOffset) * 60 * 1000);

  const hours = beijingTime.getHours();
  const minutes = beijingTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Morning session: 9:30 - 11:30
  // Afternoon session: 13:00 - 15:00
  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;

  return (
    (timeInMinutes >= morningStart && timeInMinutes <= morningEnd) ||
    (timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd)
  );
}
