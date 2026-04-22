/**
 * Point-in-Time Repository Interfaces
 *
 * All repositories here answer queries from a historical viewpoint.
 * Any method taking `asOfDate` MUST NOT leak data whose `announceDate`
 * (or equivalent availability date) is after `asOfDate`.
 *
 * @module lib/pit/interfaces
 */

export type StockStatus = 'active' | 'ST' | 'suspended' | 'delisted';

export interface TradingDayInfo {
  readonly date: string;
  readonly isTrading: boolean;
  readonly sessionType: string;
}

export interface HaltWindow {
  readonly symbol: string;
  readonly haltDate: string;
  readonly resumeDate: string | null;
  readonly reason: string | null;
}

export interface StatusSnapshot {
  readonly symbol: string;
  readonly status: StockStatus;
  readonly fromDate: string;
  readonly toDate: string | null;
  readonly reason: string | null;
}

export interface SectorSnapshotEntry {
  readonly asOfDate: string;
  readonly sectorCode: string;
  readonly symbol: string;
  readonly weight: number;
}

export interface DisclosureEntry {
  readonly symbol: string;
  readonly reportPeriod: string;
  readonly reportType: string;
  readonly announceDate: string;
}

export interface PitFactEntry {
  readonly symbol: string;
  readonly field: string;
  readonly value: number | null;
  readonly reportPeriod: string;
  readonly asOfDate: string;
  readonly source: string | null;
}

/**
 * Calendar repository — trading days, halts, and status transitions.
 *
 * Groups three small PIT lookups that are always used together during the
 * hard-filter stage of the funnel.
 */
export interface IPitCalendarRepository {
  /** Is `date` a trading day? Uses trading_calendar if populated, else falls back to weekday check. */
  isTradingDay(date: string): Promise<boolean>;

  /** List trading days in [startDate, endDate] inclusive. */
  listTradingDays(startDate: string, endDate: string): Promise<string[]>;

  /** Bulk upsert trading-calendar rows. */
  upsertTradingDays(days: ReadonlyArray<TradingDayInfo>): Promise<void>;

  /** Was `symbol` halted on `date`? */
  isHalted(symbol: string, date: string): Promise<boolean>;

  /** List halts that overlap the given window. */
  listHalts(symbol: string, startDate: string, endDate: string): Promise<HaltWindow[]>;

  /** Insert halt records. Idempotent by (symbol, halt_date). */
  upsertHalts(rows: ReadonlyArray<Omit<HaltWindow, never> & { announceDate?: string | null }>): Promise<void>;

  /** Get the status of `symbol` as observed on `asOfDate`. Returns 'active' if no record matches. */
  getStatusAt(symbol: string, asOfDate: string): Promise<StockStatus>;

  /** Insert a status transition. */
  recordStatusChange(row: {
    symbol: string;
    fromDate: string;
    toDate?: string | null;
    status: StockStatus;
    reason?: string | null;
    announceDate?: string | null;
  }): Promise<void>;
}

/**
 * Sector snapshot repository — historical sector membership.
 *
 * Critical for unbiased sector/concept backtests: the members of "新能源"
 * in 2020 are not the same as today. Never query the live mapping table.
 */
export interface IPitSectorSnapshotRepository {
  /** Get the list of symbols in `sectorCode` as of `asOfDate` (most recent snapshot ≤ asOfDate). */
  getComponents(sectorCode: string, asOfDate: string): Promise<string[]>;

  /** Inverse lookup: which sectors did `symbol` belong to on `asOfDate`? */
  getSectorsForStock(symbol: string, asOfDate: string): Promise<string[]>;

  /** Replace the entire snapshot for a (date, sector) pair. Atomic via transaction. */
  replaceSnapshot(
    asOfDate: string,
    sectorCode: string,
    entries: ReadonlyArray<{ symbol: string; weight?: number }>
  ): Promise<void>;

  /** List the snapshot dates we have on record for a sector, in descending order. */
  listSnapshotDates(sectorCode: string, limit?: number): Promise<string[]>;
}

/**
 * Disclosure repository — announce-date calendar for financial reports.
 *
 * Fundamental data queries must filter by announce_date to avoid
 * look-ahead bias (Q1 for 2024-03-31 is usually announced late April).
 */
export interface IPitDisclosureRepository {
  /** Most recent announce date for `symbol`'s reports of `reportType` with announceDate ≤ asOfDate. */
  getLatestAnnounceDate(
    symbol: string,
    reportType: string,
    asOfDate: string
  ): Promise<string | null>;

  /** List all disclosures announced in [startDate, endDate]. */
  listByAnnounceWindow(startDate: string, endDate: string): Promise<DisclosureEntry[]>;

  /** Upsert disclosure rows. Uniqueness: (symbol, report_period, report_type). */
  upsert(rows: ReadonlyArray<DisclosureEntry>): Promise<void>;
}

/**
 * PIT facts repository — versioned fundamental field store.
 *
 * Example query: "ROE for 600519 as knowable on 2023-06-01"
 *   → SELECT value ORDER BY as_of_date DESC LIMIT 1 WHERE asOfDate ≤ '2023-06-01'.
 *
 * Restatements create new rows with later as_of_date; never mutate history.
 */
export interface IPitFactsRepository {
  /** Most recent (field, value) pair knowable on `asOfDate`. */
  getFactAt(symbol: string, field: string, asOfDate: string): Promise<number | null>;

  /** Batch version of getFactAt. Returns a Map keyed by symbol. */
  getFactsAt(
    symbols: ReadonlyArray<string>,
    field: string,
    asOfDate: string
  ): Promise<Map<string, number | null>>;

  /** All versions of (symbol, field, reportPeriod). Useful for audit/restatement analysis. */
  getVersions(symbol: string, field: string, reportPeriod: string): Promise<PitFactEntry[]>;

  /** Insert a new version. Throws on duplicate (symbol, field, period, asOfDate). */
  insertFact(row: PitFactEntry): Promise<void>;

  /** Bulk insert. Skips duplicates via ON CONFLICT DO NOTHING. */
  insertFactsBulk(rows: ReadonlyArray<PitFactEntry>): Promise<number>;
}
