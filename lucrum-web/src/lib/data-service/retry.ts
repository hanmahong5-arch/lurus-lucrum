/**
 * Retry Mechanism with Exponential Backoff
 *
 * Design Philosophy (AWS SDK + Google Cloud):
 * - Exponential backoff reduces server load during outages
 * - Jitter prevents thundering herd problem
 * - Configurable retry conditions for fine-grained control
 *
 * @module lib/data-service/retry
 */

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (excluding initial attempt) */
  readonly maxRetries: number;
  /** Initial delay in milliseconds */
  readonly initialDelayMs: number;
  /** Maximum delay in milliseconds */
  readonly maxDelayMs: number;
  /** Backoff multiplier (2 = double delay each retry) */
  readonly backoffMultiplier: number;
  /** Jitter factor (0-1, adds randomness to delays) */
  readonly jitterFactor: number;
  /** Function to determine if error is retryable */
  readonly shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback before each retry */
  readonly onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  /** Timeout per attempt in milliseconds (0 = no timeout) */
  readonly timeoutMs?: number;
}

/**
 * Retry result with attempt information
 */
export interface RetryResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: Error;
  readonly attempts: number;
  readonly totalTimeMs: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

// =============================================================================
// RETRY ERROR
// =============================================================================

/**
 * Error thrown when all retry attempts are exhausted
 */
export class RetryExhaustedError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;
  public readonly totalTimeMs: number;

  constructor(attempts: number, lastError: Error, totalTimeMs: number) {
    super(`All ${attempts} retry attempts exhausted. Last error: ${lastError.message}`);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;
    this.totalTimeMs = totalTimeMs;
  }
}

/**
 * Error thrown when operation times out
 */
export class RetryTimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly attempt: number;

  constructor(timeoutMs: number, attempt: number) {
    super(`Operation timed out after ${timeoutMs}ms on attempt ${attempt}`);
    this.name = 'RetryTimeoutError';
    this.timeoutMs = timeoutMs;
    this.attempt = attempt;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate delay for a given attempt with exponential backoff and jitter
 */
export function calculateDelay(
  attempt: number,
  config: Pick<RetryConfig, 'initialDelayMs' | 'maxDelayMs' | 'backoffMultiplier' | 'jitterFactor'>
): number {
  // Exponential backoff: initialDelay * multiplier^attempt
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: delay * (1 - jitter + random * 2 * jitter)
  // This creates a range from (delay * (1 - jitter)) to (delay * (1 + jitter))
  const jitter = config.jitterFactor;
  const jitterRange = cappedDelay * jitter * 2;
  const jitteredDelay = cappedDelay * (1 - jitter) + Math.random() * jitterRange;

  return Math.floor(jitteredDelay);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retry condition - retries on network errors and 5xx status codes
 */
export function defaultShouldRetry(error: Error): boolean {
  // Retry on network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }

  // Retry on timeout errors
  if (error.name === 'AbortError' || error.name === 'RetryTimeoutError') {
    return true;
  }

  // Check for HTTP status codes in error message
  const statusMatch = error.message.match(/\b([45]\d{2})\b/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1] ?? '0', 10);
    // Retry on 5xx and specific 4xx codes
    if (status >= 500 || status === 408 || status === 429) {
      return true;
    }
    // Don't retry on other 4xx (client errors)
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  return true; // Default to retry
}

// =============================================================================
// RETRY IMPLEMENTATION
// =============================================================================

/**
 * Execute a function with retry logic
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Promise resolving to function result
 * @throws RetryExhaustedError when all retries fail
 *
 * Usage:
 * ```typescript
 * const result = await retry(
 *   () => fetchData(),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxRetries, shouldRetry = defaultShouldRetry, onRetry, timeoutMs } = fullConfig;

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute with optional timeout
      if (timeoutMs && timeoutMs > 0) {
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new RetryTimeoutError(timeoutMs, attempt + 1)),
              timeoutMs
            );
          }),
        ]);
        return result;
      }

      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt < maxRetries && shouldRetry(lastError, attempt + 1)) {
        const delay = calculateDelay(attempt, fullConfig);
        onRetry?.(lastError, attempt + 1, delay);
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  const totalTimeMs = Date.now() - startTime;
  throw new RetryExhaustedError(maxRetries + 1, lastError!, totalTimeMs);
}

/**
 * Execute with retry and return detailed result
 */
export async function retryWithResult<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const originalOnRetry = fullConfig.onRetry;

    const data = await retry(fn, {
      ...fullConfig,
      onRetry: (error, attempt, delay) => {
        attempts = attempt;
        originalOnRetry?.(error, attempt, delay);
      },
    });

    return {
      success: true,
      data,
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const retryError = error instanceof RetryExhaustedError ? error : null;

    return {
      success: false,
      error: retryError?.lastError ?? err,
      attempts: retryError?.attempts ?? attempts + 1,
      totalTimeMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// RETRY DECORATOR
// =============================================================================

/**
 * Create a retryable version of a function
 *
 * Usage:
 * ```typescript
 * const retryableFetch = withRetry(fetchData, { maxRetries: 3 });
 * const result = await retryableFetch();
 * ```
 */
export function withRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: Partial<RetryConfig> = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retry(() => fn(...args), config);
}

// =============================================================================
// SPECIALIZED RETRY CONFIGURATIONS
// =============================================================================

/**
 * Retry configuration for API calls
 * - Moderate retries with reasonable delays
 * - Retries on network errors and 5xx
 */
export const API_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Retry configuration for real-time data
 * - Fast retries for time-sensitive operations
 * - Limited retries to prevent stale data
 */
export const REALTIME_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  initialDelayMs: 100,
  maxDelayMs: 1000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  timeoutMs: 5000,
};

/**
 * Retry configuration for batch operations
 * - More retries with longer delays
 * - Patient waiting for heavy operations
 */
export const BATCH_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 5,
  initialDelayMs: 2000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitterFactor: 0.15,
};

/**
 * Retry configuration for critical operations
 * - Aggressive retries for important operations
 * - Comprehensive error logging
 */
export const CRITICAL_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 5,
  initialDelayMs: 500,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  onRetry: (error, attempt, delay) => {
    console.warn(
      `[CRITICAL RETRY] Attempt ${attempt} failed: ${error.message}. ` +
      `Retrying in ${delay}ms...`
    );
  },
};
