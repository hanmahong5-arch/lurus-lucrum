import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchKLinesTool,
  checkDataAvailabilityTool,
  getMarketQuoteTool,
  getMarketIndicesTool,
  searchStocksTool,
  marketTools,
} from '../../agent/tools/market-tools';

// Mock external dependencies
vi.mock('@/lib/data-service', () => ({
  getKLineData: vi.fn(),
}));

vi.mock('@/lib/backtest/db-kline-provider', () => ({
  getKLineFromDatabase: vi.fn(),
  checkDataAvailability: vi.fn(),
}));

// Import mocked modules for control
import { getKLineData } from '@/lib/data-service';
import { getKLineFromDatabase, checkDataAvailability } from '@/lib/backtest/db-kline-provider';

const mockedGetKLineData = vi.mocked(getKLineData);
const mockedGetKLineFromDatabase = vi.mocked(getKLineFromDatabase);
const mockedCheckDataAvailability = vi.mocked(checkDataAvailability);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

// ---------------------------------------------------------------------------
// fetchKLinesTool
// ---------------------------------------------------------------------------
describe('fetchKLinesTool', () => {
  it('returns database data for 1d timeframe when DB succeeds', async () => {
    mockedGetKLineFromDatabase.mockResolvedValue({
      success: true,
      data: [
        { time: 1704067200, open: 10, high: 11, low: 9, close: 10.5, volume: 5000 },
        { time: 1704153600, open: 10.5, high: 12, low: 10, close: 11, volume: 6000 },
      ],
    } as never);

    const result = await fetchKLinesTool.invoke({
      symbol: '000001.SZ',
      timeframe: '1d',
      limit: 200,
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('database');
    expect(result.count).toBe(2);
    expect(result.data!.length).toBe(2);
  });

  it('falls back to API when database returns empty', async () => {
    mockedGetKLineFromDatabase.mockResolvedValue({
      success: true,
      data: [],
    } as never);

    mockedGetKLineData.mockResolvedValue({
      success: true,
      data: [
        { time: 1704067200, open: 10, high: 11, low: 9, close: 10.5, volume: 5000 },
      ],
      source: 'eastmoney',
    } as never);

    const result = await fetchKLinesTool.invoke({
      symbol: '000001.SZ',
      timeframe: '1d',
      limit: 200,
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('eastmoney');
    expect(result.count).toBe(1);
  });

  it('uses API directly for non-1d timeframes', async () => {
    mockedGetKLineData.mockResolvedValue({
      success: true,
      data: [
        { time: 1704067200, open: 10, high: 11, low: 9, close: 10.5, volume: 5000 },
      ],
      source: 'sina',
    } as never);

    const result = await fetchKLinesTool.invoke({
      symbol: '600519.SH',
      timeframe: '60m',
      limit: 100,
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('sina');
    // Database should NOT be called for non-1d
    expect(mockedGetKLineFromDatabase).not.toHaveBeenCalled();
  });

  it('returns failure when both DB and API fail', async () => {
    mockedGetKLineFromDatabase.mockRejectedValue(new Error('DB down'));
    mockedGetKLineData.mockRejectedValue(new Error('API down'));

    const result = await fetchKLinesTool.invoke({
      symbol: '000001.SZ',
      timeframe: '1d',
      limit: 200,
    });

    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
  });

  it('converts string time values to unix timestamps', async () => {
    mockedGetKLineFromDatabase.mockResolvedValue({
      success: true,
      data: [
        { time: '2024-01-01', open: 10, high: 11, low: 9, close: 10.5, volume: 5000 },
      ],
    } as never);

    const result = await fetchKLinesTool.invoke({
      symbol: '000001.SZ',
      timeframe: '1d',
      limit: 200,
    });

    expect(result.success).toBe(true);
    expect(typeof result.data![0]!.time).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// checkDataAvailabilityTool
// ---------------------------------------------------------------------------
describe('checkDataAvailabilityTool', () => {
  it('returns availability info on success', async () => {
    mockedCheckDataAvailability.mockResolvedValue({
      available: true,
      dateRange: { start: '2023-01-01', end: '2024-01-01' },
      dataCount: 244,
      stockId: 1,
      stockName: 'Ping An Bank',
      coverage: 0.98,
      message: 'Data available',
    } as never);

    const result = await checkDataAvailabilityTool.invoke({
      symbol: '000001.SZ',
      startDate: '2023-01-01',
      endDate: '2024-01-01',
    });

    expect(result.available).toBe(true);
    expect(result.dataCount).toBe(244);
    expect(result.coverage).toBe(0.98);
  });

  it('returns error info when check throws', async () => {
    mockedCheckDataAvailability.mockRejectedValue(new Error('Connection refused'));

    const result = await checkDataAvailabilityTool.invoke({
      symbol: '000001.SZ',
      startDate: '2023-01-01',
      endDate: '2024-01-01',
    });

    expect(result.available).toBe(false);
    expect(result.error).toBe('Connection refused');
  });
});

// ---------------------------------------------------------------------------
// getMarketQuoteTool
// ---------------------------------------------------------------------------
describe('getMarketQuoteTool', () => {
  it('returns quote data when API responds successfully', async () => {
    const mockQuote = { price: 15.5, change: 0.3, volume: 1000000 };
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQuote }),
    } as Response);

    const result = await getMarketQuoteTool.invoke({ symbol: '000001.SZ' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockQuote);
  });

  it('returns failure when fetch throws', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

    const result = await getMarketQuoteTool.invoke({ symbol: '000001.SZ' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Quote data unavailable');
  });
});

// ---------------------------------------------------------------------------
// getMarketIndicesTool
// ---------------------------------------------------------------------------
describe('getMarketIndicesTool', () => {
  it('returns indices data on success', async () => {
    const mockIndices = [{ symbol: '000001.SH', price: 3200 }];
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockIndices }),
    } as Response);

    const result = await getMarketIndicesTool.invoke({
      indices: ['000001.SH'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockIndices);
  });

  it('returns failure when API is unavailable', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
    } as Response);

    const result = await getMarketIndicesTool.invoke({
      indices: ['000001.SH'],
    });

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// searchStocksTool
// ---------------------------------------------------------------------------
describe('searchStocksTool', () => {
  it('returns matching stocks on success', async () => {
    const mockResults = [{ symbol: '000001.SZ', name: 'Ping An Bank' }];
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockResults }),
    } as Response);

    const result = await searchStocksTool.invoke({ query: 'ping an', limit: 10 });

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.results).toEqual(mockResults);
  });

  it('returns empty results when fetch fails', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Timeout'));

    const result = await searchStocksTool.invoke({ query: 'test', limit: 10 });

    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
    expect(result.results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// marketTools collection
// ---------------------------------------------------------------------------
describe('marketTools', () => {
  it('exports all 5 tools', () => {
    expect(marketTools).toHaveLength(5);
  });
});
