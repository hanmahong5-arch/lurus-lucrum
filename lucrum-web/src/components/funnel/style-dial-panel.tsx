'use client';

/**
 * StyleDialPanel — L2 three-slider risk style dial.
 *
 * Three continuous axes: yield (保本↔进取), concentration (分散↔集中),
 * horizon (短线↔长线). Each slider has left/right descriptive labels so
 * the user sees the semantic meaning of the scale without needing to
 * remember 0 vs 100 direction.
 *
 * @module components/funnel/style-dial-panel
 */

import { Slider } from '@/components/ui/slider';
import type { StyleDial } from '@/lib/strategy-packs';

export interface StyleDialPanelProps {
  readonly value: StyleDial;
  readonly onChange: (next: StyleDial) => void;
  readonly disabled?: boolean;
}

interface AxisConfig {
  readonly key: keyof StyleDial;
  readonly title: string;
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly hint: string;
}

const AXES: ReadonlyArray<AxisConfig> = [
  {
    key: 'yield',
    title: '1. 收益 vs. 稳健',
    leftLabel: '保本优先',
    rightLabel: '收益进取',
    hint: '左端偏价值蓝筹 + 低波动，右端偏动量 + 成长。',
  },
  {
    key: 'concentration',
    title: '2. 分散 vs. 集中',
    leftLabel: '分散 Top20',
    rightLabel: '集中 Top5',
    hint: '左端持仓分散、单股敞口小；右端重仓龙头、波动放大。',
  },
  {
    key: 'horizon',
    title: '3. 短线 vs. 长线',
    leftLabel: '短线 (月内)',
    rightLabel: '长线 (季度+)',
    hint: '左端看短周期动量 + 流动性，右端看长周期估值 + 质量。',
  },
];

export function StyleDialPanel({
  value,
  onChange,
  disabled = false,
}: StyleDialPanelProps) {
  const set = (key: keyof StyleDial, v: number) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      {AXES.map((axis) => (
        <div
          key={axis.key}
          className="rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-sm font-semibold text-white">{axis.title}</h3>
            <div className="flex items-baseline gap-2 text-xs text-neutral-400">
              <span>{axis.leftLabel}</span>
              <span className="text-neutral-700">·</span>
              <span>{axis.rightLabel}</span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-2">{axis.hint}</p>
          <Slider
            value={value[axis.key]}
            onValueChange={(v) => set(axis.key, v)}
            min={0}
            max={100}
            step={1}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
