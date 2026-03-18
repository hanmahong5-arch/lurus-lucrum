/**
 * Data Validation Layer
 *
 * Design Philosophy (Two Sigma):
 * - Validate data at system boundaries
 * - Fail fast with detailed error information
 * - Log validation failures for data quality monitoring
 *
 * Note: This module uses UNBOUNDED schemas (without branded types) for
 * validating external data. The branded types from market.ts are used
 * after data has been validated and cleaned.
 *
 * @module lib/data-service/validators
 */

import { z } from "zod";

// =============================================================================
// LOCAL SCHEMA DEFINITIONS (without branded types for external data)
// =============================================================================

/**
 * Stock quote validation schema (unbounded for external data)
 * These schemas accept any valid data from external APIs without
 * requiring branded type transformations.
 */
const stockQuoteValidationSchema = z
  .object({
    symbol: z.string().min(1),
    name: z.string().min(1),
    price: z.number().nonnegative(),
    open: z.number().nonnegative(),
    high: z.number().nonnegative(),
    low: z.number().nonnegative(),
    close: z.number().nonnegative(),
    prevClose: z.number().positive(),
    change: z.number(),
    changePercent: z.number(),
    volume: z.number().int().nonnegative(),
    amount: z.number().nonnegative(),
    timestamp: z.coerce.date(),
    pe: z.number().nullable().optional(),
    pb: z.number().nullable().optional(),
    marketCap: z.number().nonnegative().nullable().optional(),
    turnoverRate: z.number().nullable().optional(),
    source: z.string().optional(),
  })
  .refine((data) => data.high >= data.low, {
    message: "High price must be >= Low price",
    path: ["high"],
  })
  .refine(
    (data) =>
      data.price === 0 || (data.price >= data.low && data.price <= data.high),
    { message: "Current price must be between High and Low", path: ["price"] },
  );

/**
 * Validated stock quote type (unbounded)
 */
export type ValidatedStockQuote = z.infer<typeof stockQuoteValidationSchema>;

/**
 * Kline validation schema (unbounded)
 */
const klineValidationSchema = z
  .object({
    time: z.union([z.coerce.date(), z.number()]),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number().nonnegative(),
    amount: z.number().nonnegative().optional(),
    turnover: z.number().optional(),
  })
  .refine((data) => data.high >= data.low, {
    message: "High must be >= Low",
    path: ["high"],
  });

/**
 * Validated kline type (unbounded)
 */
export type ValidatedKline = z.infer<typeof klineValidationSchema>;

/**
 * Market index validation schema (unbounded)
 */
const marketIndexValidationSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  price: z.number(),
  prevClose: z.number().positive(),
  change: z.number(),
  changePercent: z.number(),
  volume: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  advanceCount: z.number().int().nonnegative().optional(),
  declineCount: z.number().int().nonnegative().optional(),
  unchangedCount: z.number().int().nonnegative().optional(),
  timestamp: z.coerce.date(),
});

/**
 * Validated market index type (unbounded)
 */
export type ValidatedMarketIndex = z.infer<typeof marketIndexValidationSchema>;

/**
 * Fund flow validation schema (unbounded)
 */
const fundFlowValidationSchema = z.object({
  symbol: z.string().optional(),
  northBoundInflow: z.number(),
  northBoundOutflow: z.number(),
  northBoundNet: z.number(),
  mainForceInflow: z.number(),
  mainForceOutflow: z.number(),
  mainForceNet: z.number(),
  retailInflow: z.number(),
  retailOutflow: z.number(),
  retailNet: z.number(),
  timestamp: z.coerce.date(),
});

/**
 * Validated fund flow type (unbounded)
 */
export type ValidatedFundFlow = z.infer<typeof fundFlowValidationSchema>;

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T; warnings?: string[] }
  | { success: false; errors: ValidationError[] };

/**
 * Validation error with context
 */
export interface ValidationError {
  readonly path: string;
  readonly message: string;
  readonly code: string;
  readonly received?: unknown;
  readonly expected?: string;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Source identifier for logging */
  readonly source?: string;
  /** Whether to log validation failures */
  readonly logFailures?: boolean;
  /** Whether to attempt partial parsing (return valid items only) */
  readonly partial?: boolean;
  /** Custom error handler */
  readonly onError?: (errors: ValidationError[], rawData: unknown) => void;
}

// =============================================================================
// LOGGING
// =============================================================================

/**
 * Simple logger interface for validation
 */
interface ValidationLogger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Default console logger
 */
const defaultLogger: ValidationLogger = {
  warn: (message, context) => {
    console.warn(`[VALIDATION WARN] ${message}`, context);
  },
  error: (message, context) => {
    console.error(`[VALIDATION ERROR] ${message}`, context);
  },
};

let logger: ValidationLogger = defaultLogger;

/**
 * Set custom validation logger
 */
export function setValidationLogger(customLogger: ValidationLogger): void {
  logger = customLogger;
}

// =============================================================================
// CORE VALIDATION FUNCTIONS
// =============================================================================

/**
 * Convert Zod errors to ValidationError array
 */
function zodToValidationErrors(zodError: z.ZodError): ValidationError[] {
  return zodError.errors.map((err) => ({
    path: err.path.join("."),
    message: err.message,
    code: err.code,
    received: "received" in err ? err.received : undefined,
    expected: "expected" in err ? String(err.expected) : undefined,
  }));
}

/**
 * Generic validation function with schema
 */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
  options: ValidationOptions = {},
): ValidationResult<T> {
  const { source = "unknown", logFailures = true, onError } = options;

  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = zodToValidationErrors(result.error);

  if (logFailures) {
    logger.warn(`Validation failed for source: ${source}`, {
      errors,
      sampleData:
        typeof data === "object"
          ? JSON.stringify(data).slice(0, 500)
          : String(data),
    });
  }

  onError?.(errors, data);

  return { success: false, errors };
}

/**
 * Validate array of items, optionally returning only valid items
 */
export function validateArray<T>(
  schema: z.ZodType<T>,
  data: unknown[],
  options: ValidationOptions = {},
): ValidationResult<T[]> {
  const {
    source = "unknown",
    logFailures = true,
    partial = false,
    onError,
  } = options;

  const validItems: T[] = [];
  const allErrors: ValidationError[] = [];
  const warnings: string[] = [];

  data.forEach((item, index) => {
    const result = schema.safeParse(item);

    if (result.success) {
      validItems.push(result.data);
    } else {
      const errors = zodToValidationErrors(result.error).map((err) => ({
        ...err,
        path: `[${index}].${err.path}`,
      }));
      allErrors.push(...errors);
      warnings.push(`Item at index ${index} failed validation`);
    }
  });

  // Log if any items failed
  if (allErrors.length > 0 && logFailures) {
    logger.warn(
      `Array validation: ${allErrors.length} errors in ${data.length} items`,
      {
        source,
        validCount: validItems.length,
        invalidCount: data.length - validItems.length,
        sampleErrors: allErrors.slice(0, 5),
      },
    );
  }

  // If partial mode, return valid items even with errors
  if (partial && validItems.length > 0) {
    return { success: true, data: validItems, warnings };
  }

  // If all items valid
  if (allErrors.length === 0) {
    return { success: true, data: validItems };
  }

  onError?.(allErrors, data);
  return { success: false, errors: allErrors };
}

// =============================================================================
// MARKET DATA VALIDATORS (using unbounded schemas)
// =============================================================================

/**
 * Validate stock quote data
 * Uses unbounded schema for external data validation
 */
export function validateStockQuote(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<ValidatedStockQuote> {
  return validate(stockQuoteValidationSchema, data, {
    source: "stock-quote",
    ...options,
  });
}

/**
 * Validate array of stock quotes
 * Uses unbounded schema for external data validation
 */
export function validateStockQuotes(
  data: unknown[],
  options?: ValidationOptions,
): ValidationResult<ValidatedStockQuote[]> {
  return validateArray(stockQuoteValidationSchema, data, {
    source: "stock-quotes",
    partial: true, // Default to partial for bulk data
    ...options,
  });
}

/**
 * Validate kline (candlestick) data
 * Uses unbounded schema for external data validation
 */
export function validateKline(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<ValidatedKline> {
  return validate(klineValidationSchema, data, {
    source: "kline",
    ...options,
  });
}

/**
 * Validate array of klines
 * Uses unbounded schema for external data validation
 */
export function validateKlines(
  data: unknown[],
  options?: ValidationOptions,
): ValidationResult<ValidatedKline[]> {
  return validateArray(klineValidationSchema, data, {
    source: "klines",
    partial: true,
    ...options,
  });
}

/**
 * Validate market index data
 * Uses unbounded schema for external data validation
 */
export function validateMarketIndex(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<ValidatedMarketIndex> {
  return validate(marketIndexValidationSchema, data, {
    source: "market-index",
    ...options,
  });
}

/**
 * Validate fund flow data
 * Uses unbounded schema for external data validation
 */
export function validateFundFlow(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<ValidatedFundFlow> {
  return validate(fundFlowValidationSchema, data, {
    source: "fund-flow",
    ...options,
  });
}

// =============================================================================
// DATA TRANSFORMATION AND CLEANING
// =============================================================================

/**
 * Clean and normalize stock symbol
 */
export function normalizeStockSymbol(symbol: string): string {
  // Remove whitespace and convert to uppercase
  let normalized = symbol.trim().toUpperCase();

  // Handle common formats
  // "600519" -> "600519.SH" (Shanghai)
  // "000001" -> "000001.SZ" (Shenzhen)
  if (/^\d{6}$/.test(normalized)) {
    if (normalized.startsWith("6") || normalized.startsWith("9")) {
      normalized = `${normalized}.SH`;
    } else {
      normalized = `${normalized}.SZ`;
    }
  }

  return normalized;
}

/**
 * Clean numeric value (handle Chinese number formats)
 */
export function cleanNumericValue(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }

  let cleaned = value.trim();

  // Handle Chinese units
  if (cleaned.includes("万亿")) {
    return parseFloat(cleaned.replace(/万亿/g, "")) * 1_000_000_000_000;
  }
  if (cleaned.includes("亿")) {
    return parseFloat(cleaned.replace(/亿/g, "")) * 100_000_000;
  }
  if (cleaned.includes("万")) {
    return parseFloat(cleaned.replace(/万/g, "")) * 10_000;
  }

  // Remove common separators
  cleaned = cleaned.replace(/[,，]/g, "");

  return parseFloat(cleaned) || 0;
}

/**
 * Clean percentage value
 */
export function cleanPercentage(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }

  const cleaned = value.trim().replace(/%/g, "");
  return parseFloat(cleaned) || 0;
}

// =============================================================================
// DATA QUALITY METRICS
// =============================================================================

/**
 * Data quality metrics for monitoring
 */
export interface DataQualityMetrics {
  readonly totalRecords: number;
  readonly validRecords: number;
  readonly invalidRecords: number;
  readonly validationRate: number;
  readonly commonErrors: Map<string, number>;
  readonly timestamp: Date;
}

/**
 * Track data quality metrics
 */
class DataQualityTracker {
  private metrics: Map<string, DataQualityMetrics> = new Map();
  private errorCounts: Map<string, Map<string, number>> = new Map();

  /**
   * Record validation result
   */
  record<T>(
    source: string,
    result: ValidationResult<T> | ValidationResult<T[]>,
    totalCount: number = 1,
  ): void {
    const existing = this.metrics.get(source);
    const errorMap = this.errorCounts.get(source) ?? new Map<string, number>();

    const validCount = result.success
      ? Array.isArray(result.data)
        ? result.data.length
        : 1
      : 0;
    const invalidCount = totalCount - validCount;

    // Track error codes
    if (!result.success) {
      result.errors.forEach((err) => {
        const count = errorMap.get(err.code) ?? 0;
        errorMap.set(err.code, count + 1);
      });
    }

    this.errorCounts.set(source, errorMap);

    const newMetrics: DataQualityMetrics = {
      totalRecords: (existing?.totalRecords ?? 0) + totalCount,
      validRecords: (existing?.validRecords ?? 0) + validCount,
      invalidRecords: (existing?.invalidRecords ?? 0) + invalidCount,
      validationRate: 0, // Calculated below
      commonErrors: errorMap,
      timestamp: new Date(),
    };

    // Calculate validation rate
    const rate =
      newMetrics.totalRecords > 0
        ? newMetrics.validRecords / newMetrics.totalRecords
        : 1;

    this.metrics.set(source, {
      ...newMetrics,
      validationRate: rate,
    });
  }

  /**
   * Get metrics for a source
   */
  getMetrics(source: string): DataQualityMetrics | undefined {
    return this.metrics.get(source);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, DataQualityMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics
   */
  reset(source?: string): void {
    if (source) {
      this.metrics.delete(source);
      this.errorCounts.delete(source);
    } else {
      this.metrics.clear();
      this.errorCounts.clear();
    }
  }
}

/**
 * Global data quality tracker instance
 */
export const dataQualityTracker = new DataQualityTracker();

// =============================================================================
// VALIDATION WITH TRACKING
// =============================================================================

/**
 * Validate with automatic quality tracking
 */
export function validateWithTracking<T>(
  schema: z.ZodType<T>,
  data: unknown,
  source: string,
  options?: Omit<ValidationOptions, "source">,
): ValidationResult<T> {
  const result = validate(schema, data, { ...options, source });
  dataQualityTracker.record(source, result);
  return result;
}

/**
 * Validate array with automatic quality tracking
 */
export function validateArrayWithTracking<T>(
  schema: z.ZodType<T>,
  data: unknown[],
  source: string,
  options?: Omit<ValidationOptions, "source">,
): ValidationResult<T[]> {
  const result = validateArray(schema, data, { ...options, source });
  dataQualityTracker.record(source, result, data.length);
  return result;
}

// =============================================================================
// EXPORTED SCHEMAS (for direct use when needed)
// =============================================================================

export const schemas = {
  stockQuote: stockQuoteValidationSchema,
  kline: klineValidationSchema,
  marketIndex: marketIndexValidationSchema,
  fundFlow: fundFlowValidationSchema,
} as const;
