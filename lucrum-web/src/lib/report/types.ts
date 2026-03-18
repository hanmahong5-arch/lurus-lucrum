/**
 * PDF Report Type Definitions
 * Interfaces for report data assembly and rendering.
 *
 * @module lib/report/types
 */

import type { ScoreGrade, ScoreBreakdown, CoreMetrics } from "@/lib/backtest/score/types";

// =============================================================================
// REPORT DATA
// =============================================================================

/** Cover page data */
export interface CoverData {
  title: string;
  strategyName: string;
  parametersSummary: string;
  dateRange: string;
  targetInfo: string;
  generatedAt: string;
  grade: ScoreGrade;
  score: number;
}

/** Score summary data */
export interface ScoreData {
  grade: ScoreGrade;
  score: number;
  description: string;
  coreMetrics: CoreMetrics;
  breakdown: ScoreBreakdown;
  benchmarkAlpha?: number;
  benchmarkBeta?: number;
}

/** A single metric row for the metrics table */
export interface MetricRow {
  label: string;
  value: string;
  highlight?: "profit" | "loss" | "neutral";
}

/** Metrics table organized by category */
export interface MetricsData {
  returnMetrics: MetricRow[];
  riskMetrics: MetricRow[];
  tradingMetrics: MetricRow[];
}

/** A single trade row */
export interface TradeRow {
  date: string;
  type: "buy" | "sell";
  symbol: string;
  price: string;
  quantity: string;
  pnl: string;
  pnlHighlight: "profit" | "loss" | "neutral";
}

/** Trade list data */
export interface TradeListData {
  trades: TradeRow[];
  totalTrades: number;
  hasMore: boolean;
  moreCount: number;
}

/** Stock ranking row */
export interface StockRankingRow {
  rank: number;
  symbol: string;
  name: string;
  totalReturn: string;
  totalReturnHighlight: "profit" | "loss" | "neutral";
  winRate: string;
  sharpeRatio: string;
  maxDrawdown: string;
  tradeCount: number;
}

/** Stock ranking data */
export interface StockRankingData {
  stocks: StockRankingRow[];
  totalStocks: number;
  hasMore: boolean;
  averageReturn: string;
  averageWinRate: string;
  averageSharpe: string;
  failedCount?: number;
}

/** Chart image data (base64 PNG from html2canvas) */
export interface ChartImageData {
  /** Base64 data URL of the chart image */
  dataUrl: string;
  /** Original width in pixels */
  width: number;
  /** Original height in pixels */
  height: number;
}

// =============================================================================
// REPORT ASSEMBLY
// =============================================================================

/** Complete report data assembled from backtest results */
export interface ReportData {
  cover: CoverData;
  score: ScoreData | null;
  chartImage: ChartImageData | null;
  metrics: MetricsData;
  tradeList: TradeListData | null;
  stockRanking: StockRankingData | null;
}

/** Options for PDF generation */
export interface PdfGenerateOptions {
  /** Whether to include the equity curve chart */
  includeChart?: boolean;
  /** HTML element to capture as chart image (if includeChart is true) */
  chartElement?: HTMLElement | null;
  /** Custom filename (without .pdf extension) */
  filename?: string;
}

/** Result from PDF generation */
export interface PdfGenerateResult {
  success: boolean;
  filename: string;
  error?: string;
}
