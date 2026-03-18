/**
 * Strategy Score Types
 * 策略评分类型定义
 *
 * Defines interfaces for the strategy scoring system that converts
 * 30+ backtest metrics into an intuitive S/A/B/C/D grade.
 *
 * @module lib/backtest/score/types
 */

import Decimal from "decimal.js";

// =============================================================================
// GRADE TYPES / 评分等级类型
// =============================================================================

/**
 * Strategy grade levels
 * 策略评分等级
 */
export type ScoreGrade = "S" | "A" | "B" | "C" | "D";

/**
 * Direction of metric interpretation
 * 指标解释方向 (higher-is-better vs lower-is-better)
 */
export type MetricDirection = "higher-better" | "lower-better";

// =============================================================================
// SCORE BREAKDOWN / 评分分解
// =============================================================================

/**
 * Score breakdown by dimension
 * 各维度得分分解
 */
export interface ScoreBreakdown {
  /** Profitability score 0-100 (收益性得分) */
  profitability: number;
  /** Risk control score 0-100 (风险控制得分) */
  risk: number;
  /** Stability score 0-100 (稳定性得分) */
  stability: number;
  /** Trading efficiency score 0-100 (交易效率得分) */
  efficiency: number;
}

/**
 * Core metrics extracted for display
 * 提取的核心指标用于展示
 */
export interface CoreMetrics {
  /** Total return percentage (总收益率) */
  totalReturn: Decimal;
  /** Annualized return percentage (年化收益率) */
  annualizedReturn: Decimal;
  /** Maximum drawdown percentage (最大回撤) */
  maxDrawdown: Decimal;
  /** Sharpe ratio (夏普比率) */
  sharpeRatio: Decimal;
}

// =============================================================================
// STRATEGY SCORE / 策略评分
// =============================================================================

/**
 * Complete strategy score result
 * 完整策略评分结果
 */
export interface StrategyScore {
  /** Grade level S/A/B/C/D (评分等级) */
  grade: ScoreGrade;
  /** Numeric score 0-100 (数值评分 0-100) */
  score: number;
  /** Human readable description (可读描述) */
  description: string;
  /** Core metrics for display (核心指标展示) */
  coreMetrics: CoreMetrics;
  /** Detailed breakdown by dimension (各维度详细得分) */
  breakdown: ScoreBreakdown;
}

// =============================================================================
// GRADE CONFIGURATION / 评分配置
// =============================================================================

/**
 * Grade threshold configuration
 * 评分等级阈值配置
 */
export interface GradeThreshold {
  /** Minimum score for this grade (该等级最低分) */
  minScore: number;
  /** Grade label (等级标签) */
  grade: ScoreGrade;
  /** Description in Chinese (中文描述) */
  description: string;
  /** Description in English (英文描述) */
  descriptionEn: string;
}

/**
 * Grade configuration constants
 * 评分配置常量
 */
export const GRADE_CONFIG: readonly GradeThreshold[] = [
  { minScore: 90, grade: "S", description: "卓越", descriptionEn: "Excellent" },
  { minScore: 75, grade: "A", description: "优秀", descriptionEn: "Great" },
  { minScore: 60, grade: "B", description: "良好", descriptionEn: "Good" },
  { minScore: 40, grade: "C", description: "一般", descriptionEn: "Average" },
  { minScore: 0, grade: "D", description: "需改进", descriptionEn: "Needs Improvement" },
] as const;

/**
 * Dimension weight configuration
 * 维度权重配置
 */
export const DIMENSION_WEIGHTS = {
  /** Profitability weight (收益性权重) */
  profitability: 0.30,
  /** Risk control weight (风险控制权重) */
  risk: 0.30,
  /** Stability weight (稳定性权重) */
  stability: 0.25,
  /** Efficiency weight (交易效率权重) */
  efficiency: 0.15,
} as const;

// =============================================================================
// SCORING THRESHOLDS / 评分阈值
// =============================================================================

/**
 * Metric scoring threshold definition
 * 指标评分阈值定义
 */
export interface MetricThreshold {
  /** Metric name (指标名称) */
  name: string;
  /** Direction for interpretation (解释方向) */
  direction: MetricDirection;
  /** Thresholds for score ranges [excellent, good, average, poor] */
  thresholds: readonly [number, number, number, number];
}

/**
 * Profitability metric thresholds
 * 收益性指标阈值
 */
export const PROFITABILITY_THRESHOLDS = {
  annualizedReturn: {
    name: "annualizedReturn",
    direction: "higher-better",
    thresholds: [0.20, 0.10, 0, -0.10], // 20%, 10%, 0%, -10%
  } as MetricThreshold,
  totalReturn: {
    name: "totalReturn",
    direction: "higher-better",
    thresholds: [0.50, 0.20, 0, -0.20], // 50%, 20%, 0%, -20%
  } as MetricThreshold,
};

/**
 * Risk metric thresholds
 * 风险指标阈值
 */
export const RISK_THRESHOLDS = {
  maxDrawdown: {
    name: "maxDrawdown",
    direction: "lower-better",
    thresholds: [0.10, 0.20, 0.30, 0.50], // 10%, 20%, 30%, 50%
  } as MetricThreshold,
  volatility: {
    name: "volatility",
    direction: "lower-better",
    thresholds: [0.15, 0.25, 0.35, 0.50], // 15%, 25%, 35%, 50%
  } as MetricThreshold,
};

/**
 * Stability metric thresholds
 * 稳定性指标阈值
 */
export const STABILITY_THRESHOLDS = {
  sharpeRatio: {
    name: "sharpeRatio",
    direction: "higher-better",
    thresholds: [1.5, 1.0, 0.5, 0], // 1.5, 1.0, 0.5, 0
  } as MetricThreshold,
  sortinoRatio: {
    name: "sortinoRatio",
    direction: "higher-better",
    thresholds: [2.0, 1.5, 1.0, 0], // 2.0, 1.5, 1.0, 0
  } as MetricThreshold,
};

/**
 * Efficiency metric thresholds
 * 交易效率指标阈值
 */
export const EFFICIENCY_THRESHOLDS = {
  winRate: {
    name: "winRate",
    direction: "higher-better",
    thresholds: [0.60, 0.50, 0.40, 0.30], // 60%, 50%, 40%, 30%
  } as MetricThreshold,
  profitFactor: {
    name: "profitFactor",
    direction: "higher-better",
    thresholds: [2.0, 1.5, 1.0, 0.5], // 2.0, 1.5, 1.0, 0.5
  } as MetricThreshold,
  avgHoldingPeriod: {
    name: "avgHoldingPeriod",
    direction: "lower-better", // Shorter holding = more efficient
    thresholds: [5, 10, 20, 30], // 5, 10, 20, 30 days
  } as MetricThreshold,
};

// =============================================================================
// SPECIAL CASES / 特殊情况
// =============================================================================

/**
 * Zero trades special score
 * 零交易特殊评分
 */
export const ZERO_TRADES_SCORE: StrategyScore = {
  grade: "D",
  score: 0,
  description: "无交易记录",
  coreMetrics: {
    totalReturn: new Decimal(0),
    annualizedReturn: new Decimal(0),
    maxDrawdown: new Decimal(0),
    sharpeRatio: new Decimal(0),
  },
  breakdown: {
    profitability: 0,
    risk: 0,
    stability: 0,
    efficiency: 0,
  },
};
