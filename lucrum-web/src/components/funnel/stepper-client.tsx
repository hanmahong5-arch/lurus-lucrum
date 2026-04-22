'use client';

/**
 * StepperClient — L3 four-step wizard for custom selection.
 *
 * Steps:
 *   1. Universe       — sector/symbols
 *   2. Base Pack      — pick preset as starting point
 *   3. Tuning         — factor weights, topN, leaderWeight, hard filter
 *   4. Review & Run   — summary + SSE run
 *
 * All knobs bound server-side via /api/strategy-packs/custom; client
 * only sends basePackId + sparse override. Advancement is gated per
 * step.
 *
 * @module components/funnel/stepper-client
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { PackCard } from './pack-card';
import { StageProgress } from './stage-progress';
import { StockResultCard } from './stock-result-card';
import { useFunnelStream } from '@/hooks/use-funnel-stream';
import type {
  StrategyPack,
  StrategyPackId,
} from '@/lib/strategy-packs/types';

export interface FactorMeta {
  readonly id: string;
  readonly name: string;
  readonly category: string;
}

export interface StepperClientProps {
  readonly packs: ReadonlyArray<StrategyPack>;
  readonly factors: ReadonlyArray<FactorMeta>;
}

interface UniverseOption {
  readonly label: string;
  readonly kind: 'sector' | 'symbols';
  readonly sectorCode?: string;
  readonly symbols?: ReadonlyArray<string>;
}

const DEFAULT_UNIVERSES: ReadonlyArray<UniverseOption> = [
  { label: '新能源', kind: 'sector', sectorCode: 'BK0478' },
  { label: '半导体', kind: 'sector', sectorCode: 'BK0735' },
  { label: '医药生物', kind: 'sector', sectorCode: 'BK0727' },
  { label: '银行', kind: 'sector', sectorCode: 'BK0475' },
  { label: '白酒', kind: 'sector', sectorCode: 'BK0838' },
  { label: '人工智能', kind: 'sector', sectorCode: 'BK1036' },
];

const STEPS: ReadonlyArray<{ key: StepKey; label: string }> = [
  { key: 'universe', label: '1. 股票池' },
  { key: 'base', label: '2. 基础风格' },
  { key: 'tune', label: '3. 精调' },
  { key: 'run', label: '4. 运行' },
];

type StepKey = 'universe' | 'base' | 'tune' | 'run';

interface TuningState {
  readonly weights: Record<string, number>;
  readonly topN: number;
  readonly leaderWeight: number;
  readonly klineWindow: number;
  readonly minListingDays: number;
  readonly minMarketCap: number;
}

function toTuningState(pack: StrategyPack): TuningState {
  const weights: Record<string, number> = {};
  for (const fw of pack.factorWeights) weights[fw.factorId] = fw.weight;
  return {
    weights,
    topN: pack.portfolio.topN ?? 10,
    leaderWeight: pack.leaderWeight,
    klineWindow: pack.klineWindow,
    minListingDays: pack.hardFilter.minListingDays ?? 0,
    minMarketCap: pack.hardFilter.minMarketCap ?? 0,
  };
}

export function StepperClient({ packs, factors }: StepperClientProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [universeIdx, setUniverseIdx] = useState(0);
  const [basePackId, setBasePackId] = useState<StrategyPackId>(
    (packs[0]?.id as StrategyPackId) ?? 'growth-momentum'
  );
  const basePack = useMemo(
    () => packs.find((p) => p.id === basePackId),
    [packs, basePackId]
  );
  const [tuning, setTuning] = useState<TuningState>(() =>
    basePack ? toTuningState(basePack) : emptyTuning()
  );

  const {
    status,
    packMeta,
    synthesis,
    stageEvals,
    candidates,
    result,
    error,
    runCustom,
    abort,
  } = useFunnelStream();

  useEffect(() => () => abort(), [abort]);

  const isRunning = status === 'running';
  const resultList = result?.candidates ?? candidates;
  const universe = DEFAULT_UNIVERSES[universeIdx] ?? DEFAULT_UNIVERSES[0];
  const step = STEPS[stepIdx]?.key ?? 'universe';

  const handlePickBasePack = (id: StrategyPackId) => {
    setBasePackId(id);
    const next = packs.find((p) => p.id === id);
    if (next) setTuning(toTuningState(next));
  };

  const buildOverride = () => {
    if (!basePack) return {};
    const factorWeights = Object.entries(tuning.weights)
      .filter(([, w]) => Math.abs(w) >= 0.01)
      .map(([factorId, weight]) => ({
        factorId,
        weight: Math.round(weight * 100) / 100,
      }));
    return {
      factorWeights,
      leaderWeight: tuning.leaderWeight,
      klineWindow: tuning.klineWindow,
      topN: tuning.topN,
      minListingDays: tuning.minListingDays,
      minMarketCap: tuning.minMarketCap,
    };
  };

  const handleRun = () => {
    if (!universe) return;
    runCustom({
      basePackId,
      override: buildOverride(),
      universe: {
        kind: universe.kind,
        sectorCode: universe.sectorCode,
        symbols: universe.symbols ? [...universe.symbols] : undefined,
      },
    });
  };

  const setWeight = (factorId: string, value: number) =>
    setTuning((t) => ({ ...t, weights: { ...t.weights, [factorId]: value } }));

  const factorsByCategory = useMemo(() => {
    const map = new Map<string, FactorMeta[]>();
    for (const f of factors) {
      const bucket = map.get(f.category) ?? [];
      bucket.push(f);
      map.set(f.category, bucket);
    }
    const entries: Array<[string, FactorMeta[]]> = [];
    map.forEach((v, k) => entries.push([k, v]));
    return entries.sort(([a], [b]) => a.localeCompare(b));
  }, [factors]);

  return (
    <div className="space-y-6">
      <StepTabs
        current={stepIdx}
        onChange={setStepIdx}
        disabled={isRunning}
      />

      {step === 'universe' && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">
            选股票池
          </h2>
          <p className="text-sm text-neutral-400 mb-3">
            这是选股发生的范围。选一个板块。
          </p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_UNIVERSES.map((u, i) => (
              <button
                key={u.label}
                type="button"
                onClick={() => setUniverseIdx(i)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md border transition-colors',
                  i === universeIdx
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-neutral-300 hover:border-accent/50'
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
          <NavRow
            onBack={null}
            onNext={() => setStepIdx(1)}
            canNext={!!universe}
          />
        </section>
      )}

      {step === 'base' && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">
            选基础风格
          </h2>
          <p className="text-sm text-neutral-400 mb-3">
            从这里起步；下一步可以继续精调每个因子权重。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {packs.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                selected={pack.id === basePackId}
                onSelect={handlePickBasePack}
              />
            ))}
          </div>
          <NavRow
            onBack={() => setStepIdx(0)}
            onNext={() => setStepIdx(2)}
            canNext={!!basePack}
          />
        </section>
      )}

      {step === 'tune' && basePack && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">精调</h2>
            <p className="text-sm text-neutral-400">
              基准：
              <strong className="text-white ml-1">{basePack.name}</strong>
              。不动的值保留基准设定。
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">组合参数</h3>
            <NumberRow
              label="Top N"
              hint="最终候选数量"
              value={tuning.topN}
              min={1}
              max={50}
              step={1}
              onChange={(v) => setTuning((t) => ({ ...t, topN: v }))}
            />
            <NumberRow
              label="龙头权重"
              hint="0=不看龙头, 1=完全靠龙头"
              value={tuning.leaderWeight}
              min={0}
              max={1}
              step={0.05}
              decimals={2}
              onChange={(v) =>
                setTuning((t) => ({ ...t, leaderWeight: v }))
              }
            />
            <NumberRow
              label="K线窗口"
              hint="回看多少个交易日"
              value={tuning.klineWindow}
              min={60}
              max={520}
              step={10}
              onChange={(v) =>
                setTuning((t) => ({ ...t, klineWindow: v }))
              }
            />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">硬过滤</h3>
            <NumberRow
              label="最低上市天数"
              hint="刚上市的次新股过滤掉"
              value={tuning.minListingDays}
              min={0}
              max={1500}
              step={30}
              onChange={(v) =>
                setTuning((t) => ({ ...t, minListingDays: v }))
              }
            />
            <NumberRow
              label="最低市值 (亿)"
              hint="太小的壳股/妖股过滤掉"
              value={tuning.minMarketCap}
              min={0}
              max={2000}
              step={10}
              onChange={(v) =>
                setTuning((t) => ({ ...t, minMarketCap: v }))
              }
            />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">因子权重</h3>
            {factorsByCategory.map(([category, list]) => (
              <div key={category} className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-neutral-500">
                  {category}
                </div>
                {list.map((f) => (
                  <NumberRow
                    key={f.id}
                    label={f.name}
                    hint={f.id}
                    value={tuning.weights[f.id] ?? 0}
                    min={-2}
                    max={2}
                    step={0.1}
                    decimals={2}
                    onChange={(v) => setWeight(f.id, v)}
                  />
                ))}
              </div>
            ))}
          </div>

          <NavRow
            onBack={() => setStepIdx(1)}
            onNext={() => setStepIdx(3)}
            canNext={true}
          />
        </section>
      )}

      {step === 'run' && basePack && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              确认并运行
            </h2>
            <p className="text-sm text-neutral-400">
              基准 <strong className="text-white">{basePack.name}</strong>{' '}
              + 自定义精调，在{' '}
              <strong className="text-white">{universe?.label}</strong> 选股。
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <KV label="Top N" value={tuning.topN} />
              <KV
                label="龙头权重"
                value={tuning.leaderWeight.toFixed(2)}
              />
              <KV label="K线窗口" value={tuning.klineWindow} />
              <KV label="最低上市天数" value={tuning.minListingDays} />
              <KV label="最低市值 (亿)" value={tuning.minMarketCap} />
              <KV
                label="激活因子"
                value={
                  Object.values(tuning.weights).filter(
                    (w) => Math.abs(w) >= 0.01
                  ).length
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isRunning ? (
              <Button variant="primary" size="lg" onClick={handleRun}>
                运行选股
              </Button>
            ) : (
              <Button variant="outline" size="lg" onClick={abort}>
                取消
              </Button>
            )}
            <Button
              variant="outline"
              size="md"
              onClick={() => setStepIdx(2)}
              disabled={isRunning}
            >
              返回精调
            </Button>
          </div>

          {(isRunning || resultList.length > 0 || error) && (
            <div className="bg-surface rounded-lg border border-border p-4 space-y-4">
              {packMeta && (
                <header>
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-xl font-semibold text-white">
                      {packMeta.name}
                    </h3>
                    <span className="text-sm text-neutral-400">
                      {packMeta.tagline}
                    </span>
                  </div>
                  {synthesis && (
                    <div className="mt-2 text-xs text-neutral-500 font-mono tabular-nums">
                      topN={synthesis.topN} · leader=
                      {synthesis.leaderWeight} · kline=
                      {synthesis.klineWindow} · factors=
                      {synthesis.factorWeights.length}
                    </div>
                  )}
                </header>
              )}

              <StageProgress evals={stageEvals} running={isRunning} />

              {error && (
                <div className="text-sm text-loss border border-loss/30 rounded p-2">
                  {error}
                </div>
              )}

              {resultList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-neutral-400">
                    Top {resultList.length}
                    {isRunning && ' (实时更新中...)'}
                  </div>
                  {resultList.map((c, idx) => (
                    <StockResultCard
                      key={c.symbol}
                      rank={idx + 1}
                      candidate={c}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StepTabs({
  current,
  onChange,
  disabled,
}: {
  current: number;
  onChange: (i: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((s, i) => (
        <button
          key={s.key}
          type="button"
          onClick={() => !disabled && onChange(i)}
          disabled={disabled}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md border transition-colors shrink-0',
            i === current
              ? 'border-accent bg-accent/10 text-accent'
              : i < current
              ? 'border-profit/40 text-profit/80 hover:border-profit'
              : 'border-border text-neutral-500 hover:border-accent/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  canNext,
}: {
  onBack: (() => void) | null;
  onNext: (() => void) | null;
  canNext: boolean;
}) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <div>
        {onBack && (
          <Button variant="outline" size="md" onClick={onBack}>
            上一步
          </Button>
        )}
      </div>
      <div>
        {onNext && (
          <Button
            variant="primary"
            size="md"
            onClick={onNext}
            disabled={!canNext}
          >
            下一步
          </Button>
        )}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm font-mono tabular-nums text-white">{value}</div>
    </div>
  );
}

function NumberRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  decimals = 0,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  const displayValue =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-sm text-neutral-200">{label}</span>
          {hint && (
            <span className="ml-2 text-xs text-neutral-500 font-mono">
              {hint}
            </span>
          )}
        </div>
        <span className="text-sm font-mono tabular-nums text-accent">
          {displayValue}
        </span>
      </div>
      <Slider
        value={value}
        onValueChange={onChange}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

function emptyTuning(): TuningState {
  return {
    weights: {},
    topN: 10,
    leaderWeight: 0.2,
    klineWindow: 260,
    minListingDays: 120,
    minMarketCap: 30,
  };
}
