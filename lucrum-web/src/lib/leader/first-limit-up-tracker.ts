/**
 * First-limit-up tracker.
 *
 * A leader often prints the sector's first limit-up (涨停) — the earlier
 * the better. We detect limit-ups by close-to-prev-close ≥ the price band
 * minus a safety margin. Board-specific bands (10% main, 20% ChiNext/STAR,
 * 5% ST) are approximated via the symbol prefix.
 *
 * @module lib/leader/first-limit-up-tracker
 */

import type { FactorKlineBar } from '@/lib/factors';

/** Approximate daily price limit band as a fraction of prev close. */
export function priceLimitBand(symbol: string): number {
  // STAR Market (科创板) — 688xxx
  if (symbol.startsWith('688')) return 0.2;
  // ChiNext (创业板) — 300xxx
  if (symbol.startsWith('300')) return 0.2;
  // Beijing Stock Exchange — 8xxx, 43xxx, 83-87xxx
  if (symbol.startsWith('8') || symbol.startsWith('43')) return 0.3;
  // Main boards (SH 6xx, SZ 000/001/002) — 10%
  return 0.1;
}

const SAFETY_MARGIN = 0.002; // avoid rounding false-negatives near the boundary

export interface FirstLimitUpArgs {
  readonly symbol: string;
  readonly bars: ReadonlyArray<FactorKlineBar>;
  /** Only look at the last `window` bars. */
  readonly window: number;
}

/**
 * Returns the 0-indexed position of the first limit-up bar within the
 * last `window` bars, or null if none. Index 0 = oldest bar of the window.
 */
export function findFirstLimitUp(args: FirstLimitUpArgs): number | null {
  const { symbol, bars, window } = args;
  if (bars.length < 2) return null;

  const band = priceLimitBand(symbol);
  const threshold = band - SAFETY_MARGIN;
  const slice = bars.slice(-Math.min(window, bars.length));
  // Need at least one prior bar for a prev close comparison.
  const startIdx = Math.max(1, bars.length - slice.length);

  for (let i = startIdx; i < bars.length; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];
    if (!curr || !prev) continue;
    const prevClose = prev.close * (prev.adjFactor || 1);
    const currClose = curr.close * (curr.adjFactor || 1);
    if (prevClose <= 0) continue;
    const ret = currClose / prevClose - 1;
    if (ret >= threshold) {
      return i - startIdx;
    }
  }
  return null;
}
