"use client";

/**
 * Target Selector Component
 * 目标选择器组件
 *
 * Switches between sector selection and individual stock multi-selection
 * 在板块选择和个股多选之间切换
 */

import { StockMultiSelector } from "./stock-multi-selector";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================================
// Types
// ============================================================================

export type SelectionMode = 'sector' | 'stocks';

interface TargetSelectorProps {
  mode: SelectionMode;
  onModeChange: (mode: SelectionMode) => void;

  // Sector mode props
  sectorCode?: string;
  onSectorChange?: (sectorCode: string) => void;
  sectors?: Array<{ code: string; name: string; nameEn: string }>;

  // Stocks mode props
  selectedSymbols?: string[];
  onSymbolsChange?: (symbols: string[]) => void;
  maxStocks?: number;
  excludeST?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function TargetSelector({
  mode,
  onModeChange,
  sectorCode,
  onSectorChange,
  sectors = [],
  selectedSymbols = [],
  onSymbolsChange,
  maxStocks = 100,
  excludeST = false,
}: TargetSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-surface/50 rounded-lg">
        <button
          onClick={() => onModeChange('sector')}
          className={`flex-1 px-4 py-2.5 rounded-md transition-all font-medium ${
            mode === 'sector'
              ? 'bg-gradient-to-r from-accent/90 to-accent text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">📊</span>
            <span>行业板块</span>
          </div>
        </button>
        <button
          onClick={() => onModeChange('stocks')}
          className={`flex-1 px-4 py-2.5 rounded-md transition-all font-medium ${
            mode === 'stocks'
              ? 'bg-gradient-to-r from-accent/90 to-accent text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">🔖</span>
            <span>个股多选</span>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
              NEW
            </span>
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {mode === 'sector' ? (
          <SectorSelector
            sectorCode={sectorCode || ''}
            onSectorChange={onSectorChange || (() => {})}
            sectors={sectors}
          />
        ) : (
          <StockMultiSelector
            selectedSymbols={selectedSymbols}
            onSelectionChange={onSymbolsChange || (() => {})}
            maxStocks={maxStocks}
            excludeST={excludeST}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sector Selector (Using Shadcn Select for better dark theme support)
// ============================================================================

export interface SectorSelectorProps {
  sectorCode: string;
  onSectorChange: (sectorCode: string) => void;
  sectors: Array<{ code: string; name: string; nameEn: string; type?: 'industry' | 'concept' }>;
}

export function SectorSelector({ sectorCode, onSectorChange, sectors }: SectorSelectorProps) {
  // Separate industries and concepts for grouped display
  const industries = sectors.filter(s => s.type === 'industry' || !s.type);
  const concepts = sectors.filter(s => s.type === 'concept');

  // Find selected sector name for display
  const selectedSector = sectors.find(s => s.code === sectorCode);

  return (
    <div className="space-y-3">
      <label className="block text-sm text-gray-300 font-medium">
        选择行业板块 / Select Sector
      </label>
      <Select value={sectorCode} onValueChange={onSectorChange}>
        <SelectTrigger
          className="w-full h-12 px-4 bg-gradient-to-br from-white/10 to-white/5
                     border-2 border-white/20 hover:border-accent/50 rounded-lg
                     text-white text-sm font-medium focus:ring-2 focus:ring-accent/50
                     focus:border-accent transition-all cursor-pointer shadow-lg"
          data-testid="sector-select"
        >
          <SelectValue placeholder="请选择板块 / Please select">
            {selectedSector && (
              <span className="flex items-center gap-2">
                <span>{selectedSector.type === 'concept' ? '💡' : '📊'}</span>
                <span>{selectedSector.name}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          className="bg-surface border-white/20 max-h-80"
          position="popper"
          sideOffset={4}
        >
          {/* Industry Sectors Group */}
          {industries.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-white/50 text-xs px-2 py-1.5">
                📊 行业板块 / Industries
              </SelectLabel>
              {industries.map((sector) => (
                <SelectItem
                  key={sector.code}
                  value={sector.code}
                  className="text-white hover:bg-white/10 focus:bg-accent/20 focus:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-white/60">📊</span>
                    <span>{sector.name}</span>
                    {sector.nameEn && (
                      <span className="text-white/40 text-xs">/ {sector.nameEn}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {/* Concept Sectors Group */}
          {concepts.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-white/50 text-xs px-2 py-1.5 border-t border-white/10 mt-1 pt-2">
                💡 概念板块 / Concepts
              </SelectLabel>
              {concepts.map((sector) => (
                <SelectItem
                  key={sector.code}
                  value={sector.code}
                  className="text-white hover:bg-white/10 focus:bg-accent/20 focus:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-white/60">💡</span>
                    <span>{sector.name}</span>
                    {sector.nameEn && (
                      <span className="text-white/40 text-xs">/ {sector.nameEn}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {sectorCode && (
        <div className="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-accent text-2xl">ℹ️</div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                已选择板块模式，系统将对选定板块内的所有股票进行策略验证。
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Sector mode selected. The system will validate the strategy across all stocks in the selected sector.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
