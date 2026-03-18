#!/usr/bin/env tsx
/**
 * Initial Data Import Script
 * 初始数据导入脚本
 *
 * This script imports initial stock data into the database.
 * It supports importing stock lists and K-line historical data.
 *
 * Usage:
 *   bun run db:import                 # Import everything (stocks + klines)
 *   bun run db:import:stocks          # Import stocks only
 *   bun run db:import:klines          # Import K-lines only
 *
 * Options:
 *   --stocks-only        Import only stock list
 *   --klines-only        Import only K-line data
 *   --symbols=xxx,yyy    Specific symbols to import (comma-separated)
 *   --limit=N            Limit number of stocks to import
 *   --days=N             Number of days of K-line history (default: 365)
 *   --exchange=SH,SZ     Filter by exchange (default: all)
 *   --batch=N            Batch size for K-line import (default: 10)
 *
 * @module scripts/import-initial-data
 */

import 'dotenv/config';
import { db, stocks, klineDaily } from '../src/lib/db/index';
import { eq, sql } from 'drizzle-orm';

// =============================================================================
// Configuration
// =============================================================================

interface ImportConfig {
  stocksOnly: boolean;
  klinesOnly: boolean;
  symbols: string[];
  limit: number;
  days: number;
  exchanges: ('SH' | 'SZ' | 'BJ')[];
  batchSize: number;
  verbose: boolean;
}

const DEFAULT_CONFIG: ImportConfig = {
  stocksOnly: false,
  klinesOnly: false,
  symbols: [],
  limit: 0, // 0 = unlimited
  days: 365,
  exchanges: ['SH', 'SZ'],
  batchSize: 10,
  verbose: false,
};

// =============================================================================
// EastMoney API
// =============================================================================

const EASTMONEY_STOCK_LIST_URL = 'https://push2.eastmoney.com/api/qt/clist/get';
const EASTMONEY_KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';

/**
 * Market ID mapping for EastMoney
 * 东方财富市场ID映射
 */
const MARKET_ID: Record<string, number> = {
  'SH': 1, // Shanghai
  'SZ': 0, // Shenzhen
  'BJ': 0, // Beijing (uses SZ market ID in some APIs)
};

/**
 * Fetch stock list from EastMoney
 * 从东方财富获取股票列表
 */
async function fetchStockList(
  exchange: 'SH' | 'SZ' | 'BJ',
  limit: number = 5000
): Promise<Array<{
  symbol: string;
  name: string;
  exchange: string;
  industry?: string;
  marketCap?: number;
  isST: boolean;
}>> {
  console.log(`[Import] Fetching stock list for ${exchange}...`);

  // Construct filter string based on exchange
  // f12=code, f14=name, f100=industry, f20=marketCap
  // m:0 = Shenzhen, m:1 = Shanghai
  let fsValue: string;
  switch (exchange) {
    case 'SH':
      fsValue = 'm:1+t:2,m:1+t:23'; // Shanghai main board + STAR Market
      break;
    case 'SZ':
      fsValue = 'm:0+t:6,m:0+t:13,m:0+t:80'; // Shenzhen main board + SME + ChiNext
      break;
    case 'BJ':
      fsValue = 'm:0+t:81'; // Beijing Stock Exchange
      break;
    default:
      fsValue = 'm:0,m:1';
  }

  const params = new URLSearchParams({
    pn: '1',
    pz: limit.toString(),
    po: '1',
    np: '1',
    ut: 'bd1d9ddb04089700cf9c27f6f7426281',
    fltt: '2',
    invt: '2',
    wbp2u: '|0|0|0|web',
    fid: 'f3',
    fs: fsValue,
    fields: 'f12,f14,f100,f20',
  });

  try {
    const response = await fetch(`${EASTMONEY_STOCK_LIST_URL}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as {
      data?: {
        diff?: Array<{
          f12: string; // symbol
          f14: string; // name
          f100: string; // industry
          f20: number; // market cap
        }>;
      };
    };

    const stocks = data?.data?.diff || [];
    console.log(`[Import] Found ${stocks.length} stocks for ${exchange}`);

    return stocks.map(s => ({
      symbol: s.f12,
      name: s.f14,
      exchange,
      industry: s.f100 === '-' ? undefined : s.f100,
      marketCap: s.f20 > 0 ? s.f20 / 100000000 : undefined, // Convert to 亿元
      isST: s.f14.includes('ST'),
    }));
  } catch (error) {
    console.error(`[Import] Failed to fetch stock list for ${exchange}:`, error);
    return [];
  }
}

/**
 * Fetch K-line data from EastMoney
 * 从东方财富获取K线数据
 */
async function fetchKLineData(
  symbol: string,
  exchange: 'SH' | 'SZ' | 'BJ',
  limit: number = 365
): Promise<Array<{
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}>> {
  const marketId = MARKET_ID[exchange];
  const secId = `${marketId}.${symbol}`;

  const params = new URLSearchParams({
    secid: secId,
    ut: 'fa5fd1943c7b386f172d6893dbfba10b',
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101', // Daily
    fqt: '1', // Forward adjustment
    beg: '0',
    end: '20500101',
    lmt: limit.toString(),
    _: Date.now().toString(),
  });

  try {
    const response = await fetch(`${EASTMONEY_KLINE_URL}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as {
      data?: {
        klines?: string[];
      };
    };

    const klines = data?.data?.klines || [];

    return klines.map(line => {
      const parts = line.split(',');
      return {
        date: parts[0] || '',
        open: parseFloat(parts[1] || '0'),
        close: parseFloat(parts[2] || '0'),
        high: parseFloat(parts[3] || '0'),
        low: parseFloat(parts[4] || '0'),
        volume: parseFloat(parts[5] || '0'),
        amount: parseFloat(parts[6] || '0'),
      };
    }).filter(k => k.date && k.open > 0);
  } catch (error) {
    console.error(`[Import] Failed to fetch K-line for ${symbol}:`, error);
    return [];
  }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Import stocks to database
 * 导入股票到数据库
 */
async function importStocks(
  stockList: Array<{
    symbol: string;
    name: string;
    exchange: string;
    industry?: string;
    marketCap?: number;
    isST: boolean;
  }>,
  verbose: boolean = false
): Promise<{ inserted: number; updated: number; failed: number }> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const stock of stockList) {
    try {
      // Try to insert, update on conflict
      await db
        .insert(stocks)
        .values({
          symbol: stock.symbol,
          name: stock.name,
          exchange: stock.exchange,
          industry: stock.industry,
          marketCap: stock.marketCap,
          isST: stock.isST,
          status: 'active',
        })
        .onConflictDoUpdate({
          target: stocks.symbol,
          set: {
            name: stock.name,
            exchange: stock.exchange,
            industry: stock.industry,
            marketCap: stock.marketCap,
            isST: stock.isST,
            updatedAt: new Date(),
          },
        });

      inserted++;
      if (verbose) {
        console.log(`[Import] Imported: ${stock.symbol} ${stock.name}`);
      }
    } catch (error) {
      failed++;
      console.error(`[Import] Failed to import ${stock.symbol}:`, error);
    }
  }

  return { inserted, updated, failed };
}

/**
 * Import K-line data to database
 * 导入K线数据到数据库
 */
async function importKLines(
  stockId: number,
  klines: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    amount: number;
  }>
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // Batch insert with conflict handling
  const BATCH_SIZE = 100;

  for (let i = 0; i < klines.length; i += BATCH_SIZE) {
    const batch = klines.slice(i, i + BATCH_SIZE);

    try {
      const values = batch.map(k => ({
        stockId,
        date: k.date,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        amount: k.amount,
        adjFactor: 1.0,
      }));

      await db
        .insert(klineDaily)
        .values(values)
        .onConflictDoUpdate({
          target: [klineDaily.stockId, klineDaily.date],
          set: {
            open: sql`EXCLUDED.open`,
            high: sql`EXCLUDED.high`,
            low: sql`EXCLUDED.low`,
            close: sql`EXCLUDED.close`,
            volume: sql`EXCLUDED.volume`,
            amount: sql`EXCLUDED.amount`,
          },
        });

      inserted += batch.length;
    } catch (error) {
      skipped += batch.length;
      console.error(`[Import] Batch insert failed:`, error);
    }
  }

  return { inserted, skipped };
}

// =============================================================================
// Main Import Functions
// =============================================================================

/**
 * Import stock list for all configured exchanges
 * 导入所有配置交易所的股票列表
 */
async function runStockImport(config: ImportConfig): Promise<void> {
  console.log('\n========================================');
  console.log('  Lucrum Stock List Import');
  console.log('========================================\n');

  let totalInserted = 0;
  let totalFailed = 0;

  for (const exchange of config.exchanges) {
    console.log(`\n[Import] Processing ${exchange} exchange...`);

    const stockList = await fetchStockList(exchange, config.limit || 5000);

    if (stockList.length === 0) {
      console.log(`[Import] No stocks found for ${exchange}, skipping...`);
      continue;
    }

    // Filter by specific symbols if provided
    const filteredList = config.symbols.length > 0
      ? stockList.filter(s => config.symbols.includes(s.symbol))
      : stockList;

    // Apply limit if provided
    const limitedList = config.limit > 0
      ? filteredList.slice(0, config.limit)
      : filteredList;

    console.log(`[Import] Importing ${limitedList.length} stocks for ${exchange}...`);

    const result = await importStocks(limitedList, config.verbose);
    totalInserted += result.inserted;
    totalFailed += result.failed;

    console.log(`[Import] ${exchange}: Inserted ${result.inserted}, Failed ${result.failed}`);

    // Rate limiting
    await sleep(500);
  }

  console.log('\n----------------------------------------');
  console.log(`Stock Import Complete!`);
  console.log(`Total Inserted: ${totalInserted}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log('----------------------------------------\n');
}

/**
 * Import K-line data for stocks
 * 导入股票K线数据
 */
async function runKLineImport(config: ImportConfig): Promise<void> {
  console.log('\n========================================');
  console.log('  Lucrum K-Line Data Import');
  console.log('========================================\n');

  // Get stocks to import
  let stocksToImport: Array<{ id: number; symbol: string; name: string; exchange: string | null }>;

  if (config.symbols.length > 0) {
    // Specific symbols
    stocksToImport = await db
      .select({
        id: stocks.id,
        symbol: stocks.symbol,
        name: stocks.name,
        exchange: stocks.exchange,
      })
      .from(stocks)
      .where(sql`${stocks.symbol} = ANY(ARRAY[${sql.raw(config.symbols.map(s => `'${s}'`).join(','))}])`);
  } else {
    // All stocks with optional exchange filter
    const exchangeFilter = config.exchanges.length > 0
      ? sql`${stocks.exchange} = ANY(ARRAY[${sql.raw(config.exchanges.map(e => `'${e}'`).join(','))}])`
      : sql`TRUE`;

    stocksToImport = await db
      .select({
        id: stocks.id,
        symbol: stocks.symbol,
        name: stocks.name,
        exchange: stocks.exchange,
      })
      .from(stocks)
      .where(exchangeFilter)
      .limit(config.limit > 0 ? config.limit : 10000);
  }

  console.log(`[Import] Found ${stocksToImport.length} stocks to import K-line data`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let processed = 0;

  // Process in batches
  for (let i = 0; i < stocksToImport.length; i += config.batchSize) {
    const batch = stocksToImport.slice(i, i + config.batchSize);

    await Promise.all(batch.map(async (stock) => {
      try {
        const exchange = (stock.exchange || 'SH') as 'SH' | 'SZ' | 'BJ';
        const klines = await fetchKLineData(stock.symbol, exchange, config.days);

        if (klines.length > 0) {
          const result = await importKLines(stock.id, klines);
          totalInserted += result.inserted;
          totalSkipped += result.skipped;

          if (config.verbose) {
            console.log(`[Import] ${stock.symbol} ${stock.name}: ${result.inserted} records`);
          }
        }

        processed++;
      } catch (error) {
        console.error(`[Import] Error processing ${stock.symbol}:`, error);
      }
    }));

    // Progress update
    const progress = ((i + batch.length) / stocksToImport.length * 100).toFixed(1);
    console.log(`[Import] Progress: ${i + batch.length}/${stocksToImport.length} (${progress}%)`);

    // Rate limiting between batches
    await sleep(1000);
  }

  console.log('\n----------------------------------------');
  console.log(`K-Line Import Complete!`);
  console.log(`Stocks Processed: ${processed}`);
  console.log(`Records Inserted: ${totalInserted}`);
  console.log(`Records Skipped: ${totalSkipped}`);
  console.log('----------------------------------------\n');
}

// =============================================================================
// CLI
// =============================================================================

/**
 * Parse command line arguments
 * 解析命令行参数
 */
function parseArgs(): ImportConfig {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (const arg of args) {
    if (arg === '--stocks-only') {
      config.stocksOnly = true;
    } else if (arg === '--klines-only') {
      config.klinesOnly = true;
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    } else if (arg.startsWith('--symbols=')) {
      config.symbols = arg.split('=')[1]?.split(',').map(s => s.trim()) || [];
    } else if (arg.startsWith('--limit=')) {
      config.limit = parseInt(arg.split('=')[1] || '0', 10);
    } else if (arg.startsWith('--days=')) {
      config.days = parseInt(arg.split('=')[1] || '365', 10);
    } else if (arg.startsWith('--exchange=')) {
      config.exchanges = (arg.split('=')[1]?.split(',') || ['SH', 'SZ']) as ('SH' | 'SZ' | 'BJ')[];
    } else if (arg.startsWith('--batch=')) {
      config.batchSize = parseInt(arg.split('=')[1] || '10', 10);
    }
  }

  return config;
}

/**
 * Sleep helper
 * 休眠帮助函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main entry point
 * 主入口点
 */
async function main(): Promise<void> {
  console.log('Lucrum Database Import Script');
  console.log('==============================\n');

  const config = parseArgs();

  console.log('Configuration:');
  console.log(`  Stocks Only: ${config.stocksOnly}`);
  console.log(`  K-Lines Only: ${config.klinesOnly}`);
  console.log(`  Symbols: ${config.symbols.length > 0 ? config.symbols.join(', ') : 'All'}`);
  console.log(`  Limit: ${config.limit > 0 ? config.limit : 'Unlimited'}`);
  console.log(`  Days: ${config.days}`);
  console.log(`  Exchanges: ${config.exchanges.join(', ')}`);
  console.log(`  Batch Size: ${config.batchSize}`);
  console.log(`  Verbose: ${config.verbose}`);
  console.log('');

  try {
    // Import stocks first (unless klines-only)
    if (!config.klinesOnly) {
      await runStockImport(config);
    }

    // Import K-lines (unless stocks-only)
    if (!config.stocksOnly) {
      await runKLineImport(config);
    }

    console.log('Import completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
