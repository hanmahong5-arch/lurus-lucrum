"use client";

/**
 * Validation Mode Selector
 *
 * Three prominent buttons for choosing validation scope:
 * - Single stock   (single symbol search)
 * - Multi stock    (batch symbol selection)
 * - Sector         (industry / concept board)
 *
 * Uses ValidationStore for persistence.
 */

import { cn } from "@/lib/utils";
import type { ValidationMode } from "@/lib/stores/validation-store";

// =============================================================================
// Types
// =============================================================================

interface ModeSelectorProps {
  mode: ValidationMode;
  onModeChange: (mode: ValidationMode) => void;
  targetCount?: number;
  sectorName?: string;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MODE_OPTIONS: {
  value: ValidationMode;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "single",
    label: "单股模式",
    description: "验证单只股票",
    icon: "1",
  },
  {
    value: "multi",
    label: "多股模式",
    description: "批量验证多只股票",
    icon: "N",
  },
  {
    value: "sector",
    label: "板块模式",
    description: "验证整个行业板块",
    icon: "#",
  },
];

// =============================================================================
// Component
// =============================================================================

export function ModeSelector({
  mode,
  onModeChange,
  targetCount = 0,
  sectorName,
  className,
}: ModeSelectorProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {MODE_OPTIONS.map((opt) => {
        const isActive = mode === opt.value;

        // Build badge text
        let badge: string | null = null;
        if (opt.value === "multi" && targetCount > 0) {
          badge = String(targetCount);
        } else if (opt.value === "sector" && sectorName) {
          badge = sectorName;
        }

        return (
          <button
            key={opt.value}
            onClick={() => onModeChange(opt.value)}
            className={cn(
              "flex-1 relative rounded-xl px-4 py-3 border-2 transition-all",
              "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void outline-none",
              isActive
                ? "border-accent bg-accent/10 shadow-[0_0_20px_rgba(var(--lucrum-accent-rgb,234,179,8),0.15)]"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
            )}
            aria-pressed={isActive}
          >
            {/* Icon circle */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold mb-2 mx-auto transition-colors",
                isActive
                  ? "bg-accent text-void"
                  : "bg-white/10 text-white/50",
              )}
            >
              {opt.icon}
            </div>

            {/* Label */}
            <div
              className={cn(
                "text-sm font-semibold text-center transition-colors",
                isActive ? "text-white" : "text-white/60",
              )}
            >
              {opt.label}
            </div>

            {/* Description */}
            <div className="text-xs text-white/30 text-center mt-0.5 hidden sm:block">
              {opt.description}
            </div>

            {/* Badge */}
            {badge && (
              <span
                className={cn(
                  "absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-xs font-mono tabular-nums",
                  isActive
                    ? "bg-accent text-void"
                    : "bg-white/20 text-white/70",
                )}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
