"use client";

/**
 * Strategy Validation Configuration Panel Component
 * 策略验证配置面板组件
 *
 * Provides controls for selecting strategy, sector, date range, and holding period
 * 提供策略、行业、日期范围和持有天数的选择控件
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TargetSelector, SelectionMode } from "./target-selector";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface ValidationConfig {
  strategy: string;
  // Target selection mode / 目标选择模式
  selectionMode?: 'sector' | 'stocks'; // Selection mode / 选择模式
  // Sector mode / 板块模式
  sectorCode?: string; // Sector code (for sector mode) / 板块代码
  // Stocks mode / 个股模式
  selectedSymbols?: string[]; // Selected stock symbols (for stocks mode) / 选中的股票代码
  startDate: string;
  endDate: string;
  holdingDays: number;
  minMarketCap?: number;
  maxStocks?: number;
  // Enhanced options / 增强选项
  includeTransactionCosts?: boolean; // Include costs in return calc / 收益计算包含成本
  commissionRate?: number; // Commission rate (default 0.03%) / 佣金率
  slippageRate?: number; // Slippage rate (default 0.1%) / 滑点率
  excludeSTStocks?: boolean; // Exclude ST stocks / 排除ST股票
  excludeNewStocks?: boolean; // Exclude new stocks / 排除新股
  minListingDays?: number; // Min days since IPO / 最小上市天数
  deduplicateSignals?: boolean; // Deduplicate consecutive signals / 去重连续信号
  minSignalGapDays?: number; // Min gap between signals / 最小信号间隔天数
  // Signal strength threshold / 信号强度阈值
  enableStrengthFilter?: boolean; // Enable strength filtering / 启用强度过滤
  minSignalStrength?: number; // Min signal strength (0-100) / 最小信号强度
  maxSignalStrength?: number; // Max signal strength for outliers / 最大信号强度（过滤异常值）
}

export interface StrategyOption {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  type?: 'builtin' | 'custom'; // Strategy type: built-in or user-defined
  code?: string;               // Custom strategy code
  parameters?: Record<string, unknown>;
}

export interface SectorOption {
  code: string;
  name: string;
  nameEn: string;
  type: "industry" | "concept";
}

interface ConfigPanelProps {
  strategies: StrategyOption[];
  sectors: SectorOption[];
  onValidate: (config: ValidationConfig) => Promise<void>;
  onCancel?: () => void; // Cancel handler for aborting request / 取消请求的处理函数
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const PRESET_PERIODS = [
  { label: "1周", labelEn: "1W", days: 7 },
  { label: "2周", labelEn: "2W", days: 14 },
  { label: "1个月", labelEn: "1M", days: 30 },
  { label: "3个月", labelEn: "3M", days: 90 },
  { label: "6个月", labelEn: "6M", days: 180 },
  { label: "1年", labelEn: "1Y", days: 365 },
] as const;

const HOLDING_DAYS_OPTIONS = [
  { value: 1, label: "1天" },
  { value: 3, label: "3天" },
  { value: 5, label: "5天" },
  { value: 10, label: "10天" },
  { value: 20, label: "20天" },
] as const;

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Get default date range
 * 获取默认日期范围
 */
function getDefaultDates(days: number = 30): {
  startDate: string;
  endDate: string;
} {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split("T")[0] ?? "",
    endDate: endDate.toISOString().split("T")[0] ?? "",
  };
}

// =============================================================================
// STRATEGY SELECTOR COMPONENT / 策略选择器组件
// =============================================================================

interface StrategySelectorProps {
  strategies: StrategyOption[];
  selectedStrategy: string;
  onStrategyChange: (strategyId: string) => void;
}

/**
 * Strategy Selector with grouped display (User strategies + Built-in strategies)
 * 策略选择器，支持分组显示（用户策略 + 预定义策略）
 */
export function StrategySelector({
  strategies,
  selectedStrategy,
  onStrategyChange,
}: StrategySelectorProps) {
  // Separate user strategies and built-in strategies
  const userStrategies = strategies.filter(s => s.type === 'custom');
  const builtinStrategies = strategies.filter(s => s.type !== 'custom');

  // Find currently selected strategy for description display
  const currentStrategy = strategies.find(s => s.id === selectedStrategy);

  return (
    <div>
      <label className="block text-xs font-medium text-white/60 mb-2">
        📊 选择策略 / Select Strategy
      </label>
      <Select value={selectedStrategy} onValueChange={onStrategyChange}>
        <SelectTrigger
          className="w-full h-11 px-3 bg-gradient-to-br from-white/10 to-white/5
                     border-2 border-white/20 hover:border-accent/50 rounded-lg
                     text-white text-sm font-medium focus:ring-2 focus:ring-accent/50
                     focus:border-accent shadow-lg transition-all cursor-pointer"
          data-testid="strategy-select"
        >
          <SelectValue placeholder="选择策略 / Select a strategy">
            {currentStrategy && (
              <span className="flex items-center gap-2">
                <span>{currentStrategy.type === 'custom' ? '🎯' : '📈'}</span>
                <span>{currentStrategy.name}</span>
                {currentStrategy.nameEn && (
                  <span className="text-white/40 text-xs hidden sm:inline">
                    / {currentStrategy.nameEn}
                  </span>
                )}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          className="bg-surface border-white/20 max-h-80"
          position="popper"
          sideOffset={4}
        >
          {/* User Strategies Group - Show first if available */}
          {userStrategies.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-accent/80 text-xs px-2 py-1.5 font-medium">
                🎯 我的策略 / My Strategies
              </SelectLabel>
              {userStrategies.map((strategy) => (
                <SelectItem
                  key={strategy.id}
                  value={strategy.id}
                  className="text-white hover:bg-white/10 focus:bg-accent/20 focus:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-accent/60">🎯</span>
                    <span className="truncate max-w-[200px]">{strategy.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {/* Built-in Strategies Group */}
          <SelectGroup>
            <SelectLabel className={`text-white/50 text-xs px-2 py-1.5 ${userStrategies.length > 0 ? 'border-t border-white/10 mt-1 pt-2' : ''}`}>
              📊 预定义策略 / Built-in Strategies
            </SelectLabel>
            {builtinStrategies.map((strategy) => (
              <SelectItem
                key={strategy.id}
                value={strategy.id}
                className="text-white hover:bg-white/10 focus:bg-accent/20 focus:text-white cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="text-white/60">📈</span>
                  <span>{strategy.name}</span>
                  {strategy.nameEn && (
                    <span className="text-white/40 text-xs">/ {strategy.nameEn}</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Strategy Description */}
      {currentStrategy && (
        <div className="mt-2 p-2 bg-white/5 rounded border border-white/10">
          <p className="text-xs text-white/50">
            💡 {currentStrategy.description}
          </p>
          {currentStrategy.type === 'custom' && (
            <p className="text-xs text-accent/60 mt-1">
              ✨ 自定义策略 / Custom Strategy
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CONFIG PANEL COMPONENT / 配置面板组件
// =============================================================================

export function ConfigPanel({
  strategies,
  sectors,
  onValidate,
  onCancel,
  isLoading = false,
  className = "",
}: ConfigPanelProps) {
  // Default dates
  const defaultDates = getDefaultDates(30);

  // Form state with enhanced options
  const [config, setConfig] = useState<ValidationConfig>({
    strategy: strategies[0]?.id ?? "macd_golden_cross",
    selectionMode: 'sector', // Default to sector mode
    sectorCode: sectors[0]?.code ?? "BK0420",
    selectedSymbols: [], // Empty array for stocks mode
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    holdingDays: 5,
    maxStocks: 50,
    // Enhanced defaults
    includeTransactionCosts: true,
    commissionRate: 0.0003,
    slippageRate: 0.001,
    excludeSTStocks: true,
    excludeNewStocks: false,
    minListingDays: 60,
    deduplicateSignals: true,
    minSignalGapDays: 3,
    // Signal strength defaults
    enableStrengthFilter: false,
    minSignalStrength: 50,
    maxSignalStrength: 100,
  });

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Date validation
  const dateError =
    config.endDate && config.startDate && config.endDate < config.startDate
      ? "结束日期必须晚于开始日期"
      : null;

  /**
   * Set preset date range
   * 设置预设日期范围
   */
  const setPresetPeriod = useCallback((days: number) => {
    const dates = getDefaultDates(days);
    setConfig((prev) => ({
      ...prev,
      startDate: dates.startDate,
      endDate: dates.endDate,
    }));
  }, []);

  /**
   * Handle form submission
   * 处理表单提交
   */
  const handleSubmit = useCallback(async () => {
    await onValidate(config);
  }, [config, onValidate]);

  /**
   * Get selected strategy details
   * 获取选中策略的详情
   */
  const selectedStrategy = strategies.find((s) => s.id === config.strategy);

  return (
    <div
      className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <span className="text-sm font-medium text-white">
            验证配置 / Validation Config
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Strategy Selection / 策略选择 */}
        <StrategySelector
          strategies={strategies}
          selectedStrategy={config.strategy}
          onStrategyChange={(strategyId) =>
            setConfig((prev) => ({ ...prev, strategy: strategyId }))
          }
        />

        {/* Target Selection (Sector or Stocks) */}
        <div>
          <label className="block text-xs text-white/50 mb-3">
            选择目标 / Select Target
          </label>
          <TargetSelector
            mode={config.selectionMode || 'sector'}
            onModeChange={(mode) =>
              setConfig((prev) => ({ ...prev, selectionMode: mode }))
            }
            sectorCode={config.sectorCode}
            onSectorChange={(sectorCode) =>
              setConfig((prev) => ({ ...prev, sectorCode }))
            }
            sectors={sectors}
            selectedSymbols={config.selectedSymbols || []}
            onSymbolsChange={(symbols) =>
              setConfig((prev) => ({ ...prev, selectedSymbols: symbols }))
            }
            maxStocks={config.maxStocks || 100}
            excludeST={config.excludeSTStocks ?? true}
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-xs text-white/50 mb-2">
            验证区间 / Date Range
          </label>

          {/* Preset Periods */}
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_PERIODS.map((period) => (
              <button
                key={period.days}
                onClick={() => setPresetPeriod(period.days)}
                className="px-2 py-1 text-xs rounded bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-white/30 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={config.startDate}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-white/30 mb-1">
                结束日期
              </label>
              <input
                type="date"
                value={config.endDate}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>
        </div>

        {/* Holding Days */}
        <div>
          <label className="block text-xs text-white/50 mb-2">
            持有天数 / Holding Days
          </label>
          <div className="flex gap-2">
            {HOLDING_DAYS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() =>
                  setConfig((prev) => ({ ...prev, holdingDays: option.value }))
                }
                className={`flex-1 px-2 py-2 text-sm rounded-lg transition ${
                  config.holdingDays === option.value
                    ? "bg-accent text-primary-600 font-medium"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-white/40">
            信号触发后持有的交易日数量 / Trading days to hold after signal
          </p>
        </div>

        {/* Advanced Settings */}
        <details
          open={showAdvanced}
          onToggle={(e) =>
            setShowAdvanced((e.target as HTMLDetailsElement).open)
          }
        >
          <summary className="text-xs text-white/50 cursor-pointer hover:text-white transition">
            高级设置 / Advanced Settings
          </summary>
          <div className="mt-3 space-y-3 p-3 bg-primary/20 rounded-lg">
            {/* Max Stocks */}
            <div>
              <label className="block text-xs text-white/40 mb-1">
                最大股票数量 / Max Stocks
              </label>
              <input
                type="number"
                min={10}
                max={200}
                value={config.maxStocks ?? 50}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxStocks: parseInt(e.target.value) || 50,
                  }))
                }
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
              />
              <p className="mt-1 text-xs text-white/30">
                扫描的最大成分股数量（按市值排序）
              </p>
            </div>

            {/* Min Market Cap */}
            <div>
              <label className="block text-xs text-white/40 mb-1">
                最低市值(亿元) / Min Market Cap
              </label>
              <input
                type="number"
                min={0}
                step={10}
                value={config.minMarketCap ?? 0}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    minMarketCap: parseFloat(e.target.value) || undefined,
                  }))
                }
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
              />
              <p className="mt-1 text-xs text-white/30">
                过滤市值小于此值的股票（0表示不过滤）
              </p>
            </div>

            {/* Transaction Costs Section */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/50">
                  交易成本 / Transaction Costs
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeTransactionCosts ?? true}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        includeTransactionCosts: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-white/20 bg-white/5"
                  />
                  <span className="text-xs text-white/70">启用</span>
                </label>
              </div>

              {config.includeTransactionCosts && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-white/30 mb-1">
                      佣金率%
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={((config.commissionRate ?? 0.0003) * 100).toFixed(
                        2,
                      )}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          commissionRate:
                            parseFloat(e.target.value) / 100 || 0.0003,
                        }))
                      }
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/30 mb-1">
                      滑点率%
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={((config.slippageRate ?? 0.001) * 100).toFixed(1)}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          slippageRate:
                            parseFloat(e.target.value) / 100 || 0.001,
                        }))
                      }
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stock Filters Section */}
            <div className="pt-2 border-t border-white/10">
              <label className="block text-xs text-white/50 mb-2">
                股票过滤 / Stock Filters
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.excludeSTStocks ?? true}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        excludeSTStocks: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-white/20 bg-white/5"
                  />
                  <span className="text-xs text-white/70">排除ST股票</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.excludeNewStocks ?? false}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        excludeNewStocks: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-white/20 bg-white/5"
                  />
                  <span className="text-xs text-white/70">
                    排除新股(上市&lt;{config.minListingDays ?? 60}天)
                  </span>
                </label>
              </div>
            </div>

            {/* Signal Deduplication Section */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/50">
                  信号去重 / Signal Dedup
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.deduplicateSignals ?? true}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        deduplicateSignals: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-white/20 bg-white/5"
                  />
                  <span className="text-xs text-white/70">启用</span>
                </label>
              </div>

              {config.deduplicateSignals && (
                <div>
                  <label className="block text-xs text-white/30 mb-1">
                    最小信号间隔(天)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={config.minSignalGapDays ?? 3}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        minSignalGapDays: parseInt(e.target.value) || 3,
                      }))
                    }
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs"
                  />
                  <p className="mt-1 text-xs text-white/30">
                    间隔小于此天数的连续信号将被合并
                  </p>
                </div>
              )}
            </div>

            {/* Signal Strength Threshold Section */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/50">
                  信号强度过滤 / Strength Filter
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableStrengthFilter ?? false}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        enableStrengthFilter: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-white/20 bg-white/5"
                  />
                  <span className="text-xs text-white/70">启用</span>
                </label>
              </div>

              {config.enableStrengthFilter && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/30 mb-1">
                        最小强度
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={config.minSignalStrength ?? 50}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            minSignalStrength: parseInt(e.target.value) || 50,
                          }))
                        }
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-1">
                        最大强度
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={config.maxSignalStrength ?? 100}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            maxSignalStrength: parseInt(e.target.value) || 100,
                          }))
                        }
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-white/30">
                    过滤信号强度不在范围内的信号（0-100）
                  </p>
                  {/* Strength range visualization */}
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-accent/60 rounded-full"
                      style={{
                        left: `${config.minSignalStrength ?? 50}%`,
                        width: `${(config.maxSignalStrength ?? 100) - (config.minSignalStrength ?? 50)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/20">
                    <span>0 (弱)</span>
                    <span>50 (中)</span>
                    <span>100 (强)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </details>

        {/* Date Error */}
        {dateError && (
          <div className="p-2 bg-loss/10 border border-loss/30 rounded-lg">
            <p className="text-xs text-loss">⚠️ {dateError}</p>
          </div>
        )}

        {/* Submit / Cancel Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !!dateError}
            className="flex-1 gap-2"
            data-testid="start-validation"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
                验证中...
              </>
            ) : (
              <>
                <span>🔍</span>
                开始验证
              </>
            )}
          </Button>
          {isLoading && onCancel && (
            <Button
              onClick={onCancel}
              variant="outline"
              className="px-4"
              data-testid="cancel-validation"
            >
              取消
            </Button>
          )}
        </div>

        {/* Config Summary */}
        <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
          <div className="text-xs text-white/50 space-y-1">
            <div className="flex justify-between">
              <span>策略:</span>
              <span className="text-accent">
                {selectedStrategy?.name ?? config.strategy}
              </span>
            </div>
            <div className="flex justify-between">
              <span>目标:</span>
              <span className="text-white">
                {config.selectionMode === 'stocks' ? (
                  `${config.selectedSymbols?.length ?? 0} 只个股`
                ) : (
                  sectors.find((s) => s.code === config.sectorCode)?.name ??
                  config.sectorCode
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span>区间:</span>
              <span className="text-white">
                {config.startDate} ~ {config.endDate}
              </span>
            </div>
            <div className="flex justify-between">
              <span>持有:</span>
              <span className="text-white">{config.holdingDays}天</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfigPanel;
