/**
 * Builtin Template Grid Component
 *
 * Displays curated builtin strategy templates as a card grid
 * for quick-start strategy selection. Fulfills FR-1.5.
 *
 * Features:
 * - Card grid layout with responsive columns
 * - Difficulty badges (beginner/intermediate/advanced)
 * - Buy/sell conditions display
 * - Expected score range indicator
 * - Click-to-select with complete template data
 *
 * @module components/strategy-editor/builtin-template-grid
 */

"use client";

import React from "react";
import {
  BUILTIN_TEMPLATES,
  DIFFICULTY_CONFIG,
  type BuiltinTemplate,
} from "@/lib/strategy-templates/builtin-templates";

// =============================================================================
// TYPES
// =============================================================================

interface BuiltinTemplateGridProps {
  /** Callback when user selects a template */
  onSelectTemplate: (template: BuiltinTemplateSelection) => void;
  /** Additional CSS classes */
  className?: string;
}

/** Data passed to parent when a template is selected */
export interface BuiltinTemplateSelection {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Natural language prompt for AI generation */
  prompt: string;
  /** Vnpy Python code */
  code: string;
  /** Default parameters */
  defaultParams: Record<string, number | string>;
  /** Trading conditions */
  conditions: {
    buy: string[];
    sell: string[];
    position?: string;
  };
}

// =============================================================================
// DIFFICULTY BADGE
// =============================================================================

/**
 * Difficulty badge component
 */
function DifficultyBadge({ difficulty }: { difficulty: BuiltinTemplate["difficulty"] }) {
  const config = DIFFICULTY_CONFIG[difficulty];
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bgClass}`}
      data-testid={`difficulty-badge-${difficulty}`}
    >
      {config.label}
    </span>
  );
}

// =============================================================================
// SCORE RANGE INDICATOR
// =============================================================================

/**
 * Expected score range mini indicator
 */
function ScoreRangeIndicator({
  templateId,
  range,
}: {
  templateId: string;
  range: BuiltinTemplate["expectedScoreRange"];
}) {
  return (
    <span
      className="text-xs text-gray-400 font-mono"
      data-testid={`template-score-range-${templateId}`}
    >
      {range.min}-{range.max}
    </span>
  );
}

// =============================================================================
// TEMPLATE CARD
// =============================================================================

/**
 * Single builtin template card
 */
function BuiltinTemplateCard({
  template,
  onSelect,
}: {
  template: BuiltinTemplate;
  onSelect: (template: BuiltinTemplateSelection) => void;
}) {
  const handleUse = () => {
    onSelect({
      id: template.id,
      name: template.name,
      prompt: template.prompt,
      code: template.code,
      defaultParams: { ...template.defaultParams },
      conditions: {
        buy: [...template.conditions.buy],
        sell: [...template.conditions.sell],
        position: template.conditions.position,
      },
    });
  };

  return (
    <div
      className="border border-gray-700 rounded-lg bg-gray-800/50 hover:border-gray-500 transition-colors p-4 flex flex-col gap-3"
      data-testid={`builtin-template-card-${template.id}`}
    >
      {/* Header: icon + name + difficulty + score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{template.icon}</span>
          <h3 className="font-medium text-white truncate">{template.name}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ScoreRangeIndicator
            templateId={template.id}
            range={template.expectedScoreRange}
          />
          <DifficultyBadge difficulty={template.difficulty} />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400">{template.description}</p>

      {/* Conditions summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-green-900/20 border border-green-800/30 rounded px-2 py-1.5">
          <span className="text-green-400 font-medium">买入:</span>
          <ul className="text-gray-300 mt-0.5 space-y-0.5">
            {template.conditions.buy.map((c, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-green-500 flex-shrink-0">·</span>
                <span className="line-clamp-2">{c}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-red-900/20 border border-red-800/30 rounded px-2 py-1.5">
          <span className="text-red-400 font-medium">卖出:</span>
          <ul className="text-gray-300 mt-0.5 space-y-0.5">
            {template.conditions.sell.map((c, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-red-500 flex-shrink-0">·</span>
                <span className="line-clamp-2">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Use button */}
      <button
        onClick={handleUse}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors font-medium"
        aria-label={`使用${template.name}`}
      >
        使用
      </button>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Builtin strategy template grid component
 *
 * Displays curated strategy templates for quick-start.
 * Part of FR-1.5: Strategy template library (>=5 templates).
 */
export function BuiltinTemplateGrid({
  onSelectTemplate,
  className = "",
}: BuiltinTemplateGridProps) {
  return (
    <div
      className={`space-y-4 ${className}`}
      data-testid="builtin-template-grid"
      aria-label="内置策略模板"
    >
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>快速开始</span>
          <span className="text-sm text-gray-500 font-normal">
            ({BUILTIN_TEMPLATES.length} 个经典策略)
          </span>
        </h2>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-gray-400">
        选择一个经典策略模板，一键填充代码和参数，立即开始回测体验
      </p>

      {/* Template card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {BUILTIN_TEMPLATES.map((template) => (
          <BuiltinTemplateCard
            key={template.id}
            template={template}
            onSelect={onSelectTemplate}
          />
        ))}
      </div>

      {/* Risk disclaimer */}
      <div className="text-xs text-gray-500 bg-gray-900/50 rounded p-3">
        <p>
          <strong>风险提示：</strong>
          策略模板仅供学习参考，不构成投资建议。实盘交易需根据实际情况调整参数并做好风险管理。
        </p>
      </div>
    </div>
  );
}

export default BuiltinTemplateGrid;
