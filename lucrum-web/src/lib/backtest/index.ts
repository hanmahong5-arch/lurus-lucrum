/**
 * Backtest Module Exports
 * 回测模块导出
 *
 * @module lib/backtest
 */

// Core engine
export { runBacktest, parseStrategyCode, generateBacktestData } from "./engine";

// Lot size utilities
export {
  roundToLot,
  calculateMaxAffordableLots,
  getLotSizeConfig,
  detectAssetType,
  validateQuantity,
  formatQuantityWithUnit,
  LOT_SIZE_CONFIGS,
  FUTURES_MULTIPLIERS,
} from "./lot-size";

// Types
export type {
  // Basic types
  BacktestKline,
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  ParsedStrategy,
  EquityPoint,
  StrategySignal,
  // Enhanced types
  DetailedTrade,
  BacktestDailyLog,
  EnhancedBacktestResult,
  BacktestSummary,
} from "./types";

export type { AssetType, LotSizeConfig, LotCalculation } from "./lot-size";
