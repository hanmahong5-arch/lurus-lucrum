/**
 * AI Insight Sidebar Store
 * AI 洞察侧栏状态管理
 *
 * Manages the open/close state and context for the AI insight sidebar.
 * Context can come from backtest results or stock validation rows.
 *
 * @module lib/stores/ai-sidebar-store
 */

import { create } from "zustand";
import type { AdvisorContext } from "@/lib/advisor/agent/types";
import type { QuestionContext } from "@/lib/advisor/question-generator";

// =============================================================================
// TYPES
// =============================================================================

/** Context type origin for the AI sidebar */
export type AiSidebarContextType = "backtest" | "stock" | null;

/** Backtest summary for AI context building */
export interface BacktestSummary {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  score?: string;
  scoreBreakdown?: {
    profitability: number;
    risk: number;
    stability: number;
    efficiency: number;
  };
}

/** Payload when opening sidebar from backtest results */
export interface BacktestContextPayload {
  strategyCode: string;
  parameters: Record<string, number | string | boolean>;
  summary: BacktestSummary;
  symbol?: string;
  stockName?: string;
}

/** Payload when opening sidebar from stock validation row */
export interface StockContextPayload {
  symbol: string;
  stockName: string;
  performance: "good" | "poor" | "neutral";
  metrics: {
    winRate?: number;
    totalReturn?: number;
    sharpeRatio?: number;
  };
}

/** Partial AdvisorContext built from payloads */
export interface AiSidebarContext {
  backtestSummary?: string;
  strategySnippet?: string;
  stockInfo?: string;
}

interface AiSidebarState {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Origin type of the context */
  contextType: AiSidebarContextType;
  /** Built context for the advisor */
  context: Partial<AdvisorContext> | null;
  /** Pre-filled question for the chat input */
  preFilledQuestion: string | null;
  /** Raw metadata for display purposes */
  metadata: AiSidebarContext | null;
  /** Question generation context for SmartQuestionChips */
  questionContext: QuestionContext | null;

  /** Open sidebar with backtest context */
  openWithBacktestContext: (payload: BacktestContextPayload) => void;
  /** Open sidebar with stock-specific context */
  openWithStockContext: (payload: StockContextPayload) => void;
  /** Close sidebar and clear context */
  close: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_CODE_SNIPPET_LENGTH = 500;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Truncate strategy code to a reasonable length for context
 */
function truncateCode(code: string): string {
  if (code.length <= MAX_CODE_SNIPPET_LENGTH) return code;
  return code.slice(0, MAX_CODE_SNIPPET_LENGTH) + "\n# ... (truncated)";
}

/**
 * Format percentage for display
 */
function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Build a human-readable backtest summary string
 */
function buildBacktestSummaryText(summary: BacktestSummary): string {
  const parts = [
    `Total Return: ${formatPct(summary.totalReturn)}`,
    `Max Drawdown: ${formatPct(summary.maxDrawdown)}`,
    `Sharpe Ratio: ${summary.sharpeRatio.toFixed(2)}`,
    `Win Rate: ${formatPct(summary.winRate)}`,
    `Total Trades: ${summary.totalTrades}`,
  ];
  if (summary.score) {
    parts.push(`Score: ${summary.score}`);
  }
  if (summary.annualizedReturn !== undefined) {
    parts.push(`Annualized Return: ${formatPct(summary.annualizedReturn)}`);
  }
  return parts.join(", ");
}

/**
 * Build pre-filled question based on stock performance
 */
function buildStockQuestion(
  stockName: string,
  performance: "good" | "poor" | "neutral"
): string {
  const performanceLabel =
    performance === "good" ? "good" : performance === "poor" ? "poor" : "average";
  return `Why does ${stockName}'s strategy perform ${performanceLabel}?`;
}

// =============================================================================
// STORE
// =============================================================================

/**
 * Build QuestionContext from BacktestSummary for SmartQuestionChips
 */
function buildQuestionContext(summary: BacktestSummary): QuestionContext | null {
  if (!summary.scoreBreakdown) return null;

  return {
    scoreBreakdown: summary.scoreBreakdown,
    totalReturn: summary.totalReturn,
    annualizedReturn: summary.annualizedReturn,
    maxDrawdown: summary.maxDrawdown,
    sharpeRatio: summary.sharpeRatio,
    winRate: summary.winRate,
    totalTrades: summary.totalTrades,
    maxDrawdownDuration: summary.maxDrawdownDuration,
    profitFactor: summary.profitFactor,
  };
}

export const useAiSidebarStore = create<AiSidebarState>((set) => ({
  isOpen: false,
  contextType: null,
  context: null,
  preFilledQuestion: null,
  metadata: null,
  questionContext: null,

  openWithBacktestContext: (payload: BacktestContextPayload) => {
    const summaryText = buildBacktestSummaryText(payload.summary);
    const codeSnippet = truncateCode(payload.strategyCode);
    const questionCtx = buildQuestionContext(payload.summary);

    set({
      isOpen: true,
      contextType: "backtest",
      context: {
        // Partial AdvisorContext - the advisor chat merges this with user prefs
      },
      preFilledQuestion: null,
      metadata: {
        backtestSummary: summaryText,
        strategySnippet: codeSnippet,
        stockInfo: payload.stockName
          ? `${payload.symbol} ${payload.stockName}`
          : payload.symbol ?? undefined,
      },
      questionContext: questionCtx,
    });
  },

  openWithStockContext: (payload: StockContextPayload) => {
    const question = buildStockQuestion(payload.stockName, payload.performance);

    const metricParts: string[] = [];
    if (payload.metrics.winRate !== undefined) {
      metricParts.push(`Win Rate: ${formatPct(payload.metrics.winRate)}`);
    }
    if (payload.metrics.totalReturn !== undefined) {
      metricParts.push(`Total Return: ${formatPct(payload.metrics.totalReturn)}`);
    }
    if (payload.metrics.sharpeRatio !== undefined) {
      metricParts.push(`Sharpe: ${payload.metrics.sharpeRatio.toFixed(2)}`);
    }

    set({
      isOpen: true,
      contextType: "stock",
      context: {},
      preFilledQuestion: question,
      metadata: {
        stockInfo: `${payload.symbol} ${payload.stockName}`,
        backtestSummary: metricParts.join(", ") || undefined,
      },
      questionContext: null, // Stock context does not have score breakdown
    });
  },

  close: () => {
    set({
      isOpen: false,
      contextType: null,
      context: null,
      preFilledQuestion: null,
      metadata: null,
      questionContext: null,
    });
  },
}));
