/**
 * Stock Search API
 * 股票搜索API
 *
 * GET /api/stocks/search
 *
 * Fast search with pinyin support and result grouping
 * 支持拼音搜索和结果分组的快速搜索
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStockRepository } from '@/lib/repositories';
import { pinyin } from 'pinyin-pro';
import { dedupRequest } from '@/lib/infra/request-dedup';

// ============================================================================
// Types
// ============================================================================

type MatchType = 'exact' | 'name' | 'pinyin';

interface SearchResult {
  symbol: string;
  name: string;
  displayName: string; // "600519 贵州茅台"
  exchange: string;
  isST: boolean;
  marketCap: number | null;
  matchType: MatchType;
  matchIndices: number[]; // Character indices that matched for highlighting
}

// ============================================================================
// Pinyin Matching Utilities
// ============================================================================

/**
 * Check if query matches the stock name via pinyin (initials or full)
 * Returns matching character indices if matched, null otherwise
 */
function matchPinyin(stockName: string, query: string): number[] | null {
  const lowerQuery = query.toLowerCase();

  // Get pinyin initials for the stock name (e.g., "贵州茅台" → "gzmt")
  const initials = pinyin(stockName, { pattern: 'first', toneType: 'none', type: 'array' });
  const initialsStr = initials.join('').toLowerCase();

  // Match against initials
  if (initialsStr.startsWith(lowerQuery)) {
    // Map matched initials to character indices
    const indices: number[] = [];
    for (let i = 0; i < lowerQuery.length && i < stockName.length; i++) {
      indices.push(i);
    }
    return indices;
  }

  // Get full pinyin for matching (e.g., "贵州茅台" → "guizhoumaotai")
  const fullPinyinArr = pinyin(stockName, { toneType: 'none', type: 'array' });
  const fullPinyin = fullPinyinArr.join('').toLowerCase();

  if (fullPinyin.startsWith(lowerQuery)) {
    // Map matched pinyin characters back to Chinese characters
    const indices: number[] = [];
    let pinyinPos = 0;
    for (let charIdx = 0; charIdx < fullPinyinArr.length; charIdx++) {
      const charPinyin = fullPinyinArr[charIdx]!.toLowerCase();
      if (pinyinPos + charPinyin.length <= lowerQuery.length) {
        indices.push(charIdx);
        pinyinPos += charPinyin.length;
      } else if (pinyinPos < lowerQuery.length) {
        // Partial pinyin match for this character
        indices.push(charIdx);
        break;
      } else {
        break;
      }
    }
    return indices;
  }

  return null;
}

/**
 * Get match type and indices for a stock given a query
 */
function classifyMatch(
  symbol: string,
  name: string,
  query: string
): { matchType: MatchType; matchIndices: number[] } | null {
  const lowerQuery = query.toLowerCase();

  // Exact symbol match (highest priority)
  if (symbol.startsWith(query)) {
    const indices = Array.from({ length: query.length }, (_, i) => i);
    return { matchType: 'exact', matchIndices: indices };
  }

  // Name match
  const nameIdx = name.indexOf(query);
  if (nameIdx !== -1) {
    const indices = Array.from({ length: query.length }, (_, i) => nameIdx + i);
    return { matchType: 'name', matchIndices: indices };
  }

  // Pinyin match (only for non-numeric queries)
  if (!/^\d+$/.test(query)) {
    const pinyinIndices = matchPinyin(name, query);
    if (pinyinIndices) {
      return { matchType: 'pinyin', matchIndices: pinyinIndices };
    }
  }

  return null;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const q = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const excludeST = searchParams.get('excludeST') === 'true';

    // Validate query
    if (!q || q.length < 1) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required (min 1 character)' },
        { status: 400 }
      );
    }

    // Determine if query could be pinyin (contains only latin characters)
    const isPinyinQuery = /^[a-zA-Z]+$/.test(q);

    // Search stocks from DB via repository (symbol + name match)
    // Deduplicate identical concurrent searches (e.g., fast typing triggers)
    const stockRepo = getStockRepository();
    const dbSearchKey = `stock-search:${q}:${excludeST}:${isPinyinQuery ? limit * 3 : limit}`;
    const dbStocks = await dedupRequest(dbSearchKey, () =>
      stockRepo.search(q, {
        excludeST,
        status: 'active',
        limit: isPinyinQuery ? limit * 3 : limit, // Fetch more for pinyin re-ranking
      })
    );

    // If query looks like pinyin but DB returned few results,
    // do a broader search and filter by pinyin on server
    let allCandidates = dbStocks;

    if (isPinyinQuery && dbStocks.length < limit) {
      // For pinyin queries, the DB LIKE search won't match
      // Fetch a broader set of stocks to filter by pinyin
      const broadSearchKey = `stock-search-broad:${excludeST}`;
      const broadStocks = await dedupRequest(broadSearchKey, () =>
        stockRepo.search('%', {
          excludeST,
          status: 'active',
          limit: 200,
        })
      );

      // Merge with existing results, deduplicate
      const seen = new Set(dbStocks.map(s => s.symbol));
      for (const stock of broadStocks) {
        if (!seen.has(stock.symbol)) {
          allCandidates.push(stock);
          seen.add(stock.symbol);
        }
      }
    }

    // Classify and group results
    const exact: SearchResult[] = [];
    const nameMatch: SearchResult[] = [];
    const pinyinMatch: SearchResult[] = [];

    for (const stock of allCandidates) {
      const classification = classifyMatch(stock.symbol, stock.name, q);
      if (!classification) continue;

      const result: SearchResult = {
        symbol: stock.symbol,
        name: stock.name,
        displayName: `${stock.symbol} ${stock.name}`,
        exchange: stock.exchange || 'N/A',
        isST: stock.isST,
        marketCap: stock.marketCap,
        matchType: classification.matchType,
        matchIndices: classification.matchIndices,
      };

      switch (classification.matchType) {
        case 'exact':
          exact.push(result);
          break;
        case 'name':
          nameMatch.push(result);
          break;
        case 'pinyin':
          pinyinMatch.push(result);
          break;
      }
    }

    // Combine in priority order, respecting limit
    const results = [...exact, ...nameMatch, ...pinyinMatch].slice(0, limit);

    // Return response
    return NextResponse.json({
      success: true,
      results,
      groups: {
        exact: exact.length,
        name: nameMatch.length,
        pinyin: pinyinMatch.length,
      },
      total: results.length,
      query: q,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] /api/stocks/search error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
