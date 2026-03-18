"use client";

/**
 * Alert Panel Component
 *
 * Displays proactive alerts from the prediction system
 * Supports filtering, marking as read, and priority-based sorting
 */

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type {
  ProactiveAlert,
  AlertType,
  AlertPriority,
} from "@/lib/advisor/agent/types";
import {
  sortAlerts,
  filterExpiredAlerts,
  filterAlertsByType,
  getUnreadAlerts,
  getAlertCountByPriority,
} from "@/lib/advisor/prediction/alert-generator";
import { getAlertTypeLabels, getPriorityLabels } from "@/lib/advisor";

// ============================================================================
// Component Props
// ============================================================================

interface AlertPanelProps {
  alerts: ProactiveAlert[];
  onMarkRead?: (alertId: string) => void;
  onAlertClick?: (alert: ProactiveAlert) => void;
  onDismiss?: (alertId: string) => void;
  maxVisible?: number;
  showFilters?: boolean;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function AlertPanel({
  alerts,
  onMarkRead,
  onAlertClick,
  onDismiss,
  maxVisible = 10,
  showFilters = true,
  className,
}: AlertPanelProps) {
  const [selectedType, setSelectedType] = useState<AlertType | "all">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const typeLabels = getAlertTypeLabels();
  const priorityLabels = getPriorityLabels();

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  const processedAlerts = useMemo(() => {
    let result = filterExpiredAlerts(alerts);

    if (selectedType !== "all") {
      result = filterAlertsByType(result, [selectedType]);
    }

    if (showUnreadOnly) {
      result = getUnreadAlerts(result);
    }

    result = sortAlerts(result);

    return result.slice(0, maxVisible);
  }, [alerts, selectedType, showUnreadOnly, maxVisible]);

  const unreadCount = useMemo(() => getUnreadAlerts(alerts).length, [alerts]);
  const priorityCounts = useMemo(
    () => getAlertCountByPriority(alerts),
    [alerts],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white">实时预警</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {unreadCount} 未读
            </span>
          )}
        </div>

        {/* Priority Summary */}
        <div className="flex items-center gap-1 text-xs">
          {priorityCounts.urgent > 0 && (
            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
              {priorityCounts.urgent} 紧急
            </span>
          )}
          {priorityCounts.high > 0 && (
            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">
              {priorityCounts.high} 高
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedType("all")}
            className={cn(
              "px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition",
              selectedType === "all"
                ? "bg-accent text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20",
            )}
          >
            全部
          </button>
          {Object.entries(typeLabels)
            .slice(0, 6)
            .map(([type, label]) => (
              <button
                key={type}
                onClick={() => setSelectedType(type as AlertType)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition flex items-center gap-1",
                  selectedType === type
                    ? "bg-accent text-white"
                    : "bg-white/10 text-white/70 hover:bg-white/20",
                )}
              >
                <span>{label.icon}</span>
                <span>{label.name}</span>
              </button>
            ))}

          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition ml-auto",
              showUnreadOnly
                ? "bg-blue-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20",
            )}
          >
            仅未读
          </button>
        </div>
      )}

      {/* Alert List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {processedAlerts.length === 0 ? (
          <div className="text-center py-8 text-white/50">暂无预警信息</div>
        ) : (
          processedAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              typeLabels={typeLabels}
              priorityLabels={priorityLabels}
              onClick={() => onAlertClick?.(alert)}
              onMarkRead={() => onMarkRead?.(alert.id)}
              onDismiss={() => onDismiss?.(alert.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Alert Card Component
// ============================================================================

interface AlertCardProps {
  alert: ProactiveAlert;
  typeLabels: ReturnType<typeof getAlertTypeLabels>;
  priorityLabels: ReturnType<typeof getPriorityLabels>;
  onClick?: () => void;
  onMarkRead?: () => void;
  onDismiss?: () => void;
}

function AlertCard({
  alert,
  typeLabels,
  priorityLabels,
  onClick,
  onMarkRead,
  onDismiss,
}: AlertCardProps) {
  const typeLabel = typeLabels[alert.type] || { name: alert.type, icon: "📋" };
  const priorityLabel = priorityLabels[alert.priority];

  const priorityColors: Record<AlertPriority, string> = {
    urgent: "border-l-red-500 bg-red-500/5",
    high: "border-l-orange-500 bg-orange-500/5",
    medium: "border-l-yellow-500 bg-yellow-500/5",
    low: "border-l-green-500 bg-green-500/5",
  };

  const timeAgo = getTimeAgo(alert.timestamp);

  return (
    <div
      className={cn(
        "border-l-4 rounded-r-lg p-3 cursor-pointer transition",
        "hover:bg-white/5",
        priorityColors[alert.priority],
        !alert.read && "ring-1 ring-white/10",
      )}
      onClick={() => {
        onClick?.();
        if (!alert.read) onMarkRead?.();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{typeLabel.icon}</span>
            <span className="font-medium text-white truncate">
              {alert.title}
            </span>
            {!alert.read && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
            )}
          </div>

          {/* Summary */}
          <p className="text-sm text-white/70 line-clamp-2">{alert.summary}</p>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
            <span
              className={cn(
                "px-1.5 py-0.5 rounded",
                `bg-${priorityLabel?.color || "gray"}-500/20 text-${priorityLabel?.color || "gray"}-400`,
              )}
            >
              {priorityLabel?.name || alert.priority}
            </span>
            <span>{typeLabel.name}</span>
            <span>•</span>
            <span>{timeAgo}</span>
            {alert.symbolName && (
              <>
                <span>•</span>
                <span className="text-accent">{alert.symbolName}</span>
              </>
            )}
          </div>

          {/* Suggested Action */}
          {alert.suggestedAction && (
            <div className="mt-2 text-xs text-accent/80">
              💡 {alert.suggestedAction}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 text-white/30 hover:text-white/70 transition"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return `${days}天前`;
}

// ============================================================================
// Compact Alert Badge Component
// ============================================================================

interface AlertBadgeProps {
  alerts: ProactiveAlert[];
  onClick?: () => void;
  className?: string;
}

export function AlertBadge({ alerts, onClick, className }: AlertBadgeProps) {
  const unreadCount = getUnreadAlerts(alerts).length;
  const hasUrgent = alerts.some((a) => a.priority === "urgent" && !a.read);

  if (unreadCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1 px-2 py-1 rounded-full text-sm transition",
        hasUrgent
          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
          : "bg-white/10 text-white/70 hover:bg-white/20",
        className,
      )}
    >
      <span>🔔</span>
      <span>{unreadCount}</span>
      {hasUrgent && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );
}

export default AlertPanel;
