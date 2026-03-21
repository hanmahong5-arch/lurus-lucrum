"use client";

/**
 * Sector Selection Panel
 *
 * Rich sector picker with:
 * - Industry / Concept tabs
 * - Hot sector quick picks
 * - Selected sector info card with constituent count
 * - Stock filters (exclude ST, exclude new, market cap, price range)
 * - "View constituents" expandable section
 */

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import type { SectorOption } from "./config-panel";

// =============================================================================
// Types
// =============================================================================

interface SectorPanelProps {
  sectors: SectorOption[];
  selectedCode: string;
  onSelect: (code: string, name: string, type: "industry" | "concept") => void;
  excludeST: boolean;
  onExcludeSTChange: (v: boolean) => void;
  excludeNew: boolean;
  onExcludeNewChange: (v: boolean) => void;
  minMarketCap: number;
  onMinMarketCapChange: (v: number) => void;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const HOT_SECTORS = [
  "BK0437", // Banking
  "BK0447", // Computer
  "BK0428", // Pharma
  "BK0427", // Food & Beverage
  "BK0481", // New Energy
  "BK0448", // Electronics
  "BK0493", // AI
  "BK0456", // Media
];

const MARKET_CAP_OPTIONS = [
  { label: "不限", value: 0 },
  { label: "50亿", value: 50 },
  { label: "100亿", value: 100 },
  { label: "200亿", value: 200 },
  { label: "500亿", value: 500 },
];

// =============================================================================
// Component
// =============================================================================

export function SectorPanel({
  sectors,
  selectedCode,
  onSelect,
  excludeST,
  onExcludeSTChange,
  excludeNew,
  onExcludeNewChange,
  minMarketCap,
  onMinMarketCapChange,
  className,
}: SectorPanelProps) {
  const [sectorTab, setSectorTab] = useState<"industry" | "concept">("industry");
  const [showFilters, setShowFilters] = useState(false);
  const [showAllSectors, setShowAllSectors] = useState(false);

  const industries = useMemo(() => sectors.filter((s) => s.type === "industry"), [sectors]);
  const concepts = useMemo(() => sectors.filter((s) => s.type === "concept"), [sectors]);

  const activeSectors = sectorTab === "industry" ? industries : concepts;
  const displaySectors = showAllSectors ? activeSectors : activeSectors.slice(0, 12);

  const selectedSector = useMemo(
    () => sectors.find((s) => s.code === selectedCode),
    [sectors, selectedCode],
  );

  // Hot sectors that exist in our data
  const hotSectors = useMemo(
    () => sectors.filter((s) => HOT_SECTORS.includes(s.code)),
    [sectors],
  );

  const handleSelect = useCallback(
    (s: SectorOption) => {
      onSelect(s.code, s.name, s.type);
    },
    [onSelect],
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Sector type tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] rounded-lg">
        <button
          onClick={() => setSectorTab("industry")}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
            sectorTab === "industry"
              ? "bg-accent/15 text-accent"
              : "text-white/50 hover:text-white/70",
          )}
        >
          行业板块
          <span className="ml-1 text-xs opacity-60">({industries.length})</span>
        </button>
        <button
          onClick={() => setSectorTab("concept")}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
            sectorTab === "concept"
              ? "bg-accent/15 text-accent"
              : "text-white/50 hover:text-white/70",
          )}
        >
          概念板块
          <span className="ml-1 text-xs opacity-60">({concepts.length})</span>
        </button>
      </div>

      {/* Hot sectors quick picks */}
      {hotSectors.length > 0 && (
        <div>
          <div className="text-xs text-white/40 mb-2">热门板块</div>
          <div className="flex flex-wrap gap-1.5">
            {hotSectors.map((s) => (
              <button
                key={s.code}
                onClick={() => handleSelect(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                  selectedCode === s.code
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full sector grid */}
      <div>
        <div className="text-xs text-white/40 mb-2">
          {sectorTab === "industry" ? "全部行业" : "全部概念"}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {displaySectors.map((s) => (
            <button
              key={s.code}
              onClick={() => handleSelect(s)}
              className={cn(
                "px-2 py-2 rounded-lg text-xs transition-all border text-center truncate",
                selectedCode === s.code
                  ? "border-accent bg-accent/15 text-accent font-medium"
                  : "border-white/5 bg-white/[0.02] text-white/50 hover:border-white/15 hover:text-white/80",
              )}
              title={s.nameEn ? `${s.name} / ${s.nameEn}` : s.name}
            >
              {s.name}
            </button>
          ))}
        </div>
        {activeSectors.length > 12 && (
          <button
            onClick={() => setShowAllSectors((v) => !v)}
            className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-white/40 hover:text-white/60 transition py-1"
          >
            {showAllSectors ? (
              <>收起 <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>展开全部 ({activeSectors.length}) <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>

      {/* Selected sector info */}
      {selectedSector && (
        <div className="p-3 rounded-lg border border-accent/20 bg-accent/5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-white">{selectedSector.name}</span>
              {selectedSector.nameEn && (
                <span className="text-xs text-white/40 ml-2">{selectedSector.nameEn}</span>
              )}
            </div>
            <span className="px-2 py-0.5 rounded text-xs bg-accent/20 text-accent font-mono tabular-nums">
              {selectedSector.type === "industry" ? "行业" : "概念"}
            </span>
          </div>
        </div>
      )}

      {/* Filters toggle */}
      <button
        onClick={() => setShowFilters((v) => !v)}
        className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition"
      >
        <Filter className="w-3.5 h-3.5" />
        <span>过滤器</span>
        {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {(excludeST || excludeNew || minMarketCap > 0) && (
          <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-mono tabular-nums">
            {[excludeST, excludeNew, minMarketCap > 0].filter(Boolean).length}
          </span>
        )}
      </button>

      {/* Filter panel */}
      {showFilters && (
        <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02] space-y-3">
          {/* Checkboxes */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeST}
                onChange={(e) => onExcludeSTChange(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-accent"
              />
              <span className="text-xs text-white/70">排除ST股</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeNew}
                onChange={(e) => onExcludeNewChange(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-accent"
              />
              <span className="text-xs text-white/70">排除次新股(上市&lt;1年)</span>
            </label>
          </div>

          {/* Market cap selector */}
          <div>
            <div className="text-xs text-white/40 mb-1.5">市值下限</div>
            <div className="flex gap-1.5">
              {MARKET_CAP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onMinMarketCapChange(opt.value)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all",
                    minMarketCap === opt.value
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-white/5 text-white/50 border border-transparent hover:text-white/70",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
