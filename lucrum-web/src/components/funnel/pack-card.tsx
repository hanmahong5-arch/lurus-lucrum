'use client';

/**
 * PackCard — compact preset-pack selector tile.
 *
 * Used in L1 Quick Pick and L2 Style Dial surfaces. Two visual states:
 * `selected` (accent glow + border) and resting. Click emits the pack
 * id upstream via onSelect.
 *
 * @module components/funnel/pack-card
 */

import { cn } from '@/lib/utils';
import type { StrategyPack } from '@/lib/strategy-packs';

export interface PackCardProps {
  readonly pack: StrategyPack;
  readonly selected?: boolean;
  readonly onSelect?: (packId: StrategyPack['id']) => void;
  /** Optional fit % from regime recommender (0-1). */
  readonly fit?: number;
  readonly disabled?: boolean;
}

const RISK_COLOR: Record<string, string> = {
  低风险: 'text-profit',
  中风险: 'text-accent',
  高风险: 'text-loss',
};

export function PackCard({
  pack,
  selected = false,
  onSelect,
  fit,
  disabled = false,
}: PackCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onSelect?.(pack.id)}
      className={cn(
        'group relative text-left w-full rounded-lg border p-4 transition-all duration-200',
        'bg-surface hover:bg-surface-hover',
        selected
          ? 'border-accent shadow-lg shadow-accent/20'
          : 'border-border hover:border-accent/50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white truncate">
              {pack.name}
            </h3>
            <span
              className={cn(
                'text-xs font-medium',
                RISK_COLOR[pack.riskLevel] ?? 'text-neutral-400'
              )}
            >
              {pack.riskLevel}
            </span>
          </div>
          <p className="text-sm text-neutral-400 mt-1">{pack.tagline}</p>
        </div>
        {fit !== undefined && (
          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs text-neutral-500">适配度</span>
            <span className="text-lg font-mono tabular-nums text-accent">
              {Math.round(fit * 100)}%
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-neutral-500">持仓</div>
          <div className="text-neutral-200">{pack.holdingHorizon}</div>
        </div>
        <div>
          <div className="text-neutral-500">年化</div>
          <div className="text-neutral-200 font-mono tabular-nums">
            {pack.expectedProfile.annualReturn}
          </div>
        </div>
        <div>
          <div className="text-neutral-500">回撤</div>
          <div className="text-neutral-200 font-mono tabular-nums">
            {pack.expectedProfile.maxDrawdown}
          </div>
        </div>
      </div>

      {selected && (
        <div className="absolute top-3 right-3 text-accent text-xs font-semibold">
          ● 已选
        </div>
      )}
    </button>
  );
}
