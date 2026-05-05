/**
 * Streaming Strategy Generation API Route
 *
 * POST /api/strategy/generate/stream
 *
 * Drop-in streaming sibling of `/api/strategy/generate`. Same auth, quota,
 * cache, and persistence semantics; only the transport differs:
 *
 *   • Cache HIT  → emits one `data: {"content":<code>}` frame + `[DONE]`
 *                  so the client always sees the same SSE protocol shape
 *                  regardless of whether the LLM was actually called.
 *   • Cache MISS → forwards the upstream LLM SSE through
 *                  `translateUpstreamSseStream` (cross-chunk buffering,
 *                  mid-stream gateway error → canonical error frame,
 *                  truncation detection). On clean termination, the
 *                  assembled body is persisted to the popular-strategy
 *                  pool — same end state as the JSON route.
 *
 * Why a separate endpoint instead of content-negotiation on the JSON
 * route: streaming semantics (terminal frames, cancellation, mid-flight
 * cache writes) are orthogonal enough that the two paths share *config*
 * but not control flow. Splitting keeps each route's success/failure
 * matrix small and independently testable.
 *
 * Shared with the JSON route via `lib/strategy/generate-shared.ts`:
 *   - STRATEGY_SYSTEM_PROMPT      (must match — drives cache-key parity)
 *   - buildStrategyUserMessage    (idem)
 *   - computeStrategyCacheKey     (idem)
 *   - extractCode                 (post-stream code fence stripping)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { checkUsage, incrementUsage } from '@/lib/middleware/usage-tracker';
import { findPopularStrategyByKey, upsertPopularStrategy } from '@/lib/db/queries';
import { LlmCancelledError, loadGatewayConfig, streamChat } from '@/lib/llm';
import { translateUpstreamSseStream } from '@/lib/llm/sse-transform';
import {
  STRATEGY_SYSTEM_PROMPT,
  STRATEGY_TOKENS_PER_CHAR,
  buildStrategyUserMessage,
  computeStrategyCacheKey,
  extractCode,
} from '@/lib/strategy/generate-shared';

const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Disable buffering on nginx-style reverse proxies — without this the
  // streaming UX collapses back to "all-at-once after 52s" for users behind
  // certain ingress configurations.
  'X-Accel-Buffering': 'no',
};

const errorFrame = (payload: Record<string, unknown>): string =>
  `data: ${JSON.stringify({ error: payload })}\n\n`;
const contentFrame = (text: string): string =>
  `data: ${JSON.stringify({ content: text })}\n\n`;
const metaFrame = (payload: Record<string, unknown>): string =>
  `data: ${JSON.stringify({ meta: payload })}\n\n`;
const doneFrame = (): string => 'data: [DONE]\n\n';

function sseErrorResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(errorFrame(payload), { status, headers: SSE_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    if (!loadGatewayConfig().hasKey) {
      return sseErrorResponse(
        {
          code: 'SERVER_MISCONFIGURED',
          title: 'Server misconfigured: missing API key',
          severity: 'error',
        },
        500,
      );
    }

    const body = await request.json().catch(() => ({}));
    const { prompt, strategyType } = body as {
      prompt?: unknown;
      strategyType?: string;
    };

    if (!prompt || typeof prompt !== 'string') {
      return sseErrorResponse(
        {
          code: 'STRATEGY_NO_PROMPT',
          title: '缺少策略描述',
          description: '请输入策略描述后再生成，例如"双均线金叉买入死叉卖出"',
          severity: 'error',
          recoveryActions: [
            { type: 'custom', label: '输入描述' },
            { type: 'custom', label: '使用模板' },
          ],
        },
        400,
      );
    }

    // AI call quota check — identical to the JSON route so quota stays
    // unified across transports.
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email ?? session?.user?.name ?? 'anonymous';
    const userPlan = (session?.user as { role?: string } | undefined)?.role ?? 'free';

    const usageStatus = await checkUsage(userId, 'ai_call', userPlan);
    if (!usageStatus.allowed) {
      return sseErrorResponse(
        {
          code: 'AI_QUOTA_EXCEEDED',
          title: 'AI 调用额度已用完',
          description: `今日已使用 ${usageStatus.used}/${usageStatus.limit} 次 AI 调用，额度将于明日重置`,
          severity: 'warning',
          recoveryActions: [
            { type: 'navigate', href: '/dashboard/account', label: '升级套餐' },
            { type: 'custom', label: '使用模板' },
          ],
          resetAt: usageStatus.resetAt,
        },
        429,
      );
    }

    // Increment usage (fire-and-forget; cache hits still count as one call,
    // matching the JSON route — change here = drift in billing semantics).
    void incrementUsage(userId, 'ai_call');

    const cacheKey = computeStrategyCacheKey(prompt);

    // Cache hit: emit a single content frame + DONE. We resolve the full
    // string in one chunk because there's no value in fake-streaming a
    // local string char-by-char — the user just sees the editor flash.
    const cached = await findPopularStrategyByKey(cacheKey);
    if (cached?.veighnaCode) {
      const code = cached.veighnaCode.trim();
      // Token-saved estimate matches the JSON route's formula so the cache
      // badge displays the same number across transports — system prompt +
      // user prompt + ~500 tokens of structural overhead the LLM would
      // otherwise emit.
      const savedTokens = Math.round(
        STRATEGY_SYSTEM_PROMPT.length * STRATEGY_TOKENS_PER_CHAR +
          prompt.length * STRATEGY_TOKENS_PER_CHAR +
          500,
      );
      // Bump usage count asynchronously — same semantics as JSON route.
      void upsertPopularStrategy({
        cacheKey,
        code,
        strategyType: strategyType ?? 'unknown',
      }).catch((err: unknown) => {
        console.error('[strategy/generate/stream] Failed to update cache usage:', err);
      });

      console.log(`[strategy/generate/stream] Cache HIT for key ${cacheKey}`);
      // Order: meta first so the client can flip the cache badge before
      // rendering the (possibly large) code block, then the content, then
      // the terminator. Single Response body keeps the round-trip to a
      // single TCP write.
      return new Response(
        metaFrame({ cached: true, savedTokens }) + contentFrame(code) + doneFrame(),
        { status: 200, headers: SSE_HEADERS },
      );
    }

    console.log('[strategy/generate/stream] Cache MISS — calling LLM router (streaming)...');
    const startTime = Date.now();

    let upstream: Response;
    try {
      upstream = await streamChat(
        'routine',
        [
          { role: 'system', content: STRATEGY_SYSTEM_PROMPT },
          { role: 'user', content: buildStrategyUserMessage(prompt) },
        ],
        {
          temperature: 0.3,
          maxTokens: 2000,
          signal: request.signal,
          caller: 'strategy.generate.stream',
        },
      );
    } catch (err) {
      if (err instanceof LlmCancelledError) {
        // Caller closed the tab before we even opened the upstream socket —
        // 499 (nginx convention) keeps this out of 5xx error budgets.
        return new NextResponse(null, { status: 499 });
      }
      console.error('[strategy/generate/stream] LLM error:', err);
      return sseErrorResponse(
        {
          code: 'STRATEGY_LLM_FAILED',
          title: 'AI 策略生成失败',
          description: 'AI 服务暂时不可用，可使用内置模板生成策略',
          severity: 'error',
          recoveryActions: [
            { type: 'retry', label: '重试' },
            { type: 'custom', label: '使用模板' },
            { type: 'custom', label: '修改描述' },
          ],
          details: err instanceof Error ? err.message : String(err),
        },
        502,
      );
    }

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error(
        '[strategy/generate/stream] Upstream not ok:',
        upstream.status,
        errText.slice(0, 200),
      );
      return sseErrorResponse(
        {
          code: 'STRATEGY_LLM_FAILED',
          title: 'AI 策略生成失败',
          description:
            upstream.status === 429
              ? 'AI 服务繁忙，请稍后再试'
              : `AI 服务暂时不可用 (${upstream.status})，请稍后重试`,
          severity: 'error',
          recoveryActions: [
            { type: 'retry', label: '重试' },
            { type: 'custom', label: '使用模板' },
          ],
        },
        upstream.status,
      );
    }

    if (!upstream.body) {
      return sseErrorResponse(
        {
          code: 'STRATEGY_LLM_FAILED',
          title: 'AI 策略生成失败',
          description: 'AI 服务返回了空响应，请稍后重试',
          severity: 'error',
          recoveryActions: [{ type: 'retry', label: '重试' }],
        },
        502,
      );
    }

    // Tap content as it streams to the client so we can persist the
    // assembled body without re-parsing the SSE bytes. The translate
    // helper guarantees onComplete fires exactly once on a clean [DONE]
    // and never on error/truncation, so this won't pollute the cache with
    // half-baked code.
    let assembled = '';
    const downstream = translateUpstreamSseStream(upstream.body, {
      signal: request.signal,
      onContent: (chunk) => {
        assembled += chunk;
      },
      onComplete: () => {
        const code = extractCode(assembled).trim();
        if (code.length > 0) {
          void upsertPopularStrategy({
            cacheKey,
            code,
            strategyType: strategyType ?? 'unknown',
          }).catch((err: unknown) => {
            console.error('[strategy/generate/stream] Failed to write to public pool:', err);
          });
        }
        console.log(
          `[strategy/generate/stream] Stream completed in ${Date.now() - startTime}ms (chars=${assembled.length})`,
        );
      },
    });

    return new Response(downstream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error('[strategy/generate/stream] Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return sseErrorResponse(
      {
        code: 'STRATEGY_GEN_ERROR',
        title: 'AI 策略生成失败',
        description:
          msg.includes('fetch') || msg.includes('network')
            ? '网络连接失败，请检查网络后重试'
            : `策略生成服务出错: ${msg}`,
        severity: 'error',
        recoveryActions: [
          { type: 'retry', label: '重试' },
          { type: 'custom', label: '使用模板' },
        ],
      },
      500,
    );
  }
}
