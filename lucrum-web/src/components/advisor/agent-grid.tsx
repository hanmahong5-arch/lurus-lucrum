"use client";

/**
 * Agent Grid
 *
 * Visual agent card grid with toggle switches for enabling/disabling agents.
 * Combines master agents (built-in) with custom agents.
 * Wired to advisor-store for agent selection persistence.
 */

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdvisorStore } from "@/lib/stores/advisor-store";
import {
  ALL_MASTER_AGENTS,
} from "@/lib/advisor/agent/master-agents";
import type { InvestmentPhilosophy } from "@/lib/advisor/agent/types";
import { AgentIcon } from "@/components/agent/custom-agent-builder";
import { getLimitsForPlan } from "@/lib/config/plan-limits";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { CustomAgentConfig } from "@/lib/agent/custom-agent-types";

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
// Constants
// =============================================================================

const PHILOSOPHY_LABELS: Record<InvestmentPhilosophy, string> = {
  value: "价值投资",
  growth: "成长投资",
  trend: "技术分析",
  quantitative: "量化分析",
  index: "指数投资",
  dividend: "股息投资",
  momentum: "动量投资",
};

const PHILOSOPHY_ICONS: Record<InvestmentPhilosophy, string> = {
  value: "🏛️",
  growth: "🌱",
  trend: "📈",
  quantitative: "🔢",
  index: "📊",
  dividend: "💰",
  momentum: "🚀",
};

const PHILOSOPHY_COLORS: Record<InvestmentPhilosophy, string> = {
  value: "from-blue-500/20 to-blue-900/10 border-blue-500/30",
  growth: "from-green-500/20 to-green-900/10 border-green-500/30",
  trend: "from-purple-500/20 to-purple-900/10 border-purple-500/30",
  quantitative: "from-cyan-500/20 to-cyan-900/10 border-cyan-500/30",
  index: "from-gray-500/20 to-gray-900/10 border-gray-500/30",
  dividend: "from-yellow-500/20 to-yellow-900/10 border-yellow-500/30",
  momentum: "from-orange-500/20 to-orange-900/10 border-orange-500/30",
};

// =============================================================================
// Master Agent Toggle Card
// =============================================================================

function MasterAgentCard({
  agent,
  enabled,
  onToggle,
}: {
  agent: (typeof ALL_MASTER_AGENTS)[0];
  enabled: boolean;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const philosophy = (agent.philosophy || "value") as InvestmentPhilosophy;
  const icon = PHILOSOPHY_ICONS[philosophy] || "🎯";
  const colorClass = PHILOSOPHY_COLORS[philosophy] || PHILOSOPHY_COLORS.value;
  const label = PHILOSOPHY_LABELS[philosophy] || "投资";

  return (
    <div
      className={cn(
        "relative flex flex-col p-4 rounded-xl border transition-all bg-gradient-to-br",
        colorClass,
        enabled ? "ring-2 ring-accent/50 shadow-lg shadow-accent/5" : "opacity-70"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white truncate">{agent.name}</div>
          <div className="text-xs text-white/50">{label}</div>
        </div>
      </div>

      {/* Quote */}
      <div className="flex-1 mb-3">
        <p className="text-xs text-white/60 italic line-clamp-2 leading-relaxed">
          &ldquo;{agent.quotes[0]}&rdquo;
        </p>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <span className="text-xs text-white/40">
          {agent.masterName}
        </span>
        <button
          type="button"
          onClick={() => onToggle(agent.id, !enabled)}
          className={cn(
            "relative w-10 h-5 rounded-full transition-colors",
            enabled ? "bg-accent" : "bg-white/20"
          )}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
              enabled && "translate-x-5"
            )}
          />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Custom Agent Card
// =============================================================================

function CustomAgentCard({
  agent,
  onRun,
  onEdit,
  onDelete,
}: {
  agent: AgentData;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
      <div className="h-0.5" style={{ backgroundColor: color }} />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{
              backgroundColor: color + "20",
              color,
            }}
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
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span className="font-mono tabular-nums">
            {agent.runCount ?? 0} 次运行
          </span>
          <span>{lastRun}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded text-xs",
              agent.analysisDepth === "deep"
                ? "bg-accent/10 text-accent"
                : agent.analysisDepth === "standard"
                  ? "bg-accent/10 text-accent"
                  : "bg-white/5 text-white/40"
            )}
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
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded hover:bg-surface-hover text-white/40 hover:text-white/70"
          title="编辑"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
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
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AgentGrid() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const advisorStore = useAdvisorStore();

  const [customAgents, setCustomAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<AgentData | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningAgent, setRunningAgent] = useState<AgentData | null>(null);

  // Master agent toggle state from advisor store
  const enabledMasterIds = new Set(
    advisorStore.selectedAgents.map((a) => a.id)
  );

  useEffect(() => {
    if (status === "unauthenticated")
      router.push("/auth/login?callbackUrl=/dashboard/advisor?tab=agents");
  }, [status, router]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/custom");
      if (res.ok) {
        const data = (await res.json()) as { agents: AgentData[] };
        setCustomAgents(data.agents);
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchAgents();
  }, [status, fetchAgents]);

  const handleMasterToggle = useCallback(
    (masterId: string, enabled: boolean) => {
      const master = ALL_MASTER_AGENTS.find((m) => m.id === masterId);
      if (!master) return;

      if (enabled) {
        advisorStore.addAgent({
          id: master.id,
          name: master.name,
          school: PHILOSOPHY_LABELS[master.philosophy as InvestmentPhilosophy],
        });
      } else {
        advisorStore.removeAgent(masterId);
      }
    },
    [advisorStore]
  );

  const handleSave = useCallback(
    async (config: CustomAgentConfig, andRun: boolean) => {
      setSaving(true);
      try {
        let agentData: AgentData;
        if (editingAgent) {
          const res = await fetch(`/api/agent/custom/${editingAgent.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          });
          if (!res.ok) {
            const err = await res.json();
            alert(
              (err as { error?: string; message?: string }).error ||
                (err as { message?: string }).message ||
                "Failed to update"
            );
            return;
          }
          agentData = (
            (await res.json()) as { agent: AgentData }
          ).agent;
        } else {
          const res = await fetch("/api/agent/custom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          });
          if (!res.ok) {
            const err = await res.json();
            alert(
              (err as { error?: string; message?: string }).error ||
                (err as { message?: string }).message ||
                "Failed to create"
            );
            return;
          }
          agentData = (
            (await res.json()) as { agent: AgentData }
          ).agent;
        }
        await fetchAgents();
        setShowBuilder(false);
        setEditingAgent(null);
        if (andRun) {
          setRunningAgent(agentData);
        }
      } finally {
        setSaving(false);
      }
    },
    [editingAgent, fetchAgents]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("确定删除该分析任务？")) return;
      try {
        await fetch(`/api/agent/custom/${id}`, { method: "DELETE" });
        await fetchAgents();
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    },
    [fetchAgents]
  );

  const plan = (session?.user as { role?: string } | undefined)?.role;
  const limits = getLimitsForPlan(plan);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-white/40 text-sm">验证登录状态...</div>
      </div>
    );
  }
  if (!session) return null;

  // If running a custom agent, show run panel
  if (runningAgent) {
    return (
      <div className="h-[calc(100vh-280px)] min-h-[500px]">
        <CustomAgentRunPanel
          agentId={runningAgent.id}
          agentName={runningAgent.name}
          agentColor={runningAgent.color ?? "#6366f1"}
          autoStart={false}
          onClose={() => {
            setRunningAgent(null);
            fetchAgents();
          }}
          onEditRequest={() => {
            setEditingAgent(runningAgent);
            setShowBuilder(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Master Agents Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              投资大师代理
            </h2>
            <p className="text-sm text-white/40 mt-0.5">
              启用后，对话时将获得该大师的分析视角
            </p>
          </div>
          <span className="text-xs text-white/30">
            已启用 {enabledMasterIds.size}/{ALL_MASTER_AGENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ALL_MASTER_AGENTS.map((agent) => (
            <MasterAgentCard
              key={agent.id}
              agent={agent}
              enabled={enabledMasterIds.has(agent.id)}
              onToggle={handleMasterToggle}
            />
          ))}
        </div>
      </div>

      {/* Custom Agents Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">自定义分析任务</h2>
            <p className="text-sm text-white/40 mt-0.5">
              配置分析任务，批量回测多标的
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingAgent(null);
              setShowBuilder(true);
            }}
            className="btn-tactile bg-accent hover:bg-accent/80"
          >
            + 新建分析任务
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-surface animate-pulse"
              />
            ))}
          </div>
        ) : customAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-white/40 text-center max-w-sm mb-4 leading-relaxed">
              告诉 Agent
              你想分析哪些股票、用哪些策略，它会自动回测并给出综合研判。
            </p>
            <Button
              onClick={() => {
                setEditingAgent(null);
                setShowBuilder(true);
              }}
              className="btn-tactile bg-accent hover:bg-accent/80"
            >
              + 创建分析任务
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customAgents.map((agent) => (
              <CustomAgentCard
                key={agent.id}
                agent={agent}
                onRun={() => setRunningAgent(agent)}
                onEdit={() => {
                  setEditingAgent(agent);
                  setShowBuilder(true);
                }}
                onDelete={() => handleDelete(agent.id)}
              />
            ))}
          </div>
        )}

        {limits.customAgent.maxAgents !== -1 && (
          <div className="mt-4 text-xs text-white/30 text-center">
            已创建 {customAgents.length} / {limits.customAgent.maxAgents} 个任务
          </div>
        )}
      </div>

      {/* Builder Dialog */}
      <Dialog
        open={showBuilder}
        onOpenChange={() => {
          setShowBuilder(false);
          setEditingAgent(null);
        }}
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
                    targets:
                      editingAgent.targets as CustomAgentConfig["targets"],
                    strategies: editingAgent.strategies,
                    analysisDepth:
                      editingAgent.analysisDepth as
                        | "light"
                        | "standard"
                        | "deep",
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
