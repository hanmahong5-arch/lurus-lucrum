/**
 * Stock Favorites API
 * 股票收藏API
 *
 * GET /api/stocks/favorites - Get favorite stocks
 * POST /api/stocks/favorites - Add to favorites
 * DELETE /api/stocks/favorites - Remove from favorites
 *
 * Note: This is a simplified version using localStorage on client side.
 * For production, implement proper user authentication and database storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStocksBySymbols } from '@/lib/db/queries';

// ============================================================================
// Types
// ============================================================================

interface AddFavoriteRequest {
  symbol: string;
  note?: string;
}

interface DeleteFavoriteRequest {
  symbol: string;
}

// ============================================================================
// GET Handler - Get favorite stocks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No symbols provided',
      });
    }

    // Parse symbols
    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(s => s.length > 0);

    if (symbols.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Get stock details
    const stocks = await getStocksBySymbols(symbols);

    return NextResponse.json({
      success: true,
      data: stocks,
      count: stocks.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] /api/stocks/favorites GET error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch favorites',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Add to favorites
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: AddFavoriteRequest = await request.json();

    // Validate request
    if (!body.symbol || typeof body.symbol !== 'string') {
      return NextResponse.json(
        { error: 'Invalid symbol' },
        { status: 400 }
      );
    }

    // Verify stock exists
    const stocks = await getStocksBySymbols([body.symbol]);
    if (stocks.length === 0) {
      return NextResponse.json(
        { error: 'Stock not found' },
        { status: 404 }
      );
    }

    const stock = stocks[0]!;

    // Return success
    // Note: Actual storage happens on client side (localStorage)
    return NextResponse.json({
      success: true,
      data: {
        symbol: stock.symbol,
        name: stock.name,
        note: body.note || null,
      },
      message: 'Added to favorites',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] /api/stocks/favorites POST error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add favorite',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler - Remove from favorites
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // Return success
    // Note: Actual deletion happens on client side (localStorage)
    return NextResponse.json({
      success: true,
      message: 'Removed from favorites',
      symbol,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] /api/stocks/favorites DELETE error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove favorite',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS Handler (CORS)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
