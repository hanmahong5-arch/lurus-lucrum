"use client";

/**
 * Sector Quick Import Modal
 *
 * Allows users to select a sector and import its constituent stocks
 * into the portfolio. Supports filtering (exclude ST, min market cap)
 * and shows sector info before import.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Layers, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { PortfolioStock } from "@/lib/stores/validation-store";

// =============================================================================
// Types
// =============================================================================

interface SectorQuickImportProps {
  sectors: Array<{ code: string; name: string; type: "industry" | "concept" }>;
  existingSymbols: string[];
  maxImport: number;
  onImport: (stocks: PortfolioStock[]) => void;
  onClose: () => void;
}

interface SectorStockResult {
  symbol: string;
  name: string;
  sector: string;
  isST: boolean;
  marketCap?: number;
}

// =============================================================================
// Component
// =============================================================================

export function SectorQuickImport({
  sectors,
  existingSymbols,
  maxImport,
  onImport,
  onClose,
}: SectorQuickImportProps) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sectorTab, setSectorTab] = useState<"industry" | "concept">("industry");
  const [sectorStocks, setSectorStocks] = useState<SectorStockResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [excludeST, setExcludeST] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const industries = useMemo(
    () => sectors.filter((s) => s.type === "industry"),
    [sectors],
  );
  const concepts = useMemo(
    () => sectors.filter((s) => s.type === "concept"),
    [sectors],
  );
  const activeSectors = sectorTab === "industry" ? industries : concepts;
  const displaySectors = showAll ? activeSectors : activeSectors.slice(0, 16);

  const selectedSectorInfo = useMemo(
    () => sectors.find((s) => s.code === selectedSector),
    [sectors, selectedSector],
  );

  // Fetch sector constituents when a sector is selected
  useEffect(() => {
    if (!selectedSector) {
      setSectorStocks([]);
      return;
    }
    setIsLoading(true);
    fetch(
      `/api/stocks/search?sector=${encodeURIComponent(selectedSector)}&limit=100`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.results) {
          setSectorStocks(
            (data.results as SectorStockResult[]).map((s) => ({
              ...s,
              sector: selectedSectorInfo?.name ?? "",
            })),
          );
        }
      })
      .catch(() => setSectorStocks([]))
      .finally(() => setIsLoading(false));
  }, [selectedSector, selectedSectorInfo?.name]);

  // Filter stocks
  const filteredStocks = useMemo(() => {
    let result = sectorStocks;
    if (excludeST) {
      result = result.filter((s) => !s.isST);
    }
    // Exclude already-added stocks
    const existingSet = new Set(existingSymbols);
    result = result.filter((s) => !existingSet.has(s.symbol));
    return result;
  }, [sectorStocks, excludeST, existingSymbols]);

  const importCount = Math.min(filteredStocks.length, maxImport);

  const handleImportAll = useCallback(() => {
    const toImport: PortfolioStock[] = filteredStocks
      .slice(0, maxImport)
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
      }));
    onImport(toImport);
  }, [filteredStocks, maxImport, onImport]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-surface border border-white/10 rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-white">
              按板块添加股票
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition"
            aria-label="关闭"
          >
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
              <span className="ml-1 text-xs opacity-60">
                ({industries.length})
              </span>
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
              <span className="ml-1 text-xs opacity-60">
                ({concepts.length})
              </span>
            </button>
          </div>

          {/* Sector grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {displaySectors.map((s) => (
              <button
                key={s.code}
                onClick={() => setSelectedSector(s.code)}
                className={cn(
                  "px-2 py-2 rounded-lg text-xs transition-all border text-center truncate",
                  selectedSector === s.code
                    ? "border-accent bg-accent/15 text-accent font-medium"
                    : "border-white/5 bg-white/[0.02] text-white/50 hover:border-white/15 hover:text-white/80",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
          {activeSectors.length > 16 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full flex items-center justify-center gap-1 text-xs text-white/40 hover:text-white/60 transition py-1"
            >
              {showAll ? (
                <>
                  收起 <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  展开全部 ({activeSectors.length}){" "}
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}

          {/* Selected sector info */}
          {selectedSector && (
            <div className="p-3 rounded-lg border border-accent/20 bg-accent/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">
                  {selectedSectorInfo?.name}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-accent/20 text-accent font-mono tabular-nums">
                  {selectedSectorInfo?.type === "industry" ? "行业" : "概念"}
                </span>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  加载成分股...
                </div>
              ) : (
                <>
                  <div className="text-xs text-white/50">
                    找到{" "}
                    <span className="font-mono tabular-nums text-white">
                      {sectorStocks.length}
                    </span>{" "}
                    只成分股, 过滤后可导入{" "}
                    <span className="font-mono tabular-nums text-accent">
                      {importCount}
                    </span>{" "}
                    只
                    {maxImport < filteredStocks.length && (
                      <span className="text-white/30">
                        {" "}
                        (组合容量上限)
                      </span>
                    )}
                  </div>

                  {/* Filter options */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={excludeST}
                        onChange={(e) => setExcludeST(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent"
                      />
                      <span className="text-xs text-white/60">排除ST股</span>
                    </label>
                  </div>

                  {/* Preview list (first 10) */}
                  {filteredStocks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {filteredStocks.slice(0, 10).map((s) => (
                        <span
                          key={s.symbol}
                          className="px-2 py-1 rounded text-xs bg-white/5 text-white/60 font-mono tabular-nums"
                        >
                          {s.symbol}
                        </span>
                      ))}
                      {filteredStocks.length > 10 && (
                        <span className="px-2 py-1 text-xs text-white/30">
                          ...等{filteredStocks.length}只
                        </span>
                      )}
                    </div>
                  )}

                  {filteredStocks.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      该板块无可导入的新股票
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition"
          >
            取消
          </button>
          <button
            onClick={handleImportAll}
            disabled={importCount === 0 || isLoading}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-medium transition-all",
              importCount > 0 && !isLoading
                ? "bg-accent text-void hover:brightness-110 btn-tactile"
                : "bg-white/5 text-white/30 cursor-not-allowed",
            )}
          >
            全部添加 ({importCount})
          </button>
        </div>
      </div>
    </div>
  );
}
