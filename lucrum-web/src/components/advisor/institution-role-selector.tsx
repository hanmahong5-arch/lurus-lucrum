"use client";

/**
 * Institution Role Selector Component
 * 机构岗位选择器组件
 *
 * Displays buy-side fund roles and workflow presets.
 * Users can either pick a single role for one-shot analysis
 * or launch a full multi-step workflow.
 */

import { cn } from "@/lib/utils";
import type { InstitutionRoleId, InstitutionWorkflow } from "@/lib/advisor/agent/types";
import type { WorkflowStepResult } from "@/lib/advisor/agent/types";
import { type WorkflowStepStatus } from "@/lib/advisor/agent/types";
import {
  getAllInstitutionRoles,
  ROLE_DISPLAY_ORDER,
} from "@/lib/advisor/agent/institution-agents";
import { getAllWorkflows } from "@/lib/advisor/institution-workflow";

// =============================================================================
// TYPES
// =============================================================================

interface InstitutionRoleSelectorProps {
  selectedRole: InstitutionRoleId | null;
  onRoleSelect: (roleId: InstitutionRoleId | null) => void;
  onWorkflowStart: (workflowId: string) => void;
  activeWorkflowId: string | null;
  workflowResults: WorkflowStepResult[];
  isWorkflowRunning: boolean;
}

// =============================================================================
// ROLE CARD
// =============================================================================

function RoleCard({
  role,
  isSelected,
  onSelect,
}: {
  role: ReturnType<typeof getAllInstitutionRoles>[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all",
        "border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5a623]",
        isSelected
          ? "bg-[#f5a623] text-[#0f1117] border-[#f5a623] font-semibold"
          : "bg-[#1a1f36] text-gray-300 border-[#2a2f46] hover:border-[#f5a623]/50 hover:text-white",
      )}
      title={role.description}
    >
      <span className="text-sm" aria-hidden="true">{role.icon}</span>
      <span>{role.title}</span>
    </button>
  );
}

// =============================================================================
// WORKFLOW BUTTON
// =============================================================================

function WorkflowButton({
  workflow,
  isActive,
  isRunning,
  onStart,
}: {
  workflow: InstitutionWorkflow;
  isActive: boolean;
  isRunning: boolean;
  onStart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={isRunning}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all",
        "border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5a623]",
        isActive && isRunning
          ? "bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/50 cursor-not-allowed"
          : "bg-[#1a1f36] text-gray-300 border-[#2a2f46] hover:border-[#f5a623]/50 hover:text-white",
        isRunning && !isActive ? "opacity-50 cursor-not-allowed" : "",
      )}
      title={workflow.description}
    >
      <span className="text-sm" aria-hidden="true">{workflow.icon}</span>
      <span>{workflow.name}</span>
      {isActive && isRunning ? (
        <span className="ml-1 text-[#f5a623] animate-pulse">●</span>
      ) : (
        <span className="ml-1 text-gray-500">▶</span>
      )}
    </button>
  );
}

// =============================================================================
// WORKFLOW STEP CARD
// =============================================================================

function WorkflowStepCard({ result }: { result: WorkflowStepResult }) {
  const statusConfig: Record<WorkflowStepStatus, { icon: string; color: string; label: string }> = {
    pending: { icon: "○", color: "text-gray-500", label: "等待中" },
    running: { icon: "◉", color: "text-[#f5a623] animate-pulse", label: "分析中" },
    completed: { icon: "✓", color: "text-green-400", label: "完成" },
    error: { icon: "✗", color: "text-red-400", label: "失败" },
  };

  const config = statusConfig[result.status];

  return (
    <details className="group">
      <summary
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer",
          "bg-[#1a1f36] border border-[#2a2f46] select-none",
          "hover:border-[#3a3f56] transition-colors",
          "list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <span className={cn("font-mono w-3 text-center shrink-0", config.color)}>{config.icon}</span>
        <span className="font-medium text-gray-200">{result.roleTitle}</span>
        <span className="text-gray-500 ml-auto">{config.label}</span>
        {result.completedAt && result.startedAt && (
          <span className="text-gray-600 ml-2">
            {((result.completedAt - result.startedAt) / 1000).toFixed(1)}s
          </span>
        )}
        <span className="text-gray-600 group-open:rotate-180 transition-transform ml-1">▾</span>
      </summary>

      {result.status === "completed" && result.content && (
        <div className="mt-1 px-3 py-2 rounded-b-lg bg-[#111827] border border-t-0 border-[#2a2f46]">
          <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {result.content}
          </div>
        </div>
      )}

      {result.status === "error" && result.error && (
        <div className="mt-1 px-3 py-2 rounded-b-lg bg-red-950/30 border border-t-0 border-red-800/30">
          <div className="text-xs text-red-400">{result.error}</div>
        </div>
      )}
    </details>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InstitutionRoleSelector({
  selectedRole,
  onRoleSelect,
  onWorkflowStart,
  activeWorkflowId,
  workflowResults,
  isWorkflowRunning,
}: InstitutionRoleSelectorProps) {
  const roles = ROLE_DISPLAY_ORDER.map((id) =>
    getAllInstitutionRoles().find((r) => r.id === id),
  ).filter(Boolean) as ReturnType<typeof getAllInstitutionRoles>;

  const workflows = getAllWorkflows();

  const handleRoleClick = (roleId: InstitutionRoleId) => {
    onRoleSelect(selectedRole === roleId ? null : roleId);
  };

  return (
    <div className="space-y-4 p-4 bg-[#0d1117] border-b border-[#1a1f36]">
      {/* Single role selection */}
      <div>
        <div className="text-xs text-gray-500 mb-2">单角色分析</div>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={selectedRole === role.id}
              onSelect={() => handleRoleClick(role.id)}
            />
          ))}
        </div>
        {selectedRole && (
          <p className="mt-2 text-xs text-gray-500">
            已选：{roles.find((r) => r.id === selectedRole)?.description}
          </p>
        )}
      </div>

      {/* Workflow presets */}
      <div>
        <div className="text-xs text-gray-500 mb-2">完整决策流</div>
        <div className="flex flex-wrap gap-2">
          {workflows.map((wf) => (
            <WorkflowButton
              key={wf.id}
              workflow={wf}
              isActive={activeWorkflowId === wf.id}
              isRunning={isWorkflowRunning}
              onStart={() => onWorkflowStart(wf.id)}
            />
          ))}
        </div>
      </div>

      {/* Workflow step results */}
      {workflowResults.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">
            分析进度 ({workflowResults.filter((r) => r.status === "completed").length}/{workflowResults.length})
          </div>
          <div className="space-y-1.5">
            {workflowResults.map((result) => (
              <WorkflowStepCard key={result.roleId} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
