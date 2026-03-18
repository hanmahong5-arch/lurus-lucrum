/**
 * Investment Data Sources Configuration
 * 投资数据源配置
 *
 * Categorized by data type and reliability
 * 按数据类型和可靠性分类
 */

// =============================================================================
// DATA SOURCE REGISTRY / 数据源注册表
// =============================================================================

export interface DataSource {
  id: string;
  name: string;
  nameEn: string;
  category: DataCategory;
  type: DataType;
  reliability: "official" | "professional" | "community" | "aggregator";
  updateFrequency: string;
  accessMethod: "api" | "scrape" | "manual" | "subscription";
  url: string;
  description: string;
  dataPoints: string[];
  priority: number; // 1-10, higher is more important
}

export type DataCategory =
  | "macro-policy"      // 宏观政策
  | "market-data"       // 市场数据
  | "capital-flow"      // 资金流向
  | "fundamental"       // 基本面
  | "technical"         // 技术面
  | "sentiment"         // 情绪面
  | "alternative";      // 另类数据

export type DataType =
  | "government"        // 政府官方
  | "exchange"          // 交易所
  | "broker"            // 券商
  | "media"             // 财经媒体
  | "research"          // 研究机构
  | "social"            // 社交平台
  | "data-vendor";      // 数据供应商

// =============================================================================
// CHINA A-SHARE MARKET SOURCES / A股市场数据源
// =============================================================================

export const CHINA_DATA_SOURCES: DataSource[] = [
  // ===== MACRO POLICY SOURCES / 宏观政策数据源 =====
  {
    id: "gov-cn",
    name: "中国政府网",
    nameEn: "gov.cn",
    category: "macro-policy",
    type: "government",
    reliability: "official",
    updateFrequency: "real-time",
    accessMethod: "scrape",
    url: "https://www.gov.cn",
    description: "国务院政策文件、总理讲话、重要会议精神",
    dataPoints: ["政策文件", "会议决策", "政府工作报告"],
    priority: 10,
  },
  {
    id: "pbc",
    name: "中国人民银行",
    nameEn: "People's Bank of China",
    category: "macro-policy",
    type: "government",
    reliability: "official",
    updateFrequency: "daily",
    accessMethod: "api",
    url: "http://www.pbc.gov.cn",
    description: "货币政策、利率、外汇储备、金融统计数据",
    dataPoints: ["LPR", "MLF", "逆回购", "存款准备金率", "M2", "社融"],
    priority: 10,
  },
  {
    id: "stats-cn",
    name: "国家统计局",
    nameEn: "National Bureau of Statistics",
    category: "macro-policy",
    type: "government",
    reliability: "official",
    updateFrequency: "monthly",
    accessMethod: "api",
    url: "https://data.stats.gov.cn",
    description: "GDP、CPI、PPI、PMI等宏观经济指标",
    dataPoints: ["GDP", "CPI", "PPI", "PMI", "工业增加值", "固定资产投资"],
    priority: 10,
  },
  {
    id: "mof",
    name: "财政部",
    nameEn: "Ministry of Finance",
    category: "macro-policy",
    type: "government",
    reliability: "official",
    updateFrequency: "weekly",
    accessMethod: "scrape",
    url: "http://www.mof.gov.cn",
    description: "财政政策、国债发行、税收政策",
    dataPoints: ["财政收支", "国债发行", "减税降费政策"],
    priority: 9,
  },
  {
    id: "csrc",
    name: "中国证监会",
    nameEn: "CSRC",
    category: "macro-policy",
    type: "government",
    reliability: "official",
    updateFrequency: "real-time",
    accessMethod: "scrape",
    url: "http://www.csrc.gov.cn",
    description: "证券监管政策、IPO审核、处罚公告",
    dataPoints: ["监管政策", "IPO审核", "再融资", "处罚公告"],
    priority: 9,
  },
  {
    id: "ndrc",
    name: "国家发改委",
    nameEn: "NDRC",
    category: "macro-policy",
    type: "government",
    reliability: "official",
    updateFrequency: "daily",
    accessMethod: "scrape",
    url: "https://www.ndrc.gov.cn",
    description: "产业政策、价格政策、重大项目审批",
    dataPoints: ["产业政策", "价格监管", "重大项目"],
    priority: 9,
  },

  // ===== MARKET DATA SOURCES / 市场数据源 =====
  {
    id: "sse",
    name: "上海证券交易所",
    nameEn: "Shanghai Stock Exchange",
    category: "market-data",
    type: "exchange",
    reliability: "official",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "http://www.sse.com.cn",
    description: "上交所行情、公告、融资融券、大宗交易",
    dataPoints: ["实时行情", "公司公告", "融资融券", "大宗交易", "ETF数据"],
    priority: 10,
  },
  {
    id: "szse",
    name: "深圳证券交易所",
    nameEn: "Shenzhen Stock Exchange",
    category: "market-data",
    type: "exchange",
    reliability: "official",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "http://www.szse.cn",
    description: "深交所行情、公告、创业板数据",
    dataPoints: ["实时行情", "公司公告", "创业板", "融资融券"],
    priority: 10,
  },
  {
    id: "hkex",
    name: "香港交易所",
    nameEn: "HKEX",
    category: "market-data",
    type: "exchange",
    reliability: "official",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "https://www.hkex.com.hk",
    description: "港股通数据、北向资金流向",
    dataPoints: ["港股通额度", "北向资金", "南向资金", "十大活跃股"],
    priority: 10,
  },

  // ===== CAPITAL FLOW SOURCES / 资金流向数据源 =====
  {
    id: "eastmoney-flow",
    name: "东方财富资金流向",
    nameEn: "EastMoney Capital Flow",
    category: "capital-flow",
    type: "data-vendor",
    reliability: "professional",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "https://data.eastmoney.com/zjlx",
    description: "主力资金、北向资金、板块资金流向",
    dataPoints: ["主力净流入", "超大单", "大单", "北向实时", "板块资金"],
    priority: 9,
  },
  {
    id: "10jqka-flow",
    name: "同花顺资金流向",
    nameEn: "10jqka Capital Flow",
    category: "capital-flow",
    type: "data-vendor",
    reliability: "professional",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "http://data.10jqka.com.cn",
    description: "DDE决策、资金博弈、主力追踪",
    dataPoints: ["DDE决策", "资金博弈", "主力追踪", "游资动向"],
    priority: 8,
  },

  // ===== BROKER RESEARCH / 券商研究 =====
  {
    id: "cicc",
    name: "中金公司研究",
    nameEn: "CICC Research",
    category: "fundamental",
    type: "broker",
    reliability: "professional",
    updateFrequency: "daily",
    accessMethod: "subscription",
    url: "https://research.cicc.com",
    description: "深度研究报告、策略观点、行业分析",
    dataPoints: ["策略报告", "行业研报", "个股深度", "宏观研究"],
    priority: 9,
  },
  {
    id: "haitong",
    name: "海通证券研究",
    nameEn: "Haitong Research",
    category: "fundamental",
    type: "broker",
    reliability: "professional",
    updateFrequency: "daily",
    accessMethod: "subscription",
    url: "https://www.htsec.com/ChannelHome/2016102402/index.shtml",
    description: "策略研究、荀玉根策略团队",
    dataPoints: ["策略研究", "行业研究", "量化研究"],
    priority: 8,
  },
  {
    id: "gtja",
    name: "国泰君安研究",
    nameEn: "GTJA Research",
    category: "fundamental",
    type: "broker",
    reliability: "professional",
    updateFrequency: "daily",
    accessMethod: "subscription",
    url: "https://www.gtja.com/content/research",
    description: "策略研究、行业研究",
    dataPoints: ["策略观点", "行业配置", "个股评级"],
    priority: 8,
  },

  // ===== FINANCIAL MEDIA / 财经媒体 =====
  {
    id: "caixin",
    name: "财新网",
    nameEn: "Caixin",
    category: "sentiment",
    type: "media",
    reliability: "professional",
    updateFrequency: "real-time",
    accessMethod: "scrape",
    url: "https://www.caixin.com",
    description: "深度财经报道、财新PMI",
    dataPoints: ["财新PMI", "深度报道", "独家调查"],
    priority: 8,
  },
  {
    id: "cls",
    name: "财联社",
    nameEn: "CLS",
    category: "sentiment",
    type: "media",
    reliability: "professional",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "https://www.cls.cn",
    description: "7x24快讯、电报、独家",
    dataPoints: ["7x24快讯", "公司动态", "政策解读"],
    priority: 9,
  },
  {
    id: "yicai",
    name: "第一财经",
    nameEn: "Yicai",
    category: "sentiment",
    type: "media",
    reliability: "professional",
    updateFrequency: "real-time",
    accessMethod: "scrape",
    url: "https://www.yicai.com",
    description: "财经新闻、深度分析",
    dataPoints: ["财经新闻", "市场分析", "政策解读"],
    priority: 7,
  },

  // ===== SOCIAL SENTIMENT / 社交情绪 =====
  {
    id: "xueqiu",
    name: "雪球",
    nameEn: "Xueqiu",
    category: "sentiment",
    type: "social",
    reliability: "community",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "https://xueqiu.com",
    description: "投资者社区、热门讨论、大V观点",
    dataPoints: ["热门讨论", "大V观点", "组合持仓", "情绪指数"],
    priority: 7,
  },
  {
    id: "taoguba",
    name: "淘股吧",
    nameEn: "Taoguba",
    category: "sentiment",
    type: "social",
    reliability: "community",
    updateFrequency: "real-time",
    accessMethod: "scrape",
    url: "https://www.taoguba.com.cn",
    description: "游资论坛、短线交流",
    dataPoints: ["游资动向", "题材炒作", "短线情绪"],
    priority: 6,
  },

  // ===== ALTERNATIVE DATA / 另类数据 =====
  {
    id: "baidu-index",
    name: "百度指数",
    nameEn: "Baidu Index",
    category: "alternative",
    type: "data-vendor",
    reliability: "aggregator",
    updateFrequency: "daily",
    accessMethod: "api",
    url: "https://index.baidu.com",
    description: "搜索热度、需求图谱",
    dataPoints: ["搜索趋势", "地域分布", "人群画像"],
    priority: 6,
  },
  {
    id: "weibo-hot",
    name: "微博热搜",
    nameEn: "Weibo Hot Search",
    category: "alternative",
    type: "social",
    reliability: "community",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "https://weibo.com",
    description: "社会热点、舆情监控",
    dataPoints: ["热搜榜", "话题讨论", "舆情趋势"],
    priority: 5,
  },
];

// =============================================================================
// GLOBAL MARKET SOURCES / 全球市场数据源
// =============================================================================

export const GLOBAL_DATA_SOURCES: DataSource[] = [
  // ===== US FEDERAL RESERVE =====
  {
    id: "fed",
    name: "美联储",
    nameEn: "Federal Reserve",
    category: "macro-policy",
    type: "government",
    reliability: "official",
    updateFrequency: "varies",
    accessMethod: "api",
    url: "https://www.federalreserve.gov",
    description: "FOMC决议、点阵图、经济预测",
    dataPoints: ["FOMC决议", "点阵图", "褐皮书", "资产负债表"],
    priority: 10,
  },

  // ===== ECONOMIC DATA =====
  {
    id: "fred",
    name: "FRED经济数据",
    nameEn: "FRED",
    category: "macro-policy",
    type: "government",
    reliability: "official",
    updateFrequency: "varies",
    accessMethod: "api",
    url: "https://fred.stlouisfed.org",
    description: "美国经济指标数据库",
    dataPoints: ["GDP", "就业数据", "通胀数据", "利率数据"],
    priority: 10,
  },

  // ===== MARKET DATA =====
  {
    id: "cme",
    name: "芝加哥商品交易所",
    nameEn: "CME Group",
    category: "market-data",
    type: "exchange",
    reliability: "official",
    updateFrequency: "real-time",
    accessMethod: "api",
    url: "https://www.cmegroup.com",
    description: "期货期权数据、Fed Watch",
    dataPoints: ["Fed Watch", "期货持仓", "期权数据"],
    priority: 9,
  },

  // ===== RESEARCH =====
  {
    id: "bloomberg",
    name: "彭博",
    nameEn: "Bloomberg",
    category: "fundamental",
    type: "data-vendor",
    reliability: "professional",
    updateFrequency: "real-time",
    accessMethod: "subscription",
    url: "https://www.bloomberg.com",
    description: "全球市场数据、新闻、分析",
    dataPoints: ["全球行情", "新闻", "分析报告"],
    priority: 10,
  },
  {
    id: "reuters",
    name: "路透社",
    nameEn: "Reuters",
    category: "sentiment",
    type: "media",
    reliability: "professional",
    updateFrequency: "real-time",
    accessMethod: "subscription",
    url: "https://www.reuters.com",
    description: "全球财经新闻",
    dataPoints: ["全球新闻", "市场分析"],
    priority: 9,
  },
];

// =============================================================================
// DATA SOURCE UTILITIES / 数据源工具函数
// =============================================================================

/**
 * Get data sources by category
 * 按类别获取数据源
 */
export function getSourcesByCategory(category: DataCategory): DataSource[] {
  return [...CHINA_DATA_SOURCES, ...GLOBAL_DATA_SOURCES]
    .filter(s => s.category === category)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Get data sources by reliability
 * 按可靠性获取数据源
 */
export function getSourcesByReliability(
  reliability: DataSource["reliability"]
): DataSource[] {
  return [...CHINA_DATA_SOURCES, ...GLOBAL_DATA_SOURCES]
    .filter(s => s.reliability === reliability)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Get top priority sources for a quick analysis
 * 获取快速分析的高优先级数据源
 */
export function getTopSources(limit: number = 10): DataSource[] {
  return [...CHINA_DATA_SOURCES, ...GLOBAL_DATA_SOURCES]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/**
 * Get sources for Three Dao analysis
 * 获取三道分析所需数据源
 */
export function getThreeDaoSources(): {
  tianDao: DataSource[];
  diDao: DataSource[];
  renDao: DataSource[];
} {
  return {
    // 天道：宏观政策、全球经济
    tianDao: getSourcesByCategory("macro-policy"),
    // 地道：市场数据、资金流向
    diDao: [
      ...getSourcesByCategory("market-data"),
      ...getSourcesByCategory("capital-flow"),
    ],
    // 人道：情绪、另类数据
    renDao: [
      ...getSourcesByCategory("sentiment"),
      ...getSourcesByCategory("alternative"),
    ],
  };
}
