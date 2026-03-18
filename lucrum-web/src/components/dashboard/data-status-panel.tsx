/**
 * Data Status Panel Component
 * 数据状态监控面板组件
 *
 * Displays real-time service health, cache stats, and data source status
 * 显示实时服务健康状态、缓存统计和数据源状态
 */

"use client";

import { useState } from "react";
import { useServiceStatus } from "@/hooks/use-market-data";

/**
 * Format bytes to human readable
 * 格式化字节为可读形式
 */
function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

/**
 * Format duration to human readable
 * 格式化时长为可读形式
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Get status color class
 * 获取状态颜色类
 */
function getStatusColor(status: string): string {
  switch (status) {
    case "healthy":
      return "text-profit";
    case "degraded":
      return "text-accent";
    case "unhealthy":
      return "text-loss";
    default:
      return "text-white/50";
  }
}

/**
 * Get status dot color class
 * 获取状态点颜色类
 */
function getStatusDotColor(status: string): string {
  switch (status) {
    case "healthy":
      return "bg-profit";
    case "degraded":
      return "bg-accent";
    case "unhealthy":
      return "bg-loss";
    default:
      return "bg-white/30";
  }
}

export function DataStatusPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, loading, error, lastUpdate, refresh } = useServiceStatus({
    refreshInterval: 10000,
  });

  if (loading && !data) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/30 animate-pulse" />
          <span className="text-sm text-white/50">加载数据服务状态...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-loss" />
            <span className="text-sm text-loss">数据服务状态获取失败</span>
          </div>
          <button
            onClick={() => refresh()}
            className="text-xs text-accent hover:text-accent/80"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, health } = data;
  const overallStatus =
    health.every((h) => h.status === "healthy")
      ? "healthy"
      : health.some((h) => h.status === "unhealthy")
        ? "unhealthy"
        : "degraded";

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${getStatusDotColor(overallStatus)}`} />
          <span className="text-sm font-medium text-white">数据服务状态</span>
          <span className={`text-xs ${getStatusColor(overallStatus)}`}>
            {overallStatus === "healthy"
              ? "正常"
              : overallStatus === "degraded"
                ? "部分降级"
                : "异常"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>请求: {formatNumber(stats.totalRequests)}</span>
            <span className="text-white/20">|</span>
            <span>缓存命中: {(stats.cacheHitRate * 100).toFixed(1)}%</span>
            <span className="text-white/20">|</span>
            <span>延迟: {stats.averageLatency.toFixed(0)}ms</span>
          </div>
          <svg
            className={`w-4 h-4 text-white/50 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border-b border-border/50">
            <div>
              <div className="text-xs text-white/50 mb-1">总请求数</div>
              <div className="text-lg font-medium text-white">
                {formatNumber(stats.totalRequests)}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">成功率</div>
              <div className="text-lg font-medium text-profit">
                {stats.totalRequests > 0
                  ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)
                  : 0}
                %
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">缓存命中率</div>
              <div className="text-lg font-medium text-accent">
                {(stats.cacheHitRate * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">运行时间</div>
              <div className="text-lg font-medium text-white">
                {formatDuration(stats.uptime)}
              </div>
            </div>
          </div>

          {/* Data Sources */}
          <div className="p-4">
            <div className="text-xs text-white/50 mb-3">数据源状态</div>
            <div className="space-y-2">
              {health.map((source) => (
                <div
                  key={source.source}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getStatusDotColor(source.status)}`}
                    />
                    <span className="text-sm text-white">{source.source}</span>
                    <span className={`text-xs ${getStatusColor(source.status)}`}>
                      {source.status === "healthy"
                        ? "正常"
                        : source.status === "degraded"
                          ? "降级"
                          : "异常"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    <span>成功率: {(source.successRate * 100).toFixed(0)}%</span>
                    <span>延迟: {source.latency.toFixed(0)}ms</span>
                    <span>错误: {source.errorCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 bg-white/5 text-xs text-white/50">
            <span>
              最后更新:{" "}
              {lastUpdate ? new Date(lastUpdate).toLocaleTimeString("zh-CN") : "-"}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                refresh();
              }}
              className="text-accent hover:text-accent/80 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              刷新
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
