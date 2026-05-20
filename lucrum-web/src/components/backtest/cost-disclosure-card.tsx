"use client";

/**
 * Cost Disclosure Card
 *
 * Surfaces the transaction-cost profile a backtest actually ran with and
 * compares each field against `STANDARD_MARKETPLACE_COSTS`. Renders 4
 * chips (commission / stamp duty / slippage / adjustment basis) so the
 * user can tell at a glance whether the result is comparable to other
 * marketplace listings.
 *
 * - Green ✓ chip when the field matches the published baseline.
 * - Yellow ⚠ chip when the field is non-standard; tooltip explains the
 *   delta so the user knows by how much their numbers are non-comparable.
 *
 * The card is intentionally compact (~32px high collapsed) so it can sit
 * directly under the StaleDataBanner without crowding the results header.
 *
 * @module components/backtest/cost-disclosure-card
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  STANDARD_MARKETPLACE_COSTS,
  type TransactionCosts,
} from "@/lib/backtest/transaction-costs";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Subset of cost fields actually applied to the run. */
  costs?: Partial<TransactionCosts> | null;
  /** Single-line dense layout — no expandable body. */
  compact?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ChipId = "commission" | "stampDuty" | "slippage" | "adjustment";

interface ChipState {
  id: ChipId;
  label: string;
  actualText: string;
  standardText: string;
  matches: boolean;
  /** Sentence shown in tooltip / expanded body when non-standard. */
  delta?: string;
}

const EPS = 1e-9;

function pctText(rate: number, digits = 3): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

function buildChips(supplied: Partial<TransactionCosts> | null | undefined): ChipState[] {
  // When the engine wasn't given an override field, treat as the
  // marketplace standard (engine substitutes the same defaults).
  const commission = supplied?.commission ?? STANDARD_MARKETPLACE_COSTS.commission;
  const stampDuty = supplied?.stampDuty ?? STANDARD_MARKETPLACE_COSTS.stampDuty;
  const slippage = supplied?.slippage ?? STANDARD_MARKETPLACE_COSTS.slippage;

  const match = (a: number, b: number) =>
    Number.isFinite(a) && Math.abs(a - b) <= EPS;

  return [
    {
      id: "commission",
      label: "佣金",
      actualText: pctText(commission),
      standardText: pctText(STANDARD_MARKETPLACE_COSTS.commission),
      matches: match(commission, STANDARD_MARKETPLACE_COSTS.commission),
      delta: match(commission, STANDARD_MARKETPLACE_COSTS.commission)
        ? undefined
        : `当前 ${pctText(commission)} ≠ 市场标准 ${pctText(
            STANDARD_MARKETPLACE_COSTS.commission,
          )}，发布到市场前需对齐到标准。`,
    },
    {
      id: "stampDuty",
      label: "印花税",
      actualText: pctText(stampDuty, 2),
      standardText: pctText(STANDARD_MARKETPLACE_COSTS.stampDuty, 2),
      matches: match(stampDuty, STANDARD_MARKETPLACE_COSTS.stampDuty),
      delta: match(stampDuty, STANDARD_MARKETPLACE_COSTS.stampDuty)
        ? undefined
        : `当前 ${pctText(stampDuty, 2)} ≠ 2023-08-28 后单边卖出 ${pctText(
            STANDARD_MARKETPLACE_COSTS.stampDuty,
            2,
          )}。`,
    },
    {
      id: "slippage",
      label: "滑点",
      actualText: pctText(slippage, 2),
      standardText: pctText(STANDARD_MARKETPLACE_COSTS.slippage, 2),
      matches: match(slippage, STANDARD_MARKETPLACE_COSTS.slippage),
      delta: match(slippage, STANDARD_MARKETPLACE_COSTS.slippage)
        ? undefined
        : `当前 ${pctText(slippage, 2)} ≠ 保守散户中盘估计 ${pctText(
            STANDARD_MARKETPLACE_COSTS.slippage,
            2,
          )}。`,
    },
    // Adjustment basis: the engine always runs on forward-adjusted closes
    // for now, so this is a static "standard" chip. Surfacing it makes the
    // disclosure feel complete and seeds the slot for a future dividend
    // / split toggle.
    {
      id: "adjustment",
      label: "复权口径",
      actualText: "前复权",
      standardText: "前复权",
      matches: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostDisclosureCard({ costs, compact = false, className }: Props) {
  const chips = useMemo(() => buildChips(costs ?? null), [costs]);
  const allMatch = chips.every((c) => c.matches);
  const [expanded, setExpanded] = useState(false);

  const rowToggle = () => {
    if (compact) return;
    setExpanded((v) => !v);
  };

  return (
    <div
      className={cn(
        "rounded-lg border text-xs",
        allMatch
          ? "border-profit/20 bg-profit/5"
          : "border-yellow-500/30 bg-yellow-500/5",
        className,
      )}
    >
      <button
        type="button"
        onClick={rowToggle}
        disabled={compact}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-left",
          !compact && "hover:bg-white/[0.02] transition",
        )}
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "shrink-0 text-[10px] uppercase tracking-wide font-mono",
            allMatch ? "text-profit" : "text-yellow-400",
          )}
        >
          {allMatch ? "成本合规" : "成本偏离"}
        </span>
        <div className="flex flex-wrap gap-1.5 flex-1">
          {chips.map((chip) => (
            <Chip key={chip.id} chip={chip} />
          ))}
        </div>
        {!compact && (
          <svg
            className={cn(
              "w-3.5 h-3.5 text-white/40 transition-transform shrink-0",
              expanded && "rotate-180",
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {!compact && expanded && (
        <div className="px-3 pb-2.5 pt-1 border-t border-white/5 space-y-2 text-white/70">
          <p className="text-[11px]">
            发布到市场要求与下方<strong className="text-white/90">市场标准</strong>一致；
            自定义参数会影响 Sharpe/收益的可比性。法规依据：
            <span className="text-white/50">CSRC 60 号文（佣金/印花税）</span>。
          </p>
          <table className="w-full text-[11px] tabular-nums">
            <thead className="text-white/40">
              <tr>
                <th className="text-left font-normal py-0.5">项目</th>
                <th className="text-right font-normal py-0.5">当前</th>
                <th className="text-right font-normal py-0.5">市场标准</th>
                <th className="text-right font-normal py-0.5">状态</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {chips.map((chip) => (
                <tr key={chip.id} className="border-t border-white/5">
                  <td className="py-1 font-sans">{chip.label}</td>
                  <td className="py-1 text-right">{chip.actualText}</td>
                  <td className="py-1 text-right text-white/50">{chip.standardText}</td>
                  <td className="py-1 text-right">
                    {chip.matches ? (
                      <span className="text-profit">✓ 标准</span>
                    ) : (
                      <span className="text-yellow-400">⚠ 自定义</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!allMatch && (
            <ul className="text-[11px] text-white/60 list-disc list-inside space-y-0.5">
              {chips
                .filter((c) => !c.matches && c.delta)
                .map((c) => (
                  <li key={c.id}>{c.delta}</li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

function Chip({ chip }: { chip: ChipState }) {
  const matches = chip.matches;
  const title = matches
    ? `${chip.label}：${chip.actualText}（市场标准）`
    : `${chip.label}：${chip.actualText}（市场标准 ${chip.standardText}）`;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono tabular-nums text-[10px]",
        matches
          ? "bg-profit/15 text-profit"
          : "bg-yellow-500/15 text-yellow-300",
      )}
    >
      <span aria-hidden="true">{matches ? "✓" : "⚠"}</span>
      <span className="text-white/70 font-sans">{chip.label}</span>
      <span>{chip.actualText}</span>
    </span>
  );
}

export default CostDisclosureCard;
