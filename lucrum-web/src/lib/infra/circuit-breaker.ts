/**
 * Circuit Breaker Facade for External API Calls
 *
 * Wraps the existing data-service circuit breaker implementation
 * and provides pre-configured singleton breakers for each external
 * data provider (EastMoney, Sina, etc.).
 *
 * The existing CircuitBreaker class in data-service/ was defined but
 * never wired into the actual fallback chain. This module bridges that gap.
 *
 * @module lib/infra/circuit-breaker
 */

import {
  CircuitBreaker,
  CircuitOpenError,
  circuitBreakerRegistry,
} from '@/lib/data-service/circuit-breaker';

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

/** Failure count before the circuit trips open */
const EXTERNAL_API_FAILURE_THRESHOLD = 3;

/** Milliseconds to wait before probing a tripped circuit */
const EXTERNAL_API_TIMEOUT_MS = 60_000;

/** Max concurrent probe calls in half-open state */
const EXTERNAL_API_HALF_OPEN_MAX = 1;

/** Successes needed to fully close a half-open circuit */
const EXTERNAL_API_SUCCESS_THRESHOLD = 2;

// =============================================================================
// PRE-CONFIGURED BREAKER INSTANCES
// =============================================================================

function createExternalApiBreaker(name: string): CircuitBreaker {
  const breaker = new CircuitBreaker(name, {
    failureThreshold: EXTERNAL_API_FAILURE_THRESHOLD,
    successThreshold: EXTERNAL_API_SUCCESS_THRESHOLD,
    timeout: EXTERNAL_API_TIMEOUT_MS,
    halfOpenMaxCalls: EXTERNAL_API_HALF_OPEN_MAX,
    onStateChange: (state, prev) => {
      console.warn(
        `[CircuitBreaker] ${name}: ${prev} -> ${state}`,
      );
    },
  });
  circuitBreakerRegistry.register(breaker);
  return breaker;
}

/** EastMoney (push2.eastmoney.com) circuit breaker */
export const eastmoneyBreaker = createExternalApiBreaker('eastmoney');

/** Sina Finance (hq.sinajs.cn) circuit breaker */
export const sinaBreaker = createExternalApiBreaker('sina');

/** EastMoney Sector API (sector-specific endpoint) circuit breaker */
export const eastmoneySectorBreaker = createExternalApiBreaker('eastmoney-sector');

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

export { CircuitBreaker, CircuitOpenError, circuitBreakerRegistry };

/**
 * Get a snapshot of all breaker states for health-check endpoints.
 *
 * Returns a record of breaker name -> current state string.
 */
export function getAllBreakerStates(): Record<
  string,
  { state: string; failures: number; totalRequests: number }
> {
  const stats = circuitBreakerRegistry.getAllStats();
  const result: Record<
    string,
    { state: string; failures: number; totalRequests: number }
  > = {};

  for (const [name, stat] of Object.entries(stats)) {
    result[name] = {
      state: stat.state,
      failures: stat.consecutiveFailures,
      totalRequests: stat.totalRequests,
    };
  }
  return result;
}
