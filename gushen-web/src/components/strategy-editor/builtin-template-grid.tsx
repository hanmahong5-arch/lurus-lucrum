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

import React, { useState } from "react";
import {
  BUILTIN_TEMPLATES,
  DIFFICULTY_CONFIG,
  type BuiltinTemplate,
} from "@/lib/strategy-templates/builtin-templates";
import type { PlanTier } from "@/lib/config/plan-limits";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface BuiltinTemplateGridProps {
  /** Callback when user selects a template */
  onSelectTemplate: (template: BuiltinTemplateSelection) => void;
  /** Current user's plan tier (defaults to "free") */
  userPlan?: PlanTier;
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
/** Tier hierarchy for access checks */
const TIER_ORDER: Record<PlanTier, number> = { free: 0, standard: 1, premium: 2 };

function isTemplateLocked(templateTier: PlanTier, userPlan: PlanTier): boolean {
  return TIER_ORDER[userPlan] < TIER_ORDER[templateTier];
}

function BuiltinTemplateCard({
  template,
  onSelect,
  userPlan = "free",
  onLockClick,
}: {
  template: BuiltinTemplate;
  onSelect: (template: BuiltinTemplateSelection) => void;
  userPlan?: PlanTier;
  onLockClick: (templateName: string) => void;
}) {
  const locked = isTemplateLocked(template.tier, userPlan);

  const handleUse = () => {
    if (locked) {
      onLockClick(template.name);
      return;
    }
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
      className={`border border-gray-700 rounded-lg bg-gray-800/50 transition-colors p-4 flex flex-col gap-3 ${locked ? "opacity-60" : "hover:border-gray-500"}`}
      data-testid={`builtin-template-card-${template.id}`}
    >
      {/* Header: icon + name + difficulty + score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{template.icon}</span>
          <h3 className="font-medium text-white truncate">{template.name}</h3>
          {locked && <span className="text-sm">🔒</span>}
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
      <div className={`grid grid-cols-2 gap-2 text-xs ${locked ? "blur-sm select-none" : ""}`}>
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

      {/* Use / Unlock button */}
      <button
        onClick={handleUse}
        className={`w-full px-4 py-2 text-white text-sm rounded transition-colors font-medium ${
          locked
            ? "bg-slate-600 hover:bg-slate-500"
            : "bg-blue-600 hover:bg-blue-500"
        }`}
        aria-label={locked ? `解锁${template.name}` : `使用${template.name}`}
      >
        {locked ? "🔒 解锁" : "使用"}
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
  userPlan = "free",
  className = "",
}: BuiltinTemplateGridProps) {
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [lockedTemplateName, setLockedTemplateName] = useState("");

  const handleLockClick = (templateName: string) => {
    setLockedTemplateName(templateName);
    setLockDialogOpen(true);
  };

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
            userPlan={userPlan}
            onLockClick={handleLockClick}
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

      {/* Upgrade dialog for locked templates */}
      <UpgradeDialog
        open={lockDialogOpen}
        onOpenChange={setLockDialogOpen}
        variant="lock"
        templateName={lockedTemplateName}
      />
    </div>
  );
}

export default BuiltinTemplateGrid;
