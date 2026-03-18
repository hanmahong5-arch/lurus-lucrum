/**
 * Shared Market Data Types
 *
 * Used by both lucrum-web and lucrum-app.
 * Keep in sync — this is the single source of truth.
 */

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  amount: number;
  turnoverRate: number;
  pe: number | null;
  pb: number | null;
  marketCap: number | null;
  timestamp: number;
}

export interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}

export type KLineTimeFrame =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "1d"
  | "1w"
  | "1M";

export interface IndexQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  amount: number;
  timestamp: number;
}
