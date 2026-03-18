/**
 * Custom Agent Builder Component
 * Analysis task configuration builder
 *
 * All-chip/button configuration interface (zero-typing).
 * Compact 4-section layout: name+appearance, targets, strategies, depth+backtest.
 *
 * @module components/agent/custom-agent-builder
 */

"use client";

import { useState, useMemo } from "react";
import { AgentTokenBadge } from "./agent-token-badge";
import { Button } from "@/components/ui/button";
import type {
  TargetMode,
  AnalysisDepth,
  AgentStrategy,
  CustomAgentConfig,
} from "@/lib/agent/custom-agent-types";

// =============================================================================
// Constants
// =============================================================================

const PRESET_NAMES = [
  { label: "趋势跟踪" },
  { label: "价值筛选" },
  { label: "动量扫描" },
  { label: "板块轮动" },
];

const BUILTIN_STRATEGIES = [
  { id: "ma_cross", name: "双均线交叉" },
  { id: "rsi", name: "RSI 超买超卖" },
  { id: "macd", name: "MACD 趋势跟踪" },
  { id: "boll", name: "布林线突破" },
];

const TARGET_MODES: { mode: TargetMode; label: string; description: string }[] = [
  { mode: "all", label: "全市场", description: "扫描活跃个股 Top N" },
  { mode: "sector", label: "按板块", description: "选择板块自动展开" },
  { mode: "custom", label: "自选股", description: "手动输入代码" },
];

const DEPTH_OPTIONS: { depth: AnalysisDepth; label: string; tokenLabel: string }[] = [
  { depth: "light", label: "轻量", tokenLabel: "免费" },
  { depth: "standard", label: "标准", tokenLabel: "~1.5K tokens" },
  { depth: "deep", label: "深度", tokenLabel: "~5K tokens" },
];

const TOKEN_ESTIMATES: Record<AnalysisDepth, number> = {
  light: 0,
  standard: 1500,
  deep: 5000,
};

const SECTOR_LIST = [
  { code: "BK0420", name: "电力" },
  { code: "BK0437", name: "银行" },
  { code: "BK0475", name: "房地产" },
  { code: "BK0428", name: "医药" },
  { code: "BK0493", name: "人工智能" },
  { code: "BK1011", name: "新能源汽车" },
  { code: "BK0825", name: "光伏概念" },
  { code: "BK0447", name: "半导体" },
  { code: "BK0474", name: "白酒" },
  { code: "BK0477", name: "煤炭" },
];

const ICON_OPTIONS = ["bot", "radar", "target", "brain", "rocket", "flame"];
const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6",
];

const CAPITAL_OPTIONS = [50000, 100000, 500000, 1000000];

// =============================================================================
// Props
// =============================================================================

interface CustomAgentBuilderProps {
  /** Pre-fill for editing an existing agent */
  initialConfig?: Partial<CustomAgentConfig>;
  /** Whether deep analysis is allowed by user's plan */
  allowDeep?: boolean;
  /** Callback on save (without running) */
  onSave: (config: CustomAgentConfig) => void;
  /** Callback on save + run */
  onSaveAndRun: (config: CustomAgentConfig) => void;
  /** Whether save is in progress */
  saving?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function CustomAgentBuilder({
  initialConfig,
  allowDeep = false,
  onSave,
  onSaveAndRun,
  saving = false,
}: CustomAgentBuilderProps) {
  // Name
  const [name, setName] = useState(initialConfig?.name ?? "");
  const [customName, setCustomName] = useState(false);

  // Targets
  const [targetMode, setTargetMode] = useState<TargetMode>(
    initialConfig?.targets?.mode ?? "all"
  );
  const [selectedSectors, setSelectedSectors] = useState<string[]>(
    initialConfig?.targets?.sectors ?? []
  );
  const [customSymbols, setCustomSymbols] = useState(
    initialConfig?.targets?.symbols?.join(", ") ?? ""
  );

  // Strategies
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(
    initialConfig?.strategies?.map((s) => s.templateId) ?? [BUILTIN_STRATEGIES[0]!.id]
  );

  // Depth
  const [depth, setDepth] = useState<AnalysisDepth>(
    initialConfig?.analysisDepth ?? "standard"
  );

  // Backtest config
  const [capital, setCapital] = useState(
    initialConfig?.backtestConfig?.initialCapital ?? 100000
  );
  const [startDate, setStartDate] = useState(
    initialConfig?.backtestConfig?.dateRange?.start ?? "2023-01-01"
  );
  const [endDate, setEndDate] = useState(
    initialConfig?.backtestConfig?.dateRange?.end ?? "2024-12-31"
  );

  // Icon & Color
  const [icon, setIcon] = useState(initialConfig?.icon ?? "bot");
  const [color, setColor] = useState(initialConfig?.color ?? "#6366f1");

  // Estimated tokens
  const estimatedTokens = TOKEN_ESTIMATES[depth];

  // Build config
  function buildConfig(): CustomAgentConfig {
    const symbols =
      targetMode === "custom"
        ? customSymbols
            .split(/[,，\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    return {
      name: name || "未命名任务",
      targets: {
        mode: targetMode,
        sectors: targetMode === "sector" ? selectedSectors : undefined,
        symbols,
      },
      strategies: selectedStrategies.map((id) => ({ templateId: id })),
      analysisDepth: depth,
      backtestConfig: {
        initialCapital: capital,
        dateRange: { start: startDate, end: endDate },
      },
      icon,
      color,
    };
  }

  function toggleSector(code: string) {
    setSelectedSectors((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function toggleStrategy(id: string) {
    setSelectedStrategies((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : [...prev, id]
    );
  }

  const isValid = useMemo(() => {
    if (!name && !customName) return true; // preset name will be used
    if (selectedStrategies.length === 0) return false;
    if (targetMode === "sector" && selectedSectors.length === 0) return false;
    if (targetMode === "custom" && !customSymbols.trim()) return false;
    return true;
  }, [name, customName, selectedStrategies, targetMode, selectedSectors, customSymbols]);

  return (
    <div className="space-y-5">
      {/* Section 1: Name + Appearance (merged into one row) */}
      <section>
        <h3 className="text-sm font-medium text-white/70 mb-3">名称与外观</h3>
        {!customName ? (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {PRESET_NAMES.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setName(preset.label)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  name === preset.label
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-surface-elevated text-white/60 border border-transparent hover:bg-surface-hover"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => setCustomName(true)}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface-elevated text-white/40 border border-dashed border-white/20 hover:border-white/40 transition"
            >
              自定义...
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="输入任务名称"
            className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-white text-sm focus:border-accent focus:outline-none mb-3"
            autoFocus
          />
        )}
        {/* Icon + Color picker inline */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            {ICON_OPTIONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                  icon === ic
                    ? "bg-accent/20 border border-accent/30"
                    : "bg-surface-elevated hover:bg-surface-hover"
                }`}
              >
                <AgentIcon name={ic} />
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition ${
                  color === c ? "ring-2 ring-white ring-offset-2 ring-offset-void" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Target Mode */}
      <section>
        <h3 className="text-sm font-medium text-white/70 mb-3">分析标的</h3>
        <div className="flex gap-2 mb-3">
          {TARGET_MODES.map((tm) => (
            <button
              key={tm.mode}
              onClick={() => setTargetMode(tm.mode)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm text-center transition ${
                targetMode === tm.mode
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-surface-elevated text-white/60 border border-transparent hover:bg-surface-hover"
              }`}
            >
              <span className="block font-medium">{tm.label}</span>
              <span className="block text-xs text-white/40 mt-0.5">
                {tm.description}
              </span>
            </button>
          ))}
        </div>

        {/* Sector selector */}
        {targetMode === "sector" && (
          <div className="flex flex-wrap gap-2">
            {SECTOR_LIST.map((s) => (
              <button
                key={s.code}
                onClick={() => toggleSector(s.code)}
                className={`px-2.5 py-1 rounded-md text-xs transition ${
                  selectedSectors.includes(s.code)
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-surface-elevated text-white/50 hover:text-white/70"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Custom symbols input */}
        {targetMode === "custom" && (
          <input
            type="text"
            value={customSymbols}
            onChange={(e) => setCustomSymbols(e.target.value)}
            placeholder="输入股票代码，逗号分隔（如 600519, 000858）"
            className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-white text-sm font-mono focus:border-accent focus:outline-none"
          />
        )}
      </section>

      {/* Section 3: Strategies */}
      <section>
        <h3 className="text-sm font-medium text-white/70 mb-3">绑定策略</h3>
        <div className="flex flex-wrap gap-2">
          {BUILTIN_STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleStrategy(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                selectedStrategies.includes(s.id)
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-surface-elevated text-white/60 border border-transparent hover:bg-surface-hover"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      {/* Section 4: Analysis Depth + Backtest Params (merged side-by-side) */}
      <section>
        <h3 className="text-sm font-medium text-white/70 mb-3">分析深度与回测参数</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Left: Depth options */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">分析深度</label>
            <div className="flex gap-2">
              {DEPTH_OPTIONS.map((opt) => {
                const disabled = opt.depth === "deep" && !allowDeep;
                return (
                  <button
                    key={opt.depth}
                    onClick={() => !disabled && setDepth(opt.depth)}
                    disabled={disabled}
                    className={`flex-1 px-2 py-2 rounded-lg text-sm text-center transition ${
                      disabled
                        ? "bg-surface-elevated text-white/20 cursor-not-allowed opacity-50"
                        : depth === opt.depth
                          ? "bg-accent/20 text-accent border border-accent/30"
                          : "bg-surface-elevated text-white/60 border border-transparent hover:bg-surface-hover"
                    }`}
                  >
                    <span className="block font-medium text-xs">{opt.label}</span>
                    <span className="block text-[10px] text-white/40 mt-0.5">
                      {opt.tokenLabel}
                      {disabled && " (需升级)"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Capital + Date range */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">初始资金</label>
              <div className="flex flex-wrap gap-1.5">
                {CAPITAL_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCapital(c)}
                    className={`px-2 py-1 rounded text-xs font-mono tabular-nums transition ${
                      capital === c
                        ? "bg-accent/20 text-accent"
                        : "bg-surface-elevated text-white/50 hover:text-white/70"
                    }`}
                  >
                    {c >= 1000000 ? `${c / 10000}万` : `${(c / 10000).toFixed(0)}万`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">回测区间</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-surface-elevated border border-border text-white text-xs font-mono focus:border-accent focus:outline-none"
                />
                <span className="text-white/30 text-xs">至</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-surface-elevated border border-border text-white text-xs font-mono focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer: Token estimate + Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <AgentTokenBadge mode="estimate" tokens={estimatedTokens} />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSave(buildConfig())}
            disabled={saving || !isValid}
          >
            仅保存
          </Button>
          <Button
            size="sm"
            onClick={() => onSaveAndRun(buildConfig())}
            disabled={saving || !isValid}
            className="btn-tactile bg-accent hover:bg-accent/80"
          >
            {saving ? "保存中..." : "创建并运行"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Agent Icon — SVG line icons (no emoji)
// =============================================================================

/** Agent icon renderer using inline SVG */
export function AgentIcon({
  name,
  className = "w-4 h-4",
}: {
  name: string;
  className?: string;
}) {
  const svgProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    // Terminal / console icon
    case "bot":
      return (
        <svg {...svgProps}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8l4 4-4 4" />
          <path d="M13 16h4" />
        </svg>
      );
    // Radar / scan icon
    case "radar":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v4" />
          <path d="M12 12l6-6" />
        </svg>
      );
    // Crosshair / target icon
    case "target":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      );
    // Chart / analytics icon
    case "brain":
      return (
        <svg {...svgProps}>
          <path d="M3 20h18" />
          <path d="M5 20V10l4-6 4 8 4-4 4 6v6" />
        </svg>
      );
    // Lightning / flash icon
    case "rocket":
      return (
        <svg {...svgProps}>
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
        </svg>
      );
    // Trend line icon
    case "flame":
      return (
        <svg {...svgProps}>
          <path d="M3 17l4-4 4 4 4-8 6 4" />
          <circle cx="3" cy="17" r="1" fill="currentColor" stroke="none" />
          <circle cx="21" cy="13" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8l4 4-4 4" />
          <path d="M13 16h4" />
        </svg>
      );
  }
}

export default CustomAgentBuilder;
