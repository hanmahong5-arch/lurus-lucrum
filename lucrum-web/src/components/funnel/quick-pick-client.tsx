'use client';

/**
 * QuickPickClient — L1 entry point.
 *
 * Goal: user clicks ONE button and gets a Top-N stock list with a
 * justification for each pick. Defaults are pre-filled; every input
 * is optional.
 *
 * Two design moves added in the 2026-05-12 pass to address "selected 0
 * stocks and didn't know why":
 *
 *   1. StrictnessDial — single 4-segment selector that maps to a PackOverride
 *      bundle. Beats forcing users to learn minListingDays / minMarketCap /
 *      topN individually before they can run anything.
 *   2. FunnelDiagnostic — on a 0-candidate completion, surface the stage
 *      that did the cutting + the dominant rule + a one-click "loosen and
 *      retry" CTA. We also remember the previous run's candidate count in
 *      sessionStorage and show a "上次 → 这次" delta when it changes, so
 *      the user can see the impact of their tweaks.
 *
 * @module components/funnel/quick-pick-client
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PackCard } from './pack-card';
import { StageProgress } from './stage-progress';
import { StockResultCard } from './stock-result-card';
import { StrictnessDial } from './strictness-dial';
import { FunnelDiagnostic, type DiagnosticAction } from './funnel-diagnostic';
import { useFunnelStream } from '@/hooks/use-funnel-stream';
import {
  DEFAULT_STRICTNESS,
  nextLooser,
  presetToOverride,
  type StrictnessLevel,
} from '@/lib/funnel/strictness';
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

const DEFAULT_UNIVERSES: ReadonlyArray<UniverseOption> = [
  { label: '新能源', kind: 'sector', sectorCode: 'BK0478' },
  { label: '半导体', kind: 'sector', sectorCode: 'BK0735' },
  { label: '医药生物', kind: 'sector', sectorCode: 'BK0727' },
  { label: '银行', kind: 'sector', sectorCode: 'BK0475' },
  { label: '白酒', kind: 'sector', sectorCode: 'BK0838' },
  { label: '人工智能', kind: 'sector', sectorCode: 'BK1036' },
];

/** sessionStorage key for the last-run candidate count delta marker. */
const LAST_RUN_COUNT_KEY = 'lucrum:funnel:lastCount';

function readLastCount(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LAST_RUN_COUNT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastCount(n: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_RUN_COUNT_KEY, String(n));
  } catch {
    /* storage unavailable — silent fallback */
  }
}

export function QuickPickClient({ packs, defaultPackId }: QuickPickClientProps) {
  const [selectedPackId, setSelectedPackId] = useState<StrategyPackId>(
    defaultPackId ?? packs[0]?.id ?? 'growth-momentum'
  );
  const [universeIdx, setUniverseIdx] = useState(0);
  const [strictness, setStrictness] = useState<StrictnessLevel>(DEFAULT_STRICTNESS);
  /**
   * `lastCount` is the candidate count from the previous *completed* run in
   * this browser session; surfacing it lets the user attribute changes in
   * results to their own knob tweaks rather than guessing.
   */
  const [lastCount, setLastCount] = useState<number | null>(null);
  /** Tracks how many times we've auto-retried inside the current attempt. */
  const [autoRetryDepth, setAutoRetryDepth] = useState(0);
  const MAX_AUTO_RETRIES = 2;

  const {
    status,
    packMeta,
    stageEvals,
    candidates,
    result,
    error,
    runCustom,
    abort,
  } = useFunnelStream();

  const isRunning = status === 'running';
  const hasResults =
    status === 'done' || (status === 'running' && candidates.length > 0);

  const selectedPack = useMemo(
    () => packs.find((p) => p.id === selectedPackId),
    [packs, selectedPackId]
  );
  const selectedUniverse = DEFAULT_UNIVERSES[universeIdx] ?? DEFAULT_UNIVERSES[0];

  useEffect(() => {
    setLastCount(readLastCount());
  }, []);

  // Persist completed-run candidate count for the next session-local visit.
  useEffect(() => {
    if (status === 'done' && result) {
      writeLastCount(result.candidates.length);
    }
  }, [status, result]);

  const runAt = useCallback(
    (level: StrictnessLevel) => {
      if (!selectedUniverse) return;
      const override = presetToOverride(level);
      runCustom({
        basePackId: selectedPackId,
        override,
        universe: {
          kind: selectedUniverse.kind,
          sectorCode: selectedUniverse.sectorCode,
          symbols: selectedUniverse.symbols ? [...selectedUniverse.symbols] : undefined,
        },
      });
    },
    [runCustom, selectedPackId, selectedUniverse]
  );

  const handleRun = useCallback(() => {
    setAutoRetryDepth(0);
    runAt(strictness);
  }, [runAt, strictness]);

  const handleDiagnosticAction = useCallback(
    (action: DiagnosticAction) => {
      if (action.kind === 'relax-strictness') {
        setStrictness(action.to);
        setAutoRetryDepth((d) => d + 1);
        runAt(action.to);
        return;
      }
      if (action.kind === 'universe-fallback' || action.kind === 'change-universe') {
        // No backend universe-fallback yet — surface the suggestion by rotating
        // the universe selector to a different sector. Better than a no-op.
        const nextIdx = (universeIdx + 1) % DEFAULT_UNIVERSES.length;
        setUniverseIdx(nextIdx);
        setAutoRetryDepth((d) => d + 1);
        // Don't auto-run — let user see the new selection before committing.
        return;
      }
      // 'manual' — no-op; the diagnostic already explained the situation.
    },
    [runAt, universeIdx]
  );

  useEffect(() => () => abort(), [abort]);

  const resultList = result?.candidates ?? candidates;
  const currentCount = resultList.length;
  const hasZeroResult =
    status === 'done' && currentCount === 0 && !error && stageEvals.length > 0;
  const canAutoRetry =
    hasZeroResult && nextLooser(strictness) !== null && autoRetryDepth < MAX_AUTO_RETRIES;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">1. 选一个风格</h2>
          <p className="text-sm text-neutral-400">默认已为你选好；不认可就换一个。</p>
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
          <p className="text-sm text-neutral-400">在这个范围内选 10 只。</p>
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
        <StrictnessDial
          value={strictness}
          onChange={setStrictness}
          disabled={isRunning}
        />
      </section>

      <section>
        <div className="flex items-center gap-3 flex-wrap">
          {!isRunning ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleRun}
              disabled={!selectedPack || !selectedUniverse}
            >
              给我选 {presetToOverride(strictness).topN} 只
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={abort}>
              取消
            </Button>
          )}
          {selectedPack && (
            <span className="text-sm text-neutral-400">
              使用 <strong className="text-white">{selectedPack.name}</strong> 风格扫描{' '}
              <strong className="text-white">{selectedUniverse?.label}</strong>
            </span>
          )}
        </div>
      </section>

      {(isRunning || hasResults || error || hasZeroResult) && (
        <section className="bg-surface rounded-lg border border-border p-4 space-y-4">
          {packMeta && (
            <header>
              <div className="flex items-baseline gap-3">
                <h3 className="text-xl font-semibold text-white">{packMeta.name}</h3>
                <span className="text-sm text-neutral-400">{packMeta.tagline}</span>
              </div>
              <div className="mt-1 flex gap-4 text-xs font-mono tabular-nums text-neutral-400">
                <span>年化 {packMeta.expectedProfile.annualReturn}</span>
                <span>回撤 {packMeta.expectedProfile.maxDrawdown}</span>
                <span>换手 {packMeta.expectedProfile.turnover}</span>
              </div>
            </header>
          )}

          {/* Last-vs-current delta — only when both numbers exist and differ */}
          {status === 'done' && lastCount !== null && lastCount !== currentCount && (
            <div className="text-xs text-neutral-500">
              候选数变化：
              <span className="font-mono tabular-nums text-neutral-400">{lastCount}</span>
              {' → '}
              <span
                className={
                  'font-mono tabular-nums ' +
                  (currentCount > lastCount ? 'text-profit' : 'text-loss')
                }
              >
                {currentCount}
              </span>
            </div>
          )}

          <StageProgress evals={stageEvals} running={isRunning} />

          {error && (
            <div className="text-sm text-loss border border-loss/30 rounded p-2">
              {error}
            </div>
          )}

          {/* Diagnostic panel — only on completed 0-result runs */}
          {hasZeroResult && (
            <FunnelDiagnostic
              evals={stageEvals}
              currentLevel={strictness}
              onAct={handleDiagnosticAction}
            />
          )}

          {hasZeroResult && canAutoRetry && (
            <div className="text-[11px] text-neutral-500 leading-relaxed">
              提示：连续 {autoRetryDepth} 次重试仍 0 候选。若仍无结果，建议换板块或检查行情数据回填状态。
            </div>
          )}

          {resultList.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-neutral-400">
                Top {resultList.length}
                {isRunning && ' (实时更新中...)'}
                {autoRetryDepth > 0 && status === 'done' && (
                  <span className="ml-2 text-[11px] text-accent/80">
                    （自动放宽 {autoRetryDepth} 次后才选到 — 当前档位：
                    <span className="font-medium">{strictness}</span>）
                  </span>
                )}
              </div>
              {resultList.map((c, idx) => (
                <StockResultCard key={c.symbol} rank={idx + 1} candidate={c} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
