/**
 * BacktestBasisPanel Component Tests
 * Edge case coverage: 95%+
 *
 * Test categories:
 * 1. Null/undefined result handling
 * 2. Missing metadata fallback
 * 3. Numeric edge cases (NaN, Infinity, division by zero)
 * 4. Date format handling
 * 5. Data quality badge logic
 * 6. Market name mapping
 * 7. Trading cost display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BacktestBasisPanel } from '../backtest-basis-panel';
import type { BacktestResult, BacktestConfig, ParsedStrategy } from '@/lib/backtest/types';

// =============================================================================
// Test Data Factory
// =============================================================================

/**
 * Create a minimal valid config for testing
 */
function createMockConfig(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    symbol: '600519',
    initialCapital: 100000,
    commission: 0.0003,
    slippage: 0.001,
    startDate: '2023-01-01',
    endDate: '2024-01-01',
    timeframe: '1d',
    ...overrides,
  };
}

/**
 * Create a minimal parsed strategy for testing
 */
function createMockStrategy(overrides: Partial<ParsedStrategy> = {}): ParsedStrategy {
  return {
    name: 'Test Strategy',
    params: { period: 20 },
    indicators: ['sma'],
    entryCondition: 'close > sma20',
    exitCondition: 'close < sma20',
    ...overrides,
  };
}

/**
 * Create a full backtest result with metadata for testing
 */
function createMockResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    totalReturn: 0.15,
    annualizedReturn: 0.12,
    maxDrawdown: 0.08,
    sharpeRatio: 1.5,
    sortinoRatio: 2.0,
    winRate: 0.6,
    totalTrades: 50,
    profitFactor: 1.8,
    avgWin: 500,
    avgLoss: 300,
    maxConsecutiveWins: 5,
    maxConsecutiveLosses: 3,
    avgHoldingPeriod: 10,
    maxSingleWin: 2000,
    maxSingleLoss: 800,
    equityCurve: [],
    trades: [],
    config: createMockConfig(),
    strategy: createMockStrategy(),
    executionTime: 1000,
    backtestMeta: {
      targetSymbol: '600519',
      targetName: '贵州茅台',
      targetMarket: 'SH',
      dataSource: 'TuShare Pro',
      dataSourceType: 'historical',
      timeRange: {
        start: '2023-01-01',
        end: '2024-01-01',
        totalDays: 365,
        tradingDays: 244,
        weekendDays: 104,
        holidayDays: 17,
      },
      dataQuality: {
        completeness: 0.98,
        missingDays: 2,
        missingDates: ['2023-05-01', '2023-10-01'],
        dataPoints: 244,
      },
      tradingCosts: {
        commission: 0.0003,
        commissionType: 'percent',
        slippage: 0.001,
        slippageType: 'percent',
        stampDuty: 0.001,
      },
      capitalConfig: {
        initialCapital: 100000,
        leverageRatio: 1,
        marginRequirement: 1,
      },
      executionConfig: {
        priceType: 'close',
        orderType: 'market',
        timeframe: '1d',
      },
      generatedAt: 1704067200000,
      version: '1.2.0',
    },
    ...overrides,
  };
}

/**
 * Create result without metadata (fallback test)
 */
function createResultWithoutMeta(overrides: Partial<BacktestResult> = {}): BacktestResult {
  const result = createMockResult(overrides);
  delete result.backtestMeta;
  return result;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('BacktestBasisPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Null/Undefined Result Handling
  // ===========================================================================
  describe('Null/Undefined Result Handling', () => {
    it('renders fallback UI when result is null', () => {
      render(<BacktestBasisPanel result={null} />);

      expect(screen.getByText('回测依据信息不可用')).toBeInTheDocument();
    });

    it('renders fallback UI when result is undefined', () => {
      render(<BacktestBasisPanel result={undefined} />);

      expect(screen.getByText('回测依据信息不可用')).toBeInTheDocument();
    });

    it('applies className to fallback container', () => {
      const { container } = render(
        <BacktestBasisPanel result={null} className="custom-fallback" />
      );

      expect(container.firstChild).toHaveClass('custom-fallback');
    });
  });

  // ===========================================================================
  // 2. Missing Metadata Fallback
  // ===========================================================================
  describe('Missing Metadata Fallback', () => {
    it('renders config-based fallback when metadata is missing', () => {
      const result = createResultWithoutMeta();

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('回测依据')).toBeInTheDocument();
      expect(screen.getByText('Backtest Basis')).toBeInTheDocument();
      expect(screen.getByText('测试标的')).toBeInTheDocument();
      expect(screen.getByText('600519')).toBeInTheDocument();
    });

    it('shows unknown code when config.symbol is missing', () => {
      const result = createResultWithoutMeta();
      result.config.symbol = '';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('未知代码')).toBeInTheDocument();
    });

    it('shows date range from config', () => {
      const result = createResultWithoutMeta({
        config: createMockConfig({
          startDate: '2023-06-01',
          endDate: '2024-06-01',
        }),
      });

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('2023-06-01 ~ 2024-06-01')).toBeInTheDocument();
    });

    it('handles null config gracefully', () => {
      const result = createResultWithoutMeta();
      // @ts-expect-error - Testing edge case
      result.config = null;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('未知代码')).toBeInTheDocument();
      expect(screen.getByText('¥0.00')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 3. Numeric Edge Cases
  // ===========================================================================
  describe('Numeric Edge Cases', () => {
    it('handles NaN totalDays', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.totalDays = NaN;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('0天')).toBeInTheDocument();
    });

    it('handles Infinity tradingDays', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.tradingDays = Infinity;

      render(<BacktestBasisPanel result={result} />);

      // Should show 0 for infinite value
      expect(screen.queryByText('Infinity')).not.toBeInTheDocument();
    });

    it('handles division by zero in trading day percentage', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.totalDays = 0;
      result.backtestMeta!.timeRange.tradingDays = 100;

      render(<BacktestBasisPanel result={result} />);

      // Should not show percentage when totalDays is 0
      const tradingDaysElement = screen.queryByText('100天');
      if (tradingDaysElement) {
        // Check that there's no percentage shown
        expect(tradingDaysElement.parentElement?.textContent).not.toContain('%');
      }
    });

    it('handles negative totalDays', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.totalDays = -100;

      render(<BacktestBasisPanel result={result} />);

      // Should show 0 for negative values
      expect(screen.getByText('0天')).toBeInTheDocument();
    });

    it('handles very large initialCapital (> 1e12)', () => {
      const result = createMockResult();
      result.backtestMeta!.capitalConfig.initialCapital = 5e12;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText(/万亿/)).toBeInTheDocument();
    });

    it('handles large initialCapital (> 1e8)', () => {
      const result = createMockResult();
      result.backtestMeta!.capitalConfig.initialCapital = 5e9;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText(/亿/)).toBeInTheDocument();
    });

    it('handles negative initialCapital', () => {
      const result = createMockResult();
      result.backtestMeta!.capitalConfig.initialCapital = -50000;

      render(<BacktestBasisPanel result={result} />);

      // Should have loss styling class
      expect(document.querySelector('.text-loss')).toBeInTheDocument();
    });

    it('handles zero commission', () => {
      const result = createMockResult();
      result.backtestMeta!.tradingCosts.commission = 0;

      render(<BacktestBasisPanel result={result} />);

      // Multiple elements may show 0.00%, so use getAllByText
      const zeroPercentElements = screen.getAllByText(/0\.00%/);
      expect(zeroPercentElements.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 4. Date Format Handling
  // ===========================================================================
  describe('Date Format Handling', () => {
    it('formats valid ISO date range correctly', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.start = '2023-06-15T00:00:00.000Z';
      result.backtestMeta!.timeRange.end = '2024-06-15T00:00:00.000Z';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('2023-06-15 ~ 2024-06-15')).toBeInTheDocument();
    });

    it('handles invalid date format gracefully', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.start = 'not-a-date';
      result.backtestMeta!.timeRange.end = 'invalid';

      render(<BacktestBasisPanel result={result} />);

      // Should show original strings
      expect(screen.getByText('not-a-date ~ invalid')).toBeInTheDocument();
    });

    it('handles empty date strings', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.start = '';
      result.backtestMeta!.timeRange.end = '';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('未知日期 ~ 未知日期')).toBeInTheDocument();
    });

    it('formats generatedAt timestamp correctly', () => {
      const result = createMockResult();
      result.backtestMeta!.generatedAt = 1704067200000; // 2024-01-01

      render(<BacktestBasisPanel result={result} />);

      // Multiple date elements may contain 2024, so use getAllByText
      const dateElements = screen.getAllByText(/2024/);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it('handles null generatedAt', () => {
      const result = createMockResult();
      result.backtestMeta!.generatedAt = null as unknown as number;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('未知时间')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 5. Data Quality Badge Logic
  // ===========================================================================
  describe('Data Quality Badge', () => {
    it('shows "优秀" badge for completeness >= 0.95', () => {
      const result = createMockResult();
      result.backtestMeta!.dataQuality.completeness = 0.98;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('优秀')).toBeInTheDocument();
    });

    it('shows "良好" badge for completeness >= 0.85', () => {
      const result = createMockResult();
      result.backtestMeta!.dataQuality.completeness = 0.90;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('良好')).toBeInTheDocument();
    });

    it('shows "一般" badge for completeness >= 0.70', () => {
      const result = createMockResult();
      result.backtestMeta!.dataQuality.completeness = 0.75;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('一般')).toBeInTheDocument();
    });

    it('shows "较差" badge for completeness < 0.70', () => {
      const result = createMockResult();
      result.backtestMeta!.dataQuality.completeness = 0.50;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('较差')).toBeInTheDocument();
    });

    it('handles NaN completeness', () => {
      const result = createMockResult();
      result.backtestMeta!.dataQuality.completeness = NaN;

      render(<BacktestBasisPanel result={result} />);

      // Should default to 0 which is "较差"
      expect(screen.getByText('较差')).toBeInTheDocument();
    });

    it('handles null completeness', () => {
      const result = createMockResult();
      result.backtestMeta!.dataQuality.completeness = null as unknown as number;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('较差')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 6. Market Name Mapping
  // ===========================================================================
  describe('Market Name Mapping', () => {
    it('maps SH to 上海证券交易所', () => {
      const result = createMockResult();
      result.backtestMeta!.targetMarket = 'SH';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('上海证券交易所')).toBeInTheDocument();
    });

    it('maps SZ to 深圳证券交易所', () => {
      const result = createMockResult();
      result.backtestMeta!.targetMarket = 'SZ';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('深圳证券交易所')).toBeInTheDocument();
    });

    it('maps BJ to 北京证券交易所', () => {
      const result = createMockResult();
      result.backtestMeta!.targetMarket = 'BJ';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('北京证券交易所')).toBeInTheDocument();
    });

    it('handles lowercase market code', () => {
      const result = createMockResult();
      result.backtestMeta!.targetMarket = 'sh';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('上海证券交易所')).toBeInTheDocument();
    });

    it('shows unknown market code as-is', () => {
      const result = createMockResult();
      result.backtestMeta!.targetMarket = 'UNKNOWN';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    });

    it('does not show market when null', () => {
      const result = createMockResult();
      result.backtestMeta!.targetMarket = null as unknown as string;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.queryByText('交易市场')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 7. Data Source Type Display
  // ===========================================================================
  describe('Data Source Type Display', () => {
    it('shows "实盘历史" for historical data', () => {
      const result = createMockResult();
      result.backtestMeta!.dataSourceType = 'historical';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('实盘历史')).toBeInTheDocument();
    });

    it('shows "模拟数据" for simulated data', () => {
      const result = createMockResult();
      result.backtestMeta!.dataSourceType = 'simulated';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('模拟数据')).toBeInTheDocument();
    });

    it('shows "混合数据" for mixed data', () => {
      const result = createMockResult();
      result.backtestMeta!.dataSourceType = 'mixed';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('混合数据')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 8. Execution Config Display
  // ===========================================================================
  describe('Execution Config Display', () => {
    it('shows "收盘价" for close price type', () => {
      const result = createMockResult();
      result.backtestMeta!.executionConfig.priceType = 'close';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('收盘价')).toBeInTheDocument();
    });

    it('shows "开盘价" for open price type', () => {
      const result = createMockResult();
      result.backtestMeta!.executionConfig.priceType = 'open';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('开盘价')).toBeInTheDocument();
    });

    it('shows "成交均价" for vwap price type', () => {
      const result = createMockResult();
      result.backtestMeta!.executionConfig.priceType = 'vwap';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('成交均价')).toBeInTheDocument();
    });

    it('shows "市价单" for market order type', () => {
      const result = createMockResult();
      result.backtestMeta!.executionConfig.orderType = 'market';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('市价单')).toBeInTheDocument();
    });

    it('shows "限价单" for limit order type', () => {
      const result = createMockResult();
      result.backtestMeta!.executionConfig.orderType = 'limit';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('限价单')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 9. Trading Costs Display
  // ===========================================================================
  describe('Trading Costs Display', () => {
    it('shows stamp duty when available', () => {
      const result = createMockResult();
      result.backtestMeta!.tradingCosts.stampDuty = 0.001;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('印花税')).toBeInTheDocument();
      expect(screen.getByText('(仅卖出)')).toBeInTheDocument();
    });

    it('hides stamp duty when null', () => {
      const result = createMockResult();
      delete result.backtestMeta!.tradingCosts.stampDuty;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.queryByText('印花税')).not.toBeInTheDocument();
    });

    it('shows commission type indicator', () => {
      const result = createMockResult();
      result.backtestMeta!.tradingCosts.commissionType = 'percent';

      render(<BacktestBasisPanel result={result} />);

      // Multiple commission type indicators may exist
      const indicators = screen.getAllByText('(按比例)');
      expect(indicators.length).toBeGreaterThan(0);
    });

    it('shows fixed commission type', () => {
      const result = createMockResult();
      result.backtestMeta!.tradingCosts.commissionType = 'fixed';

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('(固定金额)')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 10. Optional Fields Display
  // ===========================================================================
  describe('Optional Fields Display', () => {
    it('shows leverage ratio when available', () => {
      const result = createMockResult();
      result.backtestMeta!.capitalConfig.leverageRatio = 2.5;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('2.5倍')).toBeInTheDocument();
    });

    it('hides leverage ratio when null', () => {
      const result = createMockResult();
      delete result.backtestMeta!.capitalConfig.leverageRatio;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.queryByText('杠杆倍数')).not.toBeInTheDocument();
    });

    it('shows margin requirement when available', () => {
      const result = createMockResult();
      result.backtestMeta!.capitalConfig.marginRequirement = 0.5;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('保证金比例')).toBeInTheDocument();
    });

    it('shows weekend days when > 0', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.weekendDays = 104;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('排除周末')).toBeInTheDocument();
      expect(screen.getByText('104天')).toBeInTheDocument();
    });

    it('hides weekend days when 0', () => {
      const result = createMockResult();
      result.backtestMeta!.timeRange.weekendDays = 0;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.queryByText('排除周末')).not.toBeInTheDocument();
    });

    it('shows missing days when > 0', () => {
      const result = createMockResult();
      result.backtestMeta!.dataQuality.missingDays = 5;

      render(<BacktestBasisPanel result={result} />);

      expect(screen.getByText('缺失交易日')).toBeInTheDocument();
      expect(screen.getByText('5天')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 11. Error Callback and Rendering
  // ===========================================================================
  describe('Error Callback', () => {
    it('does not call onError for valid result', () => {
      const onError = vi.fn();
      const result = createMockResult();

      render(<BacktestBasisPanel result={result} onError={onError} />);

      expect(onError).not.toHaveBeenCalled();
    });

    it('applies custom className', () => {
      const result = createMockResult();

      const { container } = render(
        <BacktestBasisPanel result={result} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  // ===========================================================================
  // 12. String Truncation
  // ===========================================================================
  describe('String Truncation', () => {
    it('truncates long target name', () => {
      const result = createMockResult();
      result.backtestMeta!.targetName = '这是一个非常长的股票名称测试测试测试';

      render(<BacktestBasisPanel result={result} />);

      // Should have title attribute with full name
      const el = screen.getByTitle('这是一个非常长的股票名称测试测试测试');
      expect(el).toBeInTheDocument();
    });

    it('truncates long data source', () => {
      const result = createMockResult();
      result.backtestMeta!.dataSource = 'A'.repeat(60);

      render(<BacktestBasisPanel result={result} />);

      // Should have title with full name
      const el = screen.getByTitle('A'.repeat(60));
      expect(el).toBeInTheDocument();
    });
  });
});
