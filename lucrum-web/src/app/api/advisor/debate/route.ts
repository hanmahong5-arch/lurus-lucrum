/**
 * Investment Advisor Debate API Route
 * 投资顾问辩论 API 路由
 *
 * Implements Bull vs Bear debate functionality
 * Reference: TradingAgents (UCLA) debate framework
 */

import { NextRequest, NextResponse } from "next/server";
import type {
  AdvisorContext,
  DebateSession,
  ResearcherStance,
} from "@/lib/advisor/agent/types";
import { normalizeContext } from "@/lib/advisor/context-builder";
import {
  createDebateSession,
  generateDebatePrompts,
  parseModeratorConclusion,
} from "@/lib/advisor/reaction/debate-engine";
import { chatComplete, loadGatewayConfig, LlmCancelledError } from "@/lib/llm";

// Request interfaces
interface DebateStartRequest {
  action: "start";
  topic: string;
  symbol?: string;
  symbolName?: string;
  rounds?: number;
  advisorContext?: Partial<AdvisorContext>;
  marketData?: string;
}

interface DebateArgumentRequest {
  action: "argument";
  sessionId: string;
  stance: ResearcherStance;
  previousArguments?: {
    bull: string[];
    bear: string[];
  };
  currentRound: number;
  symbol: string;
  symbolName: string;
  topic: string;
  advisorContext?: Partial<AdvisorContext>;
  marketData?: string;
}

interface DebateConclusionRequest {
  action: "conclusion";
  sessionId: string;
  bullArguments: string[];
  bearArguments: string[];
  symbol: string;
  symbolName: string;
  topic: string;
  advisorContext?: Partial<AdvisorContext>;
}

type DebateRequest =
  | DebateStartRequest
  | DebateArgumentRequest
  | DebateConclusionRequest;

/**
 * Call LLM for debate response
 * 调用 LLM 获取辩论响应
 */
async function callLLM(
  systemPrompt: string,
  userMessage: string,
  temperature: number = 0.5,
  signal?: AbortSignal,
): Promise<string> {
  // Debate is multi-turn analytic prose; use the analytic tier (falls back to
  // routine if pro is degraded). Caller can pass `request.signal` to abort
  // when the client disconnects mid-debate.
  const result = await chatComplete(
    'analytic',
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    { temperature, maxTokens: 2000, signal },
  );
  return result.content;
}

/**
 * POST handler for debate operations
 * 辩论操作 POST 处理器
 */
export async function POST(request: NextRequest) {
  try {
    if (!loadGatewayConfig().hasKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing API key' },
        { status: 500 },
      );
    }

    const body: DebateRequest = await request.json();

    switch (body.action) {
      case "start":
        return handleDebateStart(body);
      case "argument":
        return handleDebateArgument(body, request.signal);
      case "conclusion":
        return handleDebateConclusion(body, request.signal);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof LlmCancelledError) {
      return new NextResponse(null, { status: 499 });
    }
    console.error("[Debate API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 },
    );
  }
}

/**
 * Handle debate start
 * 处理辩论开始
 */
async function handleDebateStart(body: DebateStartRequest) {
  const { topic, symbol, symbolName, rounds = 2 } = body;

  if (!topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  // Create debate session
  const session = createDebateSession(topic, symbol, symbolName, rounds);

  console.log(
    `[Debate API] Created debate session ${session.id} for "${topic}"`,
  );

  // Return complete session object including participants (fix for validation error)
  // 返回完整的session对象，包含participants字段（修复验证错误）
  return NextResponse.json({
    success: true,
    session: {
      id: session.id,
      topic: session.topic,
      symbol: session.symbol,
      rounds: session.rounds,
      participants: {
        bull: session.participants.bull,
        bear: session.participants.bear,
        moderator: session.participants.moderator,
      },
      arguments: session.arguments,
      createdAt: session.createdAt,
    },
  });
}

/**
 * Handle debate argument generation
 * 处理辩论论点生成
 */
async function handleDebateArgument(body: DebateArgumentRequest, signal?: AbortSignal) {
  const {
    sessionId,
    stance,
    previousArguments,
    currentRound,
    symbol,
    symbolName,
    topic,
    advisorContext,
    marketData,
  } = body;

  if (!sessionId || !stance || !topic) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const startTime = Date.now();

  // Generate debate prompts
  const context = advisorContext ? normalizeContext(advisorContext) : undefined;
  const prompts = generateDebatePrompts({
    symbol: symbol || "",
    symbolName: symbolName || "",
    topic,
    context: context || {
      corePhilosophy: "value",
      analysisMethods: ["fundamental", "technical"],
      tradingStyle: "swing",
      specialtyStrategies: [],
      riskProfile: { tolerance: "moderate", investmentHorizon: "medium" },
    },
    marketData,
    previousArguments,
    currentRound,
  });

  // Select the appropriate prompt based on stance
  const systemPrompt =
    stance === "bull" ? prompts.bullPrompt : prompts.bearPrompt;
  const stanceLabel = stance === "bull" ? "看多" : "看空";

  // Generate argument
  const userMessage = `请针对 ${symbolName || topic} 发表你的${stanceLabel}观点。这是第 ${currentRound} 轮辩论。`;

  console.log(
    `[Debate API] Generating ${stance} argument for round ${currentRound}`,
  );

  const argument = await callLLM(systemPrompt, userMessage, 0.5, signal);

  const responseTime = Date.now() - startTime;
  console.log(`[Debate API] ${stance} argument generated in ${responseTime}ms`);

  // Extract key points (simple extraction)
  const keyPoints = extractKeyPoints(argument);

  return NextResponse.json({
    success: true,
    argument: {
      round: currentRound,
      stance,
      content: argument,
      keyPoints,
      timestamp: new Date(),
    },
    metadata: {
      sessionId,
      responseTime,
    },
  });
}

/**
 * Handle debate conclusion generation
 * 处理辩论结论生成
 */
async function handleDebateConclusion(body: DebateConclusionRequest, signal?: AbortSignal) {
  const {
    sessionId,
    bullArguments,
    bearArguments,
    symbol,
    symbolName,
    topic,
    advisorContext,
  } = body;

  if (!sessionId || !bullArguments?.length || !bearArguments?.length) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const startTime = Date.now();

  // Generate moderator prompt
  const context = advisorContext ? normalizeContext(advisorContext) : undefined;
  const prompts = generateDebatePrompts({
    symbol: symbol || "",
    symbolName: symbolName || "",
    topic,
    context: context || {
      corePhilosophy: "value",
      analysisMethods: ["fundamental", "technical"],
      tradingStyle: "swing",
      specialtyStrategies: [],
      riskProfile: { tolerance: "moderate", investmentHorizon: "medium" },
    },
    previousArguments: { bull: bullArguments, bear: bearArguments },
    currentRound: bullArguments.length,
  });

  // Generate conclusion
  const userMessage = `请综合以上多空双方的观点，给出你的综合判断和投资建议。`;

  console.log(`[Debate API] Generating moderator conclusion`);

  const conclusionText = await callLLM(
    prompts.moderatorPrompt,
    userMessage,
    0.3,
    signal,
  );

  const responseTime = Date.now() - startTime;
  console.log(`[Debate API] Conclusion generated in ${responseTime}ms`);

  // Parse conclusion
  const conclusion = parseModeratorConclusion(conclusionText);

  return NextResponse.json({
    success: true,
    conclusion: {
      ...conclusion,
      rawContent: conclusionText,
    },
    metadata: {
      sessionId,
      responseTime,
      totalRounds: bullArguments.length,
    },
  });
}

/**
 * Extract key points from argument text
 * 从论点文本中提取关键点
 */
function extractKeyPoints(text: string): string[] {
  const points: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    // Match numbered or bulleted items
    const match =
      line.match(/^[\d\-\*]\.\s*(.+)$/) || line.match(/^[\-\*]\s*(.+)$/);
    if (match && match[1]) {
      const point = match[1].trim();
      if (point.length > 10 && point.length < 200) {
        points.push(point);
      }
    }
  }

  return points.slice(0, 5); // Max 5 key points
}

/**
 * GET handler - returns debate API info
 * GET 处理器 - 返回辩论 API 信息
 */
export async function GET() {
  return NextResponse.json({
    name: "Lucrum Debate API",
    version: "1.0.0",
    description: "Bull vs Bear debate for balanced investment analysis",
    actions: {
      start: "Create a new debate session",
      argument: "Generate an argument for bull or bear side",
      conclusion: "Generate moderator conclusion",
    },
    participants: {
      bull: "Bull Researcher - Finds opportunities and upside potential",
      bear: "Bear Researcher - Identifies risks and downside factors",
      moderator: "Debate Moderator - Synthesizes both sides and gives verdict",
    },
    status: "ready",
  });
}
