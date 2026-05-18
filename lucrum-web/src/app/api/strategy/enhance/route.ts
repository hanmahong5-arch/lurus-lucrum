/**
 * Strategy Prompt Enhance API
 *
 * POST /api/strategy/enhance  { prompt: string } → { enhanced: string }
 *
 * Rewrites a user's casual strategy description into a precise, generation-ready
 * prompt — populates implicit universe / period / signal / risk knobs so the
 * downstream `strategy.generate` call doesn't have to guess. Cheaper than a
 * full generation: a routine-tier completion at maxTokens=400.
 *
 * @module app/api/strategy/enhance/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { chatComplete, LlmCancelledError } from '@/lib/llm';

const ENHANCE_SYSTEM_PROMPT = `你是 A 股量化策略描述改写助手。用户会给你一句不精确的策略想法,你的任务是改写成一段更明确、能直接喂给 vnpy 代码生成器的策略描述。

输出要求:
1. 长度 80-180 字之间,只输出改写后的策略描述本身,不要前缀/解释/markdown
2. 必须显式包含 4 要素:
   - **标的范围** (例如 "沪深 300 成分股" / "全部 A 股") — 用户没提就给合理默认
   - **时间周期** (日线 / 60分钟线 等) — 用户没提就给"日线"
   - **入场信号** (具体的指标条件 / 价格行为)
   - **出场与风控** (止损 % / 止盈 % / 持仓天数 上限)
3. 如果用户已经说得很具体(>= 60 字且 4 要素齐全),只做轻微润色,不要扩写
4. 保留用户原意,不要凭空加新策略思想
5. 中文输出,数字用阿拉伯,百分比用 % 符号

直接输出改写结果,不要 "改写后:" 等前缀。`;

const ENHANCE_MAX_INPUT_CHARS = 600;
const ENHANCE_MAX_OUTPUT_CHARS = 600;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', title: '未登录', description: '请先登录' } },
      { status: 401 },
    );
  }

  let body: { prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', title: '请求格式错误', description: '无法解析 JSON' } },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return NextResponse.json(
      { error: { code: 'EMPTY_PROMPT', title: '描述为空', description: '请先输入策略想法再点 ✨' } },
      { status: 400 },
    );
  }
  if (prompt.length > ENHANCE_MAX_INPUT_CHARS) {
    return NextResponse.json(
      {
        error: {
          code: 'PROMPT_TOO_LONG',
          title: '描述过长',
          description: `描述超过 ${ENHANCE_MAX_INPUT_CHARS} 字符,已经够具体,不需要 enhance`,
        },
      },
      { status: 400 },
    );
  }

  try {
    const completion = await chatComplete(
      'routine',
      [
        { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.4,
        maxTokens: 400,
        signal: request.signal,
        caller: 'strategy.enhance',
      },
    );

    const enhanced = completion.content.trim().slice(0, ENHANCE_MAX_OUTPUT_CHARS);
    if (!enhanced) {
      return NextResponse.json(
        {
          error: {
            code: 'ENHANCE_EMPTY',
            title: 'AI 改写失败',
            description: 'AI 没能给出改写结果,请直接点"生成策略"',
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      data: {
        enhanced,
        model: completion.model,
        fallbackUsed: completion.fallbackUsed,
      },
    });
  } catch (err) {
    if (err instanceof LlmCancelledError) {
      return new NextResponse(null, { status: 499 });
    }
    console.warn('[strategy/enhance] LLM error:', err);
    return NextResponse.json(
      {
        error: {
          code: 'ENHANCE_LLM_FAILED',
          title: 'AI 服务暂时不可用',
          description: '稍后再试,或直接点"生成策略"',
        },
      },
      { status: 502 },
    );
  }
}
