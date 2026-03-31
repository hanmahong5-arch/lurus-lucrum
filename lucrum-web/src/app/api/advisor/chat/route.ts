/**
 * Investment Advisor Chat API Route (Enhanced)
 * 投资顾问对话 API 路由 (增强版)
 *
 * Implements multi-agent architecture with:
 * - Dynamic philosophy-based context loading
 * - Multiple analysis modes (quick, deep, debate, diagnose)
 * - Master investor perspectives
 * - Token budget management
 *
 * Reference: ai-hedge-fund, TradingAgents (UCLA)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { verifyZitadelJWT } from "@/lib/auth/jwt-verify";
import type { AdvisorContext, ChatMode, InstitutionRoleId } from "@/lib/advisor/agent/types";
import {
  buildAdvisorSystemPrompt,
  normalizeContext,
} from "@/lib/advisor/context-builder";
import {
  selectAgents,
  buildAgentPrompt,
} from "@/lib/advisor/agent/agent-orchestrator";
import { recommendAnalyst } from "@/lib/advisor/agent/analyst-agents";
import { INVESTMENT_ADVISOR_SYSTEM_PROMPT } from "@/lib/investment-context/conversation-templates";
import { checkAndConsumeQuota, consumeQuota, resolveAccountId } from "@/lib/middleware/quota-check";
import { recordUserEvent } from "@/lib/db/queries";
import { getInstitutionRoleById } from "@/lib/advisor/agent/institution-agents";
import { searchMemories, addMemory, buildMemoryPromptSection } from "@/lib/memorus-client";

// lurus-api configuration
// 在集群内部通过 Service 访问，外部通过 api.lurus.cn 访问
const LURUS_API_URL = process.env.LURUS_API_URL || "https://api.lurus.cn";
const LURUS_API_KEY = process.env.LURUS_API_KEY ?? "";

// Message interface for chat history
// 聊天历史的消息接口
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Enhanced request body interface
// 增强的请求体接口
interface AdvisorChatRequest {
  message: string;
  history?: ChatMessage[];
  mode?: ChatMode;
  stream?: boolean;

  // New: Advisor context for philosophy-based analysis
  // 新增: 用于基于流派分析的顾问上下文
  advisorContext?: Partial<AdvisorContext>;

  // New: Institution role for buy-side fund analysis
  // 新增: 买方基金机构角色
  institutionRole?: InstitutionRoleId;

  // Legacy context (kept for backward compatibility)
  // 旧版上下文 (保持向后兼容)
  context?: {
    symbol?: string;
    symbolName?: string;
    sector?: string;
    timeframe?: string;
    riskTolerance?: string;
    marketData?: string;
  };
}

/**
 * Build system prompt for an institution role.
 * Prepends the role's systemPrompt + outputFormat to the base instruction.
 */
function buildInstitutionSystemPrompt(
  roleId: InstitutionRoleId,
  legacyContext: AdvisorChatRequest["context"],
): string {
  const role = getInstitutionRoleById(roleId);

  const followUpInstruction = `

## Follow-up Questions Requirement
At the END of your response, append a hidden marker containing 3 follow-up questions. Format exactly as:
<!--QUESTIONS:["question 1 in Chinese","question 2 in Chinese","question 3 in Chinese"]-->
Do NOT show this marker visually. Questions must be in Chinese, concise (≤20 characters).`;

  let contextSection = "";
  if (legacyContext?.symbol) {
    const name = legacyContext.symbolName || legacyContext.symbol;
    contextSection = `\n\n## 分析标的\n股票代码：${legacyContext.symbol}，公司名称：${name}`;
  }

  return `${role.systemPrompt}\n\n## 输出要求\n${role.outputFormat}${contextSection}${followUpInstruction}`;
}

/**
 * Build system prompt based on advisor context or legacy context
 * 根据顾问上下文或旧版上下文构建系统提示词
 */
function buildSystemPrompt(
  advisorContext: Partial<AdvisorContext> | undefined,
  legacyContext: AdvisorChatRequest["context"],
  mode: ChatMode,
): string {
  // Instruction to generate follow-up questions at the end of each response
  // 要求在每条回复末尾生成后续问题标记
  const followUpInstruction = `

## Follow-up Questions Requirement
At the END of your response, append a hidden marker containing 3 follow-up questions that would naturally continue this conversation. Format exactly as:
<!--QUESTIONS:["question 1 in Chinese","question 2 in Chinese","question 3 in Chinese"]-->
Do NOT show this marker visually in the main text. Questions must be in Chinese, concise (≤20 characters), and highly relevant to what was just discussed.`;

  // If advisor context is provided, use new dynamic context builder
  // 如果提供了顾问上下文，使用新的动态上下文构建器
  if (advisorContext) {
    const normalizedContext = normalizeContext(advisorContext);
    const built = buildAdvisorSystemPrompt(normalizedContext, mode, {
      stockSymbol: legacyContext?.symbol,
      stockName: legacyContext?.symbolName,
      marketData: legacyContext?.marketData,
    });

    console.log(
      `[Advisor API] Built dynamic context with ${built.includedSections.length} sections, ~${built.tokenBudget.total} tokens`,
    );

    return built.systemPrompt + followUpInstruction;
  }

  // Fallback to legacy system prompt
  // 回退到旧版系统提示词
  let prompt = INVESTMENT_ADVISOR_SYSTEM_PROMPT;

  if (legacyContext) {
    const contextAdditions: string[] = [];

    if (legacyContext.symbol) {
      contextAdditions.push(
        `当前用户关注的标的：${legacyContext.symbolName || legacyContext.symbol}`,
      );
    }
    if (legacyContext.sector) {
      contextAdditions.push(`当前关注的行业板块：${legacyContext.sector}`);
    }
    if (legacyContext.timeframe) {
      contextAdditions.push(`用户的投资时间框架：${legacyContext.timeframe}`);
    }
    if (legacyContext.riskTolerance) {
      contextAdditions.push(
        `用户的风险承受能力：${legacyContext.riskTolerance}`,
      );
    }
    if (legacyContext.marketData) {
      contextAdditions.push(`\n## 当前市场数据\n${legacyContext.marketData}`);
    }

    if (contextAdditions.length > 0) {
      prompt += `\n\n## 当前对话上下文\n${contextAdditions.join("\n")}`;
    }
  }

  return prompt + followUpInstruction;
}

/**
 * Get temperature and max tokens based on mode
 * 根据模式获取温度和最大 token 数
 */
function getModeConfig(mode: ChatMode): {
  temperature: number;
  maxTokens: number;
} {
  const configs: Record<ChatMode, { temperature: number; maxTokens: number }> =
    {
      quick: { temperature: 0.5, maxTokens: 1000 },
      deep: { temperature: 0.3, maxTokens: 4000 },
      debate: { temperature: 0.4, maxTokens: 3000 },
      diagnose: { temperature: 0.3, maxTokens: 3000 },
    };
  return configs[mode] || configs.deep;
}

/**
 * POST handler for investment advisor chat
 * 投资顾问对话 POST 处理器
 */
export async function POST(request: NextRequest) {
  try {
    if (!LURUS_API_KEY) {
      return NextResponse.json(
        { error: { code: 'SERVER_MISCONFIGURED', title: 'Server misconfigured: missing API key', severity: 'error' } },
        { status: 500 },
      );
    }

    const session = await getServerSession(authOptions);
    let userId = session?.user?.id as string | undefined;

    // Fallback: try Zitadel JWT from Authorization header (mobile app)
    if (!userId) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const claims = await verifyZitadelJWT(authHeader.slice(7));
        if (claims?.sub) {
          userId = claims.sub;
        }
      }
    }

    const body: AdvisorChatRequest = await request.json();
    const {
      message,
      history = [],
      mode = "deep",
      stream = false,
      advisorContext,
      institutionRole,
      context,
    } = body;

    // Validate input
    // 验证输入
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          error: {
            code: 'ADVISOR_NO_MESSAGE',
            title: '请输入问题',
            description: '请输入您想咨询的投资问题',
            severity: 'warning',
            recoveryActions: [
              { type: 'custom', label: '输入问题' },
            ],
          },
        },
        { status: 400 },
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        {
          error: {
            code: 'ADVISOR_MSG_TOO_LONG',
            title: '问题过长',
            description: '问题内容不能超过5000字，请简化问题后重试',
            severity: 'warning',
            recoveryActions: [
              { type: 'custom', label: '简化问题' },
            ],
          },
        },
        { status: 400 },
      );
    }

    // Get mode-specific configuration (temperature + maxTokens)
    // Institution roles override temperature and maxTokens from their definition
    const modeConfig = getModeConfig(mode);
    const { temperature, maxTokens } = institutionRole
      ? {
          temperature: getInstitutionRoleById(institutionRole).temperature,
          maxTokens: getInstitutionRoleById(institutionRole).maxTokens,
        }
      : modeConfig;

    // Check quota for authenticated users
    // 对已认证用户执行配额检查
    const accountId = userId ? (await resolveAccountId(userId)) ?? undefined : undefined;
    if (userId) {
      const quota = await checkAndConsumeQuota(accountId ?? userId, userId, maxTokens);
      if (!quota.allowed) {
        return NextResponse.json(
          {
            error: {
              code: 'ADVISOR_QUOTA',
              title: 'AI 对话次数已达今日上限',
              description: `当前${quota.plan ?? '免费'}计划的对话额度已用完，剩余 ${quota.remaining ?? 0} 次`,
              severity: 'warning',
              recoveryActions: [
                { type: 'navigate', href: '/dashboard/account', label: '升级套餐' },
                { type: 'custom', label: '使用模板问题' },
              ],
            },
          },
          { status: 429 }
        );
      }
    }

    // Fetch relevant memories for authenticated users (fail-open, parallel with other work)
    // 为已认证用户获取相关记忆（失败容错，不影响主流程）
    const memories = userId ? await searchMemories(userId, message) : [];
    const memorySection = buildMemoryPromptSection(memories);

    // Build system prompt: institution role takes priority, then advisor context, then legacy
    // 系统提示词优先级：机构角色 > 顾问上下文 > 旧版上下文
    const systemPrompt = (institutionRole
      ? buildInstitutionSystemPrompt(institutionRole, context)
      : buildSystemPrompt(advisorContext, context, mode)) + memorySection;

    // Build messages array
    // 构建消息数组
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10), // Keep last 10 messages / 保留最近10条消息
      { role: "user", content: message },
    ];

    // Log request details
    // 记录请求详情
    const contextInfo = institutionRole
      ? `institution_role=${institutionRole}`
      : advisorContext
        ? `philosophy=${advisorContext.corePhilosophy}, methods=${advisorContext.analysisMethods?.join(",")}`
        : "legacy context";
    console.log(
      `[Advisor API] Processing ${mode} mode request (stream: ${stream}), ${contextInfo}, history: ${history.length} messages`,
    );
    const startTime = Date.now();

    // Call lurus-api (DeepSeek) for investment advice
    // 调用 lurus-api (DeepSeek) 获取投资建议
    const response = await fetch(`${LURUS_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LURUS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[Advisor API] LLM error:", response.status, errorText);
      return NextResponse.json(
        {
          error: {
            code: 'ADVISOR_LLM',
            title: 'AI 顾问响应失败',
            description: response.status === 429
              ? 'AI 服务繁忙，请稍后再试'
              : `AI 服务暂时不可用 (${response.status})，请稍后重试`,
            severity: 'error',
            recoveryActions: [
              { type: 'retry', label: '重试' },
              { type: 'custom', label: '简化问题' },
            ],
          },
        },
        { status: response.status },
      );
    }

    // Handle streaming response
    // 处理流式响应
    if (stream) {
      const responseTime = Date.now() - startTime;
      console.log(`[Advisor API] Streaming started in ${responseTime}ms`);

      // Create a TransformStream to process SSE data
      // 创建 TransformStream 处理 SSE 数据
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const transformStream = new TransformStream({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              // Check for stream end
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";

                if (content) {
                  // Send content as SSE event
                  // 将内容作为 SSE 事件发送
                  const sseData = JSON.stringify({ content });
                  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        },
      });

      // Pipe the response through our transform
      // 通过我们的转换器管道响应
      const streamResponse = response.body?.pipeThrough(transformStream);

      return new Response(streamResponse, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Response-Time": `${responseTime}ms`,
          "X-Mode": mode,
          "X-Context-Type": advisorContext ? "agentic" : "legacy",
        },
      });
    }

    // Handle non-streaming response
    // 处理非流式响应
    const responseTime = Date.now() - startTime;
    console.log(
      `[Advisor API] Response received in ${responseTime}ms, status: ${response.status}`,
    );

    const data = await response.json();
    let advisorResponse: string = data.choices?.[0]?.message?.content || "";

    if (!advisorResponse) {
      return NextResponse.json(
        {
          error: {
            code: 'ADVISOR_EMPTY',
            title: 'AI 未返回内容',
            description: 'AI 顾问未生成有效回复，请尝试换一种方式提问',
            severity: 'warning',
            recoveryActions: [
              { type: 'retry', label: '重试' },
              { type: 'custom', label: '换一种提问方式' },
            ],
          },
        },
        { status: 500 },
      );
    }

    // Extract suggested follow-up questions from hidden marker
    // Format: <!--QUESTIONS:["q1","q2","q3"]-->
    // 解析隐藏标记中的后续问题建议
    let suggestedQuestions: string[] = [];
    const questionsMatch = advisorResponse.match(
      /<!--QUESTIONS:([\s\S]*?)-->/,
    );
    if (questionsMatch?.[1]) {
      try {
        const parsed: unknown = JSON.parse(questionsMatch[1]);
        if (Array.isArray(parsed)) {
          suggestedQuestions = parsed
            .filter((q): q is string => typeof q === "string" && q.length > 0)
            .slice(0, 5);
        }
      } catch {
        // Ignore parse errors, questions are optional
      }
      // Remove the marker from the visible response
      advisorResponse = advisorResponse.replace(/\s*<!--QUESTIONS:[\s\S]*?-->\s*/, "").trim();
    }

    const actualTokens: number = (data.usage?.total_tokens as number | undefined) ?? maxTokens;

    // Store this exchange in memorus for future context recall (fire-and-forget)
    // Cap response at 600 chars so stored bullets stay concise
    // 将本轮对话存入记忆引擎，供后续对话召回（即发即忘）
    if (userId) {
      const responseSnippet = advisorResponse.slice(0, 600);
      addMemory(userId, `用户咨询：${message}\n\n顾问建议：${responseSnippet}`);
    }

    // Record user behavior event (async, non-blocking)
    recordUserEvent({
      userId: userId ?? null,
      eventType: "advisor_chat",
      metadata: {
        mode,
        tokenCost: actualTokens,
        messageCount: history.length + 1,
        responseTime,
        contextType: advisorContext ? "agentic" : "legacy",
      },
      tokenCost: actualTokens,
    });

    // Consume actual tokens (in addition to estimated already consumed in checkAndConsumeQuota)
    if (userId && actualTokens > maxTokens) {
      consumeQuota({ accountId, userId, tokens: actualTokens - maxTokens, operationType: "advisor_chat" });
    }

    return NextResponse.json({
      success: true,
      response: advisorResponse,
      suggestedQuestions,
      usage: data.usage,
      metadata: {
        mode,
        responseTime,
        model: data.model,
        contextType: institutionRole ? "institution" : advisorContext ? "agentic" : "legacy",
        philosophy: advisorContext?.corePhilosophy,
        masterAgent: advisorContext?.masterAgent,
        institutionRole,
      },
    });
  } catch (error) {
    console.error("[Advisor API] Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          code: 'ADVISOR_ERROR',
          title: 'AI 顾问服务异常',
          description: msg.includes('timeout') || msg.includes('TIMEOUT')
            ? '请求超时，建议简化问题后重试'
            : msg.includes('fetch') || msg.includes('network')
              ? '网络连接失败，请检查网络后重试'
              : `AI 顾问服务出错: ${msg}`,
          severity: 'error',
          recoveryActions: [
            { type: 'retry', label: '重试' },
            { type: 'custom', label: '简化问题' },
          ],
        },
      },
      { status: 500 },
    );
  }
}

/**
 * GET handler - returns enhanced advisor capabilities
 * GET 处理器 - 返回增强的顾问能力
 */
export async function GET() {
  return NextResponse.json({
    name: "Lucrum Investment Advisor",
    version: "2.0.0",
    framework: "Agentic Multi-Philosophy System",
    architecture: {
      agents: {
        analysts: ["Fundamentals", "Technical", "Sentiment", "Macro"],
        researchers: ["Bull", "Bear", "Moderator"],
        masters: ["Buffett", "Lynch", "Livermore", "Simons"],
      },
      philosophies: [
        "value",
        "growth",
        "trend",
        "quantitative",
        "index",
        "dividend",
        "momentum",
      ],
      analysisMethods: [
        "fundamental",
        "technical",
        "macro",
        "behavioral",
        "factor",
      ],
      tradingStyles: [
        "scalping",
        "day_trading",
        "swing",
        "position",
        "buy_hold",
      ],
      specialtyStrategies: [
        "san_dao_liu_shu",
        "canslim",
        "turtle",
        "cycle",
        "event_driven",
      ],
    },
    capabilities: [
      "Multi-agent analysis (多Agent分析)",
      "Philosophy-based context (流派上下文)",
      "Bull vs Bear debate (多空辩论)",
      "Master investor perspectives (大师视角)",
      "Dynamic token management (动态Token管理)",
      "Proactive alerts (主动预警)",
      "Individual stock analysis (个股分析)",
      "Sector rotation analysis (行业轮动分析)",
      "Market overview (市场概览)",
      "Risk assessment (风险评估)",
      "Position sizing suggestions (仓位建议)",
      "Entry/exit timing guidance (入场/出场时机指导)",
    ],
    modes: {
      quick: "Fast response for simple queries (~1500 tokens)",
      deep: "Comprehensive multi-dimensional analysis (~3000 tokens)",
      debate: "Bull vs Bear balanced analysis (~4000 tokens)",
      diagnose: "Portfolio multi-perspective diagnosis (~2500 tokens)",
    },
    status: "ready",
  });
}
