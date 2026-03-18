/**
 * Advisor Graph using LangGraph
 * 使用 LangGraph 的顾问 Graph
 *
 * Implements a multi-agent advisor system using LangGraph's StateGraph.
 * Supports quick analysis, deep analysis, and debate modes.
 */

import { Annotation, StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type {
  AgentAnalysis,
  DebateArgument,
  DebateConclusion,
  ChatMode,
  UserContext,
  MarketData,
  Stance,
} from "./types";
import { createDefaultAdvisorState } from "./types";

// ============================================================================
// State Annotation
// ============================================================================

/**
 * Define state using LangGraph Annotation
 * 使用 LangGraph Annotation 定义状态
 */
const AdvisorStateAnnotation = Annotation.Root({
  // Input fields
  question: Annotation<string>({
    reducer: (a, b) => b || a,
    default: () => "",
  }),
  symbol: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  mode: Annotation<ChatMode>({
    reducer: (a, b) => b || a,
    default: () => "quick" as ChatMode,
  }),
  userContext: Annotation<UserContext>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => createDefaultAdvisorState().userContext,
  }),

  // Market data
  marketData: Annotation<MarketData | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),

  // Conversation history
  messages: Annotation<BaseMessage[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  // Agent analyses
  analyses: Annotation<AgentAnalysis[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  // Debate-specific fields
  isDebate: Annotation<boolean>({
    reducer: (a, b) => b ?? a,
    default: () => false,
  }),
  debateTopic: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  debateRound: Annotation<number>({
    reducer: (a, b) => b ?? a,
    default: () => 0,
  }),
  maxDebateRounds: Annotation<number>({
    reducer: (a, b) => b || a,
    default: () => 2,
  }),
  debateArguments: Annotation<DebateArgument[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  debateConclusion: Annotation<DebateConclusion | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),

  // Output fields
  finalResponse: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),
  nextAgent: Annotation<string | undefined>({
    reducer: (a, b) => b ?? a,
    default: () => undefined,
  }),

  // Metadata
  errors: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  timestamp: Annotation<Date>({
    reducer: (a, b) => b || a,
    default: () => new Date(),
  }),
});

/**
 * Type alias for the graph state
 * Graph 状态类型别名
 */
type AdvisorState = typeof AdvisorStateAnnotation.State;

// ============================================================================
// LLM Configuration
// ============================================================================

/**
 * Create LLM instance with DeepSeek configuration
 * 创建使用 DeepSeek 配置的 LLM 实例
 */
function createLLM(temperature: number = 0.7): ChatOpenAI {
  return new ChatOpenAI({
    modelName: "deepseek-chat",
    temperature,
    maxTokens: 2000,
    configuration: {
      baseURL: process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    },
  });
}

// ============================================================================
// Node Functions
// ============================================================================

/**
 * Router node - determines which analysis path to take
 * 路由节点 - 决定分析路径
 */
async function routerNode(
  state: AdvisorState,
  _config?: RunnableConfig
): Promise<Partial<AdvisorState>> {
  console.log(`[routerNode] Mode: ${state.mode}, Question: ${state.question.substring(0, 50)}...`);

  // Determine next agent based on mode
  let nextAgent: string;

  switch (state.mode) {
    case "quick":
      nextAgent = "quick_analyst";
      break;
    case "deep":
      nextAgent = "deep_analyst";
      break;
    case "debate":
      nextAgent = "bull_researcher";
      break;
    case "diagnose":
      nextAgent = "fundamental_analyst";
      break;
    default:
      nextAgent = "quick_analyst";
  }

  return {
    nextAgent,
    timestamp: new Date(),
  };
}

/**
 * Quick analysis node - single agent quick response
 * 快速分析节点 - 单 Agent 快速响应
 */
async function quickAnalystNode(
  state: AdvisorState,
  _config?: RunnableConfig
): Promise<Partial<AdvisorState>> {
  console.log(`[quickAnalystNode] Processing quick analysis...`);

  const llm = createLLM(0.7);

  const systemPrompt = buildQuickAnalystPrompt(state);
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(state.question),
  ];

  try {
    const response = await llm.invoke(messages);
    const content = typeof response.content === "string" ? response.content : "";

    const analysis: AgentAnalysis = {
      agentId: "quick_analyst",
      agentName: "快速分析师",
      agentType: "analyst",
      content,
      keyPoints: extractKeyPoints(content),
      confidence: 0.75,
      timestamp: new Date(),
    };

    return {
      analyses: [analysis],
      finalResponse: content,
      messages: [new AIMessage(content)],
    };
  } catch (error) {
    console.error("[quickAnalystNode] Error:", error);
    return {
      errors: [`Quick analysis failed: ${error}`],
    };
  }
}

/**
 * Deep analysis node - multi-perspective analysis
 * 深度分析节点 - 多视角分析
 */
async function deepAnalystNode(
  state: AdvisorState,
  _config?: RunnableConfig
): Promise<Partial<AdvisorState>> {
  console.log(`[deepAnalystNode] Processing deep analysis...`);

  const llm = createLLM(0.7);

  // Run multiple analysis perspectives in parallel
  const perspectives = state.userContext.analysisMethods.slice(0, 3);
  const analyses: AgentAnalysis[] = [];

  for (const method of perspectives) {
    const systemPrompt = buildAnalystPrompt(method, state);
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(state.question),
    ];

    try {
      const response = await llm.invoke(messages);
      const content = typeof response.content === "string" ? response.content : "";

      analyses.push({
        agentId: `${method}_analyst`,
        agentName: getAnalystName(method),
        agentType: "analyst",
        content,
        keyPoints: extractKeyPoints(content),
        confidence: 0.8,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`[deepAnalystNode] ${method} analysis error:`, error);
    }
  }

  // Synthesize final response
  const synthesizedResponse = synthesizeAnalyses(analyses, state);

  return {
    analyses,
    finalResponse: synthesizedResponse,
    messages: [new AIMessage(synthesizedResponse)],
  };
}

/**
 * Bull researcher node - bullish argument
 * 多头研究员节点 - 看多论点
 */
async function bullResearcherNode(
  state: AdvisorState,
  _config?: RunnableConfig
): Promise<Partial<AdvisorState>> {
  console.log(`[bullResearcherNode] Round ${state.debateRound + 1}...`);

  const llm = createLLM(0.8);

  // Get previous bear argument if exists
  const prevBearArg = state.debateArguments
    .filter((a) => a.stance === "bear")
    .pop();

  const systemPrompt = buildDebatePrompt("bull", state, prevBearArg?.content);
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(
      prevBearArg
        ? `请回应空头观点并陈述你的看多理由：\n\n${prevBearArg.content}`
        : `请陈述你对 ${state.symbol || "该标的"} 的看多观点`
    ),
  ];

  try {
    const response = await llm.invoke(messages);
    const content = typeof response.content === "string" ? response.content : "";

    const argument: DebateArgument = {
      round: state.debateRound + 1,
      stance: "bull",
      agentId: "bull_researcher",
      content,
      keyPoints: extractKeyPoints(content),
      timestamp: new Date(),
    };

    const analysis: AgentAnalysis = {
      agentId: "bull_researcher",
      agentName: "多头研究员",
      agentType: "researcher",
      stance: "bull",
      content,
      keyPoints: argument.keyPoints,
      timestamp: new Date(),
    };

    return {
      debateArguments: [argument],
      analyses: [analysis],
      nextAgent: "bear_researcher",
    };
  } catch (error) {
    console.error("[bullResearcherNode] Error:", error);
    return {
      errors: [`Bull argument failed: ${error}`],
    };
  }
}

/**
 * Bear researcher node - bearish argument
 * 空头研究员节点 - 看空论点
 */
async function bearResearcherNode(
  state: AdvisorState,
  _config?: RunnableConfig
): Promise<Partial<AdvisorState>> {
  console.log(`[bearResearcherNode] Round ${state.debateRound + 1}...`);

  const llm = createLLM(0.8);

  // Get previous bull argument
  const prevBullArg = state.debateArguments
    .filter((a) => a.stance === "bull")
    .pop();

  const systemPrompt = buildDebatePrompt("bear", state, prevBullArg?.content);
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `请回应多头观点并陈述你的看空理由：\n\n${prevBullArg?.content || "无"}`
    ),
  ];

  try {
    const response = await llm.invoke(messages);
    const content = typeof response.content === "string" ? response.content : "";

    const argument: DebateArgument = {
      round: state.debateRound + 1,
      stance: "bear",
      agentId: "bear_researcher",
      content,
      keyPoints: extractKeyPoints(content),
      timestamp: new Date(),
    };

    const analysis: AgentAnalysis = {
      agentId: "bear_researcher",
      agentName: "空头研究员",
      agentType: "researcher",
      stance: "bear",
      content,
      keyPoints: argument.keyPoints,
      timestamp: new Date(),
    };

    // Determine if we need more rounds
    const newRound = state.debateRound + 1;
    const shouldContinue = newRound < state.maxDebateRounds;

    return {
      debateArguments: [argument],
      analyses: [analysis],
      debateRound: newRound,
      nextAgent: shouldContinue ? "bull_researcher" : "moderator",
    };
  } catch (error) {
    console.error("[bearResearcherNode] Error:", error);
    return {
      errors: [`Bear argument failed: ${error}`],
    };
  }
}

/**
 * Moderator node - synthesize debate conclusion
 * 主持人节点 - 综合辩论结论
 */
async function moderatorNode(
  state: AdvisorState,
  _config?: RunnableConfig
): Promise<Partial<AdvisorState>> {
  console.log(`[moderatorNode] Synthesizing debate conclusion...`);

  const llm = createLLM(0.5);

  const bullArgs = state.debateArguments
    .filter((a) => a.stance === "bull")
    .map((a) => a.content);
  const bearArgs = state.debateArguments
    .filter((a) => a.stance === "bear")
    .map((a) => a.content);

  const systemPrompt = buildModeratorPrompt(state, bullArgs, bearArgs);
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage("请综合多空双方观点，给出最终投资建议"),
  ];

  try {
    const response = await llm.invoke(messages);
    const content = typeof response.content === "string" ? response.content : "";

    // Parse conclusion from response
    const conclusion = parseDebateConclusion(content, state);

    const analysis: AgentAnalysis = {
      agentId: "moderator",
      agentName: "辩论主持人",
      agentType: "moderator",
      stance: conclusion.finalVerdict,
      content,
      keyPoints: [
        ...conclusion.keyBullPoints.slice(0, 2),
        ...conclusion.keyBearPoints.slice(0, 2),
      ],
      confidence: conclusion.confidenceLevel / 100,
      timestamp: new Date(),
    };

    return {
      analyses: [analysis],
      debateConclusion: conclusion,
      finalResponse: content,
      messages: [new AIMessage(content)],
    };
  } catch (error) {
    console.error("[moderatorNode] Error:", error);
    return {
      errors: [`Moderation failed: ${error}`],
    };
  }
}

// ============================================================================
// Routing Logic
// ============================================================================

/**
 * Determine next node based on state
 * 根据状态决定下一个节点
 */
function routeAfterRouter(state: AdvisorState): string {
  if (state.mode === "debate") {
    return "bull_researcher";
  } else if (state.mode === "deep") {
    return "deep_analyst";
  } else {
    return "quick_analyst";
  }
}

/**
 * Determine next node after bull researcher
 * 多头研究员后的下一个节点
 */
function routeAfterBull(_state: AdvisorState): string {
  return "bear_researcher";
}

/**
 * Determine next node after bear researcher
 * 空头研究员后的下一个节点
 */
function routeAfterBear(state: AdvisorState): string {
  if (state.debateRound >= state.maxDebateRounds) {
    return "moderator";
  }
  return "bull_researcher";
}

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Create the advisor graph
 * 创建顾问 Graph
 */
export function createAdvisorGraph() {
  // Create graph with annotation-based state
  const workflow = new StateGraph(AdvisorStateAnnotation)
    // Add nodes
    .addNode("router", routerNode)
    .addNode("quick_analyst", quickAnalystNode)
    .addNode("deep_analyst", deepAnalystNode)
    .addNode("bull_researcher", bullResearcherNode)
    .addNode("bear_researcher", bearResearcherNode)
    .addNode("moderator", moderatorNode)
    // Entry point
    .addEdge(START, "router")
    // Router conditional edges
    .addConditionalEdges("router", routeAfterRouter, {
      quick_analyst: "quick_analyst",
      deep_analyst: "deep_analyst",
      bull_researcher: "bull_researcher",
    })
    // Quick/Deep analyst -> END
    .addEdge("quick_analyst", END)
    .addEdge("deep_analyst", END)
    // Debate flow
    .addConditionalEdges("bull_researcher", routeAfterBull, {
      bear_researcher: "bear_researcher",
    })
    .addConditionalEdges("bear_researcher", routeAfterBear, {
      bull_researcher: "bull_researcher",
      moderator: "moderator",
    })
    .addEdge("moderator", END);

  return workflow.compile();
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildQuickAnalystPrompt(state: AdvisorState): string {
  const { userContext } = state;
  return `你是一位专业的投资顾问，擅长快速分析市场和个股。

用户风险偏好：${userContext.riskProfile.tolerance}
投资期限：${userContext.riskProfile.investmentHorizon}
核心投资理念：${userContext.corePhilosophy}

请根据用户的问题提供简洁、实用的投资建议。
回答应该：
1. 直接回答用户问题
2. 给出明确的观点
3. 提供1-2个关键理由
4. 如有必要，提示主要风险

${state.marketData ? `\n当前市场数据：${JSON.stringify(state.marketData)}` : ""}`;
}

function buildAnalystPrompt(method: string, state: AdvisorState): string {
  const methodDescriptions: Record<string, string> = {
    fundamental: "基本面分析师，专注于财务报表、估值和企业质量",
    technical: "技术分析师，专注于价格走势、技术指标和图表形态",
    macro: "宏观分析师，专注于经济周期、政策和行业趋势",
    behavioral: "行为金融分析师，专注于市场情绪和投资者心理",
    factor: "因子分析师，专注于量化因子和统计规律",
  };

  return `你是一位专业的${methodDescriptions[method] || "投资分析师"}。

请从你的专业视角分析用户的问题，给出深入的见解。

用户背景：
- 风险偏好：${state.userContext.riskProfile.tolerance}
- 投资期限：${state.userContext.riskProfile.investmentHorizon}

${state.marketData ? `\n市场数据：${JSON.stringify(state.marketData)}` : ""}`;
}

function buildDebatePrompt(
  stance: "bull" | "bear",
  state: AdvisorState,
  previousArgument?: string
): string {
  const stanceDesc = stance === "bull" ? "看多" : "看空";
  const stancePersonality = stance === "bull"
    ? "你是一位乐观的多头分析师，善于发现投资机会和增长潜力。"
    : "你是一位谨慎的空头分析师，善于识别风险和估值泡沫。";

  let prompt = `${stancePersonality}

你的任务是在投资辩论中代表${stanceDesc}立场。

标的：${state.symbol || "讨论中的标的"}
主题：${state.debateTopic || state.question}

请提供有说服力的${stanceDesc}论点，包括：
1. 核心观点
2. 支撑论据（数据、事实）
3. 应对可能的反驳`;

  if (previousArgument) {
    prompt += `\n\n对方论点：\n${previousArgument}\n\n请针对性回应并加强你的观点。`;
  }

  return prompt;
}

function buildModeratorPrompt(
  state: AdvisorState,
  bullArgs: string[],
  bearArgs: string[]
): string {
  return `你是一位客观公正的投资辩论主持人。

辩论主题：${state.debateTopic || state.question}
标的：${state.symbol || "讨论中的标的"}

多头观点汇总：
${bullArgs.map((arg, i) => `第${i + 1}轮：${arg}`).join("\n\n")}

空头观点汇总：
${bearArgs.map((arg, i) => `第${i + 1}轮：${arg}`).join("\n\n")}

请综合分析双方观点，给出：
1. 共识点（双方都认同的）
2. 多头核心论点（最有说服力的2-3点）
3. 空头核心论点（最有说服力的2-3点）
4. 主要风险因素
5. 潜在机会
6. 最终判断（偏多/偏空/中性）及置信度
7. 建议操作`;
}

function getAnalystName(method: string): string {
  const names: Record<string, string> = {
    fundamental: "基本面分析师",
    technical: "技术分析师",
    macro: "宏观分析师",
    behavioral: "行为金融分析师",
    factor: "因子分析师",
  };
  return names[method] || "分析师";
}

function extractKeyPoints(content: string): string[] {
  // Simple extraction - look for numbered points or bullet points
  const lines = content.split("\n");
  const keyPoints: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match numbered points (1. 2. 3.) or bullet points (- *)
    if (/^[\d]+[.、)]/.test(trimmed) || /^[-*•]/.test(trimmed)) {
      const point = trimmed.replace(/^[\d]+[.、)]\s*/, "").replace(/^[-*•]\s*/, "");
      if (point.length > 5 && point.length < 200) {
        keyPoints.push(point);
      }
    }
  }

  return keyPoints.slice(0, 5);
}

function synthesizeAnalyses(analyses: AgentAnalysis[], state: AdvisorState): string {
  if (analyses.length === 0) {
    return "分析暂时无法完成，请稍后重试。";
  }

  let response = `## 多维度分析报告\n\n`;
  response += `**问题**: ${state.question}\n\n`;

  for (const analysis of analyses) {
    response += `### ${analysis.agentName}\n\n`;
    response += `${analysis.content}\n\n`;
  }

  response += `---\n\n`;
  response += `*以上分析仅供参考，投资有风险，入市需谨慎。*`;

  return response;
}

function parseDebateConclusion(content: string, state: AdvisorState): DebateConclusion {
  // Simple parsing - in production this would be more sophisticated
  const bullPoints: string[] = [];
  const bearPoints: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];

  // Determine verdict from content
  let verdict: Stance = "neutral";
  if (content.includes("看多") || content.includes("买入") || content.includes("乐观")) {
    verdict = "bull";
  } else if (content.includes("看空") || content.includes("卖出") || content.includes("谨慎")) {
    verdict = "bear";
  }

  // Extract key points from debate arguments
  for (const arg of state.debateArguments) {
    if (arg.stance === "bull") {
      bullPoints.push(...arg.keyPoints.slice(0, 2));
    } else if (arg.stance === "bear") {
      bearPoints.push(...arg.keyPoints.slice(0, 2));
    }
  }

  return {
    consensus: "双方均认同当前市场存在不确定性",
    keyBullPoints: bullPoints.slice(0, 3),
    keyBearPoints: bearPoints.slice(0, 3),
    riskFactors: risks,
    opportunityFactors: opportunities,
    finalVerdict: verdict,
    confidenceLevel: 65,
    suggestedAction: verdict === "bull" ? "可适量买入" : verdict === "bear" ? "建议观望" : "保持中性",
  };
}

// ============================================================================
// Exports
// ============================================================================

export { AdvisorStateAnnotation };
export type { AdvisorState };
