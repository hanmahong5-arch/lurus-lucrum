/**
 * Shared Backtest Types (simplified for mobile display)
 *
 * The full BacktestResult type lives in lucrum-web.
 * This file contains the subset needed for mobile rendering.
 */

export interface BacktestConfig {
  symbol: string;
  initialCapital: number;
  commission: number;
  slippage: number;
  startDate: string;
  endDate: string;
  timeframe: "1d" | "1w" | "60m" | "30m" | "15m" | "5m" | "1m";
  enableT1?: boolean;
  enableCircuitBreaker?: boolean;
}

export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  sortinoRatio: number;
  calmarRatio: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

export interface BacktestTrade {
  id: string;
  date: string;
  type: "buy" | "sell";
  price: number;
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
  holdingDays?: number;
}

export interface BacktestSummary {
  id: string;
  strategyName: string;
  symbol: string;
  symbolName: string;
  config: BacktestConfig;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades?: BacktestTrade[];
  executedAt: string;
  score?: string;
}

export interface BacktestHistoryItem {
  id: number;
  symbol: string;
  stockName: string;
  startDate: string;
  endDate: string;
  timeframe: string;
  dataSource: string;
  dataCoverage: number;
  metrics: Pick<BacktestMetrics, "totalReturn" | "sharpeRatio" | "maxDrawdown" | "winRate">;
  executionTime: number;
  notes: string;
  createdAt: string;
  strategy?: {
    id: number;
    name: string;
    type: string;
  };
}

export interface BacktestHistoryResponse {
  backtests: BacktestHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats: {
    avgReturn: number;
    avgSharpe: number;
    avgWinRate: number;
    bestReturn: number;
    worstReturn: number;
  };
}

/** Unified backtest request (POST /api/backtest/unified) */
export interface UnifiedBacktestRequest {
  target: {
    mode: "stock";
    stock: { symbol: string; name: string };
  };
  strategy: {
    type: "builtin" | "custom";
    builtinId?: string;
    customCode?: string;
    params?: Record<string, number>;
  };
  config: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    commission?: number;
    slippage?: number;
    timeframe?: string;
  };
}

/** Streaming progress event from multi-stock SSE */
export interface BacktestProgressEvent {
  type: "progress";
  completed: number;
  total: number;
  failed: number;
  currentItem: string;
  elapsedMs: number;
}

export interface BacktestCompleteEvent {
  type: "complete";
  result: BacktestSummary;
}

export interface BacktestErrorEvent {
  type: "error";
  message: string;
  code?: string;
}
