/**
 * Design System - The Quant's Cockpit (Mobile Adaptation)
 *
 * Mirrors lucrum-web/docs/DESIGN_SYSTEM.md for React Native.
 * Dark mode only. Financial precision mandatory.
 */

export const Colors = {
  // Backgrounds
  void: "#09090b",
  surface: "#18181b",
  surfaceHover: "#27272a",
  surfaceElevated: "#1f1f23",
  surfaceModal: "#2d2d33",

  // Text
  textPrimary: "#fafafa",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  textDisabled: "#52525b",

  // Accents
  primary: "#3b82f6",
  primaryLight: "#60a5fa",
  accent: "#f59e0b",
  accentLight: "#fbbf24",

  // Market Sentiment (A-share convention: red=up, green=down)
  profit: "#ef4444",
  loss: "#22c55e",
  profitNeon: "#f87171",
  lossNeon: "#4ade80",

  // AI Visual
  ai: "#a78bfa",
  aiBg: "rgba(167, 139, 250, 0.10)",
  aiBorder: "rgba(167, 139, 250, 0.20)",

  // Score Colors
  scoreS: "#fbbf24",
  scoreA: "#22d3ee",
  scoreB: "#3b82f6",
  scoreC: "#6b7280",
  scoreD: "#fb923c",

  // Data Source
  sourceDb: "#3b82f6",
  sourceApi: "#eab308",
  sourceSim: "#6b7280",

  // Status
  statusReady: "#22c55e",
  statusWarn: "#eab308",
  statusBlock: "#ef4444",

  // Workflow Steps
  stepActive: "#3b82f6",
  stepDone: "#22c55e",
  stepPending: "#64748b",

  // Chart
  chartBenchmark: "#6b7280",
  chartSignal: "#a78bfa",

  // Borders
  border: "#27272a",
  borderLight: "#3f3f46",
} as const;

export const Fonts = {
  sans: "System",
  mono: "JetBrainsMono",
  monoMedium: "JetBrainsMono-Medium",
  monoBold: "JetBrainsMono-Bold",
} as const;

export const FontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  display: 40,

  // Data-specific
  dataXs: 11,
  dataSm: 13,
  dataBase: 15,
  dataLg: 17,
  dataXl: 20,
  data2xl: 24,

  // Stat display
  statSm: 20,
  statMd: 28,
  statLg: 36,
  statXl: 48,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/**
 * Direction-based display helpers (matching web financial/types.ts)
 */
export type Direction = "up" | "down" | "neutral";

export const DirectionColors: Record<Direction, string> = {
  up: Colors.profit,
  down: Colors.loss,
  neutral: Colors.textMuted,
};

export const DirectionArrows: Record<Direction, string> = {
  up: "↑",
  down: "↓",
  neutral: "-",
};

export const DirectionSigns: Record<Direction, string> = {
  up: "+",
  down: "-",
  neutral: "",
};
