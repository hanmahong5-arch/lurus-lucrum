/**
 * Lucrum Agentic Advisor - Dynamic Context Builder
 *
 * Builds system prompts dynamically based on user preferences
 * with token budget management
 */

import type {
  AdvisorContext,
  ChatMode,
  TokenBudget,
  InvestmentPhilosophy,
  AnalysisMethod,
  TradingStyle,
  SpecialtyStrategy,
} from "./agent/types";
import { TOKEN_LIMITS } from "./agent/types";
import {
  PHILOSOPHY_DEFINITIONS,
  ANALYSIS_METHOD_DEFINITIONS,
  TRADING_STYLE_DEFINITIONS,
  SPECIALTY_STRATEGY_DEFINITIONS,
  getPhilosophyPrompt,
  getAnalysisMethodPrompt,
  getTradingStylePrompt,
  getSpecialtyStrategyPrompt,
} from "./philosophies";
import { getMasterAgentById } from "./agent/master-agents";

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for Chinese/English mixed text
 * / 估算中英文混合文本的 Token 数量
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Chinese characters: ~1.5 chars per token
  // English/symbols: ~4 chars per token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// ============================================================================
// Context Building
// ============================================================================

export interface BuiltContext {
  systemPrompt: string;
  tokenBudget: TokenBudget;
  includedSections: string[];
  truncatedSections: string[];
}

/**
 * Build complete advisor system prompt based on user context
 * / 根据用户上下文构建完整的顾问系统提示词
 */
export function buildAdvisorSystemPrompt(
  context: AdvisorContext,
  mode: ChatMode,
  additionalContext?: {
    stockSymbol?: string;
    stockName?: string;
    marketData?: string;
    userQuestion?: string;
  },
): BuiltContext {
  const maxTokens = TOKEN_LIMITS[mode] || 2000;
  let currentTokens = 0;
  const sections: string[] = [];
  const includedSections: string[] = [];
  const truncatedSections: string[] = [];

  // -------------------------------------------------------------------------
  // Base system instruction
  // -------------------------------------------------------------------------
  const baseInstruction = `你是 Lucrum 智能投资顾问，一位专业、客观、有深度的投资分析师。

## 基本原则
- 提供专业、客观的投资分析
- 所有建议仅供参考，不构成投资建议
- 风险提示要充分，收益预期要谨慎
- 根据用户的投资偏好和风险承受能力调整建议

## 回答格式
- 结构清晰，分点论述
- 重要结论放在前面
- 提供可操作的建议
- 标明信心水平和关键假设`;

  sections.push(baseInstruction);
  currentTokens += estimateTokens(baseInstruction);
  includedSections.push("base_instruction");

  // -------------------------------------------------------------------------
  // Layer 1: Core Philosophy (Required)
  // -------------------------------------------------------------------------
  const philosophyPrompt = getPhilosophyPrompt(context.corePhilosophy);
  const philosophyDef = PHILOSOPHY_DEFINITIONS[context.corePhilosophy];

  if (philosophyPrompt) {
    const philosophyTokens = estimateTokens(philosophyPrompt);
    if (currentTokens + philosophyTokens <= maxTokens * 0.4) {
      sections.push(philosophyPrompt);
      currentTokens += philosophyTokens;
      includedSections.push(`philosophy:${context.corePhilosophy}`);
    } else {
      // Include abbreviated version
      const abbreviated = `## 投资流派: ${philosophyDef.name}\n${philosophyDef.description}`;
      sections.push(abbreviated);
      currentTokens += estimateTokens(abbreviated);
      includedSections.push(`philosophy:${context.corePhilosophy}:abbreviated`);
      truncatedSections.push(`philosophy:${context.corePhilosophy}`);
    }
  }

  // -------------------------------------------------------------------------
  // Layer 2: Analysis Methods (Optional, max 2)
  // -------------------------------------------------------------------------
  for (const method of context.analysisMethods.slice(0, 2)) {
    const methodPrompt = getAnalysisMethodPrompt(method);
    const methodDef = ANALYSIS_METHOD_DEFINITIONS[method];

    if (
      methodPrompt &&
      currentTokens + methodDef.tokenCost <= maxTokens * 0.6
    ) {
      sections.push(methodPrompt);
      currentTokens += estimateTokens(methodPrompt);
      includedSections.push(`method:${method}`);
    } else if (methodDef) {
      truncatedSections.push(`method:${method}`);
    }
  }

  // -------------------------------------------------------------------------
  // Layer 3: Trading Style
  // -------------------------------------------------------------------------
  const stylePrompt = getTradingStylePrompt(context.tradingStyle);
  const styleDef = TRADING_STYLE_DEFINITIONS[context.tradingStyle];

  if (stylePrompt && currentTokens + styleDef.tokenCost <= maxTokens * 0.7) {
    sections.push(stylePrompt);
    currentTokens += estimateTokens(stylePrompt);
    includedSections.push(`style:${context.tradingStyle}`);
  }

  // -------------------------------------------------------------------------
  // Layer 4: Specialty Strategies (Optional)
  // -------------------------------------------------------------------------
  for (const strategy of context.specialtyStrategies.slice(0, 2)) {
    const strategyPrompt = getSpecialtyStrategyPrompt(strategy);
    const strategyDef = SPECIALTY_STRATEGY_DEFINITIONS[strategy];

    if (
      strategyPrompt &&
      currentTokens + strategyDef.tokenCost <= maxTokens * 0.8
    ) {
      sections.push(strategyPrompt);
      currentTokens += estimateTokens(strategyPrompt);
      includedSections.push(`strategy:${strategy}`);
    } else if (strategyDef) {
      truncatedSections.push(`strategy:${strategy}`);
    }
  }

  // -------------------------------------------------------------------------
  // Layer 5: Master Agent Context (Optional)
  // -------------------------------------------------------------------------
  if (context.masterAgent) {
    const master = getMasterAgentById(context.masterAgent);
    if (master && currentTokens + 300 <= maxTokens * 0.85) {
      const masterContext = `## 大师视角: ${master.name}
以${master.masterName}的思维方式和投资哲学进行分析。

核心理念:
${master.tradingRules
  .slice(0, 4)
  .map((r) => `- ${r}`)
  .join("\n")}

经典语录:
"${master.quotes[0]}"`;

      sections.push(masterContext);
      currentTokens += estimateTokens(masterContext);
      includedSections.push(`master:${context.masterAgent}`);
    }
  }

  // -------------------------------------------------------------------------
  // Layer 6: Risk Profile
  // -------------------------------------------------------------------------
  const riskProfile = buildRiskProfilePrompt(context.riskProfile);
  if (currentTokens + estimateTokens(riskProfile) <= maxTokens * 0.9) {
    sections.push(riskProfile);
    currentTokens += estimateTokens(riskProfile);
    includedSections.push("risk_profile");
  }

  // -------------------------------------------------------------------------
  // Layer 7: Additional Context (Market Data, Stock Info)
  // -------------------------------------------------------------------------
  if (additionalContext) {
    const additionalPrompt = buildAdditionalContextPrompt(additionalContext);
    if (
      additionalPrompt &&
      currentTokens + estimateTokens(additionalPrompt) <= maxTokens
    ) {
      sections.push(additionalPrompt);
      currentTokens += estimateTokens(additionalPrompt);
      includedSections.push("additional_context");
    }
  }

  // -------------------------------------------------------------------------
  // Calculate final token budget
  // -------------------------------------------------------------------------
  const tokenBudget: TokenBudget = {
    corePhilosophy:
      PHILOSOPHY_DEFINITIONS[context.corePhilosophy]?.tokenCost || 0,
    analysisMethods: context.analysisMethods.reduce(
      (sum, m) => sum + (ANALYSIS_METHOD_DEFINITIONS[m]?.tokenCost || 0),
      0,
    ),
    tradingStyle:
      TRADING_STYLE_DEFINITIONS[context.tradingStyle]?.tokenCost || 0,
    specialtyStrategies: context.specialtyStrategies.reduce(
      (sum, s) => sum + (SPECIALTY_STRATEGY_DEFINITIONS[s]?.tokenCost || 0),
      0,
    ),
    riskProfile: 100,
    masterContext: context.masterAgent ? 300 : 0,
    total: currentTokens,
    remaining: maxTokens - currentTokens,
  };

  return {
    systemPrompt: sections.join("\n\n---\n\n"),
    tokenBudget,
    includedSections,
    truncatedSections,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildRiskProfilePrompt(
  riskProfile: AdvisorContext["riskProfile"],
): string {
  const toleranceMap: Record<string, string> = {
    conservative: "保守型 - 追求稳健，厌恶风险，优先保本",
    moderate: "稳健型 - 平衡风险与收益，可接受适度波动",
    aggressive: "进取型 - 追求高收益，能承受较大波动",
  };

  const horizonMap: Record<string, string> = {
    short: "短期 (3个月以内)",
    medium: "中期 (3个月到1年)",
    long: "长期 (1年以上)",
  };

  const capitalMap: Record<string, string> = {
    small: "小额 (10万以下)",
    medium: "中等 (10-100万)",
    large: "大额 (100万以上)",
  };

  let prompt = `## 用户投资画像
- **风险容忍度**: ${toleranceMap[riskProfile.tolerance]}
- **投资期限**: ${horizonMap[riskProfile.investmentHorizon]}`;

  if (riskProfile.capitalSize) {
    prompt += `\n- **资金规模**: ${capitalMap[riskProfile.capitalSize]}`;
  }

  prompt += "\n\n请根据用户的投资画像调整分析深度和建议的保守程度。";

  return prompt;
}

function buildAdditionalContextPrompt(context: {
  stockSymbol?: string;
  stockName?: string;
  marketData?: string;
  userQuestion?: string;
}): string {
  const parts: string[] = [];

  if (context.stockSymbol || context.stockName) {
    parts.push(
      `## 分析标的\n${context.stockName || ""} (${context.stockSymbol || ""})`,
    );
  }

  if (context.marketData) {
    parts.push(`## 当前市场数据\n${context.marketData}`);
  }

  if (context.userQuestion) {
    parts.push(`## 用户问题\n${context.userQuestion}`);
  }

  return parts.join("\n\n");
}

// ============================================================================
// Default Context
// ============================================================================

/**
 * Get default advisor context / 获取默认顾问上下文
 */
export function getDefaultAdvisorContext(): AdvisorContext {
  return {
    corePhilosophy: "value",
    analysisMethods: ["fundamental", "technical"],
    tradingStyle: "swing",
    specialtyStrategies: ["san_dao_liu_shu"],
    riskProfile: {
      tolerance: "moderate",
      investmentHorizon: "medium",
    },
  };
}

/**
 * Validate and normalize context / 验证并规范化上下文
 */
export function normalizeContext(
  context: Partial<AdvisorContext>,
): AdvisorContext {
  const defaults = getDefaultAdvisorContext();

  return {
    corePhilosophy: context.corePhilosophy || defaults.corePhilosophy,
    analysisMethods: (context.analysisMethods?.length
      ? context.analysisMethods
      : defaults.analysisMethods
    ).slice(0, 2),
    tradingStyle: context.tradingStyle || defaults.tradingStyle,
    specialtyStrategies: (
      context.specialtyStrategies || defaults.specialtyStrategies
    ).slice(0, 2),
    riskProfile: {
      tolerance:
        context.riskProfile?.tolerance || defaults.riskProfile.tolerance,
      investmentHorizon:
        context.riskProfile?.investmentHorizon ||
        defaults.riskProfile.investmentHorizon,
      capitalSize: context.riskProfile?.capitalSize,
    },
    masterAgent: context.masterAgent,
  };
}

// ============================================================================
// Context Summary for UI
// ============================================================================

/**
 * Generate human-readable context summary / 生成人类可读的上下文摘要
 */
export function getContextSummary(context: AdvisorContext): {
  philosophy: string;
  methods: string[];
  style: string;
  strategies: string[];
  master?: string;
  estimatedTokens: number;
} {
  const philosophyDef = PHILOSOPHY_DEFINITIONS[context.corePhilosophy];
  const methodDefs = context.analysisMethods.map(
    (m) => ANALYSIS_METHOD_DEFINITIONS[m],
  );
  const styleDef = TRADING_STYLE_DEFINITIONS[context.tradingStyle];
  const strategyDefs = context.specialtyStrategies.map(
    (s) => SPECIALTY_STRATEGY_DEFINITIONS[s],
  );
  const master = context.masterAgent
    ? getMasterAgentById(context.masterAgent)
    : undefined;

  const estimatedTokens =
    (philosophyDef?.tokenCost || 0) +
    methodDefs.reduce((sum, m) => sum + (m?.tokenCost || 0), 0) +
    (styleDef?.tokenCost || 0) +
    strategyDefs.reduce((sum, s) => sum + (s?.tokenCost || 0), 0) +
    (master ? 300 : 0) +
    200; // Base + risk profile

  return {
    philosophy: philosophyDef?.name || context.corePhilosophy,
    methods: methodDefs.map((m) => m?.name || ""),
    style: styleDef?.name || context.tradingStyle,
    strategies: strategyDefs.map((s) => s?.name || ""),
    master: master?.name,
    estimatedTokens,
  };
}
