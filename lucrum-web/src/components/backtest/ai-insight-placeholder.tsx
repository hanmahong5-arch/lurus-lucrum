/**
 * AI Insight Placeholder Component
 * AI 洞察占位卡片组件
 *
 * Placeholder for future AI-powered insight integration (Epic 5).
 * Displays a placeholder card indicating where AI analysis will appear.
 *
 * @module components/backtest/ai-insight-placeholder
 */

"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface AiInsightPlaceholderProps {
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const PLACEHOLDER_TITLE = "AI 智能分析";
const PLACEHOLDER_DESCRIPTION = "即将推出：基于回测结果的 AI 投资建议与策略优化方向";

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function AiInsightPlaceholder({ className }: AiInsightPlaceholderProps) {
  return (
    <Card
      data-testid="ai-insight-placeholder"
      className={cn(
        "border-dashed border-2 border-muted-foreground/20",
        "bg-surface-elevated/50",
        className
      )}
      role="complementary"
      aria-label={PLACEHOLDER_TITLE}
    >
      <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Sparkles className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {PLACEHOLDER_TITLE}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {PLACEHOLDER_DESCRIPTION}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
