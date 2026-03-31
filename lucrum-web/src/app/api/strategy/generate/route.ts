/**
 * Strategy Generation API Route
 * Connects to lurus-api (DeepSeek LLM) to generate trading strategies.
 * Implements a public cache pool: checks for identical strategies before calling LLM.
 *
 * 策略生成 API 路由 - 连接 lurus-api (DeepSeek LLM) 生成交易策略。
 * 实现公共缓存池：调用 LLM 前先查询相同策略缓存。
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { checkUsage, incrementUsage } from '@/lib/middleware/usage-tracker';
import { findPopularStrategyByKey, upsertPopularStrategy } from '@/lib/db/queries';

// lurus-api configuration
const LURUS_API_URL = process.env.LURUS_API_URL || 'https://api.lurus.cn';
const LURUS_API_KEY = process.env.LURUS_API_KEY ?? '';

// Approximate tokens per character (rough estimate for cache savings display)
const TOKENS_PER_CHAR = 0.4;

// System prompt for strategy generation
const SYSTEM_PROMPT = `你是一个专业的量化交易策略开发专家，精通 VeighNa 量化交易框架。
你的任务是根据用户的自然语言描述，生成可执行的 VeighNa CTA 策略代码。

代码要求：
1. 使用 VeighNa 4.0+ 的 CtaTemplate 类
2. 包含完整的策略类定义
3. 包含参数定义、变量定义、初始化方法和 on_bar 方法
4. 代码需要有中英双语注释
5. 代码需要符合 Python 最佳实践
6. 如果用户提到具体的技术指标（如均线、RSI、MACD、布林带等），要正确实现
7. 如果用户提到止盈止损，要正确实现

输出格式：
- 只输出 Python 代码，不要有其他解释
- 代码开头要有策略描述的文档字符串
- 代码要可以直接复制运行

You are a professional quantitative trading strategy developer, expert in VeighNa framework.
Your task is to generate executable VeighNa CTA strategy code based on user's natural language description.`;

/**
 * Compute a deterministic MD5 cache key from the strategy prompt.
 * Normalises whitespace so semantically identical prompts hit the same key.
 */
function computeCacheKey(prompt: string): string {
  const normalised = prompt.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('md5').update(normalised).digest('hex');
}

/**
 * Extract Python code from markdown code block if present.
 */
function extractCode(raw: string): string {
  const withLang = raw.match(/```python\n([\s\S]*?)```/);
  if (withLang?.[1]) return withLang[1];
  const plain = raw.match(/```\n([\s\S]*?)```/);
  if (plain?.[1]) return plain[1];
  return raw;
}

export async function POST(request: NextRequest) {
  try {
    if (!LURUS_API_KEY) {
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
    const cacheKey = computeCacheKey(prompt);

    // Check public cache pool first
    const cached = await findPopularStrategyByKey(cacheKey);
    if (cached?.veighnaCode) {
      const code = cached.veighnaCode;
      const savedTokens = Math.round(SYSTEM_PROMPT.length * TOKENS_PER_CHAR + prompt.length * TOKENS_PER_CHAR + 500);

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

    // Cache miss — call lurus-api (DeepSeek) for strategy generation
    console.log('[strategy/generate] Cache MISS — calling lurus-api...');
    const startTime = Date.now();

    const response = await fetch(`${LURUS_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LURUS_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `请根据以下策略描述生成 VeighNa CTA 策略代码：\n\n${prompt}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
      cache: 'no-store',
    });

    console.log(
      `[strategy/generate] Response in ${Date.now() - startTime}ms, status: ${response.status}`
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[strategy/generate] LLM API error:', response.status, errorText);
      return NextResponse.json(
        {
          error: {
            code: 'STRATEGY_LLM_FAILED',
            title: 'AI 策略生成失败',
            description: response.status === 429
              ? 'AI 服务繁忙，请稍后重试'
              : 'AI 服务暂时不可用，可使用内置模板生成策略',
            severity: 'error',
            recoveryActions: [
              { type: 'retry', label: '重试' },
              { type: 'custom', label: '使用模板' },
              { type: 'custom', label: '修改描述' },
            ],
          },
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const generatedCode = (data.choices?.[0]?.message?.content as string) || '';
    const code = extractCode(generatedCode).trim();
    const actualTokens: number = (data.usage?.total_tokens as number | undefined) ?? 0;

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
      usage: data.usage,
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
