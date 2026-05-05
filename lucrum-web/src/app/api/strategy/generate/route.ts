/**
 * Strategy Generation API Route
 * Connects to lurus-api (DeepSeek LLM) to generate trading strategies.
 * Implements a public cache pool: checks for identical strategies before calling LLM.
 *
 * 策略生成 API 路由 - 连接 lurus-api (DeepSeek LLM) 生成交易策略。
 * 实现公共缓存池：调用 LLM 前先查询相同策略缓存。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { checkUsage, incrementUsage } from '@/lib/middleware/usage-tracker';
import { findPopularStrategyByKey, upsertPopularStrategy } from '@/lib/db/queries';
import { chatComplete, loadGatewayConfig, LlmCancelledError } from '@/lib/llm';
import {
  STRATEGY_SYSTEM_PROMPT,
  STRATEGY_TOKENS_PER_CHAR,
  buildStrategyUserMessage,
  computeStrategyCacheKey,
  extractCode,
} from '@/lib/strategy/generate-shared';

export async function POST(request: NextRequest) {
  try {
    if (!loadGatewayConfig().hasKey) {
      return NextResponse.json(
        {
          error: {
            code: 'SERVER_MISCONFIGURED',
            title: 'Server misconfigured: missing API key',
            severity: 'error',
          },
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { prompt, strategyType, params } = body as {
      prompt?: unknown;
      strategyType?: string;
      params?: Record<string, unknown>;
    };

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'STRATEGY_NO_PROMPT',
            title: '缺少策略描述',
            description: '请输入策略描述后再生成，例如"双均线金叉买入死叉卖出"',
            severity: 'error',
            recoveryActions: [
              { type: 'custom', label: '输入描述' },
              { type: 'custom', label: '使用模板' },
            ],
          },
        },
        { status: 400 }
      );
    }

    // AI call quota check
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email ?? session?.user?.name ?? 'anonymous';
    const userPlan = (session?.user as { role?: string } | undefined)?.role ?? 'free';

    const usageStatus = await checkUsage(userId, 'ai_call', userPlan);
    if (!usageStatus.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'AI_QUOTA_EXCEEDED',
            title: 'AI 调用额度已用完',
            description: `今日已使用 ${usageStatus.used}/${usageStatus.limit} 次 AI 调用，额度将于明日重置`,
            severity: 'warning',
            recoveryActions: [
              { type: 'navigate', href: '/dashboard/account', label: '升级套餐' },
              { type: 'custom', label: '使用模板' },
            ],
          },
          resetAt: usageStatus.resetAt,
        },
        { status: 429 },
      );
    }

    // Increment usage (fire-and-forget)
    void incrementUsage(userId, 'ai_call');

    // Build cache key from the prompt
    const cacheKey = computeStrategyCacheKey(prompt);

    // Check public cache pool first
    const cached = await findPopularStrategyByKey(cacheKey);
    if (cached?.veighnaCode) {
      const code = cached.veighnaCode;
      const savedTokens = Math.round(
        STRATEGY_SYSTEM_PROMPT.length * STRATEGY_TOKENS_PER_CHAR +
          prompt.length * STRATEGY_TOKENS_PER_CHAR +
          500,
      );

      // Bump usage count asynchronously
      void upsertPopularStrategy({
        cacheKey,
        code,
        strategyType: strategyType ?? 'unknown',
      }).catch((err: unknown) => {
        console.error('[strategy/generate] Failed to update cache usage:', err);
      });

      console.log(`[strategy/generate] Cache HIT for key ${cacheKey}, savedTokens=${savedTokens}`);

      return NextResponse.json({
        success: true,
        code: code.trim(),
        cached: true,
        savedTokens,
        cacheKey,
        usage: null,
      });
    }

    // Cache miss — generate via the central router.
    //
    // Task class is `routine` (deepseek-chat / -v4-flash), not `analytic`.
    // The original code picked analytic on the grounds that "code length and
    // structure are well-bounded, so v4-pro is the right tier", but v4-pro is
    // CoT-heavy: it emits hundreds-thousands of `reasoning_content` tokens
    // before the user-facing code. For a structured fill-in-the-template
    // task like CtaTemplate generation that overhead is pure waste — and at
    // maxTokens=2000 the reasoning burn frequently truncates the answer
    // mid-method (measured 2026-05-01: v4-pro 65s @ 1.4K-char output and
    // truncated, v4-flash 25s @ 6.4K-char output and complete). Routine is
    // ~2.6x faster AND produces more complete code on this prompt shape.
    console.log('[strategy/generate] Cache MISS — calling LLM router...');
    const startTime = Date.now();

    let completion;
    try {
      completion = await chatComplete(
        'routine',
        [
          { role: 'system', content: STRATEGY_SYSTEM_PROMPT },
          { role: 'user', content: buildStrategyUserMessage(prompt) },
        ],
        { temperature: 0.3, maxTokens: 2000, signal: request.signal, caller: 'strategy.generate' },
      );
    } catch (err) {
      if (err instanceof LlmCancelledError) {
        return new NextResponse(null, { status: 499 });
      }
      console.error('[strategy/generate] LLM error:', err);
      return NextResponse.json(
        {
          error: {
            code: 'STRATEGY_LLM_FAILED',
            title: 'AI 策略生成失败',
            description: 'AI 服务暂时不可用，可使用内置模板生成策略',
            severity: 'error',
            recoveryActions: [
              { type: 'retry', label: '重试' },
              { type: 'custom', label: '使用模板' },
              { type: 'custom', label: '修改描述' },
            ],
          },
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }

    console.log(
      `[strategy/generate] Response in ${Date.now() - startTime}ms, model=${completion.model}, fallback=${completion.fallbackUsed}`
    );

    const code = extractCode(completion.content).trim();
    const actualTokens: number = completion.totalTokens ?? 0;

    // Write to public pool asynchronously (do not block response)
    void upsertPopularStrategy({
      cacheKey,
      code,
      strategyType: strategyType ?? 'unknown',
    }).catch((err: unknown) => {
      console.error('[strategy/generate] Failed to write to public pool:', err);
    });

    return NextResponse.json({
      success: true,
      code,
      cached: false,
      savedTokens: 0,
      cacheKey,
      usage: {
        prompt_tokens: completion.promptTokens,
        completion_tokens: completion.completionTokens,
        total_tokens: actualTokens,
      },
      metadata: {
        model: completion.model,
        fallbackUsed: completion.fallbackUsed,
      },
    });
  } catch (error) {
    console.error('[strategy/generate] Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          code: 'STRATEGY_GEN_ERROR',
          title: 'AI 策略生成失败',
          description: msg.includes('fetch') || msg.includes('network')
            ? '网络连接失败，请检查网络后重试'
            : `策略生成服务出错: ${msg}`,
          severity: 'error',
          recoveryActions: [
            { type: 'retry', label: '重试' },
            { type: 'custom', label: '使用模板' },
          ],
        },
      },
      { status: 500 }
    );
  }
}
