/**
 * Popularity Scoring Algorithm
 * 流行度评分算法
 *
 * Calculates a unified popularity score for strategies from different sources.
 * 计算来自不同源的策略的统一流行度分数
 *
 * Formula:
 * base_score = views * 1 + likes * 5 + forks * 10 + stars * 8 + comments * 3
 * bonus = (sharpe > 1.5 ? 20% : 0) + (max_dd < 20% ? 10% : 0)
 * final_score = base_score * (1 + bonus)
 */

// =============================================================================
// Types / 类型
// =============================================================================

/**
 * Input metrics for popularity calculation
 * 流行度计算的输入指标
 */
export interface PopularityMetrics {
  /** View count / 浏览量 */
  views: number;
  /** Like count / 点赞数 */
  likes: number;
  /** Fork count (GitHub) / Fork数 */
  forks?: number;
  /** Star count (GitHub) / Star数 */
  stars?: number;
  /** Comment count / 评论数 */
  comments?: number;
  /** Sharpe ratio / 夏普比率 */
  sharpeRatio?: number;
  /** Maximum drawdown (as positive percentage, e.g., 20 for 20%) / 最大回撤 */
  maxDrawdown?: number;
}

/**
 * Scoring weights configuration
 * 评分权重配置
 */
export interface ScoringWeights {
  views: number;
  likes: number;
  forks: number;
  stars: number;
  comments: number;
}

/**
 * Detailed score breakdown
 * 详细分数分解
 */
export interface ScoreBreakdown {
  baseScore: number;
  viewsScore: number;
  likesScore: number;
  forksScore: number;
  starsScore: number;
  commentsScore: number;
  sharpeBonus: number;
  drawdownBonus: number;
  totalBonus: number;
  finalScore: number;
}

// =============================================================================
// Constants / 常量
// =============================================================================

/**
 * Default scoring weights
 * 默认评分权重
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  views: 1,
  likes: 5,
  forks: 10,
  stars: 8,
  comments: 3,
};

/**
 * Performance bonus thresholds
 * 性能奖励阈值
 */
export const BONUS_THRESHOLDS = {
  /** Sharpe ratio threshold for bonus / 夏普比率奖励阈值 */
  sharpeRatio: 1.5,
  /** Maximum drawdown threshold for bonus (%) / 最大回撤奖励阈值 */
  maxDrawdown: 20,
  /** Bonus percentage for good Sharpe / 良好夏普的奖励百分比 */
  sharpeBonus: 0.2, // 20%
  /** Bonus percentage for low drawdown / 低回撤的奖励百分比 */
  drawdownBonus: 0.1, // 10%
};

// =============================================================================
// Scoring Functions / 评分函数
// =============================================================================

/**
 * Calculate popularity score
 * 计算流行度分数
 *
 * @param metrics Input metrics
 * @param weights Optional custom weights
 * @returns Final popularity score
 */
export function calculatePopularityScore(
  metrics: PopularityMetrics,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const breakdown = getScoreBreakdown(metrics, weights);
  return breakdown.finalScore;
}

/**
 * Get detailed score breakdown
 * 获取详细分数分解
 *
 * @param metrics Input metrics
 * @param weights Optional custom weights
 * @returns Detailed breakdown of score components
 */
export function getScoreBreakdown(
  metrics: PopularityMetrics,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoreBreakdown {
  // Calculate individual scores
  // 计算各项分数
  const viewsScore = metrics.views * weights.views;
  const likesScore = metrics.likes * weights.likes;
  const forksScore = (metrics.forks ?? 0) * weights.forks;
  const starsScore = (metrics.stars ?? 0) * weights.stars;
  const commentsScore = (metrics.comments ?? 0) * weights.comments;

  // Calculate base score
  // 计算基础分数
  const baseScore = viewsScore + likesScore + forksScore + starsScore + commentsScore;

  // Calculate performance bonuses
  // 计算性能奖励
  let sharpeBonus = 0;
  if (metrics.sharpeRatio !== undefined && metrics.sharpeRatio > BONUS_THRESHOLDS.sharpeRatio) {
    sharpeBonus = BONUS_THRESHOLDS.sharpeBonus;
  }

  let drawdownBonus = 0;
  if (metrics.maxDrawdown !== undefined && metrics.maxDrawdown < BONUS_THRESHOLDS.maxDrawdown) {
    drawdownBonus = BONUS_THRESHOLDS.drawdownBonus;
  }

  const totalBonus = sharpeBonus + drawdownBonus;

  // Calculate final score
  // 计算最终分数
  const finalScore = Math.round(baseScore * (1 + totalBonus) * 100) / 100;

  return {
    baseScore,
    viewsScore,
    likesScore,
    forksScore,
    starsScore,
    commentsScore,
    sharpeBonus,
    drawdownBonus,
    totalBonus,
    finalScore,
  };
}

/**
 * Normalize score to 0-100 range
 * 将分数归一化到0-100范围
 *
 * Uses logarithmic scaling for better distribution
 *
 * @param score Raw score
 * @param maxExpectedScore Maximum expected score (for scaling)
 * @returns Normalized score (0-100)
 */
export function normalizeScore(score: number, maxExpectedScore: number = 10000): number {
  if (score <= 0) return 0;
  if (score >= maxExpectedScore) return 100;

  // Logarithmic scaling
  // 对数缩放
  const normalized = (Math.log10(score + 1) / Math.log10(maxExpectedScore + 1)) * 100;
  return Math.round(normalized * 100) / 100;
}

/**
 * Get popularity tier based on score
 * 根据分数获取流行度等级
 *
 * @param score Popularity score
 * @returns Tier name
 */
export function getPopularityTier(score: number): 'legendary' | 'popular' | 'rising' | 'new' {
  if (score >= 1000) return 'legendary';
  if (score >= 100) return 'popular';
  if (score >= 10) return 'rising';
  return 'new';
}

/**
 * Compare two strategies by popularity
 * 按流行度比较两个策略
 *
 * @param a First strategy metrics
 * @param b Second strategy metrics
 * @returns Comparison result (-1, 0, 1)
 */
export function compareByPopularity(
  a: PopularityMetrics,
  b: PopularityMetrics
): number {
  const scoreA = calculatePopularityScore(a);
  const scoreB = calculatePopularityScore(b);
  return scoreB - scoreA; // Descending order
}

// =============================================================================
// Trending Score / 趋势分数
// =============================================================================

/**
 * Calculate trending score with time decay
 * 计算带时间衰减的趋势分数
 *
 * Recent activity is weighted more heavily
 *
 * @param metrics Current metrics
 * @param previousMetrics Metrics from previous period
 * @param ageHours Age of the strategy in hours
 * @returns Trending score
 */
export function calculateTrendingScore(
  metrics: PopularityMetrics,
  previousMetrics?: PopularityMetrics,
  ageHours: number = 0
): number {
  // Base popularity score
  // 基础流行度分数
  const currentScore = calculatePopularityScore(metrics);

  // Calculate growth if previous metrics available
  // 如果有之前的指标则计算增长
  let growthMultiplier = 1;
  if (previousMetrics) {
    const previousScore = calculatePopularityScore(previousMetrics);
    if (previousScore > 0) {
      const growth = (currentScore - previousScore) / previousScore;
      growthMultiplier = 1 + Math.max(0, growth); // Only positive growth
    }
  }

  // Time decay factor (half-life of 24 hours)
  // 时间衰减因子（24小时半衰期）
  const halfLife = 24;
  const decayFactor = Math.pow(0.5, ageHours / halfLife);

  // Combine factors
  // 组合因子
  const trendingScore = currentScore * growthMultiplier * decayFactor;

  return Math.round(trendingScore * 100) / 100;
}

// =============================================================================
// Quality Score / 质量分数
// =============================================================================

/**
 * Calculate quality score based on performance metrics
 * 基于性能指标计算质量分数
 *
 * @param sharpeRatio Sharpe ratio
 * @param maxDrawdown Maximum drawdown (positive percentage)
 * @param annualReturn Annual return (percentage)
 * @returns Quality score (0-100)
 */
export function calculateQualityScore(
  sharpeRatio?: number,
  maxDrawdown?: number,
  annualReturn?: number
): number {
  let score = 50; // Base score

  // Sharpe ratio contribution (0-30 points)
  // 夏普比率贡献（0-30分）
  if (sharpeRatio !== undefined) {
    if (sharpeRatio >= 3) score += 30;
    else if (sharpeRatio >= 2) score += 25;
    else if (sharpeRatio >= 1.5) score += 20;
    else if (sharpeRatio >= 1) score += 15;
    else if (sharpeRatio >= 0.5) score += 10;
    else if (sharpeRatio > 0) score += 5;
    else score -= 10; // Negative Sharpe
  }

  // Drawdown contribution (0-20 points)
  // 回撤贡献（0-20分）
  if (maxDrawdown !== undefined) {
    if (maxDrawdown <= 5) score += 20;
    else if (maxDrawdown <= 10) score += 15;
    else if (maxDrawdown <= 20) score += 10;
    else if (maxDrawdown <= 30) score += 5;
    else if (maxDrawdown > 50) score -= 10; // Very high drawdown
  }

  // Annual return contribution (0-20 points)
  // 年化收益贡献（0-20分）
  if (annualReturn !== undefined) {
    if (annualReturn >= 50) score += 20;
    else if (annualReturn >= 30) score += 15;
    else if (annualReturn >= 20) score += 12;
    else if (annualReturn >= 10) score += 8;
    else if (annualReturn >= 0) score += 5;
    else score -= 5; // Negative return
  }

  // Clamp to 0-100
  // 限制在0-100之间
  return Math.max(0, Math.min(100, score));
}
