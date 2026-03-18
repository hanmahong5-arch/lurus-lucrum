/**
 * EastMoney Sector Data Source Implementation
 * 东方财富行业板块数据源实现
 *
 * Provides sector/industry stock lists and sector index data
 * 提供行业板块成分股列表和行业指数数据
 */

import type { KLineData, KLineTimeFrame, ApiResponse } from "../types";
import { logger, createRequestTracker } from "../logger";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const SOURCE_NAME = "eastmoney-sector";
const SECTOR_LIST_URL = "https://push2.eastmoney.com/api/qt/clist/get";
const SECTOR_KLINE_URL =
  "https://push2his.eastmoney.com/api/qt/stock/kline/get";
const DEFAULT_TIMEOUT = 15000;

// =============================================================================
// SECTOR DEFINITIONS / 板块定义
// =============================================================================

/**
 * Shenwan Level 1 Industries (申万一级行业)
 * 31 primary industry sectors
 */
export const SW_SECTORS = [
  { code: "BK0420", name: "电力", nameEn: "Electric Power" },
  { code: "BK0437", name: "银行", nameEn: "Banking" },
  { code: "BK0475", name: "房地产", nameEn: "Real Estate" },
  { code: "BK0428", name: "医药生物", nameEn: "Pharmaceutical" },
  { code: "BK0447", name: "计算机", nameEn: "Computer" },
  { code: "BK0448", name: "电子", nameEn: "Electronics" },
  { code: "BK0424", name: "汽车", nameEn: "Automobile" },
  { code: "BK0465", name: "食品饮料", nameEn: "Food & Beverage" },
  { code: "BK0427", name: "有色金属", nameEn: "Non-ferrous Metals" },
  { code: "BK0423", name: "钢铁", nameEn: "Steel" },
  { code: "BK0430", name: "化工", nameEn: "Chemical" },
  { code: "BK0429", name: "机械设备", nameEn: "Machinery" },
  { code: "BK0438", name: "非银金融", nameEn: "Non-bank Finance" },
  { code: "BK0439", name: "建筑材料", nameEn: "Building Materials" },
  { code: "BK0440", name: "建筑装饰", nameEn: "Construction" },
  { code: "BK0441", name: "交通运输", nameEn: "Transportation" },
  { code: "BK0442", name: "农林牧渔", nameEn: "Agriculture" },
  { code: "BK0443", name: "轻工制造", nameEn: "Light Manufacturing" },
  { code: "BK0444", name: "商贸零售", nameEn: "Retail" },
  { code: "BK0445", name: "社会服务", nameEn: "Social Services" },
  { code: "BK0446", name: "石油石化", nameEn: "Petrochemical" },
  { code: "BK0449", name: "通信", nameEn: "Telecom" },
  { code: "BK0450", name: "纺织服饰", nameEn: "Textile & Apparel" },
  { code: "BK0451", name: "公用事业", nameEn: "Utilities" },
  { code: "BK0452", name: "国防军工", nameEn: "Defense" },
  { code: "BK0453", name: "家用电器", nameEn: "Home Appliances" },
  { code: "BK0454", name: "美容护理", nameEn: "Beauty & Care" },
  { code: "BK0455", name: "煤炭", nameEn: "Coal" },
  { code: "BK0456", name: "传媒", nameEn: "Media" },
  { code: "BK0457", name: "环保", nameEn: "Environmental" },
  { code: "BK0458", name: "综合", nameEn: "Diversified" },
] as const;

/**
 * Popular Concept Sectors (热门概念板块)
 */
export const CONCEPT_SECTORS = [
  { code: "BK0493", name: "人工智能", nameEn: "Artificial Intelligence" },
  { code: "BK1011", name: "新能源汽车", nameEn: "NEV" },
  { code: "BK0825", name: "光伏概念", nameEn: "Solar" },
  { code: "BK1032", name: "储能", nameEn: "Energy Storage" },
  { code: "BK0679", name: "芯片概念", nameEn: "Chip" },
  { code: "BK0891", name: "半导体", nameEn: "Semiconductor" },
  { code: "BK0800", name: "锂电池", nameEn: "Lithium Battery" },
  { code: "BK0992", name: "宁德时代概念", nameEn: "CATL Concept" },
  { code: "BK0816", name: "特斯拉", nameEn: "Tesla" },
  { code: "BK0707", name: "消费电子", nameEn: "Consumer Electronics" },
  { code: "BK0859", name: "机器人概念", nameEn: "Robotics" },
  { code: "BK0536", name: "云计算", nameEn: "Cloud Computing" },
  { code: "BK0850", name: "大数据", nameEn: "Big Data" },
  { code: "BK0511", name: "物联网", nameEn: "IoT" },
  { code: "BK0886", name: "5G", nameEn: "5G" },
] as const;

/**
 * Sector index code mapping
 * 行业指数代码映射 (板块代码 -> 指数代码)
 */
export const SECTOR_INDEX_MAP: Record<string, string> = {
  // Shenwan indices use different format
  // 申万指数使用不同格式
  BK0420: "90.BK0420", // Electric Power
  BK0437: "90.BK0437", // Banking
  BK0475: "90.BK0475", // Real Estate
  BK0428: "90.BK0428", // Pharmaceutical
  BK0447: "90.BK0447", // Computer
  BK0448: "90.BK0448", // Electronics
  // ... add more as needed
};

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Sector stock information
 * 板块成分股信息
 */
export interface SectorStock {
  symbol: string; // Stock code / 股票代码
  name: string; // Stock name / 股票名称
  price: number; // Current price / 当前价格
  changePercent: number; // Change percentage / 涨跌幅
  volume: number; // Volume / 成交量
  amount: number; // Amount / 成交额
  pe: number | null; // P/E ratio / 市盈率
  pb: number | null; // P/B ratio / 市净率
  marketCap: number | null; // Market cap / 总市值
  high: number; // High price / 最高价
  low: number; // Low price / 最低价
  open: number; // Open price / 开盘价
  prevClose: number; // Previous close / 昨收价
}

/**
 * Sector information
 * 板块信息
 */
export interface SectorInfo {
  code: string; // Sector code / 板块代码
  name: string; // Sector name / 板块名称
  nameEn: string; // English name / 英文名称
  type: "industry" | "concept"; // Sector type / 板块类型
}

/**
 * Sector stock list response
 * 板块成分股列表响应
 */
export interface SectorStocksResponse {
  sector: SectorInfo;
  stocks: SectorStock[];
  totalCount: number;
  timestamp: number;
}

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Get sector info by code
 * 根据代码获取板块信息
 */
export function getSectorInfo(sectorCode: string): SectorInfo | null {
  // Check industry sectors
  const industry = SW_SECTORS.find((s) => s.code === sectorCode);
  if (industry) {
    return {
      code: industry.code,
      name: industry.name,
      nameEn: industry.nameEn,
      type: "industry",
    };
  }

  // Check concept sectors
  const concept = CONCEPT_SECTORS.find((s) => s.code === sectorCode);
  if (concept) {
    return {
      code: concept.code,
      name: concept.name,
      nameEn: concept.nameEn,
      type: "concept",
    };
  }

  return null;
}

/**
 * Get sector name by code
 * 根据代码获取板块名称
 */
export function getSectorName(sectorCode: string): string {
  const info = getSectorInfo(sectorCode);
  return info ? info.name : sectorCode;
}

/**
 * Get all available sectors
 * 获取所有可用板块
 */
export function getAllSectors(): SectorInfo[] {
  const industries = SW_SECTORS.map((s) => ({
    code: s.code,
    name: s.name,
    nameEn: s.nameEn,
    type: "industry" as const,
  }));

  const concepts = CONCEPT_SECTORS.map((s) => ({
    code: s.code,
    name: s.name,
    nameEn: s.nameEn,
    type: "concept" as const,
  }));

  return [...industries, ...concepts];
}

/**
 * Fetch with timeout
 * 带超时的fetch
 */
async function fetchWithTimeout(
  url: string,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://quote.eastmoney.com/",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse sector stock list response
 * 解析板块成分股列表响应
 */
function parseSectorStocksResponse(
  data: Record<string, unknown>,
): SectorStock[] {
  try {
    const d = data.data as Record<string, unknown>;
    if (!d || !d.diff) return [];

    const stocks = d.diff as Array<Record<string, unknown>>;
    return stocks
      .map((item) => {
        // f12: code, f14: name, f2: price, f3: changePercent
        // f5: volume, f6: amount, f9: pe, f23: pb
        // f15: high, f16: low, f17: open, f18: prevClose
        // f20: marketCap
        const price = Number(item.f2 ?? 0);
        const pe =
          item.f9 !== undefined && item.f9 !== "-" ? Number(item.f9) : null;
        const pb =
          item.f23 !== undefined && item.f23 !== "-" ? Number(item.f23) : null;
        const marketCap =
          item.f20 !== undefined && item.f20 !== "-" ? Number(item.f20) : null;

        return {
          symbol: String(item.f12 ?? ""),
          name: String(item.f14 ?? ""),
          price: price / 100,
          changePercent: Number(item.f3 ?? 0) / 100,
          volume: Number(item.f5 ?? 0),
          amount: Number(item.f6 ?? 0),
          pe: pe,
          pb: pb,
          marketCap: marketCap,
          high: Number(item.f15 ?? 0) / 100,
          low: Number(item.f16 ?? 0) / 100,
          open: Number(item.f17 ?? 0) / 100,
          prevClose: Number(item.f18 ?? 0) / 100,
        };
      })
      .filter((stock) => stock.symbol && stock.name); // Filter out invalid entries
  } catch (err) {
    logger.error(SOURCE_NAME, "Failed to parse sector stocks response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Parse K-line response
 * 解析K线响应
 */
function parseKLineResponse(data: Record<string, unknown>): KLineData[] {
  try {
    const d = data.data as Record<string, unknown>;
    if (!d || !d.klines) return [];

    const klines = d.klines as string[];
    return klines.map((line) => {
      const parts = line.split(",");
      const timeStr = parts[0] ?? "";
      // Parse time string to timestamp
      const date = new Date(timeStr.replace(/-/g, "/"));

      return {
        time: Math.floor(date.getTime() / 1000),
        open: parseFloat(parts[1] ?? "0"),
        close: parseFloat(parts[2] ?? "0"),
        high: parseFloat(parts[3] ?? "0"),
        low: parseFloat(parts[4] ?? "0"),
        volume: parseFloat(parts[5] ?? "0"),
        amount: parseFloat(parts[6] ?? "0"),
      };
    });
  } catch (err) {
    logger.error(SOURCE_NAME, "Failed to parse K-line response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Get K-line period parameter
 * 获取K线周期参数
 */
function getKLinePeriod(timeframe: KLineTimeFrame): number {
  const periodMap: Record<KLineTimeFrame, number> = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "60m": 60,
    "1d": 101,
    "1w": 102,
    "1M": 103,
  };
  return periodMap[timeframe] ?? 101;
}

// =============================================================================
// API FUNCTIONS / API函数
// =============================================================================

/**
 * Get sector constituent stocks
 * 获取板块成分股列表
 *
 * @param sectorCode - Sector code (e.g., "BK0420" for Electric Power)
 * @param limit - Maximum number of stocks to return (default 100)
 * @returns Promise with sector stocks response
 */
export async function getSectorStocks(
  sectorCode: string,
  limit: number = 100,
): Promise<ApiResponse<SectorStocksResponse>> {
  const tracker = createRequestTracker(SOURCE_NAME, `sector/${sectorCode}`);

  try {
    // Build request URL
    // Fields: f2(price), f3(changePercent), f5(volume), f6(amount),
    //         f9(pe), f12(code), f14(name), f15(high), f16(low),
    //         f17(open), f18(prevClose), f20(marketCap), f23(pb)
    const params = new URLSearchParams({
      pn: "1", // Page number
      pz: String(limit), // Page size
      po: "1", // Sort order (1=descending)
      np: "1",
      ut: "bd1d9ddb04089700cf9c27f6f7426281",
      fltt: "2",
      invt: "2",
      fid: "f3", // Sort by change percent
      fs: `b:${sectorCode}`, // Sector filter
      fields: "f2,f3,f5,f6,f9,f12,f14,f15,f16,f17,f18,f20,f23",
    });

    const url = `${SECTOR_LIST_URL}?${params.toString()}`;

    logger.debug(SOURCE_NAME, `Fetching sector stocks for ${sectorCode}`, {
      limit,
    });

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const stocks = parseSectorStocksResponse(data);

    // Get sector info
    const sectorInfo = getSectorInfo(sectorCode);
    if (!sectorInfo) {
      throw new Error(`Unknown sector code: ${sectorCode}`);
    }

    const result: SectorStocksResponse = {
      sector: sectorInfo,
      stocks,
      totalCount: stocks.length,
      timestamp: Date.now(),
    };

    const metrics = tracker.complete("success", {
      statusCode: response.status,
      cached: false,
    });

    return {
      success: true,
      data: result,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });

    logger.error(
      SOURCE_NAME,
      `Failed to fetch sector stocks for ${sectorCode}`,
      {
        error: errorMessage,
      },
    );

    return {
      success: false,
      data: null,
      error: errorMessage,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: 0,
    };
  }
}

/**
 * Get sector index K-line data
 * 获取板块指数K线数据
 *
 * @param sectorCode - Sector code (e.g., "BK0420")
 * @param timeframe - K-line timeframe (default "1d")
 * @param limit - Number of K-lines to return (default 120)
 * @returns Promise with K-line data
 */
export async function getSectorIndexKline(
  sectorCode: string,
  timeframe: KLineTimeFrame = "1d",
  limit: number = 120,
): Promise<ApiResponse<KLineData[]>> {
  const tracker = createRequestTracker(
    SOURCE_NAME,
    `sector-kline/${sectorCode}/${timeframe}`,
  );

  try {
    // Use sector code directly as secid for sector index
    // Format: 90.BKxxxx for sector indices
    const secId = `90.${sectorCode}`;
    const klt = getKLinePeriod(timeframe);

    const params = new URLSearchParams({
      secid: secId,
      klt: String(klt),
      fqt: "1", // Forward adjustment / 前复权
      lmt: String(limit),
      end: "20500101",
      fields1: "f1,f2,f3,f4,f5,f6,f7,f8",
      fields2: "f51,f52,f53,f54,f55,f56,f57,f58",
    });

    const url = `${SECTOR_KLINE_URL}?${params.toString()}`;

    logger.debug(
      SOURCE_NAME,
      `Fetching sector index K-line for ${sectorCode}`,
      {
        timeframe,
        limit,
      },
    );

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const klines = parseKLineResponse(data);

    if (klines.length === 0) {
      // Try alternative format for sector index
      logger.warn(
        SOURCE_NAME,
        `No K-line data for ${sectorCode}, trying alternative`,
        {},
      );
    }

    const metrics = tracker.complete("success", {
      statusCode: response.status,
      cached: false,
    });

    return {
      success: true,
      data: klines,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });

    logger.error(
      SOURCE_NAME,
      `Failed to fetch sector index K-line for ${sectorCode}`,
      {
        error: errorMessage,
        timeframe,
      },
    );

    return {
      success: false,
      data: null,
      error: errorMessage,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: 0,
    };
  }
}

/**
 * Get multiple sector stocks in batch
 * 批量获取多个板块的成分股
 *
 * @param sectorCodes - Array of sector codes
 * @param limitPerSector - Max stocks per sector
 * @returns Promise with map of sector code to stocks
 */
export async function getBatchSectorStocks(
  sectorCodes: string[],
  limitPerSector: number = 50,
): Promise<Map<string, SectorStocksResponse>> {
  const results = new Map<string, SectorStocksResponse>();

  // Process in chunks to avoid overwhelming the API
  const chunkSize = 5;
  for (let i = 0; i < sectorCodes.length; i += chunkSize) {
    const chunk = sectorCodes.slice(i, i + chunkSize);

    const promises = chunk.map(async (code) => {
      const response = await getSectorStocks(code, limitPerSector);
      if (response.success && response.data) {
        results.set(code, response.data);
      }
    });

    await Promise.all(promises);

    // Small delay between chunks to be respectful to the API
    if (i + chunkSize < sectorCodes.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Search sectors by name
 * 按名称搜索板块
 *
 * @param query - Search query
 * @returns Array of matching sectors
 */
export function searchSectors(query: string): SectorInfo[] {
  const lowerQuery = query.toLowerCase();
  const allSectors = getAllSectors();

  return allSectors.filter(
    (sector) =>
      sector.name.includes(query) ||
      sector.nameEn.toLowerCase().includes(lowerQuery) ||
      sector.code.toLowerCase().includes(lowerQuery),
  );
}
