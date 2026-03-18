/**
 * Lucrum Agentic Advisor - Agent Orchestrator
 *
 * Coordinates agent selection, prompt building, and execution
 * Manages token budgets and agent interactions
 */

import type {
  AgentRole,
  AnalystAgent,
  MasterAgent,
  AdvisorContext,
  ChatMode,
  AnalysisRequest,
  TokenBudget,
} from "./types";
import { TOKEN_LIMITS } from "./types";
import {
  ALL_ANALYSTS,
  getAnalystById,
  recommendAnalyst,
} from "./analyst-agents";
import {
  BULL_RESEARCHER,
  BEAR_RESEARCHER,
  DEBATE_MODERATOR,
} from "./researcher-agents";
import { ALL_MASTER_AGENTS, getMasterAgentById } from "./master-agents";

// ============================================================================
// Agent Selection
// ============================================================================

/**
 * Select appropriate agents based on analysis request
 * / 根据分析请求选择合适的 Agent
 */
export function selectAgents(
  request: AnalysisRequest,
  context: AdvisorContext,
): AgentRole[] {
  const agents: AgentRole[] = [];

  switch (request.mode) {
    case "quick":
      // Quick mode: single analyst based on question type
      // 快速模式：根据问题类型选择单个分析师
      const quickAnalyst = recommendAnalyst(request.question);
      agents.push(quickAnalyst);
      break;

    case "deep":
      // Deep mode: multiple analysts based on methods + optional master
      // 深度模式：根据分析方法选择多个分析师 + 可选大师视角
      for (const method of context.analysisMethods) {
        const analyst = ALL_ANALYSTS.find((a) => a.analysisMethod === method);
        if (analyst) {
          agents.push(analyst);
        }
      }
      // Add master agent if selected
      if (context.masterAgent) {
        const master = getMasterAgentById(context.masterAgent);
        if (master) {
          agents.push(master);
        }
      }
      break;

    case "debate":
      // Debate mode: bull + bear + moderator
      // 辩论模式：多头 + 空头 + 主持人
      agents.push(BULL_RESEARCHER, BEAR_RESEARCHER, DEBATE_MODERATOR);
      break;

    case "diagnose":
      // Diagnose mode: fundamentals + technical + macro
      // 诊断模式：基本面 + 技术面 + 宏观
      const diagAnalysts = ALL_ANALYSTS.filter((a) =>
        ["fundamental", "technical", "macro"].includes(a.analysisMethod),
      );
      agents.push(...diagAnalysts);
      break;
  }

  return agents;
}

/**
 * Get all available agents for UI display
 * / 获取所有可用的 Agent 用于前端展示
 */
export function getAllAgents(): {
  analysts: AnalystAgent[];
  masters: MasterAgent[];
} {
  return {
    analysts: ALL_ANALYSTS,
    masters: ALL_MASTER_AGENTS,
  };
}

// ============================================================================
// Token Budget Management
// ============================================================================

/**
 * Estimate token count for text (rough approximation)
 * / 估算文本的 Token 数量（粗略估算）
 */
export function estimateTokens(text: string): number {
  // Chinese: ~1.5 chars per token, English: ~4 chars per token
  // Rough average for mixed content
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * Calculate token budget for context
 * / 计算上下文的 Token 预算
 */
export function calculateTokenBudget(
  context: AdvisorContext,
  mode: ChatMode,
): TokenBudget {
  const maxTokens = TOKEN_LIMITS[mode] || 2000;

  const budget: TokenBudget = {
    corePhilosophy: 500,
    analysisMethods: context.analysisMethods.length * 300,
    tradingStyle: 100,
    specialtyStrategies: context.specialtyStrategies.length * 400,
    riskProfile: 100,
    masterContext: context.masterAgent ? 300 : 0,
    total: 0,
    remaining: 0,
  };

  budget.total =
    budget.corePhilosophy +
    budget.analysisMethods +
    budget.tradingStyle +
    budget.specialtyStrategies +
    budget.riskProfile +
    budget.masterContext;

  budget.remaining = Math.max(0, maxTokens - budget.total);

  return budget;
}

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build context prompt based on user preferences
 * / 根据用户偏好构建上下文提示词
 */
export function buildContextPrompt(context: AdvisorContext): string {
  const sections: string[] = [];

  // Risk profile
  sections.push(`## 用户风险偏好
- 风险容忍度: ${translateRiskTolerance(context.riskProfile.tolerance)}
- 投资期限: ${translateHorizon(context.riskProfile.investmentHorizon)}
${context.riskProfile.capitalSize ? `- 资金规模: ${translateCapitalSize(context.riskProfile.capitalSize)}` : ""}`);

  // Trading style
  sections.push(`## 交易风格偏好
${translateTradingStyle(context.tradingStyle)}`);

  return sections.join("\n\n");
}

/**
 * Build complete prompt for an agent
 * / 为 Agent 构建完整提示词
 */
export function buildAgentPrompt(
  agent: AgentRole,
  context: AdvisorContext,
  additionalContext?: string,
): string {
  const parts: string[] = [];

  // Agent's system prompt
  parts.push(agent.systemPrompt);

  // User context
  parts.push("---\n" + buildContextPrompt(context));

  // Additional context (market data, etc.)
  if (additionalContext) {
    parts.push("---\n## 补充信息\n" + additionalContext);
  }

  return parts.join("\n\n");
}

/**
 * Build debate prompt for multi-agent debate
 * / 为多 Agent 辩论构建提示词
 */
export function buildDebatePrompt(
  symbol: string,
  symbolName: string,
  topic: string,
  stance: "bull" | "bear",
  round: number,
  previousArguments?: string,
): string {
  const agent = stance === "bull" ? BULL_RESEARCHER : BEAR_RESEARCHER;
  const stanceLabel = stance === "bull" ? "看多" : "看空";

  let prompt = `${agent.systemPrompt}

---

## 当前辩论任务

**标的**: ${symbolName} (${symbol})
**主题**: ${topic}
**你的立场**: ${stanceLabel}
**当前轮次**: 第 ${round} 轮`;

  if (previousArguments) {
    prompt += `

## 对方前一轮论点

${previousArguments}

请针对对方的论点进行回应，同时补充新的${stanceLabel}理由。`;
  } else {
    prompt += `

请作为第一位发言者，陈述你的${stanceLabel}观点。`;
  }

  return prompt;
}

/**
 * Build moderator summary prompt
 * / 构建主持人总结提示词
 */
export function buildModeratorPrompt(
  symbol: string,
  symbolName: string,
  topic: string,
  bullArguments: string[],
  bearArguments: string[],
): string {
  return `${DEBATE_MODERATOR.systemPrompt}

---

## 辩论总结任务

**标的**: ${symbolName} (${symbol})
**主题**: ${topic}

## 多头观点汇总

${bullArguments.map((arg, i) => `### 第 ${i + 1} 轮\n${arg}`).join("\n\n")}

## 空头观点汇总

${bearArguments.map((arg, i) => `### 第 ${i + 1} 轮\n${arg}`).join("\n\n")}

---

请根据以上辩论内容，给出综合总结和投资建议。`;
}

// ============================================================================
// Agent Execution Planning
// ============================================================================

/**
 * Create execution plan for agents
 * / 为 Agent 创建执行计划
 */
export interface AgentExecutionPlan {
  agents: AgentRole[];
  sequential: boolean; // Sequential vs parallel execution
  prompts: Map<string, string>;
  tokenBudget: TokenBudget;
}

export function createExecutionPlan(
  request: AnalysisRequest,
  context: AdvisorContext,
): AgentExecutionPlan {
  const agents = selectAgents(request, context);
  const tokenBudget = calculateTokenBudget(context, request.mode);

  // Debate mode requires sequential execution
  const sequential = request.mode === "debate";

  // Build prompts for each agent
  const prompts = new Map<string, string>();

  for (const agent of agents) {
    const marketContext = request.marketData
      ? formatMarketData(request.marketData)
      : undefined;

    prompts.set(agent.id, buildAgentPrompt(agent, context, marketContext));
  }

  return {
    agents,
    sequential,
    prompts,
    tokenBudget,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function translateRiskTolerance(tolerance: string): string {
  const map: Record<string, string> = {
    conservative: "保守型（追求稳健，厌恶风险）",
    moderate: "稳健型（平衡风险与收益）",
    aggressive: "进取型（追求高收益，能承受较大波动）",
  };
  return map[tolerance] || tolerance;
}

function translateHorizon(horizon: string): string {
  const map: Record<string, string> = {
    short: "短期（3个月以内）",
    medium: "中期（3个月到1年）",
    long: "长期（1年以上）",
  };
  return map[horizon] || horizon;
}

function translateCapitalSize(size: string): string {
  const map: Record<string, string> = {
    small: "小额（10万以下）",
    medium: "中等（10-100万）",
    large: "大额（100万以上）",
  };
  return map[size] || size;
}

function translateTradingStyle(style: string): string {
  const map: Record<string, string> = {
    scalping: "超短线交易 - 持仓分钟到小时级别，追求小而频繁的利润",
    day_trading: "日内/短线交易 - 持仓天到周级别，捕捉短期波动",
    swing: "波段操作 - 持仓周到月级别，跟随中期趋势",
    position: "中长线投资 - 持仓月到年级别，基于基本面",
    buy_hold: "长期持有 - 持仓年到十年，复利增长",
  };
  return map[style] || style;
}

function formatMarketData(data: AnalysisRequest["marketData"]): string {
  if (!data) return "";

  return `## 当前市场数据
- 股票: ${data.name} (${data.symbol})
- 最新价: ¥${data.price.toFixed(2)}
- 涨跌: ${data.change >= 0 ? "+" : ""}${data.change.toFixed(2)} (${data.changePercent >= 0 ? "+" : ""}${data.changePercent.toFixed(2)}%)
- 成交量: ${formatVolume(data.volume)}
- 成交额: ${formatTurnover(data.turnover)}
- 最高/最低: ¥${data.high.toFixed(2)} / ¥${data.low.toFixed(2)}
- 开盘: ¥${data.open.toFixed(2)}
- 昨收: ¥${data.prevClose.toFixed(2)}
${data.pe ? `- PE: ${data.pe.toFixed(2)}` : ""}
${data.pb ? `- PB: ${data.pb.toFixed(2)}` : ""}
${data.marketCap ? `- 市值: ${formatMarketCap(data.marketCap)}` : ""}`;
}

function formatVolume(volume: number): string {
  if (volume >= 100000000) {
    return (volume / 100000000).toFixed(2) + "亿";
  }
  if (volume >= 10000) {
    return (volume / 10000).toFixed(2) + "万";
  }
  return volume.toString();
}

function formatTurnover(turnover: number): string {
  if (turnover >= 100000000) {
    return (turnover / 100000000).toFixed(2) + "亿元";
  }
  if (turnover >= 10000) {
    return (turnover / 10000).toFixed(2) + "万元";
  }
  return turnover.toString() + "元";
}

function formatMarketCap(cap: number): string {
  if (cap >= 100000000000) {
    return (cap / 100000000000).toFixed(2) + "千亿";
  }
  if (cap >= 100000000) {
    return (cap / 100000000).toFixed(2) + "亿";
  }
  return cap.toString();
}
