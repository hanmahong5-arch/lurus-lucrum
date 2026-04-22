'use client';

/**
 * StyleDialClient — L2 surface: three sliders drive a synthesized pack.
 *
 * Flow:
 *   1. User adjusts sliders → local state updates instantly.
 *   2. Server receives only the 3 numbers and synthesizes the pack.
 *   3. pack-meta frame streams back with the synthesized factorWeights,
 *      so the user sees what their dial actually produced.
 *
 * @module components/funnel/style-dial-client
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StyleDialPanel } from './style-dial-panel';
import { StageProgress } from './stage-progress';
import { StockResultCard } from './stock-result-card';
import { useFunnelStream } from '@/hooks/use-funnel-stream';
import {
  DEFAULT_DIAL,
  type StyleDial,
} from '@/lib/strategy-packs/style-dial';

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

export function StyleDialClient() {
  const [dial, setDial] = useState<StyleDial>(DEFAULT_DIAL);
  const [universeIdx, setUniverseIdx] = useState(0);
  const {
    status,
    packMeta,
    synthesis,
    stageEvals,
    candidates,
    result,
    error,
    runDial,
    abort,
  } = useFunnelStream();

  const isRunning = status === 'running';
  const hasResults =
    status === 'done' || (status === 'running' && candidates.length > 0);

  const selectedUniverse =
    DEFAULT_UNIVERSES[universeIdx] ?? DEFAULT_UNIVERSES[0];

  const handleRun = () => {
    if (!selectedUniverse) return;
    runDial({
      dial,
      universe: {
        kind: selectedUniverse.kind,
        sectorCode: selectedUniverse.sectorCode,
        symbols: selectedUniverse.symbols
          ? [...selectedUniverse.symbols]
          : undefined,
      },
    });
  };

  useEffect(() => () => abort(), [abort]);

  const resultList = result?.candidates ?? candidates;

  const topFactors = useMemo(() => {
    if (!synthesis) return [];
    return [...synthesis.factorWeights]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }, [synthesis]);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">
            1. 调整你的三滑块
          </h2>
          <p className="text-sm text-neutral-400">
            每个滑块都影响选股逻辑；服务器会根据滑块值合成一个自定义风格包。
          </p>
        </div>
        <StyleDialPanel
          value={dial}
          onChange={setDial}
          disabled={isRunning}
        />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">2. 选一个股票池</h2>
          <p className="text-sm text-neutral-400">
            在这个范围内按你的风格选股。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_UNIVERSES.map((u, i) => (
            <button
              key={u.label}
              type="button"
              onClick={() => setUniverseIdx(i)}
              disabled={isRunning}
              className={
                'px-3 py-1.5 text-sm rounded-md border transition-colors ' +
                (i === universeIdx
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-neutral-300 hover:border-accent/50') +
                (isRunning ? ' opacity-50 cursor-not-allowed' : '')
              }
            >
              {u.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3">
          {!isRunning ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleRun}
              disabled={!selectedUniverse}
            >
              按这个风格选股
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={abort}>
              取消
            </Button>
          )}
          <span className="text-sm text-neutral-400">
            当前设定：
            <strong className="text-white ml-1">
              收益 {dial.yield} · 集中 {dial.concentration} · 时长{' '}
              {dial.horizon}
            </strong>
          </span>
        </div>
      </section>

      {(isRunning || hasResults || error) && (
        <section className="bg-surface rounded-lg border border-border p-4 space-y-4">
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
              <div className="mt-1 flex gap-4 text-xs font-mono tabular-nums text-neutral-400">
                <span>年化 {packMeta.expectedProfile.annualReturn}</span>
                <span>回撤 {packMeta.expectedProfile.maxDrawdown}</span>
                <span>换手 {packMeta.expectedProfile.turnover}</span>
              </div>
              {topFactors.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                  <span className="text-neutral-400">主导因子:</span>
                  {topFactors.map((f) => (
                    <span
                      key={f.factorId}
                      className="font-mono tabular-nums"
                    >
                      {f.factorId} · {f.weight.toFixed(2)}
                    </span>
                  ))}
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

          {status === 'done' && resultList.length === 0 && !error && (
            <div className="text-sm text-neutral-400">
              漏斗跑完但没有留下候选。调低硬过滤强度（向 进取 方向拖）或换一个股票池再试。
            </div>
          )}
        </section>
      )}
    </div>
  );
}
