"use client";

/**
 * Slider primitive - Radix UI wrapper with fintech terminal styling
 * 滑块基础组件 - Radix UI 包装，金融终端风格
 */

import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Quick-select tick marks (displayed below track) */
  ticks?: number[];
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  ticks,
  className,
  disabled,
}: SliderProps) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-3">
        {/* Min label */}
        <span className="text-[10px] text-neutral-600 font-mono tabular-nums shrink-0">
          {min}
        </span>

        {/* Track */}
        <SliderPrimitive.Root
          className="relative flex-1 flex items-center select-none touch-none h-5"
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(vals) => {
            const v = vals[0];
            if (v !== undefined) onValueChange(v);
          }}
          disabled={disabled}
        >
          <SliderPrimitive.Track className="relative h-1 flex-1 rounded-full bg-surface-hover overflow-hidden">
            <SliderPrimitive.Range
              className="absolute h-full bg-primary/60 rounded-full"
            />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={cn(
              "block w-4 h-4 rounded-full border-2 border-primary bg-surface",
              "ring-offset-background transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              "hover:border-primary/80 cursor-pointer",
            )}
          />
        </SliderPrimitive.Root>

        {/* Max label */}
        <span className="text-[10px] text-neutral-600 font-mono tabular-nums shrink-0">
          {max}
        </span>
      </div>

      {/* Tick marks */}
      {ticks && ticks.length > 0 && (
        <div className="flex gap-1 mt-1.5 ml-6 mr-6">
          {ticks.map((tick) => (
            <button
              key={tick}
              type="button"
              onClick={() => onValueChange(tick)}
              disabled={disabled}
              className={cn(
                "px-1.5 py-0.5 text-[10px] rounded font-mono tabular-nums transition-colors",
                value === tick
                  ? "bg-primary/20 text-primary"
                  : "bg-surface text-neutral-500 hover:text-neutral-300 hover:bg-surface-hover",
              )}
              style={{
                marginLeft:
                  tick === ticks[0]
                    ? `${((tick - min) / (max - min)) * 100}%`
                    : undefined,
              }}
            >
              {tick}
            </button>
          ))}
        </div>
      )}

      {/* Current value badge */}
      <div className="flex justify-end mt-0.5">
        <span
          className="text-xs font-mono tabular-nums text-primary"
          style={{ marginRight: `${100 - percent}%` }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
