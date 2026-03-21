/**
 * Repository Layer — Barrel Exports & Singleton Factory
 *
 * Provides lazy-initialized singleton instances of each repository.
 * All repositories share the same Drizzle db instance from @/lib/db.
 *
 * Usage:
 *   import { getStockRepository } from '@/lib/repositories';
 *   const stocks = await getStockRepository().search('maotai');
 *
 * @module lib/repositories
 */

import { db } from '@/lib/db';
import type { IStockRepository, IKlineRepository, IBacktestRepository, IStrategyRepository, ISectorRepository } from './interfaces';
import { DrizzleStockRepository } from './drizzle/stock-repository';
import { DrizzleKlineRepository } from './drizzle/kline-repository';
import { DrizzleBacktestRepository } from './drizzle/backtest-repository';
import { DrizzleStrategyRepository } from './drizzle/strategy-repository';
import { DrizzleSectorRepository } from './drizzle/sector-repository';

// Re-export all interface types for convenient imports
export type {
  IStockRepository,
  IKlineRepository,
  IBacktestRepository,
  IStrategyRepository,
  ISectorRepository,
  PaginationOptions,
  PaginatedResult,
  SectorStockFilter,
  StockSearchOptions,
  BacktestHistoryFilter,
  BacktestHistoryStats,
  BacktestHistoryRow,
  SymbolEntry,
  KlineBar,
  UserStrategyFilter,
  MarketplaceFilter,
} from './interfaces';

// Re-export implementations for direct use or testing
export { DrizzleStockRepository } from './drizzle/stock-repository';
export { DrizzleKlineRepository } from './drizzle/kline-repository';
export { DrizzleBacktestRepository } from './drizzle/backtest-repository';
export { DrizzleStrategyRepository } from './drizzle/strategy-repository';
export { DrizzleSectorRepository } from './drizzle/sector-repository';

// =============================================================================
// LAZY SINGLETONS
// =============================================================================

let _stocks: IStockRepository | null = null;
let _klines: IKlineRepository | null = null;
let _backtests: IBacktestRepository | null = null;
let _strategies: IStrategyRepository | null = null;
let _sectors: ISectorRepository | null = null;

/** Get the singleton stock repository instance */
export function getStockRepository(): IStockRepository {
  if (!_stocks) _stocks = new DrizzleStockRepository(db);
  return _stocks;
}

/** Get the singleton kline repository instance */
export function getKlineRepository(): IKlineRepository {
  if (!_klines) _klines = new DrizzleKlineRepository(db);
  return _klines;
}

/** Get the singleton backtest history repository instance */
export function getBacktestRepository(): IBacktestRepository {
  if (!_backtests) _backtests = new DrizzleBacktestRepository(db);
  return _backtests;
}

/** Get the singleton strategy history repository instance */
export function getStrategyRepository(): IStrategyRepository {
  if (!_strategies) _strategies = new DrizzleStrategyRepository(db);
  return _strategies;
}

/** Get the singleton sector repository instance */
export function getSectorRepository(): ISectorRepository {
  if (!_sectors) _sectors = new DrizzleSectorRepository(db);
  return _sectors;
}

/**
 * Reset all singleton instances.
 * Intended for testing only — allows injecting mock implementations.
 */
export function _resetRepositories(): void {
  _stocks = null;
  _klines = null;
  _backtests = null;
  _strategies = null;
  _sectors = null;
}
