"use client";

/**
 * ConversationList - Display for AI advisor conversation history.
 * Shows query preview, category badge, and timestamp.
 */

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface ConversationItem {
  id: string;
  query: string;
  responsePreview: string;
  category: string;
  timestamp: string;
}

interface ConversationListProps {
  entries: ConversationItem[];
}

// =============================================================================
// CATEGORY COLORS
// =============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  macro: "bg-chart-blue/10 text-chart-blue",
  technical: "bg-chart-cyan/10 text-chart-cyan",
  fundamental: "bg-chart-purple/10 text-chart-purple",
  risk: "bg-loss/10 text-loss",
  strategy: "bg-accent/10 text-accent",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? "bg-white/10 text-white/50";
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ConversationList({ entries }: ConversationListProps) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 p-3 bg-surface rounded-lg border border-border hover:border-white/15 transition cursor-pointer group"
        >
          {/* Icon */}
          <div className="w-9 h-9 rounded-lg bg-chart-purple/10 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-chart-purple" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white line-clamp-1">
                {entry.query}
              </span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded shrink-0",
                  getCategoryColor(entry.category),
                )}
              >
                {entry.category}
              </span>
            </div>
            <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">
              {entry.responsePreview}
            </p>
          </div>

          {/* Timestamp */}
          <div className="text-[10px] text-white/30 shrink-0 mt-1">
            {formatTime(entry.timestamp)}
          </div>
        </div>
      ))}
    </div>
  );
}
