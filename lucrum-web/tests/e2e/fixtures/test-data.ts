/**
 * Shared mock data for E2E tests.
 *
 * Provides deterministic API response fixtures so E2E tests
 * are independent of external services and databases.
 */

// ─── Strategy Generation ────────────────────────────────────────────────────

/** Mock strategy code returned by /api/strategy/generate */
export const MOCK_GENERATED_CODE = `"""
KDJ Golden Cross Strategy
KDJ金叉策略
"""

from vnpy.trader.object import BarData
from vnpy_ctastrategy import CtaTemplate

class KDJGoldenCrossStrategy(CtaTemplate):
    """KDJ Golden Cross CTA Strategy"""

    author = "Lucrum"

    # Parameters
    kdj_period = 9
    kdj_slow = 3
    kdj_smooth = 3
    fixed_size = 1

    # Variables
    inited = False
    trading = False
    k_value = 0.0
    d_value = 0.0

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)

    def on_bar(self, bar: BarData):
        if not self.inited:
            return

        am = self.cta_engine.get_am(self.vt_symbol)
        k, d = am.kdj(self.kdj_period, self.kdj_slow, self.kdj_smooth)
        prev_k = self.k_value
        prev_d = self.d_value
        self.k_value = k
        self.d_value = d

        if prev_k < prev_d and k > d and k < 20 and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif prev_k > prev_d and k < d and k > 80 and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))

        self.put_event()
`;

/** Successful /api/strategy/generate response */
export const MOCK_STRATEGY_GENERATE_RESPONSE = {
  success: true,
  code: MOCK_GENERATED_CODE,
};

// ─── Backtest Results ───────────────────────────────────────────────────────

/** Mock backtest result metrics */
export const MOCK_BACKTEST_RESULT = {
  success: true,
  data: {
    metrics: {
      totalReturn: 0.325,
      annualizedReturn: 0.187,
      maxDrawdown: 0.142,
      sharpeRatio: 1.45,
      winRate: 0.625,
      tradeCount: 16,
      profitFactor: 2.1,
      sortinoRatio: 1.8,
      calmarRatio: 1.32,
      avgWin: 0.045,
      avgLoss: -0.021,
      holdingPeriod: 12.5,
    },
    trades: [
      {
        entryDate: '2025-03-15',
        exitDate: '2025-04-02',
        symbol: '600519',
        direction: 'long',
        entryPrice: 1680.0,
        exitPrice: 1750.0,
        pnl: 70.0,
        returnPct: 0.0417,
      },
      {
        entryDate: '2025-05-10',
        exitDate: '2025-05-28',
        symbol: '600519',
        direction: 'long',
        entryPrice: 1720.0,
        exitPrice: 1690.0,
        pnl: -30.0,
        returnPct: -0.0174,
      },
    ],
    equityCurve: [
      { date: '2025-01-02', equity: 1000000 },
      { date: '2025-06-30', equity: 1325000 },
    ],
    score: {
      grade: 'A',
      composite: 3.2,
      dimensions: {
        returnScore: 3.5,
        riskScore: 3.0,
        stabilityScore: 3.0,
        efficiencyScore: 3.5,
      },
    },
    dataSource: 'database',
    symbol: '600519',
    symbolName: '\u8d35\u5dde\u8305\u53f0',
    startDate: '2025-01-02',
    endDate: '2025-06-30',
  },
  meta: {
    dataSource: 'database',
    executionTimeMs: 1240,
  },
  timestamp: Date.now(),
};

// ─── Stock List ─────────────────────────────────────────────────────────────

/** Mock stock list for search and selection */
export const MOCK_STOCK_LIST = {
  success: true,
  data: [
    { symbol: '600519', name: '\u8d35\u5dde\u8305\u53f0', market: 'SH', sector: '\u98df\u54c1\u996e\u6599' },
    { symbol: '000858', name: '\u4e94\u7cae\u6db2', market: 'SZ', sector: '\u98df\u54c1\u996e\u6599' },
    { symbol: '601318', name: '\u4e2d\u56fd\u5e73\u5b89', market: 'SH', sector: '\u4fdd\u9669' },
    { symbol: '600036', name: '\u62db\u5546\u94f6\u884c', market: 'SH', sector: '\u94f6\u884c' },
    { symbol: '000001', name: '\u5e73\u5b89\u94f6\u884c', market: 'SZ', sector: '\u94f6\u884c' },
  ],
  timestamp: Date.now(),
};

// ─── Sector & Validation ────────────────────────────────────────────────────

/** Mock sector list for multi-stock validation */
export const MOCK_SECTORS = {
  success: true,
  data: {
    strategies: [
      { id: 'dual_ma', name: '\u53cc\u5747\u7ebf\u7b56\u7565', type: 'builtin' },
      { id: 'kdj_cross', name: 'KDJ\u91d1\u53c9\u6b7b\u53c9', type: 'builtin' },
      { id: 'macd_divergence', name: 'MACD\u80cc\u79bb', type: 'builtin' },
    ],
    sectors: [
      { id: 'sw_bank', name: '\u7533\u4e07\u94f6\u884c', stockCount: 42 },
      { id: 'sw_food', name: '\u7533\u4e07\u98df\u54c1\u996e\u6599', stockCount: 35 },
      { id: 'sw_medicine', name: '\u7533\u4e07\u533b\u836f\u751f\u7269', stockCount: 68 },
    ],
  },
  timestamp: Date.now(),
};

/** Mock multi-stock validation result */
export const MOCK_VALIDATION_RESULT = {
  success: true,
  data: {
    summary: {
      totalStocks: 10,
      profitableStocks: 7,
      avgReturn: 0.156,
      avgSharpe: 1.12,
      avgWinRate: 0.58,
      bestStock: { symbol: '600519', name: '\u8d35\u5dde\u8305\u53f0', totalReturn: 0.42 },
      worstStock: { symbol: '601166', name: '\u5174\u4e1a\u94f6\u884c', totalReturn: -0.08 },
    },
    rankings: [
      { rank: 1, symbol: '600519', name: '\u8d35\u5dde\u8305\u53f0', totalReturn: 0.42, sharpe: 1.85, winRate: 0.72, signals: 14 },
      { rank: 2, symbol: '000858', name: '\u4e94\u7cae\u6db2', totalReturn: 0.31, sharpe: 1.45, winRate: 0.65, signals: 12 },
      { rank: 3, symbol: '600036', name: '\u62db\u5546\u94f6\u884c', totalReturn: 0.18, sharpe: 1.2, winRate: 0.58, signals: 10 },
    ],
    signals: [
      { date: '2025-03-15', symbol: '600519', type: 'buy', price: 1680.0, returnPct: 0.042 },
      { date: '2025-04-02', symbol: '600519', type: 'sell', price: 1750.0, returnPct: 0.042 },
    ],
  },
  timestamp: Date.now(),
};

// ─── AI Advisor ─────────────────────────────────────────────────────────────

/** Mock SSE streaming response lines for AI advisor chat */
export const MOCK_ADVISOR_SSE_LINES = [
  'data: {"content":"\\u8fd9\\u662f\\u4e00\\u4e2a","done":false}',
  'data: {"content":"\\u5f88\\u597d\\u7684","done":false}',
  'data: {"content":"\\u7b56\\u7565\\u3002","done":false}',
  'data: {"content":"\\u5efa\\u8bae\\u6ce8\\u610f\\u98ce\\u9669\\u63a7\\u5236\\u3002","done":true}',
];

// ─── Strategy Discovery ─────────────────────────────────────────────────────

/** Mock popular strategies for discovery page */
export const MOCK_POPULAR_STRATEGIES = {
  success: true,
  data: [
    {
      id: 'pop-1',
      name: 'Dual Moving Average Crossover',
      description: 'Classic dual MA strategy using 5-day and 20-day moving averages.',
      sourceUrl: 'https://github.com/example/dual-ma',
      stars: 245,
      forks: 82,
      score: 87.5,
      indicators: ['MA', 'SMA'],
      language: 'Python',
      updatedAt: '2026-01-15',
    },
    {
      id: 'pop-2',
      name: 'RSI Reversal Strategy',
      description: 'Trades RSI oversold/overbought reversals with confirmation.',
      sourceUrl: 'https://github.com/example/rsi-reversal',
      stars: 189,
      forks: 56,
      score: 82.3,
      indicators: ['RSI'],
      language: 'Python',
      updatedAt: '2026-02-01',
    },
    {
      id: 'pop-3',
      name: 'MACD Histogram Divergence',
      description: 'Detects bullish/bearish divergence via MACD histogram.',
      sourceUrl: 'https://github.com/example/macd-div',
      stars: 312,
      forks: 95,
      score: 91.0,
      indicators: ['MACD'],
      language: 'Python',
      updatedAt: '2025-12-20',
    },
  ],
  timestamp: Date.now(),
};

/** Mock strategy detail for discovery page */
export const MOCK_STRATEGY_DETAIL = {
  success: true,
  data: {
    id: 'pop-1',
    name: 'Dual Moving Average Crossover',
    description: 'Classic dual MA strategy using 5-day and 20-day moving averages for trend following.',
    sourceUrl: 'https://github.com/example/dual-ma',
    stars: 245,
    forks: 82,
    score: 87.5,
    indicators: ['MA', 'SMA'],
    language: 'Python',
    updatedAt: '2026-01-15',
    convertedCode: MOCK_GENERATED_CODE,
    parameters: {
      fast_window: 5,
      slow_window: 20,
      fixed_size: 1,
    },
  },
  timestamp: Date.now(),
};

// ─── Error Responses ────────────────────────────────────────────────────────

/** Generic server error response */
export const MOCK_SERVER_ERROR = {
  success: false,
  error: 'Internal server error',
  details: 'Service temporarily unavailable',
};

/** Network error response (empty body, status 503) */
export const MOCK_NETWORK_ERROR_STATUS = 503;

/** Empty data response for empty state testing */
export const MOCK_EMPTY_RESPONSE = {
  success: true,
  data: [],
  timestamp: Date.now(),
};
