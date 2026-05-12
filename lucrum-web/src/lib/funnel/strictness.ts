/**
 * Strictness presets — coarse-grained funnel param bundles that let users
 * tune the trade-off between "high-quality picks" and "got something back at
 * all" without learning every knob.
 *
 * Why 4 levels (not 3, not a slider): users need a label for what they
 * actually want. "Balanced" is the default and matches typical mainland-A
 * stock screening practice. "Loose" softens the unforgiving listing-age +
 * market-cap floors that bite small-universe sector runs. "Force" exists
 * specifically because a 0-result run is a UX dead end — losing 30s of
 * waiting and showing nothing destroys trust. "Force" trades selectivity
 * for guaranteed output and explicitly tells the user it did so.
 *
 * The presets map only to params the public funnel API currently accepts:
 *   - maxUniverseSize     (universe stage)
 *   - hardFilter.*        (hard-filter stage)
 *   - portfolio.topN      (portfolio-construction stage)
 *
 * Scorer + factor stages are not parameterised here because they don't
 * gate output count — they only re-rank what hard-filter let through.
 *
 * @module lib/funnel/strictness
 */

import type { HardFilterOptions } from './stages/01-hard-filter';

export type StrictnessLevel = 'strict' | 'balanced' | 'loose' | 'force';

export interface StrictnessPreset {
  readonly level: StrictnessLevel;
  /** Chinese label shown on the dial. */
  readonly label: string;
  /** One-line explanation of the trade-off. */
  readonly tagline: string;
  /** Detail bullets shown when the dial item is hovered/focused. */
  readonly details: ReadonlyArray<string>;
  readonly maxUniverseSize: number;
  readonly hardFilter: HardFilterOptions;
  readonly topN: number;
}

/**
 * Preset definitions. The "loose" preset deliberately drops minMarketCap so
 * sector runs with predominantly small-cap members aren't wiped out. "force"
 * additionally turns off ST + halt filters so even messy candidate pools
 * yield something — the result card UI flags ST/halted picks separately so
 * the user is never silently shown a delisted stub.
 */
export const STRICTNESS_PRESETS: Readonly<Record<StrictnessLevel, StrictnessPreset>> = {
  strict: {
    level: 'strict',
    label: '严格',
    tagline: '机构口径：60 天上市 + 流动性 + ST 全卡',
    details: [
      '上市天数 ≥ 60',
      '排除 ST / 退市 / 当日停牌',
      '宇宙上限 500 — 优先质量',
      'Top 10 输出',
    ],
    maxUniverseSize: 500,
    hardFilter: {
      excludeST: true,
      excludeDelisted: true,
      excludeHalted: true,
      minListingDays: 60,
    },
    topN: 10,
  },
  balanced: {
    level: 'balanced',
    label: '平衡',
    tagline: '默认推荐：30 天上市 + 保留质量门槛',
    details: [
      '上市天数 ≥ 30',
      '排除 ST / 退市 / 当日停牌',
      '宇宙上限 800',
      'Top 10 输出',
    ],
    maxUniverseSize: 800,
    hardFilter: {
      excludeST: true,
      excludeDelisted: true,
      excludeHalted: true,
      minListingDays: 30,
    },
    topN: 10,
  },
  loose: {
    level: 'loose',
    label: '宽松',
    tagline: '让冷门板块也能出货：10 天上市 + 不限市值',
    details: [
      '上市天数 ≥ 10',
      '保留排除 ST / 退市',
      '允许当日停牌（明天可买）',
      '宇宙上限 1500',
      'Top 15 输出',
    ],
    maxUniverseSize: 1500,
    hardFilter: {
      excludeST: true,
      excludeDelisted: true,
      excludeHalted: false,
      minListingDays: 10,
    },
    topN: 15,
  },
  force: {
    level: 'force',
    label: '保证选出',
    tagline: '只为看到结果：几乎不过滤，仅去掉已退市',
    details: [
      '不限上市天数',
      '不排除 ST（结果卡会标红警示）',
      '不排除停牌',
      '宇宙上限 3000',
      'Top 20 输出',
      '⚠ 用于探索 / 验证 pipeline，不建议作为实盘依据',
    ],
    maxUniverseSize: 3000,
    hardFilter: {
      excludeST: false,
      excludeDelisted: true,
      excludeHalted: false,
      minListingDays: 0,
    },
    topN: 20,
  },
};

/** Ordered list of levels, strict → force. Used for "next looser" walks. */
export const STRICTNESS_ORDER: ReadonlyArray<StrictnessLevel> = [
  'strict',
  'balanced',
  'loose',
  'force',
];

export const DEFAULT_STRICTNESS: StrictnessLevel = 'balanced';

/**
 * Return the next looser preset, or null if already at "force". Used by the
 * auto-retry path when a run yields 0 candidates.
 */
export function nextLooser(level: StrictnessLevel): StrictnessLevel | null {
  const idx = STRICTNESS_ORDER.indexOf(level);
  if (idx < 0 || idx >= STRICTNESS_ORDER.length - 1) return null;
  return STRICTNESS_ORDER[idx + 1] ?? null;
}

/** Convenience: map a level → preset, with a safe fallback. */
export function getPreset(level: StrictnessLevel): StrictnessPreset {
  return STRICTNESS_PRESETS[level] ?? STRICTNESS_PRESETS[DEFAULT_STRICTNESS];
}

/**
 * Translate a strictness preset into the PackOverride shape accepted by
 * /api/strategy-packs/custom. Only fields that exist in PackOverride are
 * surfaced — the ST/halt toggles and maxUniverseSize are baked into the
 * pack defaults today and can be wired through if the dial needs to flip
 * them later. minMarketCap=0 is the deliberate signal that the user wants
 * the cap floor disabled at the looser tiers.
 */
export function presetToOverride(level: StrictnessLevel): {
  readonly minListingDays: number;
  readonly minMarketCap: number;
  readonly topN: number;
} {
  const p = getPreset(level);
  return {
    minListingDays: p.hardFilter.minListingDays ?? 0,
    minMarketCap: p.hardFilter.minMarketCap ?? 0,
    topN: p.topN,
  };
}
