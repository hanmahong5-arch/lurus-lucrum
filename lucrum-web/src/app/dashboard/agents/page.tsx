/**
 * Agent Hub Page
 * Analysis task management center
 *
 * Route: /dashboard/agents
 * Auth-guarded. Displays agent grid cards + builder dialog + run panel.
 *
 * Uses useReducer with discriminated union to prevent illegal intermediate
 * states (e.g. builderOpen=true but editingAgent=null).
 *
 * @module app/dashboard/agents/page
 */

"use client";

import { useEffect, useReducer, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AgentIcon } from "@/components/agent/custom-agent-builder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLimitsForPlan } from "@/lib/config/plan-limits";
import { showToast } from "@/lib/toast";
import type { CustomAgentConfig } from "@/lib/agent/custom-agent-types";

// Dynamic imports to avoid SSR issues
const CustomAgentBuilder = dynamic(
  () =>
    import("@/components/agent/custom-agent-builder").then(
      (m) => m.CustomAgentBuilder
    ),
  { ssr: false }
);

const CustomAgentRunPanel = dynamic(
  () =>
    import("@/components/agent/custom-agent-run-panel").then(
      (m) => m.CustomAgentRunPanel
    ),
  { ssr: false }
);

// =============================================================================
// Types
// =============================================================================

interface AgentData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isPinned: boolean | null;
  runCount: number | null;
  lastRunAt: string | null;
  analysisDepth: string;
  targets: { mode: string; sectors?: string[]; symbols?: string[] };
  strategies: Array<{ templateId: string }>;
}

// =============================================================================
// State Machine Types
// =============================================================================

interface RunContext {
  agent: AgentData;
  autoStart: boolean;
  runKey: number;
}

type PageView =
  | { view: "grid" }
  | { view: "running"; agent: AgentData; autoStart: boolean; runKey: number }
  | { view: "editing"; agent: AgentData | null; returnTo: "grid" | { kind: "running" } & RunContext };

interface PageState {
  saving: boolean;
  current: PageView;
}

type PageAction =
  | { type: "OPEN_BUILDER"; agent?: AgentData }
  | { type: "CLOSE_BUILDER" }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "START_RUN"; agent: AgentData }
  | { type: "CLOSE_RUN" }
  | { type: "SAVE_AND_RUN"; agent: AgentData }
  | { type: "SAVE_KEEP_PANEL" };

let runKeyCounter = 0;

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "OPEN_BUILDER": {
      const agent = action.agent ?? null;
      if (state.current.view === "running") {
        // Editing from within the run panel — remember run context
        return {
          ...state,
          current: {
            view: "editing",
            agent: agent ?? state.current.agent,
            returnTo: {
              kind: "running",
              agent: state.current.agent,
              autoStart: state.current.autoStart,
              runKey: state.current.runKey,
            },
          },
        };
      }
      return {
        ...state,
        current: { view: "editing", agent, returnTo: "grid" },
      };
    }

    case "CLOSE_BUILDER": {
      if (state.current.view !== "editing") return state;
      const { returnTo } = state.current;
      if (returnTo === "grid") {
        return { ...state, saving: false, current: { view: "grid" } };
      }
      // Return to the running panel
      return {
        ...state,
        saving: false,
        current: {
          view: "running",
          agent: returnTo.agent,
          autoStart: returnTo.autoStart,
          runKey: returnTo.runKey,
        },
      };
    }

    case "SET_SAVING":
      return { ...state, saving: action.saving };

    case "START_RUN":
      return {
        ...state,
        current: {
          view: "running",
          agent: action.agent,
          autoStart: false,
          runKey: ++runKeyCounter,
        },
      };

    case "CLOSE_RUN":
      return { ...state, current: { view: "grid" } };

    case "SAVE_AND_RUN":
      return {
        ...state,
        saving: false,
        current: {
          view: "running",
          agent: action.agent,
          autoStart: true,
          runKey: ++runKeyCounter,
        },
      };

    case "SAVE_KEEP_PANEL": {
      // Close builder, keep RunPanel underneath
      if (state.current.view !== "editing") return { ...state, saving: false };
      const { returnTo } = state.current;
      if (returnTo === "grid") {
        return { ...state, saving: false, current: { view: "grid" } };
      }
      return {
        ...state,
        saving: false,
        current: {
          view: "running",
          agent: returnTo.agent,
          autoStart: returnTo.autoStart,
          runKey: returnTo.runKey,
        },
      };
    }

    default:
      return state;
  }
}

const initialState: PageState = {
  saving: false,
  current: { view: "grid" },
};

// =============================================================================
// Component
// =============================================================================

export default function AgentHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Data state (separate from UI state machine)
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state machine
  const [state, dispatch] = useReducer(pageReducer, initialState);
  const { current, saving } = state;

  // Derive run context for RunPanel rendering
  const runContext: RunContext | null =
    current.view === "running"
      ? current
      : current.view === "editing" && current.returnTo !== "grid"
        ? current.returnTo
        : null;

  // Derive editing agent for the builder dialog
  const editingAgent = current.view === "editing" ? current.agent : null;

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/dashboard/agents");
    }
  }, [status, router]);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/custom");
      if (res.ok) {
        const data = (await res.json()) as { agents: AgentData[] };
        setAgents(data.agents);
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchAgents();
    }
  }, [status, fetchAgents]);

  // Open editor from within the run panel (overlay on top of run panel)
  const handleEditRequest = useCallback(() => {
    dispatch({ type: "OPEN_BUILDER" });
  }, []);

  // Create or update agent
  const handleSave = useCallback(
    async (config: CustomAgentConfig, andRun: boolean) => {
      dispatch({ type: "SET_SAVING", saving: true });
      try {
        let agentData: AgentData;

        if (editingAgent) {
          // Update
          const res = await fetch(`/api/agent/custom/${editingAgent.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          });
          if (!res.ok) {
            const err = await res.json();
            alert(err.error || err.message || "Failed to update");
            return;
          }
          const data = (await res.json()) as { agent: AgentData };
          agentData = data.agent;
        } else {
          // Create
          const res = await fetch("/api/agent/custom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          });
          if (!res.ok) {
            const err = await res.json();
            alert(err.error || err.message || "Failed to create");
            return;
          }
          const data = (await res.json()) as { agent: AgentData };
          agentData = data.agent;
        }

        await fetchAgents();

        if (runContext) {
          // Editing from within the run panel
          if (andRun) {
            dispatch({ type: "SAVE_AND_RUN", agent: agentData });
          } else {
            dispatch({ type: "SAVE_KEEP_PANEL" });
            showToast.success("配置已更新，点击「再次运行」生效", { duration: 5000 });
          }
        } else {
          // From agent grid
          if (andRun) {
            dispatch({ type: "SAVE_AND_RUN", agent: agentData });
          } else {
            dispatch({ type: "CLOSE_BUILDER" });
          }
        }
      } finally {
        dispatch({ type: "SET_SAVING", saving: false });
      }
    },
    [editingAgent, fetchAgents, runContext]
  );

  // Delete agent
  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("确定删除该分析任务？所有运行记录也将被删除。")) return;

      try {
        await fetch(`/api/agent/custom/${id}`, { method: "DELETE" });
        await fetchAgents();
      } catch (err) {
        console.error("Failed to delete agent:", err);
      }
    },
    [fetchAgents]
  );

  // Pin/unpin
  const handleTogglePin = useCallback(
    async (agent: AgentData) => {
      try {
        await fetch(`/api/agent/custom/${agent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPinned: !agent.isPinned }),
        });
        await fetchAgents();
      } catch (err) {
        console.error("Failed to toggle pin:", err);
      }
    },
    [fetchAgents]
  );

  // Plan limits
  const plan = (session?.user as { role?: string } | undefined)?.role;
  const limits = getLimitsForPlan(plan);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white/40 text-sm">验证登录状态...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <DashboardHeader />

      {/* RunPanel — visible when running OR editing-from-run */}
      {runContext && (
        <main className="flex-1 overflow-hidden">
          <div className="h-[calc(100vh-56px)]">
            <CustomAgentRunPanel
              key={runContext.runKey}
              agentId={runContext.agent.id}
              agentName={runContext.agent.name}
              agentColor={runContext.agent.color ?? "#6366f1"}
              autoStart={runContext.autoStart}
              onClose={() => {
                dispatch({ type: "CLOSE_RUN" });
                fetchAgents();
              }}
              onEditRequest={handleEditRequest}
            />
          </div>
        </main>
      )}

      {/* Grid — only when view=grid */}
      {current.view === "grid" && (
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Page header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-white">
                  分析任务
                </h1>
                <p className="text-sm text-white/40 mt-0.5">
                  配置分析任务，批量回测多标的，生成综合研究报告
                </p>
              </div>
              <Button
                onClick={() => dispatch({ type: "OPEN_BUILDER" })}
                className="btn-tactile bg-accent hover:bg-accent/80"
              >
                + 新建分析任务
              </Button>
            </div>

            {/* Agent grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-40 rounded-xl bg-surface animate-pulse"
                  />
                ))}
              </div>
            ) : agents.length === 0 ? (
              /* Guided empty state */
              <div className="flex flex-col items-center justify-center py-16">
                <div className="text-4xl mb-4">🔍</div>
                <h2 className="text-base font-medium text-white mb-2">
                  你的第一个分析任务从这里开始
                </h2>
                <p className="text-sm text-white/40 text-center max-w-sm mb-6 leading-relaxed">
                  告诉 Agent 你想分析哪些股票、用哪些策略，
                  <br />
                  它会自动回测并给出综合研判，帮你找到值得关注的机会。
                </p>
                <Button
                  onClick={() => dispatch({ type: "OPEN_BUILDER" })}
                  className="btn-tactile bg-accent hover:bg-accent/80"
                >
                  + 创建分析任务
                </Button>
                <p className="text-xs text-white/30 mt-4">
                  💡 新手建议：先试试「全市场 + 双均线」，只需 30 秒配置
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onRun={() => dispatch({ type: "START_RUN", agent })}
                    onEdit={() => dispatch({ type: "OPEN_BUILDER", agent })}
                    onDelete={() => handleDelete(agent.id)}
                    onTogglePin={() => handleTogglePin(agent)}
                  />
                ))}
              </div>
            )}

            {/* Tier info */}
            {limits.customAgent.maxAgents !== -1 && (
              <div className="mt-6 text-xs text-white/30 text-center">
                已创建 {agents.length} / {limits.customAgent.maxAgents} 个任务 ·
                今日可运行 {limits.customAgent.runsPerDay} 次 ·
                单次最多 {limits.customAgent.maxStocks} 只标的
              </div>
            )}
          </div>
        </main>
      )}

      {/* Builder Dialog — overlays on top of whatever is behind */}
      <Dialog
        open={current.view === "editing"}
        onOpenChange={() => dispatch({ type: "CLOSE_BUILDER" })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border-border w-full sm:max-w-2xl max-sm:h-full max-sm:max-h-full max-sm:rounded-none max-sm:border-0">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? `编辑: ${editingAgent.name}` : "新建分析任务"}
            </DialogTitle>
          </DialogHeader>
          <CustomAgentBuilder
            initialConfig={
              editingAgent
                ? {
                    name: editingAgent.name,
                    description: editingAgent.description ?? undefined,
                    targets: editingAgent.targets as CustomAgentConfig["targets"],
                    strategies: editingAgent.strategies,
                    analysisDepth: editingAgent.analysisDepth as "light" | "standard" | "deep",
                    icon: editingAgent.icon ?? undefined,
                    color: editingAgent.color ?? undefined,
                  }
                : undefined
            }
            allowDeep={limits.customAgent.allowDeep}
            saving={saving}
            onSave={(config) => handleSave(config, false)}
            onSaveAndRun={(config) => handleSave(config, true)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Agent Card Sub-component
// =============================================================================

function AgentCard({
  agent,
  onRun,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  agent: AgentData;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const color = agent.color ?? "#6366f1";
  const lastRun = agent.lastRunAt
    ? new Date(agent.lastRunAt).toLocaleDateString("zh-CN")
    : "从未运行";

  return (
    <div
      className="group relative rounded-xl bg-surface border border-border hover:border-white/20 transition-all cursor-pointer overflow-hidden"
      onClick={onRun}
    >
      {/* Color accent bar at top */}
      <div className="h-0.5" style={{ backgroundColor: color }} />

      {/* Pin indicator */}
      {agent.isPinned && (
        <div className="absolute top-3.5 right-2 text-accent text-xs">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      )}

      <div className="p-4">
        {/* Icon + Name */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: color + "20", color }}
          >
            <AgentIcon name={agent.icon ?? "bot"} className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white truncate">
              {agent.name}
            </h3>
            {agent.description && (
              <p className="text-xs text-white/40 truncate">
                {agent.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span className="font-mono tabular-nums">
            {agent.runCount ?? 0} 次运行
          </span>
          <span>{lastRun}</span>
        </div>

        {/* Depth badge */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs ${
              agent.analysisDepth === "deep"
                ? "bg-accent/10 text-accent"
                : agent.analysisDepth === "standard"
                  ? "bg-accent/10 text-accent"
                  : "bg-white/5 text-white/40"
            }`}
          >
            {agent.analysisDepth === "deep"
              ? "深度分析"
              : agent.analysisDepth === "standard"
                ? "标准分析"
                : "轻量扫描"}
          </span>
          <span className="text-xs text-white/30">
            {agent.strategies.length} 策略
          </span>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className="p-1.5 rounded hover:bg-surface-hover text-white/40 hover:text-white/70"
          title={agent.isPinned ? "取消置顶" : "置顶"}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded hover:bg-surface-hover text-white/40 hover:text-white/70"
          title="编辑"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded hover:bg-loss/20 text-white/40 hover:text-loss"
          title="删除"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
