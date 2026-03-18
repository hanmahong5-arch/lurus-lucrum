"use client";

/**
 * Data Updates Admin Page
 * 数据更新管理页面
 *
 * Monitor and manually trigger data updates
 * 监控和手动触发数据更新
 */

import { useState, useEffect, useCallback } from "react";
import { NavHeader } from "@/components/dashboard/nav-header";
import { RefreshCw, PlayCircle, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface UpdateLog {
  id: number;
  updateDate: string;
  updateType: string;
  status: string;
  recordsUpdated: number;
  recordsFailed: number;
  duration: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface StatusData {
  currentStatus: {
    isUpdating: boolean;
    latestUpdate: {
      date: string;
      status: string;
      recordsUpdated: number;
      recordsFailed: number;
      startTime: string;
      endTime: string | null;
    } | null;
  };
  statistics: {
    total: number;
    successful: number;
    failed: number;
    partial: number;
    successRate: string;
  };
  recentLogs: UpdateLog[];
}

// ============================================================================
// Component
// ============================================================================

export default function DataUpdatesAdminPage() {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  /**
   * Fetch status data
   * 获取状态数据
   */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/data/status');
      const data = await response.json();

      if (data.success) {
        setStatusData(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Trigger manual update
   * 触发手动更新
   */
  const handleTriggerUpdate = useCallback(async () => {
    if (isTriggering || statusData?.currentStatus.isUpdating) {
      return;
    }

    setIsTriggering(true);
    setUpdateMessage(null);

    try {
      const response = await fetch('/api/data/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateType: 'daily',
          force: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUpdateMessage(`✅ 更新成功！更新了 ${data.stats.recordsUpdated} 条记录，失败 ${data.stats.recordsFailed} 条`);
        // Refresh status after update
        setTimeout(() => fetchStatus(), 1000);
      } else {
        setUpdateMessage(`❌ 更新失败：${data.error || data.message}`);
      }
    } catch (err) {
      console.error('Failed to trigger update:', err);
      setUpdateMessage(`❌ 触发更新失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTriggering(false);
    }
  }, [isTriggering, statusData, fetchStatus]);

  /**
   * Auto-refresh status every 30 seconds
   * 每30秒自动刷新状态
   */
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  /**
   * Get status badge
   * 获取状态徽章
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
            <CheckCircle className="w-3 h-3" />
            成功
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">
            <XCircle className="w-3 h-3" />
            失败
          </span>
        );
      case 'partial':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
            <AlertCircle className="w-3 h-3" />
            部分成功
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
            <RefreshCw className="w-3 h-3 animate-spin" />
            运行中
          </span>
        );
      default:
        return (
          <span className="text-xs px-2 py-1 bg-white/10 text-gray-400 rounded">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50">加载中...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            数据更新管理
            <span className="text-base font-normal text-white/50 ml-2">
              / Data Updates Admin
            </span>
          </h1>
          <p className="text-white/60">
            监控每日数据更新任务，手动触发更新
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Update Message */}
        {updateMessage && (
          <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
            <p className="text-white text-sm">{updateMessage}</p>
          </div>
        )}

        {/* Current Status Card */}
        {statusData && (
          <div className="mb-6 bg-surface/80 backdrop-blur-xl border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">当前状态</h2>
              <button
                onClick={fetchStatus}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="刷新"
              >
                <RefreshCw className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Latest Update */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Clock className="w-4 h-4" />
                  <span>最近更新</span>
                </div>
                {statusData.currentStatus.latestUpdate ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {statusData.currentStatus.latestUpdate.date}
                      </span>
                      {getStatusBadge(statusData.currentStatus.latestUpdate.status)}
                    </div>
                    <div className="text-sm text-white/60">
                      更新: {statusData.currentStatus.latestUpdate.recordsUpdated} 条 |
                      失败: {statusData.currentStatus.latestUpdate.recordsFailed} 条
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/40">暂无更新记录</div>
                )}
              </div>

              {/* Statistics */}
              <div className="space-y-3">
                <div className="text-sm text-white/50">统计信息</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-white/40 mb-1">总次数</div>
                    <div className="text-xl font-bold text-white">
                      {statusData.statistics.total}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-white/40 mb-1">成功率</div>
                    <div className="text-xl font-bold text-green-400">
                      {statusData.statistics.successRate}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Trigger Button */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={handleTriggerUpdate}
                disabled={isTriggering || statusData.currentStatus.isUpdating}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80
                         rounded-lg text-white font-medium transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTriggering || statusData.currentStatus.isUpdating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    手动触发更新
                  </>
                )}
              </button>
              <p className="mt-2 text-xs text-white/40">
                更新今日的K线数据（如果已存在则跳过）
              </p>
            </div>
          </div>
        )}

        {/* Recent Logs Table */}
        {statusData && statusData.recentLogs.length > 0 && (
          <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-white">最近更新记录</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60">
                      日期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60">
                      类型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60">
                      状态
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-white/60">
                      更新数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-white/60">
                      失败数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-white/60">
                      耗时(秒)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {statusData.recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 text-sm text-white">
                        {log.updateDate}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60">
                        {log.updateType}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-green-400">
                        {log.recordsUpdated}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-red-400">
                        {log.recordsFailed}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-white/60">
                        {log.duration ? log.duration.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cron Schedule Info */}
        <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-accent text-2xl">ℹ️</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-white mb-1">
                自动更新调度
              </h3>
              <p className="text-xs text-white/60 mb-2">
                系统已配置每日自动更新任务，在交易日（周一至周五）15:30自动执行。
              </p>
              <div className="text-xs text-white/40">
                • 时区: Asia/Shanghai (UTC+8)<br />
                • 执行时间: 15:30 CST<br />
                • 执行日期: 周一至周五<br />
                • 模式: {process.env.NODE_ENV === 'production' ? '生产环境（已启用）' : '开发环境（已禁用）'}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
