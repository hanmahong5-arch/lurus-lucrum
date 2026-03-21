/**
 * Infrastructure Layer — Barrel Exports
 *
 * Cross-cutting infrastructure concerns: circuit breakers, external API wrappers.
 *
 * @module lib/infra
 */

export {
  eastmoneyBreaker,
  sinaBreaker,
  eastmoneySectorBreaker,
  CircuitOpenError,
  getAllBreakerStates,
} from './circuit-breaker';

export {
  getKLineDataWithBreaker,
  getStockQuoteWithBreaker,
  getMajorIndicesWithBreaker,
  getSectorStocksProtected,
  getSectorIndexKlineProtected,
} from './external-apis';

export { dedupRequest } from './request-dedup';
