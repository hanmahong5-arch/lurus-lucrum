/**
 * Tests for lib/strategy/parameter-parser.ts
 *
 * Covers parameter extraction, validation, code update, and cross-parameter rules
 */
import { describe, it, expect } from 'vitest';
import {
  parseStrategyParameters,
  updateStrategyCode,
  updateParameterInCode,
  validateParameter,
  validateAllParameters,
  validateCrossParameterRules,
  getApplicableCrossRules,
  getCategoryDisplayName,
  groupParametersByCategory,
  type StrategyParameter,
} from '../parameter-parser';

// =============================================================================
// Sample Strategy Code for Testing
// =============================================================================

const SAMPLE_STRATEGY_CODE = `
class MaCrossStrategy:
    """Double Moving Average Crossover Strategy"""

    fast_window = 5
    slow_window = 20
    rsi_window = 14
    rsi_buy = 30
    rsi_sell = 70
    stop_loss = 5.0
    take_profit = 10.0
    fixed_size = 100

    def on_bar(self, bar):
        # golden cross check
        if fast > slow:
            self.buy()
`;

const MACD_STRATEGY_CODE = `
class MacdStrategy:
    """MACD Strategy"""

    macd_fast = 12
    macd_slow = 26
    macd_signal = 9

    def on_bar(self, bar):
        if macd > 0:
            self.buy()
`;

const BOLL_STRATEGY_CODE = `
class BollStrategy:
    boll_window = 20
    boll_dev = 2.0

    def on_bar(self, bar):
        if close < lower:
            self.buy()
        if close > upper:
            self.sell()
`;

describe('parseStrategyParameters', () => {
  it('should extract strategy name from class definition', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    expect(result.name).toBe('MaCrossStrategy');
  });

  it('should extract description from docstring', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    expect(result.description).toBe('Double Moving Average Crossover Strategy');
  });

  it('should extract numeric parameters', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    const fastWindow = result.parameters.find(p => p.name === 'fast_window');
    expect(fastWindow).toBeDefined();
    expect(fastWindow!.value).toBe(5);
    expect(fastWindow!.type).toBe('number');
  });

  it('should extract float parameters', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    const stopLoss = result.parameters.find(p => p.name === 'stop_loss');
    expect(stopLoss).toBeDefined();
    expect(stopLoss!.value).toBe(5.0);
  });

  it('should assign known parameter metadata', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    const fastWindow = result.parameters.find(p => p.name === 'fast_window');
    expect(fastWindow!.displayName).toBe('\u5FEB\u7EBF\u5468\u671F'); // "Fast period" in Chinese
    expect(fastWindow!.category).toBe('indicator');
    expect(fastWindow!.range).toEqual({ min: 1, max: 250, step: 1 });
  });

  it('should extract multiple parameters in correct categories', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    const categories = result.parameters.map(p => p.category);
    expect(categories).toContain('indicator');
    expect(categories).toContain('signal');
    expect(categories).toContain('risk');
    expect(categories).toContain('position');
  });

  it('should detect SMA indicator when code mentions sma or ma_window', () => {
    const smaCode = `
class SmaStrategy:
    """SMA Strategy"""
    ma_window = 20

    def on_bar(self):
        sma = self.get_sma()
    `;
    const result = parseStrategyParameters(smaCode);
    const sma = result.indicators.find(i => i.type === 'SMA');
    expect(sma).toBeDefined();
  });

  it('should detect RSI indicator', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    const rsi = result.indicators.find(i => i.type === 'RSI');
    expect(rsi).toBeDefined();
  });

  it('should detect MACD indicator', () => {
    const result = parseStrategyParameters(MACD_STRATEGY_CODE);
    const macd = result.indicators.find(i => i.type === 'MACD');
    expect(macd).toBeDefined();
    expect(macd!.params.fast).toBe(12);
    expect(macd!.params.slow).toBe(26);
    expect(macd!.params.signal).toBe(9);
  });

  it('should detect Bollinger Bands indicator', () => {
    const result = parseStrategyParameters(BOLL_STRATEGY_CODE);
    const boll = result.indicators.find(i => i.type === 'BOLL');
    expect(boll).toBeDefined();
  });

  it('should extract entry conditions', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    expect(result.entryConditions.length).toBeGreaterThan(0);
    expect(result.entryConditions).toContain('MA Golden Cross (\u5747\u7EBF\u91D1\u53C9)');
  });

  it('should extract exit conditions', () => {
    const code = `class S:
    stop_loss = 5
    def on_bar(self):
        if stop_loss:
            self.sell()
    `;
    const result = parseStrategyParameters(code);
    expect(result.exitConditions).toContain('Stop Loss (\u6B62\u635F)');
  });

  it('should extract risk rules', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    expect(result.riskRules).toContain('Stop Loss (\u6B62\u635F)');
    expect(result.riskRules).toContain('Take Profit (\u6B62\u76C8)');
  });

  it('should return invalid for empty code', () => {
    const result = parseStrategyParameters('');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should return invalid for whitespace-only code', () => {
    const result = parseStrategyParameters('   \n  \t  ');
    expect(result.isValid).toBe(false);
  });

  it('should skip reserved words', () => {
    const code = `
class S:
    result = 10
    data = 20
    fast_window = 5
    `;
    const result = parseStrategyParameters(code);
    const names = result.parameters.map(p => p.name);
    expect(names).not.toContain('result');
    expect(names).not.toContain('data');
    expect(names).toContain('fast_window');
  });

  it('should skip self-prefixed lines', () => {
    const code = `
class S:
    fast_window = 5
    self.pos = 0
    `;
    const result = parseStrategyParameters(code);
    const names = result.parameters.map(p => p.name);
    expect(names).not.toContain('pos');
  });

  it('should sort parameters by category order', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    const categoryOrder = { indicator: 0, signal: 1, position: 2, risk: 3, general: 4 };
    for (let i = 1; i < result.parameters.length; i++) {
      const prev = categoryOrder[result.parameters[i - 1]!.category];
      const curr = categoryOrder[result.parameters[i]!.category];
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});

describe('validateParameter', () => {
  it('should pass for value within range', () => {
    const param: StrategyParameter = {
      name: 'fast_window',
      displayName: 'Fast Window',
      type: 'number',
      value: 10,
      defaultValue: 5,
      description: 'test',
      category: 'indicator',
      range: { min: 1, max: 250 },
    };
    expect(validateParameter(param).isValid).toBe(true);
  });

  it('should fail for value below min', () => {
    const param: StrategyParameter = {
      name: 'fast_window',
      displayName: 'Fast Window',
      type: 'number',
      value: 0,
      defaultValue: 5,
      description: 'test',
      category: 'indicator',
      range: { min: 1, max: 250 },
    };
    const result = validateParameter(param);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('>= 1');
  });

  it('should fail for value above max', () => {
    const param: StrategyParameter = {
      name: 'fast_window',
      displayName: 'Fast Window',
      type: 'number',
      value: 300,
      defaultValue: 5,
      description: 'test',
      category: 'indicator',
      range: { min: 1, max: 250 },
    };
    const result = validateParameter(param);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('<= 250');
  });

  it('should pass for non-numeric types without range', () => {
    const param: StrategyParameter = {
      name: 'use_trailing',
      displayName: 'Use Trailing',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'test',
      category: 'risk',
    };
    expect(validateParameter(param).isValid).toBe(true);
  });

  it('should pass for number without range', () => {
    const param: StrategyParameter = {
      name: 'custom',
      displayName: 'Custom',
      type: 'number',
      value: 9999,
      defaultValue: 0,
      description: 'test',
      category: 'general',
    };
    expect(validateParameter(param).isValid).toBe(true);
  });
});

describe('validateAllParameters', () => {
  it('should pass when all parameters are valid', () => {
    const params: StrategyParameter[] = [
      {
        name: 'fast_window',
        displayName: 'Fast',
        type: 'number',
        value: 5,
        defaultValue: 5,
        description: '',
        category: 'indicator',
        range: { min: 1, max: 250 },
      },
    ];
    const result = validateAllParameters(params);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should fail and collect errors for invalid parameters', () => {
    const params: StrategyParameter[] = [
      {
        name: 'fast_window',
        displayName: 'Fast',
        type: 'number',
        value: 0,
        defaultValue: 5,
        description: '',
        category: 'indicator',
        range: { min: 1, max: 250 },
      },
      {
        name: 'slow_window',
        displayName: 'Slow',
        type: 'number',
        value: 300,
        defaultValue: 20,
        description: '',
        category: 'indicator',
        range: { min: 1, max: 250 },
      },
    ];
    const result = validateAllParameters(params);
    expect(result.isValid).toBe(false);
    expect(result.errors['fast_window']).toBeDefined();
    expect(result.errors['slow_window']).toBeDefined();
  });
});

describe('updateStrategyCode', () => {
  it('should update numeric parameter in code', () => {
    const updated = updateParameterInCode(SAMPLE_STRATEGY_CODE, 'fast_window', 10);
    expect(updated).toContain('fast_window = 10');
    expect(updated).not.toContain('fast_window = 5');
  });

  it('should update float parameter in code', () => {
    const updated = updateParameterInCode(SAMPLE_STRATEGY_CODE, 'stop_loss', 3.5);
    expect(updated).toContain('stop_loss = 3.5');
  });

  it('should preserve code structure', () => {
    const updated = updateParameterInCode(SAMPLE_STRATEGY_CODE, 'fast_window', 10);
    expect(updated).toContain('class MaCrossStrategy');
    expect(updated).toContain('def on_bar');
  });

  it('should not modify unrelated parameters', () => {
    const updated = updateParameterInCode(SAMPLE_STRATEGY_CODE, 'fast_window', 10);
    expect(updated).toContain('slow_window = 20');
    expect(updated).toContain('rsi_window = 14');
  });
});

describe('validateCrossParameterRules', () => {
  it('should pass when fast < slow window', () => {
    const params: StrategyParameter[] = [
      { name: 'fast_window', displayName: '', type: 'number', value: 5, defaultValue: 5, description: '', category: 'indicator' },
      { name: 'slow_window', displayName: '', type: 'number', value: 20, defaultValue: 20, description: '', category: 'indicator' },
    ];
    const result = validateCrossParameterRules(params);
    expect(result.isValid).toBe(true);
  });

  it('should fail when fast >= slow window', () => {
    const params: StrategyParameter[] = [
      { name: 'fast_window', displayName: '', type: 'number', value: 30, defaultValue: 5, description: '', category: 'indicator' },
      { name: 'slow_window', displayName: '', type: 'number', value: 20, defaultValue: 20, description: '', category: 'indicator' },
    ];
    const result = validateCrossParameterRules(params);
    expect(result.isValid).toBe(false);
    expect(result.warnings.some(w => w.rule === 'ma_window_order')).toBe(true);
  });

  it('should warn when take_profit < 1.5x stop_loss', () => {
    const params: StrategyParameter[] = [
      { name: 'stop_loss', displayName: '', type: 'number', value: 5, defaultValue: 5, description: '', category: 'risk' },
      { name: 'take_profit', displayName: '', type: 'number', value: 6, defaultValue: 10, description: '', category: 'risk' },
    ];
    const result = validateCrossParameterRules(params);
    // This is a warning, not blocking (isValid remains true)
    expect(result.warnings.some(w => w.rule === 'stop_take_profit_ratio')).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('should pass when take_profit >= 1.5x stop_loss', () => {
    const params: StrategyParameter[] = [
      { name: 'stop_loss', displayName: '', type: 'number', value: 5, defaultValue: 5, description: '', category: 'risk' },
      { name: 'take_profit', displayName: '', type: 'number', value: 10, defaultValue: 10, description: '', category: 'risk' },
    ];
    const result = validateCrossParameterRules(params);
    expect(result.warnings.some(w => w.rule === 'stop_take_profit_ratio')).toBe(false);
  });

  it('should validate RSI thresholds', () => {
    const params: StrategyParameter[] = [
      { name: 'rsi_buy', displayName: '', type: 'number', value: 70, defaultValue: 30, description: '', category: 'signal' },
      { name: 'rsi_sell', displayName: '', type: 'number', value: 30, defaultValue: 70, description: '', category: 'signal' },
    ];
    const result = validateCrossParameterRules(params);
    expect(result.isValid).toBe(false);
    expect(result.warnings.some(w => w.rule === 'rsi_threshold_order')).toBe(true);
  });

  it('should skip rules when affected params are not present', () => {
    const params: StrategyParameter[] = [
      { name: 'boll_window', displayName: '', type: 'number', value: 20, defaultValue: 20, description: '', category: 'indicator' },
    ];
    const result = validateCrossParameterRules(params);
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBe(0);
  });
});

describe('getApplicableCrossRules', () => {
  it('should return rules for MA window parameters', () => {
    const rules = getApplicableCrossRules(['fast_window', 'slow_window']);
    expect(rules.some(r => r.name === 'ma_window_order')).toBe(true);
  });

  it('should return empty for parameters with no rules', () => {
    const rules = getApplicableCrossRules(['boll_window']);
    expect(rules.length).toBe(0);
  });
});

describe('getCategoryDisplayName', () => {
  it('should return display name for each category', () => {
    expect(getCategoryDisplayName('indicator')).toContain('Indicator');
    expect(getCategoryDisplayName('signal')).toContain('Signal');
    expect(getCategoryDisplayName('position')).toContain('Position');
    expect(getCategoryDisplayName('risk')).toContain('Risk');
    expect(getCategoryDisplayName('general')).toContain('General');
  });
});

describe('groupParametersByCategory', () => {
  it('should group parameters by category', () => {
    const result = parseStrategyParameters(SAMPLE_STRATEGY_CODE);
    const groups = groupParametersByCategory(result.parameters);
    expect(groups.indicator.length).toBeGreaterThan(0);
    expect(groups.signal.length).toBeGreaterThan(0);
    expect(groups.risk.length).toBeGreaterThan(0);
  });

  it('should return empty arrays for unused categories', () => {
    const groups = groupParametersByCategory([]);
    expect(groups.indicator).toHaveLength(0);
    expect(groups.signal).toHaveLength(0);
    expect(groups.position).toHaveLength(0);
    expect(groups.risk).toHaveLength(0);
    expect(groups.general).toHaveLength(0);
  });
});
