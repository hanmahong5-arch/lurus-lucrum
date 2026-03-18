/**
 * Symbol Information Service
 * 股票/标的名称映射服务
 *
 * Provides symbol name mapping for display in backtest results.
 * This module maintains a comprehensive mapping of common A-share stocks,
 * indices, ETFs, futures, and cryptocurrencies.
 *
 * @module lib/backtest/symbol-info
 */

import { detectAssetType, type AssetType } from "./lot-size";

// =============================================================================
// SYMBOL NAME MAPPING / 股票名称映射
// =============================================================================

/**
 * Comprehensive symbol name mapping
 * 综合股票名称映射表 (200+ symbols)
 */
export const SYMBOL_NAME_MAP: Record<string, string> = {
  // =========================================================================
  // 主要指数 / Major Indices
  // =========================================================================
  "000001.SH": "上证指数",
  "000002.SH": "A股指数",
  "000003.SH": "B股指数",
  "000016.SH": "上证50",
  "000300.SH": "沪深300",
  "000905.SH": "中证500",
  "000852.SH": "中证1000",
  "000688.SH": "科创50",
  "399001.SZ": "深证成指",
  "399005.SZ": "中小100",
  "399006.SZ": "创业板指",
  "399673.SZ": "创业板50",
  "399550.SZ": "央视50",

  // =========================================================================
  // 上证蓝筹 / Shanghai Blue Chips (600xxx)
  // =========================================================================
  "600000.SH": "浦发银行",
  "600009.SH": "上海机场",
  "600010.SH": "包钢股份",
  "600011.SH": "华能国际",
  "600015.SH": "华夏银行",
  "600016.SH": "民生银行",
  "600018.SH": "上港集团",
  "600019.SH": "宝钢股份",
  "600023.SH": "浙能电力",
  "600025.SH": "华能水电",
  "600028.SH": "中国石化",
  "600029.SH": "南方航空",
  "600030.SH": "中信证券",
  "600031.SH": "三一重工",
  "600036.SH": "招商银行",
  "600048.SH": "保利发展",
  "600050.SH": "中国联通",
  "600061.SH": "国投资本",
  "600066.SH": "宇通客车",
  "600068.SH": "葛洲坝",
  "600085.SH": "同仁堂",
  "600089.SH": "特变电工",
  "600104.SH": "上汽集团",
  "600109.SH": "国金证券",
  "600111.SH": "北方稀土",
  "600115.SH": "中国东航",
  "600118.SH": "中国卫星",
  "600150.SH": "中国船舶",
  "600176.SH": "中国巨石",
  "600183.SH": "生益科技",
  "600188.SH": "兖矿能源",
  "600196.SH": "复星医药",
  "600256.SH": "广汇能源",
  "600276.SH": "恒瑞医药",
  "600309.SH": "万华化学",
  "600332.SH": "白云山",
  "600346.SH": "恒力石化",
  "600352.SH": "浙江龙盛",
  "600362.SH": "江西铜业",
  "600406.SH": "国电南瑞",
  "600436.SH": "片仔癀",
  "600438.SH": "通威股份",
  "600487.SH": "亨通光电",
  "600489.SH": "中金黄金",
  "600519.SH": "贵州茅台",
  "600547.SH": "山东黄金",
  "600570.SH": "恒生电子",
  "600585.SH": "海螺水泥",
  "600588.SH": "用友网络",
  "600600.SH": "青岛啤酒",
  "600606.SH": "绿地控股",
  "600660.SH": "福耀玻璃",
  "600690.SH": "海尔智家",
  "600703.SH": "三安光电",
  "600741.SH": "华域汽车",
  "600745.SH": "闻泰科技",
  "600760.SH": "中航沈飞",
  "600795.SH": "国电电力",
  "600809.SH": "山西汾酒",
  "600837.SH": "海通证券",
  "600845.SH": "宝信软件",
  "600848.SH": "上海临港",
  "600867.SH": "通化东宝",
  "600886.SH": "国投电力",
  "600887.SH": "伊利股份",
  "600893.SH": "航发动力",
  "600900.SH": "长江电力",
  "600905.SH": "三峡能源",
  "600918.SH": "中泰证券",
  "600919.SH": "江苏银行",
  "600926.SH": "杭州银行",
  "600941.SH": "中国移动",
  "600958.SH": "东方证券",
  "600989.SH": "宝丰能源",
  "600999.SH": "招商证券",

  // =========================================================================
  // 上证大型 / Shanghai Large Cap (601xxx)
  // =========================================================================
  "601006.SH": "大秦铁路",
  "601009.SH": "南京银行",
  "601012.SH": "隆基绿能",
  "601088.SH": "中国神华",
  "601111.SH": "中国国航",
  "601117.SH": "中国化学",
  "601138.SH": "工业富联",
  "601155.SH": "新城控股",
  "601166.SH": "兴业银行",
  "601169.SH": "北京银行",
  "601186.SH": "中国铁建",
  "601211.SH": "国泰君安",
  "601225.SH": "陕西煤业",
  "601229.SH": "上海银行",
  "601236.SH": "红塔证券",
  "601288.SH": "农业银行",
  "601318.SH": "中国平安",
  "601319.SH": "中国人保",
  "601328.SH": "交通银行",
  "601336.SH": "新华保险",
  "601360.SH": "三六零",
  "601377.SH": "兴业证券",
  "601390.SH": "中国中铁",
  "601398.SH": "工商银行",
  "601601.SH": "中国太保",
  "601618.SH": "中国中冶",
  "601628.SH": "中国人寿",
  "601633.SH": "长城汽车",
  "601668.SH": "中国建筑",
  "601669.SH": "中国电建",
  "601688.SH": "华泰证券",
  "601698.SH": "中国卫通",
  "601728.SH": "中国电信",
  "601766.SH": "中国中车",
  "601788.SH": "光大证券",
  "601799.SH": "星宇股份",
  "601800.SH": "中国交建",
  "601808.SH": "中海油服",
  "601816.SH": "京沪高铁",
  "601818.SH": "光大银行",
  "601838.SH": "成都银行",
  "601857.SH": "中国石油",
  "601877.SH": "正泰电器",
  "601881.SH": "中国银河",
  "601888.SH": "中国中免",
  "601898.SH": "中煤能源",
  "601899.SH": "紫金矿业",
  "601901.SH": "方正证券",
  "601919.SH": "中远海控",
  "601939.SH": "建设银行",
  "601985.SH": "中国核电",
  "601988.SH": "中国银行",
  "601989.SH": "中国重工",
  "601995.SH": "中金公司",
  "601998.SH": "中信银行",

  // =========================================================================
  // 深证主板 / Shenzhen Main Board (000xxx)
  // =========================================================================
  "000001.SZ": "平安银行",
  "000002.SZ": "万科A",
  "000063.SZ": "中兴通讯",
  "000066.SZ": "中国长城",
  "000069.SZ": "华侨城A",
  "000100.SZ": "TCL科技",
  "000157.SZ": "中联重科",
  "000166.SZ": "申万宏源",
  "000333.SZ": "美的集团",
  "000338.SZ": "潍柴动力",
  "000400.SZ": "许继电气",
  "000401.SZ": "冀东水泥",
  "000402.SZ": "金融街",
  "000423.SZ": "东阿阿胶",
  "000425.SZ": "徐工机械",
  "000538.SZ": "云南白药",
  "000539.SZ": "粤电力A",
  "000568.SZ": "泸州老窖",
  "000581.SZ": "威孚高科",
  "000591.SZ": "太阳能",
  "000596.SZ": "古井贡酒",
  "000617.SZ": "中油资本",
  "000625.SZ": "长安汽车",
  "000651.SZ": "格力电器",
  "000656.SZ": "金科股份",
  "000661.SZ": "长春高新",
  "000671.SZ": "阳光城",
  "000703.SZ": "恒逸石化",
  "000708.SZ": "中信特钢",
  "000709.SZ": "河钢股份",
  "000725.SZ": "京东方A",
  "000728.SZ": "国元证券",
  "000768.SZ": "中航飞机",
  "000776.SZ": "广发证券",
  "000783.SZ": "长江证券",
  "000786.SZ": "北新建材",
  "000792.SZ": "盐湖股份",
  "000800.SZ": "一汽解放",
  "000807.SZ": "云铝股份",
  "000858.SZ": "五粮液",
  "000876.SZ": "新希望",
  "000877.SZ": "天山股份",
  "000883.SZ": "湖北能源",
  "000895.SZ": "双汇发展",
  "000898.SZ": "鞍钢股份",
  "000938.SZ": "紫光股份",
  "000963.SZ": "华东医药",
  "000977.SZ": "浪潮信息",
  "000983.SZ": "西山煤电",

  // =========================================================================
  // 创业板 / ChiNext (300xxx)
  // =========================================================================
  "300001.SZ": "特锐德",
  "300002.SZ": "神州泰岳",
  "300003.SZ": "乐普医疗",
  "300012.SZ": "华测检测",
  "300014.SZ": "亿纬锂能",
  "300015.SZ": "爱尔眼科",
  "300017.SZ": "网宿科技",
  "300024.SZ": "机器人",
  "300033.SZ": "同花顺",
  "300059.SZ": "东方财富",
  "300122.SZ": "智飞生物",
  "300124.SZ": "汇川技术",
  "300136.SZ": "信维通信",
  "300142.SZ": "沃森生物",
  "300144.SZ": "宋城演艺",
  "300146.SZ": "汤臣倍健",
  "300347.SZ": "泰格医药",
  "300408.SZ": "三环集团",
  "300413.SZ": "芒果超媒",
  "300433.SZ": "蓝思科技",
  "300450.SZ": "先导智能",
  "300454.SZ": "深信服",
  "300496.SZ": "中科创达",
  "300498.SZ": "温氏股份",
  "300601.SZ": "康泰生物",
  "300628.SZ": "亿联网络",
  "300661.SZ": "圣邦股份",
  "300676.SZ": "华大基因",
  "300750.SZ": "宁德时代",
  "300759.SZ": "康龙化成",
  "300760.SZ": "迈瑞医疗",
  "300782.SZ": "卓胜微",
  "300832.SZ": "新产业",
  "300896.SZ": "爱美客",

  // =========================================================================
  // 科创板 / STAR Market (688xxx)
  // =========================================================================
  "688001.SH": "华兴源创",
  "688005.SH": "容百科技",
  "688009.SH": "中国通号",
  "688012.SH": "中微公司",
  "688036.SH": "传音控股",
  "688111.SH": "金山办公",
  "688126.SH": "沪硅产业",
  "688139.SH": "海尔生物",
  "688169.SH": "石头科技",
  "688180.SH": "君实生物",
  "688185.SH": "康希诺",
  "688187.SH": "时代电气",
  "688188.SH": "柏楚电子",
  "688256.SH": "寒武纪",
  "688269.SH": "凯赛生物",
  "688271.SH": "联影医疗",
  "688303.SH": "大全能源",
  "688363.SH": "华熙生物",
  "688396.SH": "华润微",
  "688516.SH": "奥特维",
  "688536.SH": "思瑞浦",
  "688561.SH": "奇安信",
  "688599.SH": "天合光能",
  "688617.SH": "惠泰医疗",
  "688728.SH": "格科微",
  "688778.SH": "厦钨新能",
  "688981.SH": "中芯国际",

  // =========================================================================
  // 北交所 / BSE (8xxxxx)
  // =========================================================================
  "830799.BJ": "艾融软件",
  "831856.BJ": "浙江大农",
  "832317.BJ": "观典防务",
  "833819.BJ": "颖泰生物",
  "834021.BJ": "流金岁月",
  "835185.BJ": "贝特瑞",
  "836149.BJ": "旭杰科技",
  "836239.BJ": "长虹能源",
  "838171.BJ": "邦德股份",
  "838275.BJ": "驱动力",
  "838810.BJ": "春光药装",
  "838971.BJ": "天马新材",
  "839167.BJ": "同力股份",
  "871981.BJ": "晶赛科技",

  // =========================================================================
  // 主要ETF / Major ETFs
  // =========================================================================
  "510050.SH": "上证50ETF",
  "510300.SH": "沪深300ETF",
  "510500.SH": "中证500ETF",
  "510880.SH": "红利ETF",
  "512000.SH": "券商ETF",
  "512010.SH": "医药ETF",
  "512100.SH": "中证1000ETF",
  "512480.SH": "半导体ETF",
  "512660.SH": "军工ETF",
  "512690.SH": "酒ETF",
  "512760.SH": "芯片ETF",
  "512800.SH": "银行ETF",
  "512880.SH": "证券ETF",
  "512980.SH": "传媒ETF",
  "513050.SH": "中概互联ETF",
  "513100.SH": "纳指ETF",
  "513180.SH": "恒生科技ETF",
  "513500.SH": "标普500ETF",
  "515030.SH": "新能源车ETF",
  "515050.SH": "5GETF",
  "515180.SH": "100ETF",
  "515790.SH": "光伏ETF",
  "515880.SH": "通信ETF",
  "516160.SH": "新能源ETF",
  "518880.SH": "黄金ETF",
  "159001.SZ": "保证金ETF",
  "159605.SZ": "A50ETF",
  "159632.SZ": "消费ETF",
  "159819.SZ": "人工智能ETF",
  "159869.SZ": "游戏ETF",
  "159915.SZ": "创业板ETF",
  "159919.SZ": "深300ETF",
  "159922.SZ": "中证500ETF",
  "159949.SZ": "创业板50ETF",

  // =========================================================================
  // 期货品种 / Futures Contracts
  // =========================================================================
  IF: "沪深300股指期货",
  IC: "中证500股指期货",
  IH: "上证50股指期货",
  IM: "中证1000股指期货",
  T: "10年期国债期货",
  TF: "5年期国债期货",
  TS: "2年期国债期货",
  AU: "黄金期货",
  AG: "白银期货",
  CU: "铜期货",
  AL: "铝期货",
  ZN: "锌期货",
  PB: "铅期货",
  NI: "镍期货",
  SN: "锡期货",
  RB: "螺纹钢期货",
  HC: "热卷期货",
  I: "铁矿石期货",
  J: "焦炭期货",
  JM: "焦煤期货",
  FG: "玻璃期货",
  SA: "纯碱期货",
  C: "玉米期货",
  A: "大豆期货",
  M: "豆粕期货",
  Y: "豆油期货",
  P: "棕榈油期货",
  OI: "菜籽油期货",
  CF: "棉花期货",
  SR: "白糖期货",
  TA: "PTA期货",
  MA: "甲醇期货",
  PP: "聚丙烯期货",
  L: "塑料期货",
  V: "PVC期货",
  EB: "苯乙烯期货",
  EG: "乙二醇期货",
  SC: "原油期货",
  FU: "燃油期货",
  LU: "低硫燃油期货",
  PG: "液化气期货",
  RU: "橡胶期货",
  NR: "20号胶期货",
  SP: "纸浆期货",
  AP: "苹果期货",
  CJ: "红枣期货",
  PK: "花生期货",
  LH: "生猪期货",

  // =========================================================================
  // 加密货币 / Cryptocurrencies
  // =========================================================================
  "BTC/USDT": "比特币",
  "ETH/USDT": "以太坊",
  "BNB/USDT": "币安币",
  "SOL/USDT": "Solana",
  "XRP/USDT": "瑞波币",
  "ADA/USDT": "艾达币",
  "AVAX/USDT": "雪崩",
  "DOGE/USDT": "狗狗币",
  "DOT/USDT": "波卡",
  "MATIC/USDT": "Polygon",
  "SHIB/USDT": "柴犬币",
  "TRX/USDT": "波场",
  "LINK/USDT": "Chainlink",
  "UNI/USDT": "Uniswap",
  "ATOM/USDT": "Cosmos",
  "LTC/USDT": "莱特币",
  "ETC/USDT": "以太经典",
  "XLM/USDT": "恒星币",
  "NEAR/USDT": "Near",
  "FIL/USDT": "Filecoin",
  "APT/USDT": "Aptos",
  "ARB/USDT": "Arbitrum",
  "OP/USDT": "Optimism",
  BTCUSDT: "比特币",
  ETHUSDT: "以太坊",
  BNBUSDT: "币安币",
  SOLUSDT: "Solana",
};

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Get symbol name from mapping
 * 从映射表获取股票名称
 *
 * @param symbol - Stock symbol code
 * @returns Symbol name or code if not found
 */
export function getSymbolName(symbol: string): string {
  if (!symbol) return "";

  // Normalize the symbol
  const normalized = normalizeSymbol(symbol);

  // Direct lookup
  if (SYMBOL_NAME_MAP[normalized]) {
    return SYMBOL_NAME_MAP[normalized];
  }

  // Try with suffix variations
  const codeOnly = normalized.split(".")[0] || normalized;
  const variations: string[] = [
    normalized,
    `${normalized}.SH`,
    `${normalized}.SZ`,
    `${normalized}.BJ`,
    normalized.replace(".SS", ".SH"), // Yahoo Finance format
    codeOnly, // Code only
  ];

  for (const variant of variations) {
    if (variant && SYMBOL_NAME_MAP[variant]) {
      return SYMBOL_NAME_MAP[variant];
    }
  }

  // For futures, try base code
  const baseCode = symbol.replace(/\d+$/, "").toUpperCase();
  if (SYMBOL_NAME_MAP[baseCode]) {
    return SYMBOL_NAME_MAP[baseCode];
  }

  // Return code as fallback
  return symbol;
}

/**
 * Normalize symbol to standard format
 * 标准化股票代码格式
 */
function normalizeSymbol(symbol: string): string {
  if (!symbol) return "";

  // Remove whitespace
  let normalized = symbol.trim().toUpperCase();

  // Handle Yahoo Finance format (.SS -> .SH)
  normalized = normalized.replace(".SS", ".SH");

  return normalized;
}

/**
 * Format symbol for display with name and code
 * 格式化显示股票名称和代码
 *
 * @param symbol - Stock symbol code
 * @returns Formatted string like "贵州茅台 (600519)"
 */
export function formatSymbolDisplay(symbol: string): string {
  const name = getSymbolName(symbol);
  const code = symbol.split(".")[0]; // Get code without suffix

  if (name === symbol) {
    return symbol;
  }

  return `${name} (${code})`;
}

/**
 * Get quantity unit based on asset type
 * 根据资产类型获取数量单位
 *
 * @param symbol - Stock symbol
 * @returns Unit string ("股"/"手"/"张"/"个")
 */
export function getQuantityUnit(symbol: string): string {
  const assetType = detectAssetType(symbol);

  switch (assetType) {
    case "stock":
    case "etf":
    case "index":
      return "股";
    case "bond":
      return "张";
    case "futures":
      return "手";
    case "crypto":
      return "个";
    default:
      return "股";
  }
}

/**
 * Get market name from symbol suffix
 * 从股票代码后缀获取市场名称
 *
 * @param symbol - Stock symbol with suffix
 * @returns Market name
 */
export function getMarketName(symbol: string): string {
  if (!symbol) return "";

  const upper = symbol.toUpperCase();

  if (upper.endsWith(".SH") || upper.endsWith(".SS")) {
    return "上海";
  }
  if (upper.endsWith(".SZ")) {
    return "深圳";
  }
  if (upper.endsWith(".BJ")) {
    return "北京";
  }

  // Check code patterns
  const code = symbol.split(".")[0] || symbol;
  if (/^6\d{5}$/.test(code)) return "上海";
  if (/^0\d{5}$/.test(code) || /^3\d{5}$/.test(code)) return "深圳";
  if (/^8\d{5}$/.test(code)) return "北京";

  // Futures
  if (/^[A-Z]{1,2}\d*$/.test(code)) return "期货";

  // Crypto
  if (symbol.includes("USDT") || symbol.includes("/")) return "加密";

  return "";
}

/**
 * Format quantity with lots info
 * 格式化数量显示（包含手数信息）
 *
 * @param quantity - Number of shares
 * @param lotSize - Lot size (e.g., 100 for stocks)
 * @param unit - Quantity unit
 * @returns Formatted string like "500股 (5手)"
 */
export function formatQuantityWithLots(
  quantity: number,
  lotSize: number,
  unit: string = "股",
): string {
  const lots = Math.floor(quantity / lotSize);
  const formattedQty = quantity.toLocaleString();

  if (lotSize === 1) {
    return `${formattedQty}${unit}`;
  }

  return `${formattedQty}${unit} (${lots}手)`;
}

/**
 * Check if symbol is in the mapping
 * 检查股票代码是否在映射表中
 */
export function isSymbolMapped(symbol: string): boolean {
  return getSymbolName(symbol) !== symbol;
}

/**
 * Get all mapped symbols for a market
 * 获取某个市场的所有已映射股票
 */
export function getSymbolsByMarket(market: "SH" | "SZ" | "BJ"): string[] {
  return Object.keys(SYMBOL_NAME_MAP).filter((s) => s.endsWith(`.${market}`));
}

/**
 * Search symbols by name or code
 * 按名称或代码搜索股票
 */
export function searchSymbols(
  query: string,
  limit: number = 10,
): Array<{ symbol: string; name: string }> {
  if (!query) return [];

  const normalizedQuery = query.toLowerCase();
  const results: Array<{ symbol: string; name: string }> = [];

  for (const [symbol, name] of Object.entries(SYMBOL_NAME_MAP)) {
    if (
      symbol.toLowerCase().includes(normalizedQuery) ||
      name.toLowerCase().includes(normalizedQuery)
    ) {
      results.push({ symbol, name });
      if (results.length >= limit) break;
    }
  }

  return results;
}
