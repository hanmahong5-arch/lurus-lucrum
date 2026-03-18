/**
 * Next Step Guide Component
 * 下一步引导组件
 *
 * Displays 3 action cards after backtest completion to guide users
 * toward their next workflow step: optimize params, ask AI, or validate more stocks.
 *
 * @module components/backtest/next-step-guide
 */

"use client";

import { cn } from "@/lib/utils";
import { Settings2, MessageCircle, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface NextStepGuideProps {
  /** Callback: optimize strategy parameters */
  onOptimizeParams?: () => void;
  /** Callback: ask AI advisor */
  onAskAI?: () => void;
  /** Callback: validate on more stocks */
  onValidateMore?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// GUIDE CARD DEFINITIONS / 引导卡片定义
// =============================================================================

interface GuideCardDef {
  id: string;
  testId: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  callbackKey: keyof Pick<
    NextStepGuideProps,
    "onOptimizeParams" | "onAskAI" | "onValidateMore"
  >;
}

const GUIDE_CARDS: readonly GuideCardDef[] = [
  {
    id: "optimize",
    testId: "next-step-card-optimize",
    title: "优化参数",
    description: "调整策略参数，寻找更优回测表现",
    icon: Settings2,
    callbackKey: "onOptimizeParams",
  },
  {
    id: "ai",
    testId: "next-step-card-ai",
    title: "问问AI顾问",
    description: "获取 AI 对策略表现的专业分析建议",
    icon: MessageCircle,
    callbackKey: "onAskAI",
  },
  {
    id: "validate",
    testId: "next-step-card-validate",
    title: "验证更多股票",
    description: "在不同标的上验证策略的普适性",
    icon: BarChart3,
    callbackKey: "onValidateMore",
  },
] as const;

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function NextStepGuide({
  onOptimizeParams,
  onAskAI,
  onValidateMore,
  className,
}: NextStepGuideProps) {
  const callbacks: Record<string, (() => void) | undefined> = {
    onOptimizeParams,
    onAskAI,
    onValidateMore,
  };

  return (
    <div
      data-testid="next-step-guide"
      className={cn("grid grid-cols-3 gap-4", className)}
      role="navigation"
      aria-label="下一步操作"
    >
      {GUIDE_CARDS.map((card) => {
        const Icon = card.icon;
        const handler = callbacks[card.callbackKey];

        return (
          <Card
            key={card.id}
            data-testid={card.testId}
            className={cn(
              "cursor-pointer transition-colors",
              "hover:border-primary/50 hover:bg-primary/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            )}
            tabIndex={0}
            role="button"
            aria-label={card.title}
            onClick={() => handler?.()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handler?.();
              }
            }}
          >
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium">{card.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
