/**
 * Strategy Discovery Card Component
 *
 * Displays a single crawled strategy as a card in the discovery grid.
 * Shows strategy name, description, source, popularity metrics, and type badge.
 *
 * Story 3.2: Discovery Page & Filter
 *
 * @module components/discovery/strategy-discovery-card
 */

"use client";

import React from "react";
import { Star, Eye, ExternalLink, Github, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoveryStrategy } from "@/hooks/use-discovery-strategies";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Strategy type display configuration */
const STRATEGY_TYPE_CONFIG: Record<string, { label: string; colorClass: string }> = {
  trend: { label: "趋势跟踪", colorClass: "bg-blue-500/20 text-blue-400" },
  "mean-revert": { label: "均值回归", colorClass: "bg-purple-500/20 text-purple-400" },
  momentum: { label: "动量", colorClass: "bg-green-500/20 text-green-400" },
  composite: { label: "复合", colorClass: "bg-yellow-500/20 text-yellow-400" },
  factor: { label: "因子", colorClass: "bg-cyan-500/20 text-cyan-400" },
  pattern: { label: "形态", colorClass: "bg-pink-500/20 text-pink-400" },
};

/** Source platform display configuration */
const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Github }> = {
  github: { label: "GitHub", icon: Github },
  builtin: { label: "内置", icon: Sparkles },
};

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const config = STRATEGY_TYPE_CONFIG[type] || {
    label: type,
    colorClass: "bg-neutral-500/20 text-neutral-400",
  };
  return (
    <span
      className={cn("text-xs px-2 py-0.5 rounded-full font-medium", config.colorClass)}
      data-testid="strategy-type-badge"
    >
      {config.label}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source] || { label: source, icon: Github };
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-neutral-500"
      data-testid="strategy-source-badge"
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function PopularityMetrics({ views, likes }: { views: number; likes: number }) {
  return (
    <div className="flex items-center gap-3 text-xs text-neutral-500">
      <span className="inline-flex items-center gap-1" data-testid="strategy-likes">
        <Star className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">{likes}</span>
      </span>
      <span className="inline-flex items-center gap-1" data-testid="strategy-views">
        <Eye className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">{views}</span>
      </span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface StrategyDiscoveryCardProps {
  strategy: DiscoveryStrategy;
  onSelect: (strategy: DiscoveryStrategy) => void;
  className?: string;
}

export function StrategyDiscoveryCard({
  strategy,
  onSelect,
  className,
}: StrategyDiscoveryCardProps) {
  const handleClick = () => onSelect(strategy);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(strategy);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative rounded-lg border border-neutral-800 bg-surface p-4",
        "hover:border-neutral-600 hover:bg-surface-hover",
        "transition-all duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
      data-testid="strategy-discovery-card"
      aria-label={strategy.name + " - " + (strategy.description || "")}
    >
      {/* Header: Source + Featured */}
      <div className="flex items-center justify-between mb-2">
        <SourceBadge source={strategy.source} />
        {strategy.isFeatured && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-score-s/20 text-score-s font-medium"
            data-testid="strategy-featured-badge"
          >
            ★ 推荐
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-neutral-100 mb-1 line-clamp-1 group-hover:text-primary transition-colors">
        {strategy.name}
      </h3>

      {/* Description */}
      <p className="text-xs text-neutral-400 mb-3 line-clamp-2 min-h-[2rem]">
        {strategy.description || "暂无描述"}
      </p>

      {/* Footer: Type + Metrics */}
      <div className="flex items-center justify-between">
        <TypeBadge type={strategy.strategyType} />
        <PopularityMetrics views={strategy.views} likes={strategy.likes} />
      </div>

      {/* Author */}
      {strategy.author && (
        <p className="text-xs text-neutral-600 mt-2 truncate">
          by {strategy.author}
        </p>
      )}

      {/* External link indicator */}
      {strategy.originalUrl && (
        <ExternalLink
          className="absolute top-3 right-3 h-3 w-3 text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />
      )}
    </div>
  );
}