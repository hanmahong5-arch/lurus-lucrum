"use client";

/**
 * PreCheckPanel - Backtest prerequisite checklist
 * 回测前置条件检查面板
 *
 * Displays a checklist of conditions that must be met before running a backtest.
 * Uses three-state lights (ready/warn/block) inspired by aircraft CAS displays.
 * Clicking a failed item focuses the corresponding editor field.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export type CheckStatus = "ready" | "warn" | "block";

export interface PreCheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
  focusField?: string;
}

export type FocusField = "strategy" | "target" | "dateRange" | "capital";

interface PreCheckPanelProps {
  items: PreCheckItem[];
  onFocusField?: (field: string) => void;
  className?: string;
}

interface PreCheckConditionsInput {
  strategyCode: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_CONFIG: Record<
  CheckStatus,
  { colorClass: string; icon: string; ariaStatus: string }
> = {
  ready: {
    colorClass: "bg-status-ready",
    icon: "✅",
    ariaStatus: "就绪",
  },
  warn: {
    colorClass: "bg-status-warn",
    icon: "⚠️",
    ariaStatus: "警告",
  },
  block: {
    colorClass: "bg-status-block",
    icon: "❌",
    ariaStatus: "未完成",
  },
};

/** Minimum capital threshold for warn state (A-share 100-lot constraint) */
const MIN_CAPITAL_WARN_THRESHOLD = 10000;

/** Minimum date range days for warn state */
const MIN_DATE_RANGE_WARN_DAYS = 30;

// =============================================================================
// HOOK: usePreCheckConditions
// =============================================================================

/**
 * Evaluate backtest prerequisite conditions and return check items.
 * Each condition maps to a three-state light: ready / warn / block.
 */
export function usePreCheckConditions(
  input: PreCheckConditionsInput,
): PreCheckItem[] {
  return useMemo(() => {
    const { strategyCode, symbol, startDate, endDate, initialCapital } = input;

    // 1. Strategy code validity
    const strategyStatus: CheckStatus = strategyCode.trim()
      ? "ready"
      : "block";

    // 2. Target selection
    const targetStatus: CheckStatus = symbol.trim() ? "ready" : "block";

    // 3. Date range
    let dateRangeStatus: CheckStatus = "block";
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays >= MIN_DATE_RANGE_WARN_DAYS) {
        dateRangeStatus = "ready";
      } else if (diffDays > 0) {
        dateRangeStatus = "warn";
      }
      // diffDays <= 0 stays block
    }

    // 4. Initial capital
    let capitalStatus: CheckStatus = "block";
    if (initialCapital >= MIN_CAPITAL_WARN_THRESHOLD) {
      capitalStatus = "ready";
    } else if (initialCapital > 0) {
      capitalStatus = "warn";
    }

    return [
      {
        id: "strategy",
        label: "策略代码有效",
        status: strategyStatus,
        focusField: "strategy" as FocusField,
      },
      {
        id: "target",
        label: "已选择回测标的",
        status: targetStatus,
        detail: symbol || undefined,
        focusField: "target" as FocusField,
      },
      {
        id: "dateRange",
        label: "已设置日期范围",
        status: dateRangeStatus,
        detail:
          startDate && endDate ? `${startDate} ~ ${endDate}` : undefined,
        focusField: "dateRange" as FocusField,
      },
      {
        id: "capital",
        label: "初始资金已配置",
        status: capitalStatus,
        detail:
          initialCapital > 0
            ? `¥${initialCapital.toLocaleString()}`
            : undefined,
        focusField: "capital" as FocusField,
      },
    ];
  }, [
    input.strategyCode,
    input.symbol,
    input.startDate,
    input.endDate,
    input.initialCapital,
  ]);
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PreCheckPanel({
  items,
  onFocusField,
  className,
}: PreCheckPanelProps) {
  const allReady = items.every((item) => item.status === "ready");
  const hasBlocker = items.some((item) => item.status === "block");

  return (
    <div
      className={cn("rounded-lg border border-white/5 bg-void/30 p-3", className)}
      data-all-ready={allReady}
      data-has-blocker={hasBlocker}
    >
      {/* Title */}
      <div className="text-xs font-medium text-neutral-300 mb-2">
        执行前检查
      </div>

      {/* Checklist */}
      <ul
        role="list"
        aria-live="polite"
        className="space-y-1.5"
      >
        {items.map((item) => {
          const config = STATUS_CONFIG[item.status];
          const isClickable =
            item.status !== "ready" && item.focusField && onFocusField;

          return (
            <li
              key={item.id}
              role="listitem"
              aria-label={`${item.label}，${config.ariaStatus}`}
              className={cn(
                "flex items-center gap-2 text-xs rounded px-2 py-1 transition-colors",
                isClickable &&
                  "cursor-pointer hover:bg-white/5 active:bg-white/10",
              )}
              onClick={
                isClickable
                  ? () => onFocusField(item.focusField!)
                  : undefined
              }
            >
              {/* Three-state light dot */}
              <span
                data-status={item.status}
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  config.colorClass,
                )}
              />

              {/* Label */}
              <span
                className={cn(
                  "text-neutral-300",
                  item.status === "block" && "text-neutral-500",
                )}
              >
                {item.label}
              </span>

              {/* Detail text */}
              {item.detail && (
                <span className="text-neutral-500 text-[11px] ml-auto truncate max-w-[120px]">
                  {item.detail}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
