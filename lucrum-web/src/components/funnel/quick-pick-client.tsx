'use client';

/**
 * QuickPickClient — L1 entry point.
 *
 * Goal: user clicks ONE button and gets a Top-N stock list with a
 * justification for each pick. Defaults are pre-filled; every input
 * is optional.
 *
 * State:
 *   - selectedPackId          (auto-selected default; user can change)
 *   - universeKind/sectorCode (dropdown; sensible defaults)
 *   - topN                    (hidden; default 10)
 *
 * The panel shows three rows once a run starts:
 *   1. Pack header (name + tagline + expected profile)
 *   2. StageProgress (live)
 *   3. Results list (StockResultCard × N)
 *
 * @module components/funnel/quick-pick-client
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PackCard } from './pack-card';
import { StageProgress } from './stage-progress';
import { StockResultCard } from './stock-result-card';
import { useFunnelStream } from '@/hooks/use-funnel-stream';
import type { StrategyPack, StrategyPackId } from '@/lib/strategy-packs';

interface QuickPickClientProps {
  readonly packs: ReadonlyArray<StrategyPack>;
  readonly defaultPackId?: StrategyPackId;
}

interface UniverseOption {
  readonly label: string;
  readonly kind: 'sector' | 'symbols';
  readonly sectorCode?: string;
  readonly symbols?: ReadonlyArray<string>;
}

/**
 * Defaults pick well-known sector concept codes. If a code happens to
 * have no snapshot yet, the funnel's Universe stage emits a warning and
 * returns an empty candidate set — the UI surfaces the warning instead
 * of a silent empty result.
 */
const DEFAULT_UNIVERSES: ReadonlyArray<UniverseOption> = [
  { label: '新能源', kind: 'sector', sectorCode: 'BK0478' },
  { label: '半导体', kind: 'sector', sectorCode: 'BK0735' },
  { label: '医药生物', kind: 'sector', sectorCode: 'BK0727' },
  { label: '银行', kind: 'sector', sectorCode: 'BK0475' },
  { label: '白酒', kind: 'sector', sectorCode: 'BK0838' },
  { label: '人工智能', kind: 'sector', sectorCode: 'BK1036' },
];

export function QuickPickClient({ packs, defaultPackId }: QuickPickClientProps) {
  const [selectedPackId, setSelectedPackId] = useState<StrategyPackId>(
    defaultPackId ?? packs[0]?.id ?? 'growth-momentum'
  );
  const [universeIdx, setUniverseIdx] = useState(0);
  const { status, packMeta, stageEvals, candidates, result, error, run, abort } =
    useFunnelStream();

  const isRunning = status === 'running';
  const hasResults =
    status === 'done' || (status === 'running' && candidates.length > 0);

  const selectedPack = useMemo(
    () => packs.find((p) => p.id === selectedPackId),
    [packs, selectedPackId]
  );
  const selectedUniverse =
    DEFAULT_UNIVERSES[universeIdx] ?? DEFAULT_UNIVERSES[0];

  const handleRun = () => {
    if (!selectedUniverse) return;
    run({
      packId: selectedPackId,
      universe: {
        kind: selectedUniverse.kind,
        sectorCode: selectedUniverse.sectorCode,
        symbols: selectedUniverse.symbols ? [...selectedUniverse.symbols] : undefined,
      },
      topN: 10,
    });
  };

  useEffect(() => () => abort(), [abort]);

  const resultList = result?.candidates ?? candidates;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">1. 选一个风格</h2>
          <p className="text-sm text-neutral-400">
            默认已为你选好；不认可就换一个。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              selected={pack.id === selectedPackId}
              onSelect={setSelectedPackId}
              disabled={isRunning}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">2. 选一个股票池</h2>
          <p className="text-sm text-neutral-400">
            在这个范围内选 10 只。
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
              disabled={!selectedPack || !selectedUniverse}
            >
              给我选 10 只
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={abort}>
              取消
            </Button>
          )}
          {selectedPack && (
            <span className="text-sm text-neutral-400">
              使用 <strong className="text-white">{selectedPack.name}</strong>{' '}
              风格扫描{' '}
              <strong className="text-white">{selectedUniverse?.label}</strong>
            </span>
          )}
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
              选股漏斗跑完了，但没有留下候选。
              常见原因：板块历史快照未回填（PIT ETL 未运行），或硬过滤太严。
            </div>
          )}
        </section>
      )}
    </div>
  );
}
