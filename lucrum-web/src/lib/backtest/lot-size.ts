/**
 * Lot Size Rules for Different Asset Classes
 * 不同资产类别的手数规则
 *
 * This module implements standard lot size rules for various markets:
 * - A-shares: 100 shares per lot (买入必须是100的整数倍)
 * - ETF: 100 units per lot
 * - Convertible bonds: 10 units per lot
 * - Futures: Contract multiplier based
 * - Crypto: Fractional trading allowed
 *
 * @module lib/backtest/lot-size
 */

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Asset type for determining lot size rules
 */
export type AssetType =
  | "stock" // A股股票
  | "etf" // ETF基金
  | "bond" // 可转债
  | "futures" // 期货
  | "crypto" // 加密货币
  | "index"; // 指数

/**
 * Lot size configuration for different asset types
 */
export interface LotSizeConfig {
  lotSize: number; // Minimum trading unit (一手的数量)
  minLots: number; // Minimum lots per trade
  maxLots: number; // Maximum lots per trade (0 = unlimited)
  allowFractional: boolean; // Whether fractional shares are allowed
  description: string; // Description in Chinese
}

/**
 * Lot calculation result
 */
export interface LotCalculation {
  requestedQuantity: number; // Original calculated quantity
  lotSize: number; // Lot size used
  actualLots: number; // Number of lots
  actualQuantity: number; // Final quantity (lots * lotSize)
  roundingLoss: number; // Quantity lost due to rounding
  roundingLossPercent: number; // Percentage of rounding loss
}

// =============================================================================
// LOT SIZE CONFIGURATIONS / 手数配置
// =============================================================================

/**
 * Default lot size configurations for different asset types
 * A股市场规则：
 * - 股票：100股/手，买入必须是100的整数倍，卖出可以零股
 * - ETF：100份/手
 * - 可转债：10张/手
 */
export const LOT_SIZE_CONFIGS: Record<AssetType, LotSizeConfig> = {
  stock: {
    lotSize: 100,
    minLots: 1,
    maxLots: 0, // Unlimited
    allowFractional: false,
    description: "A股股票: 100股/手 (买入必须是100的整数倍)",
  },
  etf: {
    lotSize: 100,
    minLots: 1,
    maxLots: 0,
    allowFractional: false,
    description: "ETF基金: 100份/手",
  },
  bond: {
    lotSize: 10,
    minLots: 1,
    maxLots: 0,
    allowFractional: false,
    description: "可转债: 10张/手",
  },
  futures: {
    lotSize: 1, // Will be overridden by contract multiplier
    minLots: 1,
    maxLots: 0,
    allowFractional: false,
    description: "期货: 按合约乘数",
  },
  crypto: {
    lotSize: 0.001, // Minimum trading unit for most cryptos
    minLots: 1,
    maxLots: 0,
    allowFractional: true,
    description: "加密货币: 支持小数交易",
  },
  index: {
    lotSize: 1,
    minLots: 1,
    maxLots: 0,
    allowFractional: true,
    description: "指数: 理论交易单位",
  },
};

/**
 * Futures contract multipliers (常见期货合约乘数)
 */
export const FUTURES_MULTIPLIERS: Record<string, number> = {
  // Stock index futures (股指期货)
  IF: 300, // 沪深300股指期货
  IH: 300, // 上证50股指期货
  IC: 200, // 中证500股指期货
  IM: 200, // 中证1000股指期货

  // Commodity futures (商品期货)
  AU: 1000, // 黄金
  AG: 15, // 白银
  CU: 5, // 铜
  AL: 5, // 铝
  ZN: 5, // 锌
  RB: 10, // 螺纹钢
  HC: 10, // 热轧卷板

  // Agricultural futures (农产品期货)
  C: 10, // 玉米
  A: 10, // 豆一
  M: 10, // 豆粕
  Y: 10, // 豆油
  P: 10, // 棕榈油
  OI: 10, // 菜油
  CF: 5, // 棉花
  SR: 10, // 白糖

  // Energy futures (能源期货)
  SC: 1000, // 原油
  FU: 10, // 燃料油
  LU: 10, // 低硫燃料油
};

// =============================================================================
// LOT SIZE FUNCTIONS / 手数计算函数
// =============================================================================

/**
 * Detect asset type from symbol
 * 根据代码识别资产类型
 */
export function detectAssetType(symbol: string): AssetType {
  const cleanSymbol = symbol.toUpperCase().replace(/\s/g, "");

  // ETF patterns (ETF基金)
  if (
    cleanSymbol.startsWith("51") || // 上海 ETF (510xxx, 515xxx, etc.)
    cleanSymbol.startsWith("15") || // 深圳 ETF (159xxx)
    cleanSymbol.includes("ETF")
  ) {
    return "etf";
  }

  // Convertible bond patterns (可转债)
  if (
    cleanSymbol.startsWith("11") || // 上海可转债 (11xxxx)
    cleanSymbol.startsWith("12") || // 深圳可转债 (12xxxx)
    cleanSymbol.includes("转") ||
    cleanSymbol.includes("EB")
  ) {
    return "bond";
  }

  // Futures patterns (期货)
  const futuresPattern = /^[A-Z]{1,2}\d{3,4}$/;
  if (
    futuresPattern.test(cleanSymbol) ||
    Object.keys(FUTURES_MULTIPLIERS).some((f) => cleanSymbol.startsWith(f))
  ) {
    return "futures";
  }

  // Crypto patterns (加密货币)
  if (
    cleanSymbol.includes("BTC") ||
    cleanSymbol.includes("ETH") ||
    cleanSymbol.includes("USDT") ||
    cleanSymbol.endsWith("-USD") ||
    cleanSymbol.endsWith("-USDT")
  ) {
    return "crypto";
  }

  // Index patterns (指数)
  // NOTE: 000xxx are Shenzhen A-share STOCKS (not indices)!
  // 000001=平安银行, 000858=五粮液 etc. — these are stocks.
  // Shenzhen indices use 399xxx. Shanghai indices (000001=上证综指) are
  // distinguished by market context, not code prefix alone.
  if (
    cleanSymbol.startsWith("399") || // 深证指数
    cleanSymbol.startsWith("880") || // 行业板块指数
    cleanSymbol.startsWith("899") || // 概念板块指数
    cleanSymbol.includes("指数") ||
    cleanSymbol.includes("INDEX")
  ) {
    return "index";
  }

  // Default to stock (默认为股票)
  return "stock";
}

/**
 * Check if a stock symbol belongs to STAR Market (科创板)
 * 判断是否为科创板股票 (688xxx)
 */
export function isStarMarket(symbol: string): boolean {
  const clean = symbol.replace(/\D/g, "");
  return clean.startsWith("688");
}

/**
 * Get lot size configuration for a symbol
 * 获取代码的手数配置
 */
export function getLotSizeConfig(
  symbol: string,
  overrideAssetType?: AssetType,
): LotSizeConfig {
  const assetType = overrideAssetType ?? detectAssetType(symbol);
  const config = { ...LOT_SIZE_CONFIGS[assetType] };

  // STAR Market (科创板 688xxx): 200 shares per lot minimum
  if (assetType === "stock" && isStarMarket(symbol)) {
    config.lotSize = 200;
    config.description = "科创板股票: 200股/手 (买入必须是200的整数倍)";
  }

  // Special handling for futures - use contract multiplier
  if (assetType === "futures") {
    const prefix = symbol.replace(/\d/g, "").toUpperCase();
    const multiplier = FUTURES_MULTIPLIERS[prefix];
    if (multiplier) {
      config.lotSize = multiplier;
      config.description = `${prefix}期货: ${multiplier}合约乘数`;
    }
  }

  return config;
}

/**
 * Round quantity to valid lot size
 * 将数量取整到有效的手数
 *
 * @param quantity - Desired quantity (原始数量)
 * @param symbol - Trading symbol (交易代码)
 * @param direction - Trade direction, 'buy' rounds down, 'sell' can use odd lots (交易方向)
 * @returns Lot calculation result (手数计算结果)
 */
export function roundToLot(
  quantity: number,
  symbol: string,
  direction: "buy" | "sell" = "buy",
): LotCalculation {
  const config = getLotSizeConfig(symbol);

  // For fractional assets, return as-is with minimum lot check
  if (config.allowFractional) {
    const minQuantity = config.lotSize * config.minLots;
    const actualQuantity = Math.max(quantity, minQuantity);
    return {
      requestedQuantity: quantity,
      lotSize: config.lotSize,
      actualLots: actualQuantity / config.lotSize,
      actualQuantity,
      roundingLoss: 0,
      roundingLossPercent: 0,
    };
  }

  // For buying, must be multiples of lot size
  // For selling, A-shares allow odd lot selling (零股卖出)
  let actualLots: number;
  if (direction === "buy") {
    actualLots = Math.floor(quantity / config.lotSize);
  } else {
    // For selling, we can sell any quantity we hold
    // But for simplicity in backtesting, we also round to lots
    actualLots = Math.floor(quantity / config.lotSize);
  }

  // Enforce minimum lots
  actualLots = Math.max(actualLots, 0);
  if (actualLots > 0 && actualLots < config.minLots) {
    actualLots = config.minLots;
  }

  // Enforce maximum lots
  if (config.maxLots > 0 && actualLots > config.maxLots) {
    actualLots = config.maxLots;
  }

  const actualQuantity = actualLots * config.lotSize;
  const roundingLoss = quantity - actualQuantity;
  const roundingLossPercent = quantity > 0 ? (roundingLoss / quantity) * 100 : 0;

  return {
    requestedQuantity: quantity,
    lotSize: config.lotSize,
    actualLots,
    actualQuantity,
    roundingLoss,
    roundingLossPercent,
  };
}

/**
 * Calculate maximum lots affordable with given cash
 * 计算给定资金能买的最大手数
 *
 * @param cash - Available cash (可用资金)
 * @param price - Current price per share (每股价格)
 * @param symbol - Trading symbol (交易代码)
 * @param commission - Commission rate (手续费率)
 * @returns Maximum affordable lots and quantity
 */
export function calculateMaxAffordableLots(
  cash: number,
  price: number,
  symbol: string,
  commission: number = 0.0003,
): LotCalculation {
  const config = getLotSizeConfig(symbol);

  // Calculate maximum quantity considering commission
  // cash = quantity * price * (1 + commission)
  // quantity = cash / (price * (1 + commission))
  const maxQuantity = cash / (price * (1 + commission));

  return roundToLot(maxQuantity, symbol, "buy");
}

/**
 * Validate if a quantity is valid for trading
 * 验证交易数量是否有效
 */
export function validateQuantity(
  quantity: number,
  symbol: string,
  direction: "buy" | "sell",
): { valid: boolean; message: string } {
  const config = getLotSizeConfig(symbol);

  if (quantity <= 0) {
    return { valid: false, message: "数量必须大于0" };
  }

  if (!config.allowFractional) {
    // Check if it's a multiple of lot size for buying
    if (direction === "buy") {
      if (quantity % config.lotSize !== 0) {
        return {
          valid: false,
          message: `买入数量必须是${config.lotSize}的整数倍 (${config.description})`,
        };
      }
    }

    // Check minimum lots
    const lots = quantity / config.lotSize;
    if (lots < config.minLots) {
      return {
        valid: false,
        message: `最少${config.minLots}手，即${config.minLots * config.lotSize}${getUnit(symbol)}`,
      };
    }
  }

  return { valid: true, message: "有效" };
}

/**
 * Get unit name for asset type
 * 获取资产类型的单位名称
 */
function getUnit(symbol: string): string {
  const assetType = detectAssetType(symbol);
  switch (assetType) {
    case "stock":
      return "股";
    case "etf":
      return "份";
    case "bond":
      return "张";
    case "futures":
      return "手";
    case "crypto":
      return "枚";
    default:
      return "单位";
  }
}

/**
 * Format quantity with both lots and shares for display.
 * For A-shares: "12手 (1,200股)"
 * For fractional assets: "0.0500枚"
 */
export function formatQuantityWithUnit(
  quantity: number,
  symbol: string,
): string {
  const config = getLotSizeConfig(symbol);
  const unit = getUnit(symbol);
  const lots = quantity / config.lotSize;

  if (config.allowFractional) {
    return `${quantity.toFixed(4)}${unit}`;
  }

  if (lots === Math.floor(lots) && lots > 0) {
    const formattedShares = quantity.toLocaleString("zh-CN");
    return `${lots}手 (${formattedShares}${unit})`;
  }

  return `${quantity.toLocaleString("zh-CN")}${unit}`;
}
