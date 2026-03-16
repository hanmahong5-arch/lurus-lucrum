"use client";

/**
 * Strategy Management Page
 * 策略管理页面 - 展示、创建、激活/停用策略
 * Uses DashboardHeader for consistent navigation across all dashboard pages
 * 使用 DashboardHeader 确保所有仪表板页面导航一致
 */

import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  Code,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

/**
 * Strategy interface matching backend model
 * 策略接口，与后端模型匹配
 */
interface Strategy {
  id: string;
  name: string;
  description: string;
  code: string;
  status: "inactive" | "active" | "error";
  created_at: string;
  updated_at: string;
  parameters?: Record<string, unknown>;
}

/**
 * Strategy Management Page
 * 策略管理页面 - 展示、创建、激活/停用策略
 */
export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newStrategyPrompt, setNewStrategyPrompt] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch strategies from backend
  // 从后端获取策略列表
  const fetchStrategies = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/backend/strategy/list");
      const data = await response.json();

      if (data.success) {
        setStrategies(data.strategies || []);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch strategies");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // Create strategy from natural language
  // 从自然语言创建策略
  const handleCreateStrategy = async () => {
    if (!newStrategyPrompt.trim()) return;

    try {
      setActionLoading("create");
      const response = await fetch("/api/backend/strategy/create-from-nl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newStrategyPrompt,
          auto_activate: false
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNewStrategyPrompt("");
        setIsCreating(false);
        await fetchStrategies();
      } else {
        setError(data.error || "Failed to create strategy");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  // Activate strategy
  // 激活策略
  const handleActivate = async (strategyId: string) => {
    try {
      setActionLoading(strategyId);
      const response = await fetch(`/api/backend/strategy/${strategyId}/activate`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        await fetchStrategies();
      } else {
        setError(data.error || "Failed to activate strategy");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  // Deactivate strategy
  // 停用策略
  const handleDeactivate = async (strategyId: string) => {
    try {
      setActionLoading(strategyId);
      const response = await fetch(`/api/backend/strategy/${strategyId}/deactivate`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        await fetchStrategies();
      } else {
        setError(data.error || "Failed to deactivate strategy");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  // Delete strategy
  // 删除策略
  const handleDelete = async (strategyId: string) => {
    if (!confirm("确定要删除这个策略吗？/ Are you sure you want to delete this strategy?")) {
      return;
    }

    try {
      setActionLoading(strategyId);
      const response = await fetch(`/api/backend/strategy/${strategyId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        await fetchStrategies();
      } else {
        setError(data.error || "Failed to delete strategy");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  // Get status badge
  // 获取状态徽章
  const getStatusBadge = (status: Strategy["status"]) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-profit/20 text-profit text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            运行中
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-loss/20 text-loss text-xs rounded-full">
            <XCircle className="w-3 h-3" />
            错误
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white/60 text-xs rounded-full">
            <AlertCircle className="w-3 h-3" />
            未激活
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Unified Dashboard Header with account status */}
      {/* 统一的仪表板头部，包含账户状态 */}
      <DashboardHeader />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Page title and actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              策略管理
              <span className="text-base font-normal text-white/50 ml-2">
                / Strategy Management
              </span>
            </h1>
            <p className="text-white/60">
              管理你的交易策略，激活或停用它们
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStrategies}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/80 text-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              刷新
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 rounded-lg text-primary-900 text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
              新建策略
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-lg flex items-center justify-between">
            <p className="text-loss text-sm">⚠️ {error}</p>
            <button onClick={() => setError(null)} className="text-loss/60 hover:text-loss">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Create strategy modal */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg mx-4 p-6 bg-surface border border-border rounded-2xl">
              <h2 className="text-lg font-bold text-white mb-4">
                创建新策略 / Create New Strategy
              </h2>
              <p className="text-white/60 text-sm mb-4">
                用自然语言描述你的策略，AI 将自动生成代码
              </p>
              <textarea
                value={newStrategyPrompt}
                onChange={(e) => setNewStrategyPrompt(e.target.value)}
                placeholder="例如：当5日均线上穿20日均线时买入，下穿时卖出，止损5%..."
                className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 resize-none focus:outline-none focus:border-accent/50"
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewStrategyPrompt("");
                  }}
                  className="px-4 py-2 text-white/60 hover:text-white text-sm transition"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateStrategy}
                  disabled={!newStrategyPrompt.trim() || actionLoading === "create"}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 rounded-lg text-primary-900 text-sm font-medium transition disabled:opacity-50"
                >
                  {actionLoading === "create" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  创建策略
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Strategy list */}
        {isLoading && strategies.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : strategies.length === 0 ? (
          <div className="text-center py-20">
            <Code className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white/60 mb-2">
              暂无策略 / No Strategies
            </h3>
            <p className="text-white/40 text-sm mb-6">
              点击 &quot;新建策略&quot; 开始创建你的第一个交易策略
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 rounded-lg text-primary-900 text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
              新建策略
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="p-6 bg-surface border border-border rounded-xl hover:border-accent/30 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-white truncate">
                        {strategy.name}
                      </h3>
                      {getStatusBadge(strategy.status)}
                    </div>
                    <p className="text-white/60 text-sm mb-3 line-clamp-2">
                      {strategy.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        创建于 {new Date(strategy.created_at).toLocaleDateString("zh-CN")}
                      </span>
                      <span>ID: {strategy.id.slice(0, 8)}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {strategy.status === "active" ? (
                      <button
                        onClick={() => handleDeactivate(strategy.id)}
                        disabled={actionLoading === strategy.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-loss/10 hover:bg-loss/20 border border-loss/30 rounded-lg text-loss text-sm transition disabled:opacity-50"
                      >
                        {actionLoading === strategy.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                        停用
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(strategy.id)}
                        disabled={actionLoading === strategy.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-profit/10 hover:bg-profit/20 border border-profit/30 rounded-lg text-profit text-sm transition disabled:opacity-50"
                      >
                        {actionLoading === strategy.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        激活
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(strategy.id)}
                      disabled={actionLoading === strategy.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-loss/10 border border-white/10 hover:border-loss/30 rounded-lg text-white/60 hover:text-loss text-sm transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
