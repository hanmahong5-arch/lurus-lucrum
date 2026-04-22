/**
 * Financial Disclosure ETL — announce-date calendar for earnings reports.
 *
 * Status: skeleton. The real implementation needs a provider that returns
 * `(symbol, reportPeriod, reportType, announceDate)`. Likely candidates:
 *   - akshare `stock_yjbb_em` (annual earnings) and `stock_yjkb_em` (forecasts)
 *   - eastmoney disclosure API
 *   - tushare `disclosure_date` (requires auth)
 *
 * The interface below is provider-agnostic; wire a concrete fetcher via
 * `ingestDisclosures(entries)` once picked.
 *
 * @module lib/pit/etl/disclosure-etl
 */

import type {
  DisclosureEntry,
  IPitDisclosureRepository,
} from '../interfaces';
import { getPitDisclosureRepository } from '..';

export interface IngestDisclosuresOptions {
  readonly entries: ReadonlyArray<DisclosureEntry>;
  readonly repo?: IPitDisclosureRepository;
}

export interface IngestDisclosuresResult {
  readonly inserted: number;
  readonly entriesReceived: number;
}

/**
 * Upsert disclosure rows. Safe to call repeatedly: uniqueness on
 * (symbol, report_period, report_type) ensures idempotency.
 */
export async function ingestDisclosures(
  options: IngestDisclosuresOptions
): Promise<IngestDisclosuresResult> {
  const repo = options.repo ?? getPitDisclosureRepository();
  await repo.upsert(options.entries);
  return {
    inserted: options.entries.length,
    entriesReceived: options.entries.length,
  };
}

/**
 * TODO: wire a real provider. Shape it should return:
 *   fetchDisclosures(startDate, endDate) → DisclosureEntry[]
 */
export type DisclosureProvider = (
  startDate: string,
  endDate: string
) => Promise<DisclosureEntry[]>;

export async function runDisclosureSync(
  provider: DisclosureProvider,
  startDate: string,
  endDate: string,
  repo?: IPitDisclosureRepository
): Promise<IngestDisclosuresResult> {
  const entries = await provider(startDate, endDate);
  return ingestDisclosures({ entries, repo });
}
