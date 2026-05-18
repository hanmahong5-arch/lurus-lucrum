/**
 * Out-of-sample (OOS) anchor — splits performance series by the
 * "marketplace-submit moment" so a strategy can't market itself with
 * in-sample (cherry-picked) backtest numbers.
 *
 * The anchor is `marketplaceStrategies.publishedAt`. Any equity / return
 * data with timestamp ≥ that anchor is **out-of-sample** (forward-looking,
 * independent of the parameter search); anything before is **in-sample**.
 *
 * Caller convention: UI surfaces should:
 *   1. show IS and OOS metrics as TWO separate numbers, not blended;
 *   2. fade or label IS more cautiously than OOS;
 *   3. require a minimum OOS window (`MIN_OOS_DAYS_FOR_VETTED`) before
 *      promoting a strategy out of the "未成熟" bucket.
 *
 * Sprint 1 — QC Alpha-Streams 反 cherry-picking 招 A.
 *
 * @module lib/backtest/validation/oos-anchor
 */

/** Minimum out-of-sample days before a marketplace listing is "vetted". */
export const MIN_OOS_DAYS_FOR_VETTED = 90;

export interface IsOosSplit<T> {
  inSample: T[];
  outOfSample: T[];
}

/**
 * Split a chronologically-sorted array of dated records by an OOS anchor.
 * Records with `getDate(r) >= anchor` are out-of-sample.
 *
 * Stable order preserved within each bucket. O(n) single pass.
 */
export function splitIsOos<T>(
  rows: readonly T[],
  anchor: Date,
  getDate: (row: T) => Date | string,
): IsOosSplit<T> {
  const anchorMs = anchor.getTime();
  const inSample: T[] = [];
  const outOfSample: T[] = [];
  for (const row of rows) {
    const raw = getDate(row);
    const t = (raw instanceof Date ? raw : new Date(raw)).getTime();
    if (Number.isNaN(t)) continue; // skip un-dated rows rather than mis-bucketing
    if (t >= anchorMs) {
      outOfSample.push(row);
    } else {
      inSample.push(row);
    }
  }
  return { inSample, outOfSample };
}

/**
 * Days elapsed between the anchor and `now`. Negative values clamped to 0
 * to keep callers' branching simple ("how long has it been live").
 */
export function daysSinceAnchor(anchor: Date | string, now: Date = new Date()): number {
  const a = (anchor instanceof Date ? anchor : new Date(anchor)).getTime();
  if (Number.isNaN(a)) return 0;
  const diffMs = now.getTime() - a;
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export type VettingStatus = "vetted" | "immature" | "unknown";

/**
 * Decide whether a marketplace listing has cleared the OOS maturity bar.
 *
 *   anchor missing       → "unknown" (treat as immature in UI but don't lie)
 *   < MIN_OOS_DAYS_FOR_VETTED days since publish → "immature"
 *   ≥ MIN_OOS_DAYS_FOR_VETTED days since publish → "vetted"
 */
export function vettingStatus(
  publishedAt: Date | string | null | undefined,
  now: Date = new Date(),
): VettingStatus {
  if (!publishedAt) return "unknown";
  const days = daysSinceAnchor(publishedAt, now);
  return days >= MIN_OOS_DAYS_FOR_VETTED ? "vetted" : "immature";
}
