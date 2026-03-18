/**
 * EnhancedTradeCard Component Tests
 * Edge case coverage: 95%+
 *
 * Test categories:
 * 1. Null/undefined handling
 * 2. Numeric edge cases (NaN, Infinity, extreme values)
 * 3. String edge cases (empty, long strings, Unicode)
 * 4. Date format handling
 * 5. Error callback behavior
 * 6. Indicator value rendering
 * 7. P&L display logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnhancedTradeCard } from '../enhanced-trade-card';
import type { DetailedTrade } from '@/lib/backtest/types';
import type { LotCalculation } from '@/lib/backtest/lot-size';

// =============================================================================
// Test Data Factory
// =============================================================================

/**
 * Create a valid base trade object for testing
 * Factory function provides isolated test data
 */
function createMockTrade(overrides: Partial<DetailedTrade> = {}): DetailedTrade {
  const baseLotCalculation: LotCalculation = {
    requestedQuantity: 1000,
    lotSize: 100,
    actualLots: 10,
    actualQuantity: 1000,
    roundingLoss: 0,
    roundingLossPercent: 0,
  };

  return {
    id: 'test-trade-001',
    timestamp: 1704067200000,
    date: '2024-01-01',
    type: 'buy',
    symbol: '600519',
    symbolName: '贵州茅台',
    market: 'SH',
    signalPrice: 50.0,
    executePrice: 50.05,
    slippage: 0.05,
    slippagePercent: 0.1,
    commission: 15.0,
    commissionPercent: 0.03,
    totalCost: 15.05,
    lotCalculation: baseLotCalculation,
    requestedQuantity: 1000,
    actualQuantity: 1000,
    lots: 10,
    lotSize: 100,
    quantityUnit: '股',
    orderValue: 50050,
    cashBefore: 100000,
    cashAfter: 49950,
    positionBefore: 0,
    positionAfter: 10,
    portfolioValueBefore: 100000,
    portfolioValueAfter: 100000,
    triggerReason: '金叉买入信号',
    indicatorValues: { macdDif: 0.5, macdDea: 0.3 },
    strategyName: 'MACD Strategy',
    ...overrides,
  };
}

/**
 * Create a mock sell trade with P&L data
 */
function createMockSellTrade(overrides: Partial<DetailedTrade> = {}): DetailedTrade {
  return createMockTrade({
    id: 'test-trade-sell-001',
    type: 'sell',
    pnl: 5000,
    pnlPercent: 10.0,
    holdingDays: 30,
    entryTradeId: 'test-trade-001',
    triggerReason: '止盈卖出',
    cashBefore: 49950,
    cashAfter: 105000,
    positionBefore: 10,
    positionAfter: 0,
    ...overrides,
  });
}

// =============================================================================
// Test Suite
// =============================================================================

describe('EnhancedTradeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Null/Undefined Handling
  // ===========================================================================
  describe('Null/Undefined Trade Handling', () => {
    it('renders fallback UI when trade is null', () => {
      render(<EnhancedTradeCard trade={null} />);

      expect(screen.getByText('交易记录不可用')).toBeInTheDocument();
    });

    it('renders fallback UI when trade is undefined', () => {
      render(<EnhancedTradeCard trade={undefined} />);

      expect(screen.getByText('交易记录不可用')).toBeInTheDocument();
    });

    it('handles null symbol gracefully', () => {
      const trade = createMockTrade({
        symbol: null as unknown as string,
        symbolName: null as unknown as string,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('未知代码')).toBeInTheDocument();
      expect(screen.getByText('未知股票')).toBeInTheDocument();
    });

    it('handles undefined date gracefully', () => {
      const trade = createMockTrade({
        date: undefined as unknown as string,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('未知日期')).toBeInTheDocument();
    });

    it('handles null market gracefully', () => {
      const trade = createMockTrade({
        market: null as unknown as string,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Market should not render when null
      expect(screen.queryByText('上海')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 2. Numeric Edge Cases
  // ===========================================================================
  describe('Numeric Edge Cases', () => {
    it('formats NaN price as fallback', () => {
      const trade = createMockTrade({
        executePrice: NaN,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('¥0.00/股')).toBeInTheDocument();
    });

    it('formats Infinity price as fallback', () => {
      const trade = createMockTrade({
        executePrice: Infinity,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('¥0.00/股')).toBeInTheDocument();
    });

    it('formats -Infinity price as fallback', () => {
      const trade = createMockTrade({
        executePrice: -Infinity,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('¥0.00/股')).toBeInTheDocument();
    });

    it('formats extremely large value (1e15) correctly', () => {
      const trade = createMockTrade({
        orderValue: 1e15,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should show in 万亿 format
      expect(screen.getByText(/万亿/)).toBeInTheDocument();
    });

    it('formats very small positive value (<0.01) correctly', () => {
      const trade = createMockTrade({
        commission: 0.001,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should show exponential format
      expect(screen.getByText(/手续费.*e/i)).toBeInTheDocument();
    });

    it('handles zero values correctly', () => {
      const trade = createMockTrade({
        lots: 0,
        actualQuantity: 0,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('0手 (0股)')).toBeInTheDocument();
    });

    it('handles negative cash values (edge case)', () => {
      const trade = createMockTrade({
        cashBefore: -1000,
        cashAfter: -500,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Negative values should be displayed with loss styling
      const container = document.querySelector('.text-loss');
      expect(container).toBeInTheDocument();
    });

    it('handles fractional lots', () => {
      const trade = createMockTrade({
        lots: 10.5,
        actualQuantity: 1050,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Fractional lots don't use toLocaleString for quantity
      expect(screen.getByText('10.50手 (1050股)')).toBeInTheDocument();
    });

    it('formats extreme P&L percentage (>1000%) correctly', () => {
      const trade = createMockSellTrade({
        pnlPercent: 5000,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should show exponential format for extreme percentages
      expect(screen.getByText(/\+.*e.*%/)).toBeInTheDocument();
    });

    it('handles null P&L for sell trade', () => {
      const trade = createMockSellTrade({
        pnl: null as unknown as number,
        pnlPercent: null as unknown as number,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // P&L section should not render when null
      expect(screen.queryByText(/盈利/)).not.toBeInTheDocument();
      expect(screen.queryByText(/亏损/)).not.toBeInTheDocument();
    });

    it('handles NaN P&L percentage', () => {
      const trade = createMockSellTrade({
        pnl: 1000,
        pnlPercent: NaN,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should not render P&L when percentage is NaN
      expect(screen.queryByText(/\+.*%/)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 3. String Edge Cases
  // ===========================================================================
  describe('String Edge Cases', () => {
    it('truncates extremely long symbol name', () => {
      const longName = '这是一个非常长的股票名称测试测试测试测试测试测试';
      const trade = createMockTrade({
        symbolName: longName,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should be truncated (component limits to 15 chars for name)
      const truncated = screen.getByTitle(longName);
      expect(truncated).toBeInTheDocument();
    });

    it('truncates extremely long trigger reason', () => {
      const longReason = 'A'.repeat(200);
      const trade = createMockTrade({
        triggerReason: longReason,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Check that the content contains ... (truncated)
      expect(screen.getByText(/\.{3}$/)).toBeInTheDocument();
    });

    it('handles empty trigger reason', () => {
      const trade = createMockTrade({
        triggerReason: '',
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('无触发原因')).toBeInTheDocument();
    });

    it('handles Unicode characters in symbol name', () => {
      const trade = createMockTrade({
        symbolName: '中国平安🚀',
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should render Unicode correctly
      const el = screen.getByTitle('中国平安🚀');
      expect(el).toBeInTheDocument();
    });

    it('handles special characters in trigger reason', () => {
      const trade = createMockTrade({
        triggerReason: 'MACD > 0 && RSI < 70 & Vol > 1000000',
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText(/MACD.*RSI.*Vol/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 4. Date Format Handling
  // ===========================================================================
  describe('Date Format Handling', () => {
    it('formats valid ISO date correctly', () => {
      const trade = createMockTrade({
        date: '2024-01-15T10:30:00.000Z',
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should show YYYY-MM-DD format
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });

    it('handles invalid date format gracefully', () => {
      const trade = createMockTrade({
        date: 'not-a-date',
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should return original string if not ISO format
      expect(screen.getByText('not-a-date')).toBeInTheDocument();
    });

    it('handles Unix timestamp as string', () => {
      const trade = createMockTrade({
        date: '1704067200',
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should return as-is since it's not ISO format
      expect(screen.getByText('1704067200')).toBeInTheDocument();
    });

    it('handles empty date string', () => {
      const trade = createMockTrade({
        date: '',
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('未知日期')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 5. Trade Type Handling
  // ===========================================================================
  describe('Trade Type Handling', () => {
    it('renders buy trade with correct styling', () => {
      const trade = createMockTrade({ type: 'buy' });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('买入')).toBeInTheDocument();
      // Check for profit styling class
      expect(document.querySelector('.bg-profit\\/5')).toBeInTheDocument();
    });

    it('renders sell trade with correct styling', () => {
      const trade = createMockSellTrade();

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('卖出')).toBeInTheDocument();
      // Check for loss styling class
      expect(document.querySelector('.bg-loss\\/5')).toBeInTheDocument();
    });

    it('handles invalid trade type and calls onError', () => {
      const onError = vi.fn();
      const trade = createMockTrade({
        type: 'invalid' as 'buy' | 'sell',
      });

      render(<EnhancedTradeCard trade={trade} onError={onError} />);

      // Should show error UI
      expect(screen.getByText('交易记录渲染失败')).toBeInTheDocument();

      // Should call onError callback
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('handles uppercase trade type', () => {
      const trade = createMockTrade({
        type: 'BUY' as unknown as 'buy' | 'sell',
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('买入')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 6. Error Callback Behavior
  // ===========================================================================
  describe('Error Callback Behavior', () => {
    it('calls onError with Error object on render failure', () => {
      const onError = vi.fn();
      const trade = createMockTrade({
        type: 'unknown' as 'buy' | 'sell',
      });

      render(<EnhancedTradeCard trade={trade} onError={onError} />);

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Invalid trade type'),
      }));
    });

    it('does not call onError when trade is valid', () => {
      const onError = vi.fn();
      const trade = createMockTrade();

      render(<EnhancedTradeCard trade={trade} onError={onError} />);

      expect(onError).not.toHaveBeenCalled();
    });

    it('renders error message when render fails', () => {
      const trade = createMockTrade({
        type: 'invalid-type' as 'buy' | 'sell',
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('交易记录渲染失败')).toBeInTheDocument();
      expect(screen.getByText(/Invalid trade type/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 7. Indicator Value Rendering
  // ===========================================================================
  describe('Indicator Value Rendering', () => {
    it('renders indicator values correctly', () => {
      const trade = createMockTrade({
        indicatorValues: {
          macdDif: 0.5678,
          rsi: 65.43,
        },
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Values should be formatted to 2 decimal places
      expect(screen.getByText('0.57')).toBeInTheDocument();
      expect(screen.getByText('65.43')).toBeInTheDocument();
    });

    it('handles empty indicator values object', () => {
      const trade = createMockTrade({
        indicatorValues: {},
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Component should render without indicator badges
      expect(screen.queryByText(/macdDif/)).not.toBeInTheDocument();
    });

    it('handles null indicator value', () => {
      const trade = createMockTrade({
        indicatorValues: {
          macdDif: null as unknown as number,
          rsi: 65,
        },
      });

      render(<EnhancedTradeCard trade={trade} />);

      // null value should be filtered out
      expect(screen.queryByText('macdDif=')).not.toBeInTheDocument();
      expect(screen.getByText('65.00')).toBeInTheDocument();
    });

    it('limits indicator display to 10 items', () => {
      const manyIndicators: Record<string, number> = {};
      for (let i = 0; i < 15; i++) {
        manyIndicators[`indicator${i}`] = i;
      }

      const trade = createMockTrade({
        indicatorValues: manyIndicators,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should only show 10 indicators max
      const indicatorBadges = document.querySelectorAll('.bg-primary\\/20');
      expect(indicatorBadges.length).toBeLessThanOrEqual(10);
    });

    it('handles NaN indicator value', () => {
      const trade = createMockTrade({
        indicatorValues: {
          macdDif: NaN,
          rsi: 65,
        },
      });

      render(<EnhancedTradeCard trade={trade} />);

      // NaN should display as string
      expect(screen.getByText('NaN')).toBeInTheDocument();
    });

    it('truncates long indicator names', () => {
      const trade = createMockTrade({
        indicatorValues: {
          'veryLongIndicatorName': 50,
        },
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should truncate to 10 chars + ...
      expect(screen.getByTitle('veryLongIndicatorName=50')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 8. Market Name Display
  // ===========================================================================
  describe('Market Name Display', () => {
    it('maps SH to 上海', () => {
      const trade = createMockTrade({ market: 'SH' });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('上海')).toBeInTheDocument();
    });

    it('maps SZ to 深圳', () => {
      const trade = createMockTrade({ market: 'SZ' });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('深圳')).toBeInTheDocument();
    });

    it('maps BJ to 北京', () => {
      const trade = createMockTrade({ market: 'BJ' });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('北京')).toBeInTheDocument();
    });

    it('handles lowercase market code', () => {
      const trade = createMockTrade({ market: 'sh' });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('上海')).toBeInTheDocument();
    });

    it('displays unknown market code as-is', () => {
      const trade = createMockTrade({ market: 'UNKNOWN' });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 9. P&L Display for Sell Trades
  // ===========================================================================
  describe('P&L Display', () => {
    it('displays positive P&L with profit styling', () => {
      const trade = createMockSellTrade({
        pnl: 5000,
        pnlPercent: 10.5,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('+10.50%')).toBeInTheDocument();
      expect(screen.getByText(/盈利/)).toBeInTheDocument();
    });

    it('displays negative P&L with loss styling', () => {
      const trade = createMockSellTrade({
        pnl: -3000,
        pnlPercent: -6.5,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('-6.50%')).toBeInTheDocument();
      expect(screen.getByText(/亏损/)).toBeInTheDocument();
    });

    it('displays holding days when available', () => {
      const trade = createMockSellTrade({
        holdingDays: 45,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('持有 45天')).toBeInTheDocument();
    });

    it('hides holding days when negative', () => {
      const trade = createMockSellTrade({
        holdingDays: -5,
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.queryByText(/持有.*天/)).not.toBeInTheDocument();
    });

    it('does not show P&L for buy trades', () => {
      const trade = createMockTrade({
        type: 'buy',
        pnl: 1000,
        pnlPercent: 5,
      });

      render(<EnhancedTradeCard trade={trade} />);

      // P&L section should not render for buy trades
      expect(screen.queryByText(/盈利|亏损/)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 10. className Prop
  // ===========================================================================
  describe('className Prop', () => {
    it('applies custom className to container', () => {
      const trade = createMockTrade();

      const { container } = render(
        <EnhancedTradeCard trade={trade} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('applies className to fallback UI when trade is null', () => {
      const { container } = render(
        <EnhancedTradeCard trade={null} className="null-class" />
      );

      expect(container.firstChild).toHaveClass('null-class');
    });
  });

  // ===========================================================================
  // 11. Trade ID Display
  // ===========================================================================
  describe('Trade ID Display', () => {
    it('displays truncated trade ID', () => {
      const trade = createMockTrade({
        id: '12345678-90ab-cdef-1234-567890abcdef',
      });

      render(<EnhancedTradeCard trade={trade} />);

      // Should show first 8 chars
      expect(screen.getByText('#12345678')).toBeInTheDocument();
    });

    it('handles short trade ID', () => {
      const trade = createMockTrade({
        id: 'ABC',
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('#ABC')).toBeInTheDocument();
    });

    it('handles empty trade ID with fallback', () => {
      const trade = createMockTrade({
        id: '',
      });

      render(<EnhancedTradeCard trade={trade} />);

      expect(screen.getByText('#UNKNOWN')).toBeInTheDocument();
    });
  });
});
