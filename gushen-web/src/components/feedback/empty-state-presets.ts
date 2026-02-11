/**
 * Empty State Presets
 * 空状态预设配置
 *
 * Pre-configured empty state scenarios for common use cases.
 * Each preset includes icon, title, description, and action button labels.
 *
 * Story 1.4: 空状态组件
 */

import {
  FileCode,
  BarChart3,
  Folder,
  MessageCircle,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// =============================================================================
// Types / 类型
// =============================================================================

/**
 * Preset action definition (without onClick - to be provided by consumer)
 */
export interface PresetAction {
  /** Button label text */
  label: string;
  /** Button variant */
  variant: "primary" | "ghost";
}

/**
 * Empty state preset configuration
 */
export interface EmptyStatePreset {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Optional description text */
  description?: string;
  /** Action button configurations (onClick to be provided by consumer) */
  actions: PresetAction[];
}

// =============================================================================
// Presets / 预设配置
// =============================================================================

/**
 * Empty Editor Preset
 * 空编辑器预设
 *
 * Use when the strategy editor has no content.
 */
export const emptyEditorPreset: EmptyStatePreset = {
  icon: FileCode,
  title: "开始创建你的第一个策略",
  description: "使用自然语言描述你的投资想法，AI 将帮你生成策略代码",
  actions: [
    { label: "新建", variant: "primary" },
    { label: "浏览模板", variant: "ghost" },
  ],
};

/**
 * No Backtest History Preset
 * 无回测历史预设
 *
 * Use when there are no backtest results to display.
 */
export const noBacktestHistoryPreset: EmptyStatePreset = {
  icon: BarChart3,
  title: "还没有回测记录",
  description: "运行你的第一次回测，验证策略表现",
  actions: [{ label: "运行第一次回测", variant: "primary" }],
};

/**
 * Empty Strategy List Preset
 * 空策略列表预设
 *
 * Use when the user has no saved strategies.
 */
export const emptyStrategyListPreset: EmptyStatePreset = {
  icon: Folder,
  title: "还没有保存的策略",
  description: "创建或导入策略开始量化之旅",
  actions: [
    { label: "新建", variant: "primary" },
    { label: "导入", variant: "ghost" },
  ],
};

/**
 * AI No Context Preset
 * AI 无上下文预设
 *
 * Use when the AI advisor has no backtest context to analyze.
 */
export const aiNoContextPreset: EmptyStatePreset = {
  icon: MessageCircle,
  title: "先回测，AI 分析更精准",
  description: "回测后 AI 能给出更有针对性的建议",
  actions: [
    { label: "去回测", variant: "primary" },
    { label: "直接提问", variant: "ghost" },
  ],
};

/**
 * Discovery No Data Preset
 * 发现页无数据预设
 *
 * Use when the strategy discovery page cannot fetch data.
 */
export const discoveryNoDataPreset: EmptyStatePreset = {
  icon: Globe,
  title: "暂时无法获取最新策略",
  description: "网络可能存在问题，请稍后重试",
  actions: [
    { label: "显示缓存", variant: "primary" },
    { label: "刷新", variant: "ghost" },
  ],
};

// =============================================================================
// Helper Functions / 辅助函数
// =============================================================================

/**
 * All available presets
 */
export const allPresets = {
  emptyEditor: emptyEditorPreset,
  noBacktestHistory: noBacktestHistoryPreset,
  emptyStrategyList: emptyStrategyListPreset,
  aiNoContext: aiNoContextPreset,
  discoveryNoData: discoveryNoDataPreset,
} as const;

/**
 * Preset key type
 */
export type PresetKey = keyof typeof allPresets;

/**
 * Get a preset by key
 */
export function getPreset(key: PresetKey): EmptyStatePreset {
  return allPresets[key];
}
