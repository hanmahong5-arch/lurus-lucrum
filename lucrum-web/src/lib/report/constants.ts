/**
 * PDF Report Constants
 * PDF report layout, colors, and typography constants.
 *
 * @module lib/report/constants
 */

// =============================================================================
// PAGE LAYOUT / 页面布局
// =============================================================================

/** A4 page dimensions in mm */
export const PAGE = {
  WIDTH: 210,
  HEIGHT: 297,
  MARGIN_TOP: 20,
  MARGIN_BOTTOM: 20,
  MARGIN_LEFT: 20,
  MARGIN_RIGHT: 20,
} as const;

/** Usable content area after margins */
export const CONTENT = {
  WIDTH: PAGE.WIDTH - PAGE.MARGIN_LEFT - PAGE.MARGIN_RIGHT,
  HEIGHT: PAGE.HEIGHT - PAGE.MARGIN_TOP - PAGE.MARGIN_BOTTOM,
  START_X: PAGE.MARGIN_LEFT,
  START_Y: PAGE.MARGIN_TOP,
} as const;

// =============================================================================
// TYPOGRAPHY / 字体
// =============================================================================

/** Font family names registered in jsPDF */
export const FONT = {
  /** Chinese-capable font (NotoSansSC loaded at runtime) */
  CJK: 'NotoSansSC',
  /** Fallback Latin font (built-in) */
  FALLBACK: 'helvetica',
  /** Monospace font for financial numbers */
  MONO: 'courier',
} as const;

/** Font sizes in points */
export const FONT_SIZE = {
  TITLE: 24,
  SUBTITLE: 16,
  HEADING: 14,
  SUBHEADING: 12,
  BODY: 10,
  SMALL: 8,
  TINY: 7,
} as const;

// =============================================================================
// COLORS / 颜色
// =============================================================================

/** RGB color tuples for jsPDF [r, g, b] */
export const COLOR = {
  /** Primary text */
  TEXT: [33, 33, 33] as const,
  /** Secondary text */
  TEXT_MUTED: [117, 117, 117] as const,
  /** White text */
  TEXT_WHITE: [255, 255, 255] as const,

  /** Profit green */
  PROFIT: [34, 197, 94] as const,
  /** Loss red */
  LOSS: [239, 68, 68] as const,

  /** Table header background */
  TABLE_HEADER_BG: [51, 65, 85] as const,
  /** Table even row background */
  TABLE_ROW_EVEN: [248, 250, 252] as const,
  /** Table odd row background (white) */
  TABLE_ROW_ODD: [255, 255, 255] as const,
  /** Table border */
  TABLE_BORDER: [226, 232, 240] as const,

  /** Score grade colors */
  GRADE_S: [245, 158, 11] as const,
  GRADE_A: [34, 197, 94] as const,
  GRADE_B: [59, 130, 246] as const,
  GRADE_C: [161, 161, 170] as const,
  GRADE_D: [239, 68, 68] as const,

  /** Dimension bar background */
  BAR_BG: [226, 232, 240] as const,
  /** Dimension bar fill */
  BAR_FILL: [59, 130, 246] as const,

  /** Page background */
  PAGE_BG: [255, 255, 255] as const,
  /** Divider line */
  DIVIDER: [203, 213, 225] as const,

  /** Cover accent bar */
  ACCENT: [59, 130, 246] as const,

  /** Gold/Silver/Bronze for top 3 ranking */
  GOLD: [245, 158, 11] as const,
  SILVER: [148, 163, 184] as const,
  BRONZE: [180, 83, 9] as const,
} as const;

/** Map ScoreGrade to color tuple */
export const GRADE_COLORS: Record<string, readonly [number, number, number]> = {
  S: COLOR.GRADE_S,
  A: COLOR.GRADE_A,
  B: COLOR.GRADE_B,
  C: COLOR.GRADE_C,
  D: COLOR.GRADE_D,
};

// =============================================================================
// REPORT LIMITS / 报告限制
// =============================================================================

/** Maximum items per section */
export const LIMITS = {
  /** Maximum trades shown in trade list */
  MAX_TRADES: 20,
  /** Maximum stocks per ranking page */
  MAX_STOCKS_PER_PAGE: 25,
  /** Maximum strategy name length on cover */
  MAX_STRATEGY_NAME_LENGTH: 40,
  /** Chart image scale factor for retina */
  CHART_SCALE: 2,
} as const;

// =============================================================================
// TABLE LAYOUT / 表格布局
// =============================================================================

/** Standard table row height in mm */
export const TABLE = {
  ROW_HEIGHT: 7,
  HEADER_HEIGHT: 8,
  CELL_PADDING: 2,
} as const;
