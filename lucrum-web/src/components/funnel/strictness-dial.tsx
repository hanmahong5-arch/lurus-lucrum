'use client';

/**
 * StrictnessDial — 4-segment selector for funnel preset.
 *
 * Positioned at the top of QuickPick so users see the trade-off knob
 * before they hit "Run". Hover/focus reveals the per-level detail bullets
 * so power users don't have to guess what each level changes. Selected
 * level shows an inline tagline beneath the dial so screen-reader and
 * low-vision users get the same context as hover users.
 *
 * @module components/funnel/strictness-dial
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  STRICTNESS_ORDER,
  STRICTNESS_PRESETS,
  type StrictnessLevel,
} from '@/lib/funnel/strictness';

export interface StrictnessDialProps {
  readonly value: StrictnessLevel;
  readonly onChange: (level: StrictnessLevel) => void;
  readonly disabled?: boolean;
}

export function StrictnessDial({ value, onChange, disabled }: StrictnessDialProps) {
  const [hovered, setHovered] = useState<StrictnessLevel | null>(null);
  const focused = hovered ?? value;
  const focusedPreset = STRICTNESS_PRESETS[focused];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-400">严格度</span>
        <div
          role="radiogroup"
          aria-label="选股严格度档位"
          className="inline-flex rounded-lg border border-border bg-surface/40 p-1"
        >
          {STRICTNESS_ORDER.map((level) => {
            const p = STRICTNESS_PRESETS[level];
            const selected = level === value;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onMouseEnter={() => setHovered(level)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(level)}
                onBlur={() => setHovered(null)}
                onClick={() => onChange(level)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-accent/50',
                  selected
                    ? 'bg-accent text-void'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5',
                  level === 'force' && !selected && 'text-accent/80',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <p
        className={cn(
          'text-xs leading-snug',
          focused === 'force' ? 'text-accent/80' : 'text-neutral-500'
        )}
        aria-live="polite"
      >
        <span className="font-medium text-neutral-400">{focusedPreset.label}：</span>
        {focusedPreset.tagline}
      </p>
    </div>
  );
}
