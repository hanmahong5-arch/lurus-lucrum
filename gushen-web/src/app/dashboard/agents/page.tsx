/**
 * Agent Hub Page
 * 自定义 Agent 管理中心
 *
 * Route: /dashboard/agents
 * Auth-guarded. Displays agent grid cards + builder dialog + run panel.
 *
 * @module app/dashboard/agents/page
 */

"use client";

import { useEffect, useState, useCallback } from "react";
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
// Component
// =============================================================================

export default function AgentHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Agents list
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentData | null>(null);
  const [runningAgent, setRunningAgent] = useState<AgentData | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Create or update agent
  const handleSave = useCallback(
    async (config: CustomAgentConfig, andRun: boolean) => {
      setSaving(true);
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

        setBuilderOpen(false);
        setEditingAgent(null);
        await fetchAgents();

        if (andRun) {
          setRunningAgent(agentData);
        }
      } finally {
        setSaving(false);
      }
    },
    [editingAgent, fetchAgents]
  );

  // Delete agent
  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("确定删除该 Agent？所有运行记录也将被删除。")) return;

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

  // If running an agent, show the run panel
  if (runningAgent) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col">
        <DashboardHeader />
        <main className="flex-1 overflow-hidden">
          <div className="h-[calc(100vh-56px)]">
            <CustomAgentRunPanel
              agentId={runningAgent.id}
              agentName={runningAgent.name}
              agentColor={runningAgent.color ?? "#6366f1"}
              onClose={() => {
                setRunningAgent(null);
                fetchAgents();
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <DashboardHeader />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-white">
                我的 Agent
              </h1>
              <p className="text-sm text-white/40 mt-0.5">
                自定义 Agent 批量分析标的，AI 生成综合洞察
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingAgent(null);
                setBuilderOpen(true);
              }}
              className="btn-tactile bg-accent hover:bg-accent/80"
            >
              + 新建 Agent
            </Button>
          </div>

          {/* Agent grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-40 rounded-xl bg-surface animate-pulse"
                />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-white/30">
              <svg
                className="w-16 h-16 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm mb-2">还没有创建任何 Agent</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBuilderOpen(true)}
              >
                创建第一个 Agent
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onRun={() => setRunningAgent(agent)}
                  onEdit={() => {
                    setEditingAgent(agent);
                    setBuilderOpen(true);
                  }}
                  onDelete={() => handleDelete(agent.id)}
                  onTogglePin={() => handleTogglePin(agent)}
                />
              ))}
            </div>
          )}

          {/* Tier info */}
          {limits.customAgent.maxAgents !== -1 && (
            <div className="mt-6 text-xs text-white/30 text-center">
              已创建 {agents.length} / {limits.customAgent.maxAgents} 个 Agent ·
              今日可运行 {limits.customAgent.runsPerDay} 次 ·
              单次最多 {limits.customAgent.maxStocks} 只标的
            </div>
          )}
        </div>
      </main>

      {/* Builder Dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border-border">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? `编辑: ${editingAgent.name}` : "新建 Agent"}
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
      className="group relative rounded-xl bg-surface border border-border hover:border-white/20 transition-all cursor-pointer"
      onClick={onRun}
    >
      {/* Pin indicator */}
      {agent.isPinned && (
        <div className="absolute top-2 right-2 text-accent text-xs">
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
            style={{ backgroundColor: color + "20" }}
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
                ? "bg-ai-bg text-ai"
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
