"use client";

/**
 * DataSourceBadge Component
 * Displays data source type (DB/API/Simulated) with color-coded badge and tooltip
 */

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// Types
// =============================================================================

type DataSourceType = "db" | "api" | "simulated";

interface DataSourceBadgeProps {
  /** Data source type */
  type: DataSourceType;
  /** Optional detail text for tooltip */
  detail?: string;
  /** Optional class overrides */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SOURCE_CONFIG: Record<
  DataSourceType,
  {
    label: string;
    tooltipDefault: string;
    bgClass: string;
    textClass: string;
    dotClass: string;
  }
> = {
  db: {
    label: "数据库",
    tooltipDefault: "真实历史数据，来自本地数据库",
    bgClass: "bg-source-db/20",
    textClass: "text-source-db",
    dotClass: "bg-source-db",
  },
  api: {
    label: "API",
    tooltipDefault: "实时拉取，可能有延迟",
    bgClass: "bg-source-api/20",
    textClass: "text-source-api",
    dotClass: "bg-source-api",
  },
  simulated: {
    label: "模拟",
    tooltipDefault: "模拟生成数据，仅供参考",
    bgClass: "bg-source-sim/20",
    textClass: "text-source-sim",
    dotClass: "bg-source-sim",
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Map a raw data source string to DataSourceType.
 * Shared by backtest-panel and strategy-validation pages.
 */
export function mapDataSourceString(source: string): DataSourceType {
  const lower = source.toLowerCase();
  if (lower.includes("simulated") || lower.includes("mock") || lower.includes("模拟")) {
    return "simulated";
  }
  if (lower.includes("api") || lower.includes("eastmoney") || lower.includes("sina")) {
    return "api";
  }
  return "db";
}

// =============================================================================
// Component
// =============================================================================

export function DataSourceBadge({
  type,
  detail,
  className,
}: DataSourceBadgeProps) {
  const config = SOURCE_CONFIG[type];

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-1 py-0.5 rounded-full text-[13px] font-medium cursor-default",
              config.bgClass,
              config.textClass,
              className,
            )}
          >
            <span
              className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dotClass)}
            />
            {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{detail || config.tooltipDefault}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export type { DataSourceType, DataSourceBadgeProps };
