/**
 * Repository Interfaces — Pure Data Access Abstractions
 *
 * These interfaces decouple business logic from the ORM layer.
 * Implementations live in ./drizzle/ and can be swapped for tests or migrations.
 *
 * @module lib/repositories/interfaces
 */

import type {
  Stock,
  Sector,
  KLineDaily,
  BacktestHistory,
  StrategyHistory,
  NewBacktestHistory,
  NewStrategyHistory,
} from '@/lib/db/schema';

// =============================================================================
// COMMON TYPES
// =============================================================================

/** Pagination options for list queries */
export interface PaginationOptions {
  readonly limit: number;
  readonly offset: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

/** Filter criteria for sector stock queries */
export interface SectorStockFilter {
  readonly excludeST?: boolean;
  readonly minMarketCap?: number;
  readonly excludeNewStocks?: boolean;
  readonly minListingDays?: number;
  readonly status?: string;
  readonly maxStocks?: number;
}

/** Filter criteria for stock search */
export interface StockSearchOptions {
  readonly excludeST?: boolean;
  readonly status?: string;
  readonly limit?: number;
}

/** Filter criteria for backtest history */
export interface BacktestHistoryFilter {
  readonly symbol?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

/** Aggregate stats for backtest history */
export interface BacktestHistoryStats {
  readonly avgReturn: number | null;
  readonly avgSharpe: number | null;
  readonly avgWinRate: number | null;
  readonly bestReturn: number | null;
  readonly worstReturn: number | null;
}

/** Backtest history row with joined strategy info */
export interface BacktestHistoryRow {
  readonly id: number;
  readonly symbol: string;
  readonly stockName: string | null;
  readonly startDate: string;
  readonly endDate: string;
  readonly timeframe: string;
  readonly dataSource: string;
  readonly dataCoverage: number | null;
  readonly totalReturn: number | null;
  readonly sharpeRatio: number | null;
  readonly maxDrawdown: number | null;
  readonly winRate: number | null;
  readonly executionTime: number | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly strategyId: number | null;
  readonly strategyName: string | null;
  readonly strategyType: string | null;
}

/** Distinct symbol entry for filter dropdown */
export interface SymbolEntry {
  readonly symbol: string;
  readonly stockName: string | null;
}

/** K-line bar in repository-neutral format */
export interface KlineBar {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly amount: number | null;
  readonly adjFactor: number;
}

/** Strategy filter for user queries */
export interface UserStrategyFilter {
  readonly isActive?: boolean;
  readonly limit?: number;
}

/** Marketplace listing filter */
export interface MarketplaceFilter {
  readonly status?: string;
  readonly priceType?: string;
  readonly sortBy?: 'publishedAt' | 'totalRuns' | 'totalSubscribers';
  readonly sortOrder?: 'asc' | 'desc';
}

// =============================================================================
// REPOSITORY INTERFACES
// =============================================================================

/**
 * Stock data access interface
 *
 * Abstracts all stock-related database queries.
 */
export interface IStockRepository {
  /** Find a single stock by its symbol code */
  findBySymbol(symbol: string): Promise<Stock | null>;

  /** Search stocks by keyword (matches symbol or name) */
  search(query: string, options?: StockSearchOptions): Promise<Stock[]>;

  /** Get stocks belonging to a specific sector via mapping table */
  findBySector(sectorCode: string, filters?: SectorStockFilter): Promise<Stock[]>;

  /** Get stocks by a list of symbol codes */
  findBySymbols(symbols: string[]): Promise<Stock[]>;

  /** Count stocks matching optional filters */
  count(options?: StockSearchOptions): Promise<number>;
}

/**
 * K-line data access interface
 *
 * Handles daily candlestick data storage and retrieval.
 */
export interface IKlineRepository {
  /** Get daily kline data for a stock within a date range */
  getDaily(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<KLineDaily[]>;

  /** Batch upsert daily kline bars for a stock */
  upsertDaily(stockId: number, bars: KlineBar[]): Promise<void>;

  /** Get the latest available date for a stock's kline data */
  getLatestDate(symbol: string): Promise<string | null>;

  /** Get kline data for multiple stocks in a single query */
  getBatch(
    symbols: string[],
    startDate: string,
    endDate: string,
  ): Promise<Map<string, KLineDaily[]>>;
}

/**
 * Backtest history data access interface
 *
 * Manages persistence and retrieval of backtest results.
 */
export interface IBacktestRepository {
  /** Save a new backtest result, returns the generated ID */
  save(result: NewBacktestHistory): Promise<number>;

  /** Find a backtest by its ID */
  findById(id: number): Promise<BacktestHistory | null>;

  /** List backtest history for a user with filters and pagination */
  findByUser(
    userId: string,
    filters: BacktestHistoryFilter,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<BacktestHistoryRow>>;

  /** Delete a backtest record by ID */
  deleteById(id: number): Promise<void>;

  /** Get distinct symbols used in a user's backtest history */
  getDistinctSymbols(userId: string): Promise<SymbolEntry[]>;

  /** Get aggregate statistics for a user's backtests */
  getStats(userId: string): Promise<BacktestHistoryStats>;
}

/**
 * Strategy history data access interface
 *
 * Handles version-controlled strategy storage and retrieval.
 */
export interface IStrategyRepository {
  /** Save a new strategy version, returns the generated ID */
  save(strategy: NewStrategyHistory): Promise<number>;

  /** Find a strategy by its ID */
  findById(id: number): Promise<StrategyHistory | null>;

  /** List strategies for a user */
  findByUser(userId: string, filters?: UserStrategyFilter): Promise<StrategyHistory[]>;
}

/**
 * Sector data access interface
 *
 * Abstracts sector/industry classification queries.
 */
export interface ISectorRepository {
  /** Find a sector by its code (e.g., "BK0420") */
  findByCode(code: string): Promise<Sector | null>;

  /** List all sectors, optionally filtered by level */
  listAll(level?: number): Promise<Sector[]>;

  /** Get stocks in a sector with filtering (delegates to mapping table) */
  getStocks(sectorCode: string, filters?: SectorStockFilter): Promise<Stock[]>;
}
