/**
 * Stock Date Range API
 * 获取股票可用K线数据的时间范围
 *
 * GET /api/stocks/date-range?symbol=600519
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKLineDateRange } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "symbol" is required' },
        { status: 400 }
      );
    }

    const range = await getKLineDateRange(symbol);

    if (!range) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No K-line data found for this symbol',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        minDate: range.minDate,
        maxDate: range.maxDate,
        dataPoints: range.count,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API] /api/stocks/date-range error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch date range',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
