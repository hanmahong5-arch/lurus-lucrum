/**
 * Empty State Component
 * 空状态组件
 *
 * Displays a helpful message and actions when a page or panel has no data.
 * Guides users with clear next steps instead of showing a blank screen.
 *
 * Story 1.4: 空状态组件
 */

"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types / 类型
// =============================================================================

/**
 * Action button configuration
 */
export interface EmptyStateAction {
  /** Button label text */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Button variant: primary (filled) or ghost (text-only) */
  variant?: "primary" | "ghost";
}

/**
 * EmptyState component props
 */
export interface EmptyStateProps {
  /** Lucide icon component to display */
  icon: LucideIcon;
  /** Main title text */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action buttons (max 2 recommended) */
  actions?: EmptyStateAction[];
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Action Button Component
// =============================================================================

interface ActionButtonProps {
  action: EmptyStateAction;
}

function ActionButton({ action }: ActionButtonProps) {
  const { label, onClick, variant = "primary" } = action;

  const baseClasses =
    "px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 btn-tactile";

  const variantClasses = {
    primary:
      "bg-primary text-white hover:bg-primary-600 active:bg-primary-700 glow-active",
    ghost:
      "text-neutral-400 hover:text-neutral-200 hover:bg-surface-hover active:bg-surface-active",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(baseClasses, variantClasses[variant])}
    >
      {label}
    </button>
  );
}

// =============================================================================
// Main EmptyState Component
// =============================================================================

/**
 * EmptyState - Empty state display component
 *
 * Shows a centered icon, title, optional description, and action buttons
 * when there's no data to display.
 *
 * @example
 * ```tsx
 * import { EmptyState } from '@/components/feedback/empty-state';
 * import { FileCode } from 'lucide-react';
 *
 * <EmptyState
 *   icon={FileCode}
 *   title="开始创建你的第一个策略"
 *   description="使用自然语言描述你的投资想法"
 *   actions={[
 *     { label: '新建', onClick: handleNew, variant: 'primary' },
 *     { label: '浏览模板', onClick: handleBrowse, variant: 'ghost' },
 *   ]}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "pt-8 px-4",
        "max-w-sm mx-auto",
        className
      )}
    >
      {/* Icon */}
      <div className="mb-4">
        <Icon
          className="w-12 h-12 text-neutral-500"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3 className="text-sm text-neutral-400 mb-1">{title}</h3>

      {/* Description (optional) */}
      {description && (
        <p className="text-xs text-neutral-500 mb-4">{description}</p>
      )}

      {/* Actions (optional) */}
      {actions && actions.length > 0 && (
        <div
          className={cn(
            "flex items-center gap-2 mt-4",
            // Add margin-top only if no description
            !description && "mt-2"
          )}
        >
          {actions.map((action, index) => (
            <ActionButton key={`${action.label}-${index}`} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
