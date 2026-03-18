/**
 * Circuit Breaker Pattern Implementation
 *
 * Design Philosophy (NautilusTrader + Netflix Hystrix):
 * - Prevent cascading failures in distributed systems
 * - Graceful degradation when external services fail
 * - Self-healing with automatic recovery attempts
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 *
 * @module lib/data-service/circuit-breaker
 */

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  readonly failureThreshold: number;
  /** Number of successes needed to close circuit from half-open */
  readonly successThreshold: number;
  /** Time in ms before attempting to close circuit */
  readonly timeout: number;
  /** Maximum calls allowed in half-open state */
  readonly halfOpenMaxCalls: number;
  /** Optional name for logging/debugging */
  readonly name?: string;
  /** Callback when state changes */
  readonly onStateChange?: (state: CircuitState, prevState: CircuitState) => void;
  /** Callback on failure */
  readonly onFailure?: (error: Error) => void;
  /** Callback on success */
  readonly onSuccess?: () => void;
}

/**
 * Circuit breaker state enum
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  readonly state: CircuitState;
  readonly failures: number;
  readonly successes: number;
  readonly consecutiveFailures: number;
  readonly consecutiveSuccesses: number;
  readonly totalRequests: number;
  readonly failedRequests: number;
  readonly successfulRequests: number;
  readonly lastFailureTime: Date | null;
  readonly lastSuccessTime: Date | null;
  readonly halfOpenCalls: number;
  readonly stateChangedAt: Date;
}

/**
 * Default circuit breaker configuration
 * Tuned for typical API interactions
 */
const DEFAULT_CONFIG: Required<Omit<CircuitBreakerConfig, 'onStateChange' | 'onFailure' | 'onSuccess'>> = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000, // 30 seconds
  halfOpenMaxCalls: 3,
  name: 'default',
};

// =============================================================================
// CIRCUIT BREAKER ERROR
// =============================================================================

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  public readonly circuitName: string;
  public readonly retryAfter: number;

  constructor(circuitName: string, retryAfter: number = 0) {
    super(`Circuit breaker '${circuitName}' is OPEN. Retry after ${retryAfter}ms`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.retryAfter = retryAfter;
  }
}

// =============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// =============================================================================

/**
 * Circuit Breaker Implementation
 *
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker('api-service', {
 *   failureThreshold: 5,
 *   successThreshold: 3,
 *   timeout: 30000,
 * });
 *
 * try {
 *   const result = await breaker.execute(() => fetchData());
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Handle circuit open - use fallback
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private readonly config: Required<Omit<CircuitBreakerConfig, 'onStateChange' | 'onFailure' | 'onSuccess'>> &
    Pick<CircuitBreakerConfig, 'onStateChange' | 'onFailure' | 'onSuccess'>;

  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private totalRequests = 0;
  private failedRequests = 0;
  private successfulRequests = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private halfOpenCalls = 0;
  private stateChangedAt: Date = new Date();

  constructor(
    private readonly name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = {
      ...DEFAULT_CONFIG,
      name: name,
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   * @throws CircuitOpenError when circuit is open
   * @throws Original error when function fails (if circuit allows)
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        const retryAfter = this.getRetryAfter();
        throw new CircuitOpenError(this.name, retryAfter);
      }
    }

    // Check half-open call limit
    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      const retryAfter = this.getRetryAfter();
      throw new CircuitOpenError(this.name, retryAfter);
    }

    // Track request
    this.totalRequests++;
    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Execute with fallback value when circuit is open
   */
  async executeWithFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return fallback;
      }
      throw error;
    }
  }

  /**
   * Execute with fallback function when circuit is open
   */
  async executeWithFallbackFn<T>(
    fn: () => Promise<T>,
    fallbackFn: () => T | Promise<T>
  ): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return await fallbackFn();
      }
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;
    this.successfulRequests++;
    this.lastSuccessTime = new Date();

    this.config.onSuccess?.();

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.failedRequests++;
    this.lastFailureTime = new Date();
    this.successes = 0;

    this.config.onFailure?.(error);

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open state reopens the circuit
      this.transitionTo('OPEN');
    } else if (this.failures >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Check if circuit should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }
    return Date.now() - this.lastFailureTime.getTime() >= this.config.timeout;
  }

  /**
   * Get time until retry is allowed
   */
  private getRetryAfter(): number {
    if (!this.lastFailureTime) {
      return 0;
    }
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.config.timeout - elapsed);
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) {
      return;
    }

    const prevState = this.state;
    this.state = newState;
    this.stateChangedAt = new Date();

    // Reset counters on state change
    if (newState === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
      this.halfOpenCalls = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successes = 0;
      this.halfOpenCalls = 0;
    }

    this.config.onStateChange?.(newState, prevState);
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      successfulRequests: this.successfulRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      halfOpenCalls: this.halfOpenCalls,
      stateChangedAt: this.stateChangedAt,
    };
  }

  /**
   * Manually reset circuit to closed state
   * Use with caution - typically for admin/debugging purposes
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.halfOpenCalls = 0;
  }

  /**
   * Manually open circuit
   * Use for proactive circuit breaking (e.g., known maintenance)
   */
  trip(): void {
    this.lastFailureTime = new Date();
    this.transitionTo('OPEN');
  }

  /**
   * Check if circuit allows requests
   */
  isAllowed(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }
    if (this.state === 'OPEN') {
      return this.shouldAttemptReset();
    }
    // HALF_OPEN
    return this.halfOpenCalls < this.config.halfOpenMaxCalls;
  }

  /**
   * Get circuit breaker name
   */
  getName(): string {
    return this.name;
  }
}

// =============================================================================
// CIRCUIT BREAKER REGISTRY
// =============================================================================

/**
 * Global registry for circuit breakers
 * Enables monitoring and management of all breakers
 */
class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  /**
   * Register a circuit breaker
   */
  register(breaker: CircuitBreaker): void {
    this.breakers.set(breaker.getName(), breaker);
  }

  /**
   * Get a circuit breaker by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    const existing = this.breakers.get(name);
    if (existing) {
      return existing;
    }
    const breaker = new CircuitBreaker(name, config);
    this.register(breaker);
    return breaker;
  }

  /**
   * Get all registered circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
  }

  /**
   * Remove a circuit breaker from registry
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
  }
}

/**
 * Global circuit breaker registry instance
 */
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a circuit breaker with default configuration for data services
 * Pre-configured for typical API interaction patterns
 */
export function createDataServiceBreaker(
  name: string,
  overrides?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  const breaker = new CircuitBreaker(name, {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    halfOpenMaxCalls: 2,
    ...overrides,
  });
  circuitBreakerRegistry.register(breaker);
  return breaker;
}
