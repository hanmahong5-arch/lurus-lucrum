import { describe, it, expect } from 'vitest';
import {
  detectAssetType,
  getLotSizeConfig,
  roundToLot,
  calculateMaxAffordableLots,
  validateQuantity,
  formatQuantityWithUnit,
  LOT_SIZE_CONFIGS,
  FUTURES_MULTIPLIERS,
} from '../lot-size';

describe('detectAssetType', () => {
  it('should detect Shanghai stock (600xxx)', () => {
    expect(detectAssetType('600519')).toBe('stock');
  });

  it('should detect Shenzhen stock (002xxx)', () => {
    expect(detectAssetType('002594')).toBe('stock');
  });

  it('should detect index for symbols starting with 000', () => {
    // IMPORTANT: 000001 is an index (上证指数), not a stock
    expect(detectAssetType('000001')).toBe('index');
  });

  it('should detect ETF starting with 51', () => {
    expect(detectAssetType('510050')).toBe('etf');
  });

  it('should detect ETF starting with 15', () => {
    expect(detectAssetType('159915')).toBe('etf');
  });

  it('should detect ETF containing ETF in name', () => {
    expect(detectAssetType('ETF300')).toBe('etf');
  });

  it('should detect bond starting with 11', () => {
    expect(detectAssetType('110059')).toBe('bond');
  });

  it('should detect bond starting with 12 (convertible bond)', () => {
    expect(detectAssetType('123456')).toBe('bond');
  });

  it('should detect bond containing 转', () => {
    expect(detectAssetType('可转债')).toBe('bond');
  });

  it('should detect bond containing EB', () => {
    expect(detectAssetType('EB123456')).toBe('bond');
  });

  it('should detect futures with pattern (IF2401)', () => {
    expect(detectAssetType('IF2401')).toBe('futures');
  });

  it('should detect futures with pattern (AU2312)', () => {
    expect(detectAssetType('AU2312')).toBe('futures');
  });

  it('should detect crypto containing BTC', () => {
    expect(detectAssetType('BTC-USDT')).toBe('crypto');
  });

  it('should detect crypto containing ETH', () => {
    expect(detectAssetType('ETH-USD')).toBe('crypto');
  });

  it('should detect crypto ending with -USDT', () => {
    expect(detectAssetType('DOGE-USDT')).toBe('crypto');
  });

  it('should detect index starting with 399', () => {
    expect(detectAssetType('399001')).toBe('index');
  });

  it('should detect index containing 指数', () => {
    expect(detectAssetType('沪深300指数')).toBe('index');
  });

  it('should detect index containing INDEX', () => {
    expect(detectAssetType('SP500INDEX')).toBe('index');
  });

  it('should default to stock for unknown pattern', () => {
    expect(detectAssetType('UNKNOWN123')).toBe('stock');
  });
});

describe('getLotSizeConfig', () => {
  it('should return stock config with lotSize 100', () => {
    const config = getLotSizeConfig('600519');
    expect(config.lotSize).toBe(100);
    expect(config.allowFractional).toBe(false);
  });

  it('should return ETF config with lotSize 100', () => {
    const config = getLotSizeConfig('510050');
    expect(config.lotSize).toBe(100);
    expect(config.allowFractional).toBe(false);
  });

  it('should return bond config with lotSize 10', () => {
    const config = getLotSizeConfig('110059');
    expect(config.lotSize).toBe(10);
    expect(config.allowFractional).toBe(false);
  });

  it('should return futures config with multiplier for IF', () => {
    const config = getLotSizeConfig('IF2401');
    expect(config.lotSize).toBe(300); // IF multiplier is 300
    expect(config.allowFractional).toBe(false);
  });

  it('should return futures config with default lotSize 1 for unknown futures', () => {
    const config = getLotSizeConfig('XX2401');
    expect(config.lotSize).toBe(1);
    expect(config.allowFractional).toBe(false);
  });

  it('should return crypto config with fractional support', () => {
    const config = getLotSizeConfig('BTC-USDT');
    expect(config.lotSize).toBe(0.001);
    expect(config.allowFractional).toBe(true);
  });

  it('should allow override asset type', () => {
    const config = getLotSizeConfig('600519', 'crypto');
    expect(config.lotSize).toBe(0.001);
    expect(config.allowFractional).toBe(true);
  });

  it('should return index config', () => {
    const config = getLotSizeConfig('000001');
    expect(config.lotSize).toBe(1);
    expect(config.allowFractional).toBe(true);
  });
});

describe('roundToLot', () => {
  it('should round down 250 shares of stock to 2 lots (200 shares)', () => {
    const result = roundToLot(250, '600519', 'buy');
    expect(result.actualLots).toBe(2);
    expect(result.actualQuantity).toBe(200);
    expect(result.roundingLoss).toBe(50);
    expect(result.roundingLossPercent).toBeCloseTo(20, 1);
  });

  it('should round 99 shares to 0 lots (0 shares)', () => {
    const result = roundToLot(99, '600519', 'buy');
    expect(result.actualLots).toBe(0);
    expect(result.actualQuantity).toBe(0);
    expect(result.roundingLoss).toBe(99);
  });

  it('should handle exact lot quantities', () => {
    const result = roundToLot(300, '600519', 'buy');
    expect(result.actualLots).toBe(3);
    expect(result.actualQuantity).toBe(300);
    expect(result.roundingLoss).toBe(0);
    expect(result.roundingLossPercent).toBe(0);
  });

  it('should handle fractional crypto as-is', () => {
    const result = roundToLot(0.12345, 'BTC-USDT', 'buy');
    expect(result.actualQuantity).toBe(0.12345);
    expect(result.roundingLoss).toBe(0);
  });

  it('should enforce minLots for crypto if quantity is positive but below minimum', () => {
    const result = roundToLot(0.0001, 'BTC-USDT', 'buy');
    // Should enforce minLots (typically 0.001 for crypto)
    expect(result.actualQuantity).toBeGreaterThanOrEqual(0.001);
  });

  it('should handle large quantities', () => {
    const result = roundToLot(123456, '600519', 'buy');
    expect(result.actualLots).toBe(1234);
    expect(result.actualQuantity).toBe(123400);
    expect(result.roundingLoss).toBe(56);
  });

  it('should handle zero quantity', () => {
    const result = roundToLot(0, '600519', 'buy');
    expect(result.actualLots).toBe(0);
    expect(result.actualQuantity).toBe(0);
    expect(result.roundingLoss).toBe(0);
  });

  it('should handle ETF with lotSize 100', () => {
    const result = roundToLot(350, '510050', 'buy');
    expect(result.actualLots).toBe(3);
    expect(result.actualQuantity).toBe(300);
    expect(result.roundingLoss).toBe(50);
  });

  it('should handle bond with lotSize 10', () => {
    const result = roundToLot(45, '110059', 'buy');
    expect(result.actualLots).toBe(4);
    expect(result.actualQuantity).toBe(40);
    expect(result.roundingLoss).toBe(5);
  });

  it('should handle sell direction the same way', () => {
    const result = roundToLot(250, '600519', 'sell');
    expect(result.actualLots).toBe(2);
    expect(result.actualQuantity).toBe(200);
  });
});

describe('calculateMaxAffordableLots', () => {
  it('should calculate max affordable lots with 100000 cash at price 10', () => {
    const result = calculateMaxAffordableLots(100000, 10, '600519', 0.0003);
    // maxQuantity = 100000 / (10 * 1.0003) ≈ 9997
    // Round down to lots: 99 lots = 9900 shares
    expect(result.actualLots).toBe(99);
    expect(result.actualQuantity).toBe(9900);
  });

  it('should return 0 lots when cannot afford even 1 lot', () => {
    const result = calculateMaxAffordableLots(50, 100, '600519', 0.0003);
    // maxQuantity = 50 / (100 * 1.0003) ≈ 0.499
    // Cannot afford 1 lot (100 shares)
    expect(result.actualLots).toBe(0);
    expect(result.actualQuantity).toBe(0);
  });

  it('should handle zero commission', () => {
    const result = calculateMaxAffordableLots(10000, 10, '600519', 0);
    // maxQuantity = 10000 / 10 = 1000
    // 10 lots = 1000 shares
    expect(result.actualLots).toBe(10);
    expect(result.actualQuantity).toBe(1000);
  });

  it('should handle high commission rates', () => {
    const result = calculateMaxAffordableLots(10000, 10, '600519', 0.01); // 1% commission
    // maxQuantity = 10000 / (10 * 1.01) ≈ 990.099
    // 9 lots = 900 shares
    expect(result.actualLots).toBe(9);
    expect(result.actualQuantity).toBe(900);
  });

  it('should work with ETF', () => {
    const result = calculateMaxAffordableLots(5000, 5, '510050', 0.0003);
    // maxQuantity = 5000 / (5 * 1.0003) ≈ 999.4
    // 9 lots = 900 shares (ETF lotSize is 100)
    expect(result.actualLots).toBe(9);
    expect(result.actualQuantity).toBe(900);
  });

  it('should work with crypto (fractional)', () => {
    const result = calculateMaxAffordableLots(1000, 50000, 'BTC-USDT', 0.001);
    // maxQuantity = 1000 / (50000 * 1.001) ≈ 0.01998
    // Crypto allows fractional, so should return close to this
    expect(result.actualQuantity).toBeCloseTo(0.01998, 4);
  });
});

describe('validateQuantity', () => {
  it('should validate correct lot quantity for stock buy', () => {
    const result = validateQuantity(100, '600519', 'buy');
    expect(result.valid).toBe(true);
  });

  it('should invalidate non-multiple lot quantity for stock buy', () => {
    const result = validateQuantity(150, '600519', 'buy');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('100');
  });

  it('should invalidate zero quantity', () => {
    const result = validateQuantity(0, '600519', 'buy');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('0');
  });

  it('should invalidate negative quantity', () => {
    const result = validateQuantity(-100, '600519', 'buy');
    expect(result.valid).toBe(false);
  });

  it('should validate sell with same rounding rules', () => {
    const result = validateQuantity(200, '600519', 'sell');
    expect(result.valid).toBe(true);
  });

  it('should allow sell with non-multiple lot size (A-share odd lot sell)', () => {
    // Sell direction does not enforce lot multiples in this implementation
    const result = validateQuantity(150, '600519', 'sell');
    expect(result.valid).toBe(true);
  });

  it('should validate fractional crypto quantities', () => {
    const result = validateQuantity(0.12345, 'BTC-USDT', 'buy');
    expect(result.valid).toBe(true);
  });

  it('should allow any positive crypto quantity (fractional)', () => {
    // With allowFractional: true, any positive quantity is valid
    const result = validateQuantity(0.0001, 'BTC-USDT', 'buy');
    expect(result.valid).toBe(true);
  });

  it('should validate bond with lotSize 10', () => {
    const result = validateQuantity(30, '110059', 'buy');
    expect(result.valid).toBe(true);
  });

  it('should invalidate bond with incorrect lot size', () => {
    const result = validateQuantity(35, '110059', 'buy');
    expect(result.valid).toBe(false);
  });
});

describe('formatQuantityWithUnit', () => {
  it('should format stock quantity with lots', () => {
    const formatted = formatQuantityWithUnit(1000, '600519');
    expect(formatted).toBe('1000股 (10手)');
  });

  it('should format single lot of stock', () => {
    const formatted = formatQuantityWithUnit(100, '600519');
    expect(formatted).toBe('100股 (1手)');
  });

  it('should format ETF quantity with lots', () => {
    const formatted = formatQuantityWithUnit(100, '510050');
    expect(formatted).toBe('100份 (1手)');
  });

  it('should format multiple lots of ETF', () => {
    const formatted = formatQuantityWithUnit(500, '510050');
    expect(formatted).toBe('500份 (5手)');
  });

  it('should format crypto with fractional display', () => {
    const formatted = formatQuantityWithUnit(0.001, 'BTC-USDT');
    expect(formatted).toContain('0.0010');
    expect(formatted).toContain('枚');
  });

  it('should format larger crypto quantity', () => {
    const formatted = formatQuantityWithUnit(1.23456, 'BTC-USDT');
    expect(formatted).toContain('1.2346');
    expect(formatted).toContain('枚');
  });

  it('should format bond quantity', () => {
    const formatted = formatQuantityWithUnit(30, '110059');
    expect(formatted).toContain('30');
    expect(formatted).toContain('3手');
  });

  it('should format futures quantity', () => {
    const formatted = formatQuantityWithUnit(2, 'IF2401');
    expect(formatted).toContain('2');
    expect(formatted).toContain('手');
  });

  it('should handle zero quantity', () => {
    const formatted = formatQuantityWithUnit(0, '600519');
    expect(formatted).toBe('0股 (0手)');
  });
});

describe('LOT_SIZE_CONFIGS and FUTURES_MULTIPLIERS', () => {
  it('should have stock config defined', () => {
    expect(LOT_SIZE_CONFIGS.stock).toBeDefined();
    expect(LOT_SIZE_CONFIGS.stock.lotSize).toBe(100);
  });

  it('should have ETF config defined', () => {
    expect(LOT_SIZE_CONFIGS.etf).toBeDefined();
    expect(LOT_SIZE_CONFIGS.etf.lotSize).toBe(100);
  });

  it('should have bond config defined', () => {
    expect(LOT_SIZE_CONFIGS.bond).toBeDefined();
    expect(LOT_SIZE_CONFIGS.bond.lotSize).toBe(10);
  });

  it('should have crypto config with fractional support', () => {
    expect(LOT_SIZE_CONFIGS.crypto).toBeDefined();
    expect(LOT_SIZE_CONFIGS.crypto.allowFractional).toBe(true);
  });

  it('should have futures multipliers for common contracts', () => {
    expect(FUTURES_MULTIPLIERS.IF).toBe(300); // CSI 300 index futures
    expect(FUTURES_MULTIPLIERS.IC).toBeDefined();
    expect(FUTURES_MULTIPLIERS.IH).toBeDefined();
  });
});
