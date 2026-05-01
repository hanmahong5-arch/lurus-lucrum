/**
 * Curated demo universe for the "magic moment" new-user flow.
 *
 * 选股原则：
 *   - 散户脸熟（名字一看就认）
 *   - 11 个主要行业各 4-6 只
 *   - SH/SZ 混合，蓝筹 + 成长 + 消费各占一部分
 *   - 不含 ST / 长期停牌 / 退市边缘
 *
 * 该列表是 demo / bootstrap 用，不是投顾建议。
 * 后续完整 A 股 ingest（5000 只）见 plans/data-ingest-pipeline.md。
 */

export interface CuratedSymbol {
  readonly symbol: string;       // e.g. "600519.SH"
  readonly name: string;         // 中文名 (must be accurate)
  readonly market: 'SH' | 'SZ';
  readonly secid: string;        // EastMoney secid: SH→1.NNNNNN, SZ→0.NNNNNN
  readonly sector: string;       // 中文行业名
}

export const CURATED_SYMBOLS: ReadonlyArray<CuratedSymbol> = [
  // ─────────────────────────── 银行 ───────────────────────────
  { symbol: '601398.SH', name: '工商银行',   market: 'SH', secid: '1.601398', sector: '银行' },
  { symbol: '601939.SH', name: '建设银行',   market: 'SH', secid: '1.601939', sector: '银行' },
  { symbol: '601288.SH', name: '农业银行',   market: 'SH', secid: '1.601288', sector: '银行' },
  { symbol: '601988.SH', name: '中国银行',   market: 'SH', secid: '1.601988', sector: '银行' },
  { symbol: '600036.SH', name: '招商银行',   market: 'SH', secid: '1.600036', sector: '银行' },
  { symbol: '601166.SH', name: '兴业银行',   market: 'SH', secid: '1.601166', sector: '银行' },

  // ─────────────────────────── 保险 ───────────────────────────
  { symbol: '601318.SH', name: '中国平安',   market: 'SH', secid: '1.601318', sector: '保险' },
  { symbol: '601628.SH', name: '中国人寿',   market: 'SH', secid: '1.601628', sector: '保险' },
  { symbol: '601601.SH', name: '中国太保',   market: 'SH', secid: '1.601601', sector: '保险' },
  { symbol: '601336.SH', name: '新华保险',   market: 'SH', secid: '1.601336', sector: '保险' },

  // ─────────────────────────── 白酒 / 食品饮料 ───────────────────────────
  { symbol: '600519.SH', name: '贵州茅台',   market: 'SH', secid: '1.600519', sector: '白酒' },
  { symbol: '000858.SZ', name: '五粮液',     market: 'SZ', secid: '0.000858', sector: '白酒' },
  { symbol: '000568.SZ', name: '泸州老窖',   market: 'SZ', secid: '0.000568', sector: '白酒' },
  { symbol: '600809.SH', name: '山西汾酒',   market: 'SH', secid: '1.600809', sector: '白酒' },
  { symbol: '603288.SH', name: '海天味业',   market: 'SH', secid: '1.603288', sector: '白酒' },
  { symbol: '600887.SH', name: '伊利股份',   market: 'SH', secid: '1.600887', sector: '白酒' },

  // ─────────────────────────── 医药 ───────────────────────────
  { symbol: '600276.SH', name: '恒瑞医药',   market: 'SH', secid: '1.600276', sector: '医药' },
  { symbol: '300760.SZ', name: '迈瑞医疗',   market: 'SZ', secid: '0.300760', sector: '医药' },
  { symbol: '603259.SH', name: '药明康德',   market: 'SH', secid: '1.603259', sector: '医药' },
  { symbol: '000538.SZ', name: '云南白药',   market: 'SZ', secid: '0.000538', sector: '医药' },
  { symbol: '600196.SH', name: '复星医药',   market: 'SH', secid: '1.600196', sector: '医药' },

  // ─────────────────────────── 新能源 (EV / 电池 / 光伏) ───────────────────────────
  { symbol: '002594.SZ', name: '比亚迪',     market: 'SZ', secid: '0.002594', sector: '新能源' },
  { symbol: '300750.SZ', name: '宁德时代',   market: 'SZ', secid: '0.300750', sector: '新能源' },
  { symbol: '601012.SH', name: '隆基绿能',   market: 'SH', secid: '1.601012', sector: '新能源' },
  { symbol: '002460.SZ', name: '赣锋锂业',   market: 'SZ', secid: '0.002460', sector: '新能源' },
  { symbol: '002129.SZ', name: 'TCL中环',    market: 'SZ', secid: '0.002129', sector: '新能源' },
  { symbol: '601877.SH', name: '正泰电器',   market: 'SH', secid: '1.601877', sector: '新能源' },

  // ─────────────────────────── 半导体 ───────────────────────────
  { symbol: '688981.SH', name: '中芯国际',   market: 'SH', secid: '1.688981', sector: '半导体' },
  { symbol: '603501.SH', name: '韦尔股份',   market: 'SH', secid: '1.603501', sector: '半导体' },
  { symbol: '002371.SZ', name: '北方华创',   market: 'SZ', secid: '0.002371', sector: '半导体' },
  { symbol: '688012.SH', name: '中微公司',   market: 'SH', secid: '1.688012', sector: '半导体' },
  { symbol: '603986.SH', name: '兆易创新',   market: 'SH', secid: '1.603986', sector: '半导体' },

  // ─────────────────────────── 互联网 / 软件 ───────────────────────────
  { symbol: '002230.SZ', name: '科大讯飞',   market: 'SZ', secid: '0.002230', sector: '互联网软件' },
  { symbol: '300033.SZ', name: '同花顺',     market: 'SZ', secid: '0.300033', sector: '互联网软件' },
  { symbol: '300059.SZ', name: '东方财富',   market: 'SZ', secid: '0.300059', sector: '互联网软件' },
  { symbol: '600588.SH', name: '用友网络',   market: 'SH', secid: '1.600588', sector: '互联网软件' },
  { symbol: '002405.SZ', name: '四维图新',   market: 'SZ', secid: '0.002405', sector: '互联网软件' },

  // ─────────────────────────── 消费电子 / 家电 ───────────────────────────
  { symbol: '002415.SZ', name: '海康威视',   market: 'SZ', secid: '0.002415', sector: '消费电子' },
  { symbol: '000651.SZ', name: '格力电器',   market: 'SZ', secid: '0.000651', sector: '消费电子' },
  { symbol: '000333.SZ', name: '美的集团',   market: 'SZ', secid: '0.000333', sector: '消费电子' },
  { symbol: '600690.SH', name: '海尔智家',   market: 'SH', secid: '1.600690', sector: '消费电子' },
  { symbol: '002475.SZ', name: '立讯精密',   market: 'SZ', secid: '0.002475', sector: '消费电子' },
  { symbol: '002241.SZ', name: '歌尔股份',   market: 'SZ', secid: '0.002241', sector: '消费电子' },

  // ─────────────────────────── 地产 ───────────────────────────
  { symbol: '600048.SH', name: '保利发展',   market: 'SH', secid: '1.600048', sector: '地产' },
  { symbol: '000002.SZ', name: '万科A',      market: 'SZ', secid: '0.000002', sector: '地产' },
  { symbol: '001979.SZ', name: '招商蛇口',   market: 'SZ', secid: '0.001979', sector: '地产' },
  { symbol: '600606.SH', name: '绿地控股',   market: 'SH', secid: '1.600606', sector: '地产' },

  // ─────────────────────────── 传媒 ───────────────────────────
  { symbol: '300413.SZ', name: '芒果超媒',   market: 'SZ', secid: '0.300413', sector: '传媒' },
  { symbol: '002602.SZ', name: '世纪华通',   market: 'SZ', secid: '0.002602', sector: '传媒' },
  { symbol: '300251.SZ', name: '光线传媒',   market: 'SZ', secid: '0.300251', sector: '传媒' },
  { symbol: '002555.SZ', name: '三七互娱',   market: 'SZ', secid: '0.002555', sector: '传媒' },

  // ─────────────────────────── 公用事业 / 能源 ───────────────────────────
  { symbol: '601857.SH', name: '中国石油',   market: 'SH', secid: '1.601857', sector: '公用事业' },
  { symbol: '600028.SH', name: '中国石化',   market: 'SH', secid: '1.600028', sector: '公用事业' },
  { symbol: '601088.SH', name: '中国神华',   market: 'SH', secid: '1.601088', sector: '公用事业' },
  { symbol: '600900.SH', name: '长江电力',   market: 'SH', secid: '1.600900', sector: '公用事业' },
  { symbol: '601985.SH', name: '中国核电',   market: 'SH', secid: '1.601985', sector: '公用事业' },
];
