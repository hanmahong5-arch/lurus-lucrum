/**
 * API Configuration
 *
 * All API calls go through lucrum-web API Routes or lurus-api.
 * The mobile app never directly connects to databases.
 */

export const API_CONFIG = {
  // lucrum-web API base (Next.js API routes)
  LUCRUM_API_URL: "https://gushen.lurus.cn/api",

  // lurus-api (AI gateway)
  LURUS_API_URL: "https://api.lurus.cn",

  // lurus-platform public API (account, billing, wallet, subscription)
  PLATFORM_API_URL: "https://identity.lurus.cn/api/v1",

  // Zitadel OIDC
  ZITADEL_ISSUER: "https://auth.lurus.cn",
  ZITADEL_CLIENT_ID: "358400000000065537@lurus-api",

  // Timeouts (ms)
  REQUEST_TIMEOUT: 15_000,
  UPLOAD_TIMEOUT: 60_000,
  SSE_TIMEOUT: 120_000,

  // WebSocket
  WS_URL: "wss://gushen.lurus.cn/ws",
  WS_RECONNECT_INTERVAL: 3_000,
  WS_MAX_RECONNECT_ATTEMPTS: 10,
} as const;

/**
 * API endpoint paths (relative to LUCRUM_API_URL)
 */
export const ENDPOINTS = {
  // Auth
  AUTH_CALLBACK: "/auth/callback/zitadel",

  // Market Data
  STOCKS_LIST: "/stocks",
  STOCKS_KLINE: "/stocks/kline",
  DATA_FETCH: "/data/fetch",

  // Strategy
  STRATEGY_GENERATE: "/strategy/generate",
  STRATEGY_OPTIMIZE: "/strategy/optimize",
  STRATEGIES_POPULAR: "/strategies",

  // Backtest
  BACKTEST_UNIFIED: "/backtest/unified",
  BACKTEST_SECTOR: "/backtest/sector",
  BACKTEST_MULTI: "/backtest/multi-stocks/stream",

  // AI Advisor
  ADVISOR_CHAT: "/advisor/chat",
  ADVISOR_DEBATE: "/advisor/debate",

  // Agent
  AGENT_BACKTEST: "/agent/backtest",
  AGENT_SCANNER: "/agent/scanner",

  // History
  HISTORY_BACKTESTS: "/history/backtests",

} as const;
