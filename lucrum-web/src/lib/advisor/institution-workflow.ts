/**
 * Institution Workflow Engine
 * 机构工作流执行引擎
 *
 * Defines 3 preset workflow chains for buy-side fund analysis.
 * Each workflow runs steps sequentially (with parallel options per step group),
 * injecting previous outputs as context for downstream roles.
 */

import type {
  InstitutionRoleId,
  InstitutionWorkflow,
  WorkflowStepResult,
} from "@/lib/advisor/agent/types";
import { getInstitutionRoleById } from "@/lib/advisor/agent/institution-agents";

// ============================================================================
// Workflow definitions / 工作流定义
// ============================================================================

export const INSTITUTION_WORKFLOWS: Record<string, InstitutionWorkflow> = {
  single_stock: {
    id: "single_stock",
    name: "单股分析流",
    description: "深度分析单只股票，适合\"帮我分析 600519\"类问题",
    icon: "🔍",
    steps: [
      ["analyst"],              // Step 1: Industry analyst deep-dive
      ["cro"],                  // Step 2: Risk assessment
      ["fund_manager"],         // Step 3: Final decision
    ],
  },

  buy_decision: {
    id: "buy_decision",
    name: "买入决策流",
    description: "综合多维度判断是否买入，适合\"要不要买入\"类问题",
    icon: "📋",
    steps: [
      ["macro_strategist", "quant"],  // Step 1: Macro + Quant (parallel)
      ["head_researcher"],            // Step 2: Aggregate research
      ["cro"],                        // Step 3: Risk check
      ["fund_manager"],               // Step 4: Final decision
    ],
  },

  portfolio_review: {
    id: "portfolio_review",
    name: "组合复盘流",
    description: "全面复盘当前持仓，适合\"当前持仓怎么样\"类问题",
    icon: "📊",
    steps: [
      ["analyst", "quant", "macro_strategist"],  // Step 1: All researchers (parallel)
      ["head_researcher"],                        // Step 2: Aggregate
      ["cro"],                                    // Step 3: Portfolio risk
      ["fund_manager"],                           // Step 4: Rebalancing decision
    ],
  },
};

export function getAllWorkflows(): InstitutionWorkflow[] {
  return Object.values(INSTITUTION_WORKFLOWS);
}

export function getWorkflowById(id: string): InstitutionWorkflow | undefined {
  return INSTITUTION_WORKFLOWS[id];
}

// ============================================================================
// Workflow executor / 工作流执行器
// ============================================================================

interface WorkflowExecutionOptions {
  userMessage: string;
  symbol?: string;
  symbolName?: string;
  /** Called when a step starts */
  onStepStart: (roleId: InstitutionRoleId) => void;
  /** Called when a step completes */
  onStepComplete: (result: WorkflowStepResult) => void;
  /** Called when the whole workflow finishes */
  onComplete: (results: WorkflowStepResult[]) => void;
  /** Called on error */
  onError: (error: string) => void;
}

/**
 * Build the context prefix for a role based on previous step results.
 * This simulates internal document circulation in a real fund.
 */
function buildContextPrefix(
  previousResults: WorkflowStepResult[],
  currentRoleId: InstitutionRoleId,
): string {
  if (previousResults.length === 0) return "";

  const completedAnalyses = previousResults
    .filter((r) => r.status === "completed" && r.content)
    .map((r) => `=== ${r.roleTitle}的分析 ===\n${r.content}`)
    .join("\n\n");

  if (!completedAnalyses) return "";

  return `以下是团队其他成员已完成的分析，请在此基础上给出你作为${getInstitutionRoleById(currentRoleId).title}的专业判断：\n\n${completedAnalyses}\n\n---\n请基于以上材料，从你的岗位职责角度给出分析：`;
}

/**
 * Execute a single role's analysis via the advisor chat API
 */
async function executeRoleStep(
  roleId: InstitutionRoleId,
  userMessage: string,
  previousResults: WorkflowStepResult[],
  symbol?: string,
  symbolName?: string,
): Promise<string> {
  const role = getInstitutionRoleById(roleId);
  const contextPrefix = buildContextPrefix(previousResults, roleId);
  const fullMessage = contextPrefix
    ? `${contextPrefix}\n\n用户问题：${userMessage}`
    : userMessage;

  const response = await fetch("/api/advisor/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: fullMessage,
      mode: "deep",
      institutionRole: roleId,
      context: symbol
        ? { symbol, symbolName: symbolName || symbol }
        : undefined,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      (errData as { error?: string }).error || `HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as { response?: string };
  return data.response || "";
}

/**
 * Execute an institution workflow, calling each role in order.
 * Groups within a step run in parallel; steps run sequentially.
 */
export async function executeWorkflow(
  workflowId: string,
  options: WorkflowExecutionOptions,
): Promise<void> {
  const workflow = getWorkflowById(workflowId);
  if (!workflow) {
    options.onError(`未知工作流: ${workflowId}`);
    return;
  }

  const allResults: WorkflowStepResult[] = [];

  for (const stepGroup of workflow.steps) {
    // Signal that all roles in this group are starting
    for (const roleId of stepGroup) {
      options.onStepStart(roleId);
    }

    // Execute all roles in the group in parallel
    const groupPromises = stepGroup.map(async (roleId) => {
      const role = getInstitutionRoleById(roleId);
      const startedAt = Date.now();

      try {
        const content = await executeRoleStep(
          roleId,
          options.userMessage,
          allResults,
          options.symbol,
          options.symbolName,
        );

        const result: WorkflowStepResult = {
          roleId,
          roleTitle: role.title,
          content,
          status: "completed",
          startedAt,
          completedAt: Date.now(),
        };

        options.onStepComplete(result);
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const result: WorkflowStepResult = {
          roleId,
          roleTitle: role.title,
          content: "",
          status: "error",
          startedAt,
          completedAt: Date.now(),
          error: errorMsg,
        };
        options.onStepComplete(result);
        return result;
      }
    });

    // Wait for all parallel steps to complete before proceeding
    const groupResults = await Promise.all(groupPromises);
    allResults.push(...groupResults);
  }

  options.onComplete(allResults);
}
