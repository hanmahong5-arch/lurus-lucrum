/**
 * Workflow Cache Strategy
 * 工作流缓存策略
 *
 * Defines caching strategies for different workflow steps.
 * Handles cache key generation and invalidation logic.
 *
 * 定义不同工作流步骤的缓存策略
 * 处理缓存键生成和失效逻辑
 */

import { createHash } from 'crypto';
import type { StepType, StepCacheStrategy } from './types';
import {
  workflowCache,
  getWorkflowStepKey,
  CACHE_TTL,
} from '@/lib/cache';

// =============================================================================
// Constants / 常量
// =============================================================================

/**
 * Step-specific TTL values (in seconds)
 * 步骤特定的TTL值（秒）
 */
export const STEP_TTLS: Record<StepType, number> = {
  // Strategy Development / 策略开发
  stock_select: 60 * 60, // 1 hour
  strategy_input: 24 * 60 * 60, // 24 hours
  strategy_generate: 24 * 60 * 60, // 24 hours
  parameter_adjust: 0, // No cache
  backtest_run: 24 * 60 * 60, // 24 hours
  result_analysis: 60 * 60, // 1 hour

  // Backtest Analysis / 回测分析
  strategy_select: 60 * 60, // 1 hour
  date_range_select: 0, // No cache
  parameter_config: 0, // No cache
  run_backtest: 24 * 60 * 60, // 24 hours
  analyze_results: 60 * 60, // 1 hour

  // Advisor Chat / 顾问对话
  advisor_query: 0, // No cache (session-based)
  agent_analysis: 60 * 60, // 1 hour
  debate_round: 60 * 60, // 1 hour
  conclusion: 60 * 60, // 1 hour
};

// =============================================================================
// Cache Key Generation / 缓存键生成
// =============================================================================

/**
 * Generate hash from input data
 * 从输入数据生成哈希
 */
export function hashInput(input: Record<string, unknown>): string {
  const sortedInput = JSON.stringify(input, Object.keys(input).sort());
  return createHash('md5').update(sortedInput).digest('hex').slice(0, 16);
}

/**
 * Generate cache key for a workflow step
 * 为工作流步骤生成缓存键
 */
export function generateStepCacheKey(
  sessionId: string,
  stepNumber: number,
  input: Record<string, unknown>
): string {
  const inputHash = hashInput(input);
  return `${getWorkflowStepKey(sessionId, stepNumber)}:${inputHash}`;
}

// =============================================================================
// Cache Strategies / 缓存策略
// =============================================================================

/**
 * Default cache key generator
 * 默认缓存键生成器
 */
function defaultKeyGenerator(input: Record<string, unknown>): string {
  return hashInput(input);
}

/**
 * Strategy-specific key generator (includes strategy description hash)
 * 策略特定的键生成器（包含策略描述哈希）
 */
function strategyKeyGenerator(input: Record<string, unknown>): string {
  const strategyInput = input.strategyInput as string;
  const params = input.parameters as Record<string, unknown>;
  return hashInput({ strategyInput, params });
}

/**
 * Backtest-specific key generator (includes symbol and date range)
 * 回测特定的键生成器（包含股票代码和日期范围）
 */
function backtestKeyGenerator(input: Record<string, unknown>): string {
  const { symbol, startDate, endDate, strategyCode, parameters } = input;
  return hashInput({ symbol, startDate, endDate, strategyCode, parameters });
}

/**
 * Cache strategies for each step type
 * 每种步骤类型的缓存策略
 */
export const STEP_CACHE_STRATEGIES: Record<StepType, StepCacheStrategy> = {
  // Strategy Development / 策略开发
  stock_select: {
    enabled: true,
    ttl: STEP_TTLS.stock_select,
    keyGenerator: defaultKeyGenerator,
    shouldInvalidate: (cached, newInput) => {
      const cachedSymbols = (cached as { symbols?: string[] })?.symbols ?? [];
      const newSymbols = (newInput.symbols as string[]) ?? [];
      return cachedSymbols.join(',') !== newSymbols.join(',');
    },
  },

  strategy_input: {
    enabled: true,
    ttl: STEP_TTLS.strategy_input,
    keyGenerator: defaultKeyGenerator,
  },

  strategy_generate: {
    enabled: true,
    ttl: STEP_TTLS.strategy_generate,
    keyGenerator: strategyKeyGenerator,
    shouldInvalidate: (cached, newInput) => {
      const cachedInput = (cached as { strategyInput?: string })?.strategyInput;
      return cachedInput !== newInput.strategyInput;
    },
  },

  parameter_adjust: {
    enabled: false,
    ttl: 0,
    keyGenerator: defaultKeyGenerator,
  },

  backtest_run: {
    enabled: true,
    ttl: STEP_TTLS.backtest_run,
    keyGenerator: backtestKeyGenerator,
  },

  result_analysis: {
    enabled: true,
    ttl: STEP_TTLS.result_analysis,
    keyGenerator: defaultKeyGenerator,
  },

  // Backtest Analysis / 回测分析
  strategy_select: {
    enabled: true,
    ttl: STEP_TTLS.strategy_select,
    keyGenerator: defaultKeyGenerator,
  },

  date_range_select: {
    enabled: false,
    ttl: 0,
    keyGenerator: defaultKeyGenerator,
  },

  parameter_config: {
    enabled: false,
    ttl: 0,
    keyGenerator: defaultKeyGenerator,
  },

  run_backtest: {
    enabled: true,
    ttl: STEP_TTLS.run_backtest,
    keyGenerator: backtestKeyGenerator,
  },

  analyze_results: {
    enabled: true,
    ttl: STEP_TTLS.analyze_results,
    keyGenerator: defaultKeyGenerator,
  },

  // Advisor Chat / 顾问对话
  advisor_query: {
    enabled: false, // Session-based, no cross-session cache
    ttl: 0,
    keyGenerator: defaultKeyGenerator,
  },

  agent_analysis: {
    enabled: true,
    ttl: STEP_TTLS.agent_analysis,
    keyGenerator: (input) => {
      const { query, context } = input;
      return hashInput({ query, context });
    },
  },

  debate_round: {
    enabled: true,
    ttl: STEP_TTLS.debate_round,
    keyGenerator: (input) => {
      const { topic, round, positions } = input;
      return hashInput({ topic, round, positions });
    },
  },

  conclusion: {
    enabled: true,
    ttl: STEP_TTLS.conclusion,
    keyGenerator: defaultKeyGenerator,
  },
};

// =============================================================================
// Cache Operations / 缓存操作
// =============================================================================

/**
 * Get cached step result
 * 获取缓存的步骤结果
 */
export async function getCachedStepResult<T>(
  sessionId: string,
  stepNumber: number,
  stepType: StepType,
  input: Record<string, unknown>
): Promise<T | null> {
  const strategy = STEP_CACHE_STRATEGIES[stepType];

  if (!strategy.enabled) {
    return null;
  }

  const inputHash = strategy.keyGenerator(input);
  const cacheKey = generateStepCacheKey(sessionId, stepNumber, input);

  try {
    const cached = await workflowCache.get(cacheKey);

    if (cached) {
      // Check if should invalidate
      if (strategy.shouldInvalidate?.(cached, input)) {
        await workflowCache.delete(cacheKey);
        return null;
      }

      return cached as T;
    }
  } catch (error) {
    console.error('[WorkflowCache] Get error:', error);
  }

  return null;
}

/**
 * Set cached step result
 * 设置缓存的步骤结果
 */
export async function setCachedStepResult(
  sessionId: string,
  stepNumber: number,
  stepType: StepType,
  input: Record<string, unknown>,
  result: unknown
): Promise<void> {
  const strategy = STEP_CACHE_STRATEGIES[stepType];

  if (!strategy.enabled || strategy.ttl === 0) {
    return;
  }

  const cacheKey = generateStepCacheKey(sessionId, stepNumber, input);

  try {
    await workflowCache.set(cacheKey, result, { ttl: strategy.ttl });
  } catch (error) {
    console.error('[WorkflowCache] Set error:', error);
  }
}

/**
 * Invalidate cached step result
 * 使缓存的步骤结果失效
 */
export async function invalidateStepCache(
  sessionId: string,
  stepNumber: number,
  input: Record<string, unknown>
): Promise<void> {
  const cacheKey = generateStepCacheKey(sessionId, stepNumber, input);

  try {
    await workflowCache.delete(cacheKey);
  } catch (error) {
    console.error('[WorkflowCache] Invalidate error:', error);
  }
}

/**
 * Check if step should be cached
 * 检查步骤是否应该缓存
 */
export function shouldCacheStep(stepType: StepType): boolean {
  const strategy = STEP_CACHE_STRATEGIES[stepType];
  return strategy.enabled && strategy.ttl > 0;
}

/**
 * Get step TTL
 * 获取步骤TTL
 */
export function getStepTTL(stepType: StepType): number {
  return STEP_TTLS[stepType] ?? 0;
}
