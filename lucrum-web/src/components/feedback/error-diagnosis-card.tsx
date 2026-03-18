"use client";

/**
 * ErrorDiagnosisCard - Structured error diagnosis for backtest failures
 * 错误诊断卡 - 回测失败的结构化错误诊断
 *
 * Displays a structured error card with:
 * - Error type icon based on BT error code category
 * - Bilingual error message (Chinese primary, English secondary)
 * - Cause description and actionable suggestion
 * - Collapsible detail section
 * - Action buttons (apply suggestion, change stock, close)
 *
 * Uses role="alert" for immediate screen reader announcement.
 * Left border uses status-block design token for visual severity indication.
 *
 * Story 2.7: 错误诊断卡 (Error Diagnosis Card)
 */

import { useState, useCallback, useMemo } from "react";
import {
  ShieldAlert,
  Database,
  Calculator,
  Cog,
  Wifi,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ErrorInfo } from "@/lib/backtest/core/interfaces";
import { getErrorSeverity } from "@/lib/backtest/core/errors";

// =============================================================================
// TYPES
// =============================================================================

export interface ErrorAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Button variant: primary action or secondary */
  variant?: "primary" | "secondary";
}

export interface ErrorDiagnosisProps {
  /** ErrorInfo from backtest error system */
  error: ErrorInfo;
  /** Optional action buttons */
  actions?: ErrorAction[];
  /** Callback when close button is clicked */
  onClose?: () => void;
  /** Whether details section is initially expanded */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Error category prefix length (e.g., "BT1" from "BT100") */
const CATEGORY_PREFIX_LENGTH = 3;

/** Default label for unknown error categories */
const UNKNOWN_CATEGORY_LABEL = { zh: "未知错误", en: "Unknown Error" };

/**
 * Error category configuration mapping BT code prefixes to display metadata.
 * Each category maps to a label (zh/en), icon, and border color class.
 */
const ERROR_CATEGORIES: Record<
  string,
  {
    labelZh: string;
    labelEn: string;
    icon: LucideIcon;
  }
> = {
  BT1: {
    labelZh: "验证错误",
    labelEn: "Validation Error",
    icon: ShieldAlert,
  },
  BT2: {
    labelZh: "数据错误",
    labelEn: "Data Error",
    icon: Database,
  },
  BT3: {
    labelZh: "计算错误",
    labelEn: "Calculation Error",
    icon: Calculator,
  },
  BT4: {
    labelZh: "引擎错误",
    labelEn: "Engine Error",
    icon: Cog,
  },
  BT5: {
    labelZh: "网络错误",
    labelEn: "Network Error",
    icon: Wifi,
  },
  BT9: {
    labelZh: "系统错误",
    labelEn: "System Error",
    icon: AlertTriangle,
  },
};

/**
 * Severity-based border color classes.
 * Maps error severity level to left-border Tailwind class.
 */
const SEVERITY_BORDER_CLASS: Record<string, string> = {
  error: "border-l-status-block",
  warning: "border-l-status-warn",
  info: "border-l-step-active",
};

/**
 * Severity-based icon color classes.
 */
const SEVERITY_ICON_CLASS: Record<string, string> = {
  error: "text-status-block",
  warning: "text-status-warn",
  info: "text-step-active",
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract error category from BT error code.
 * Returns the 3-character prefix (e.g., "BT1" from "BT100").
 */
function getErrorCategoryPrefix(code: string): string {
  if (!code || code.length < CATEGORY_PREFIX_LENGTH) {
    return "";
  }
  return code.slice(0, CATEGORY_PREFIX_LENGTH);
}

/**
 * Get error category metadata from error code.
 * Falls back to AlertTriangle icon and unknown label for unrecognized codes.
 */
function getErrorCategory(code: string): {
  labelZh: string;
  labelEn: string;
  icon: LucideIcon;
} {
  const prefix = getErrorCategoryPrefix(code);
  return (
    ERROR_CATEGORIES[prefix] ?? {
      labelZh: UNKNOWN_CATEGORY_LABEL.zh,
      labelEn: UNKNOWN_CATEGORY_LABEL.en,
      icon: AlertTriangle,
    }
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ErrorDiagnosisCard({
  error,
  actions,
  onClose,
  defaultExpanded = false,
  className,
}: ErrorDiagnosisProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Derive category and severity from error code
  const category = useMemo(() => getErrorCategory(error.code), [error.code]);
  const severity = useMemo(() => {
    try {
      // getErrorSeverity expects BacktestErrorCode enum, but we pass the string code
      // It will match if the code is a valid enum value
      return getErrorSeverity(error.code as Parameters<typeof getErrorSeverity>[0]);
    } catch {
      return "error" as const;
    }
  }, [error.code]);

  const CategoryIcon = category.icon;
  const borderClass = SEVERITY_BORDER_CLASS[severity] ?? SEVERITY_BORDER_CLASS.error;
  const iconColorClass = SEVERITY_ICON_CLASS[severity] ?? SEVERITY_ICON_CLASS.error;

  // Determine if we have expandable details
  const hasDetails = Boolean(error.messageEn) || Boolean(error.details);

  return (
    <div
      className={cn(
        // Base layout
        "rounded-lg border-l-2 bg-surface-elevated p-4",
        // Left border color based on severity
        borderClass,
        className,
      )}
      role="alert"
      aria-label={`${category.labelZh}: ${error.message}`}
    >
      {/* Header: Icon + Title + Error Code + Close */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CategoryIcon
            className={cn("h-5 w-5 shrink-0", iconColorClass)}
            aria-hidden="true"
          />
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-sm font-medium text-neutral-100">
              {"\u56DE\u6D4B\u5931\u8D25"}
            </span>
            <span
              className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs tabular-nums text-neutral-400"
              aria-label={`Error code: ${error.code}`}
            >
              {error.code}
            </span>
            <span className="text-xs text-neutral-400">
              {category.labelZh}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-neutral-400 hover:bg-surface-hover hover:text-neutral-200 transition-colors"
            aria-label={"\u5173\u95ED\u9519\u8BEF\u8BCA\u65AD\u5361"}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="my-3 border-t border-white/5" />

      {/* Problem: What happened */}
      <div className="space-y-2">
        <div>
          <span className="text-xs font-medium text-neutral-400">
            {"\u95EE\u9898"}
          </span>
          <p className="mt-0.5 text-sm text-neutral-200">
            {error.message}
          </p>
        </div>

        {/* Cause: Why it happened (English message as secondary context) */}
        {error.messageEn && (
          <div>
            <span className="text-xs font-medium text-neutral-400">
              {"\u539F\u56E0"}
            </span>
            <p className="mt-0.5 text-sm text-neutral-300">
              {error.messageEn}
            </p>
          </div>
        )}
      </div>

      {/* Separator before suggestion */}
      {error.suggestedAction && (
        <>
          <div className="my-3 border-t border-white/5" />

          {/* Suggestion: What user can do */}
          <div>
            <span className="text-xs font-medium text-neutral-400">
              {"\u5EFA\u8BAE"}
            </span>
            <p className="mt-0.5 text-sm text-step-active">
              {error.suggestedAction}
            </p>
          </div>
        </>
      )}

      {/* Collapsible details section */}
      {hasDetails && (
        <div className="mt-3">
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
            aria-expanded={isExpanded}
            aria-controls="error-details"
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isExpanded ? "\u6536\u8D77\u8BE6\u60C5" : "\u5C55\u5F00\u8BE6\u60C5"}
          </button>

          {isExpanded && (
            <div
              id="error-details"
              className="mt-2 rounded border border-white/5 bg-void/30 p-3 text-xs"
            >
              {error.messageEn && (
                <div className="mb-2">
                  <span className="font-medium text-neutral-400">English: </span>
                  <span className="text-neutral-300">{error.messageEn}</span>
                </div>
              )}
              {error.details != null && (
                <div>
                  <span className="font-medium text-neutral-400">Details: </span>
                  <span className="font-mono text-neutral-300">
                    {typeof error.details === "string"
                      ? error.details
                      : JSON.stringify(error.details, null, 2)}
                  </span>
                </div>
              )}
              <div className="mt-2">
                <span className="font-medium text-neutral-400">
                  {"\u53EF\u6062\u590D"}: </span>
                <span className={cn(
                  "text-xs",
                  error.recoverable ? "text-step-done" : "text-status-block",
                )}>
                  {error.recoverable ? "\u662F" : "\u5426"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {actions && actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors btn-tactile",
                action.variant === "primary"
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-surface text-neutral-300 hover:bg-surface-hover hover:text-neutral-100",
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
