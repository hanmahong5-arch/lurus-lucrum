/**
 * Type Definitions Index
 *
 * Centralized export for all type definitions
 * Import from '@/lib/types' for clean access
 *
 * @module lib/types
 */

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================

export {
  // Branded types
  type UserId,
  type SessionId,
  type Email,
  type PlanId,

  // Zod schemas
  emailSchema,
  userIdSchema,
  sessionIdSchema,
  passwordSchema,
  planIdSchema,
  userProfileSchema,
  subscriptionQuotasSchema,
  subscriptionStatusSchema,
  userSubscriptionSchema,
  userMetadataSchema,
  userSchema,
  deviceInfoSchema,
  sessionSchema,
  loginRequestSchema,
  registerRequestSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,

  // Inferred types
  type UserProfile,
  type SubscriptionQuotas,
  type SubscriptionStatus,
  type UserSubscription,
  type UserMetadata,
  type User,
  type DeviceInfo,
  type Session,
  type LoginRequest,
  type RegisterRequest,
  type PasswordResetRequest,
  type PasswordResetConfirm,

  // Configuration
  type SubscriptionPlanConfig,
  SUBSCRIPTION_PLANS,

  // Utility functions
  hasQuota,
  getRemainingQuota,
  isSubscriptionActive,
  getPlanConfig,
  createDefaultSubscription,

  // Type guards
  isPlanId,
  isSubscriptionStatus,
} from './auth';

// =============================================================================
// MARKET DATA TYPES
// =============================================================================

export {
  // Branded types
  type StockSymbol,
  type Price,
  type Volume,
  type Percentage,
  type Timestamp,

  // Zod schemas
  stockSymbolSchema,
  aShareSymbolSchema,
  priceSchema,
  positivePriceSchema,
  volumeSchema,
  percentageSchema,
  dailyChangePercentSchema,
  timestampSchema,
  stockQuoteSchema,
  klineSchema,
  klinePeriodSchema,
  marketIndexSchema,
  fundFlowSchema,
  priceUpdateEventSchema,
  klineUpdateEventSchema,
  marketEventSchema,
  movingAverageSchema,
  macdSchema,
  rsiSchema,
  bollingerBandsSchema,
  watchlistItemSchema,
  portfolioPositionSchema,
  dataSourceStatusSchema,
  dataSourceConfigSchema,

  // Inferred types
  type StockQuote,
  type Kline,
  type KlinePeriod,
  type MarketIndex,
  type FundFlow,
  type PriceUpdateEvent,
  type KlineUpdateEvent,
  type MarketEvent,
  type MovingAverage,
  type MACD,
  type RSI,
  type BollingerBands,
  type WatchlistItem,
  type PortfolioPosition,
  type DataSourceStatus,
  type DataSourceConfig,

  // Utility functions
  parseStockQuote,
  parseKlineArray,
  calculateChange,
  formatPrice,
  formatPercentage,
  formatLargeNumber,
  isMarketOpen,
} from './market';
