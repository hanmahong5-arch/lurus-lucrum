/**
 * TargetSelector Component Tests
 *
 * Tests:
 * - Component rendering: tabs, stock mode, selected stock display
 * - Stock selection via quick access buttons
 * - Search placeholder with pinyin mention
 * - Recent stocks hook: localStorage read behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TargetSelector } from '../target-selector';

// =============================================================================
// Setup
// =============================================================================

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
});

// =============================================================================
// TargetSelector Component Tests
// =============================================================================

describe('TargetSelector', () => {
  describe('rendering', () => {
    it('renders with mode tabs (板块, 个股, 组合)', () => {
      const onChange = vi.fn();
      render(<TargetSelector onChange={onChange} />);
      expect(screen.getByText('板块')).toBeInTheDocument();
      expect(screen.getByText('个股')).toBeInTheDocument();
      expect(screen.getByText('组合')).toBeInTheDocument();
    });

    it('renders 3 tab triggers', () => {
      const onChange = vi.fn();
      render(<TargetSelector onChange={onChange} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(3);
    });

    it('renders in stock mode by default when value.mode is stock', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          value={{ mode: 'stock' }}
          onChange={onChange}
        />,
      );
      expect(screen.getByText('快捷选择 / Quick Access')).toBeInTheDocument();
    });

    it('renders disabled state when disabled=true', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          onChange={onChange}
          disabled={true}
        />,
      );
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(3);
      // Radix Tabs renders disabled tabs with data-disabled attribute
      tabs.forEach((tab) => {
        const isDisabled = tab.hasAttribute('disabled') ||
          tab.hasAttribute('data-disabled') ||
          tab.getAttribute('aria-disabled') === 'true';
        expect(isDisabled).toBe(true);
      });
    });
  });

  describe('stock mode', () => {
    it('shows search placeholder with pinyin mention', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          value={{ mode: 'stock' }}
          onChange={onChange}
        />,
      );
      expect(
        screen.getByText('搜索股票代码、名称或拼音...'),
      ).toBeInTheDocument();
    });

    it('shows selected stock info when value has stock', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          value={{
            mode: 'stock',
            stock: { symbol: '600519', name: '贵州茅台', market: 'SH' },
          }}
          onChange={onChange}
        />,
      );
      expect(screen.getByText('600519.SH')).toBeInTheDocument();
      const maotaiElements = screen.getAllByText('贵州茅台');
      expect(maotaiElements.length).toBeGreaterThanOrEqual(1);
    });

    it('calls onChange when a quick access stock is clicked', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          value={{ mode: 'stock' }}
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByText('招商银行'));
      expect(onChange).toHaveBeenCalledWith({
        mode: 'stock',
        stock: { symbol: '600036', name: '招商银行', market: 'SH' },
      });
    });

    it('renders selected stock display section', () => {
      const onChange = vi.fn();
      const { container } = render(
        <TargetSelector
          value={{
            mode: 'stock',
            stock: { symbol: '600519', name: '贵州茅台', market: 'SH' },
          }}
          onChange={onChange}
        />,
      );
      const selectedSection = container.querySelector('.bg-primary\\/5');
      expect(selectedSection).toBeInTheDocument();
    });

    it('renders 8 quick access stock buttons', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          value={{ mode: 'stock' }}
          onChange={onChange}
        />,
      );
      // Quick access section has 8 known stocks
      expect(screen.getByText('贵州茅台')).toBeInTheDocument();
      expect(screen.getByText('五粮液')).toBeInTheDocument();
      expect(screen.getByText('招商银行')).toBeInTheDocument();
      expect(screen.getByText('平安银行')).toBeInTheDocument();
      expect(screen.getByText('中国平安')).toBeInTheDocument();
      expect(screen.getByText('宁德时代')).toBeInTheDocument();
      expect(screen.getByText('比亚迪')).toBeInTheDocument();
      expect(screen.getByText('恒瑞医药')).toBeInTheDocument();
    });
  });

  describe('mode tabs', () => {
    it('sector tab has correct aria-controls', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          value={{ mode: 'stock' }}
          onChange={onChange}
        />,
      );
      const tabs = screen.getAllByRole('tab');
      const sectorTab = tabs.find((tab) => tab.textContent?.includes('板块'));
      expect(sectorTab).toBeDefined();
      expect(sectorTab?.getAttribute('aria-controls')).toContain('sector');
    });

    it('stock tab is active when mode is stock', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          value={{ mode: 'stock' }}
          onChange={onChange}
        />,
      );
      const tabs = screen.getAllByRole('tab');
      const stockTab = tabs.find((tab) => tab.textContent?.includes('个股'));
      expect(stockTab?.getAttribute('aria-selected')).toBe('true');
    });

    it('sector tab is active when mode is sector', () => {
      const onChange = vi.fn();
      render(
        <TargetSelector
          value={{ mode: 'sector' }}
          onChange={onChange}
        />,
      );
      const tabs = screen.getAllByRole('tab');
      const sectorTab = tabs.find((tab) => tab.textContent?.includes('板块'));
      expect(sectorTab?.getAttribute('aria-selected')).toBe('true');
    });
  });
});

// =============================================================================
// Recent Stocks localStorage Tests
// =============================================================================

describe('Recent stocks localStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.removeItem('gushen:recent-stocks');
  });

  it('writes to localStorage when stock is selected via quick access', () => {
    const onChange = vi.fn();
    render(
      <TargetSelector value={{ mode: 'stock' }} onChange={onChange} />,
    );

    fireEvent.click(screen.getByText('招商银行'));

    const stored = localStorage.getItem('gushen:recent-stocks');
    expect(stored).not.toBeNull();
    expect(stored).toContain('600036');
  });

  it('deduplicates when same stock is selected again', () => {
    // Pre-seed with existing recent stocks
    localStorage.setItem(
      'gushen:recent-stocks',
      JSON.stringify([
        { symbol: '600036', name: '招商银行', market: 'SH' },
        { symbol: '000858', name: '五粮液', market: 'SZ' },
      ]),
    );

    const onChange = vi.fn();
    render(
      <TargetSelector value={{ mode: 'stock' }} onChange={onChange} />,
    );

    // Click 招商银行 again
    fireEvent.click(screen.getByText('招商银行'));

    const stored = localStorage.getItem('gushen:recent-stocks');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    const zhaoShangCount = parsed.filter(
      (s: { symbol: string }) => s.symbol === '600036',
    );
    expect(zhaoShangCount.length).toBe(1);
    // 招商银行 should be first (most recent)
    expect(parsed[0].symbol).toBe('600036');
  });

  it('limits recent stocks to max 5 entries', () => {
    // Pre-seed with 5 existing stocks
    localStorage.setItem(
      'gushen:recent-stocks',
      JSON.stringify([
        { symbol: '600519', name: '贵州茅台', market: 'SH' },
        { symbol: '000858', name: '五粮液', market: 'SZ' },
        { symbol: '600036', name: '招商银行', market: 'SH' },
        { symbol: '000001', name: '平安银行', market: 'SZ' },
        { symbol: '601318', name: '中国平安', market: 'SH' },
      ]),
    );

    const onChange = vi.fn();
    render(
      <TargetSelector value={{ mode: 'stock' }} onChange={onChange} />,
    );

    // Add a new stock (not in the list)
    fireEvent.click(screen.getByText('宁德时代'));

    const stored = localStorage.getItem('gushen:recent-stocks');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBeLessThanOrEqual(5);
    // 宁德时代 should be first
    expect(parsed[0].symbol).toBe('300750');
  });
});
