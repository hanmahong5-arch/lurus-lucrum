"use client";

/**
 * Empty state components for each history tab.
 * Each provides context-specific messaging and a link to the relevant page.
 */

import Link from "next/link";
import { BarChart3, ArrowRightLeft, GitBranch, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface EmptyStateConfig {
  icon: typeof BarChart3;
  message: string;
  linkText: string;
  linkHref: string;
}

interface QuickStartAction {
  label: string;
  href: string;
  description: string;
}

interface EnhancedEmptyStateConfig extends EmptyStateConfig {
  /** Additional quick-start actions for richer empty states */
  quickActions?: QuickStartAction[];
}

const EMPTY_CONFIGS: Record<string, EnhancedEmptyStateConfig> = {
  backtest: {
    icon: BarChart3,
    message: "还没有回测记录",
    linkText: "前往策略工作台",
    linkHref: "/dashboard",
    quickActions: [
      { label: "用自然语言描述策略", href: "/dashboard", description: '例如: "MACD金叉买入，RSI超卖卖出"' },
      { label: "从模板开始", href: "/dashboard", description: "8种经典策略模板一键加载" },
      { label: "去策略市场导入", href: "/dashboard/marketplace", description: "发现其他用户分享的策略" },
    ],
  },
  trades: {
    icon: ArrowRightLeft,
    message: "还没有交易记录",
    linkText: "前往交易中心",
    linkHref: "/dashboard/trading",
    quickActions: [
      { label: "开始模拟交易", href: "/dashboard/trading", description: "10万虚拟资金，零风险练手" },
      { label: "先回测策略", href: "/dashboard", description: "先验证策略效果再交易" },
    ],
  },
  versions: {
    icon: GitBranch,
    message: "还没有保存的策略",
    linkText: "前往策略工作台",
    linkHref: "/dashboard",
    quickActions: [
      { label: "创建新策略", href: "/dashboard", description: "用AI助手快速生成策略代码" },
      { label: "浏览策略市场", href: "/dashboard/marketplace", description: "从社区策略中获取灵感" },
    ],
  },
  conversations: {
    icon: MessageSquare,
    message: "还没有对话记录",
    linkText: "前往 AI 顾问",
    linkHref: "/dashboard/advisor",
    quickActions: [
      { label: "咨询AI顾问", href: "/dashboard/advisor", description: "11位专项AI投资分析师" },
      { label: "多空辩论", href: "/dashboard/advisor", description: "让AI从多空两面分析" },
    ],
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function HistoryEmptyState({
  tab,
  className,
}: {
  tab: string;
  className?: string;
}) {
  const fallback: EmptyStateConfig = {
    icon: BarChart3,
    message: "暂无数据",
    linkText: "返回主页",
    linkHref: "/dashboard",
  };
  const config = EMPTY_CONFIGS[tab] ?? fallback;
  const Icon = config.icon;

  const quickActions = (config as EnhancedEmptyStateConfig).quickActions;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-white/20" />
      </div>
      <p className="text-sm text-white/40 max-w-xs mb-2">{config.message}</p>

      {/* Quick-start actions */}
      {quickActions && quickActions.length > 0 && (
        <div className="w-full max-w-sm mt-4 space-y-2">
          <p className="text-xs text-white/30 mb-3">试试这些快速开始方式:</p>
          {quickActions.map((qa) => (
            <Link
              key={qa.label}
              href={qa.href}
              className="flex items-start gap-3 px-4 py-3 rounded-lg text-left bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-accent/20 transition group"
            >
              <div className="min-w-0">
                <span className="block text-xs font-medium text-white/70 group-hover:text-accent transition">
                  {qa.label}
                </span>
                <span className="block text-[10px] text-white/30 mt-0.5">
                  {qa.description}
                </span>
              </div>
              <span className="text-xs text-white/20 group-hover:text-accent/60 shrink-0 mt-0.5">&rarr;</span>
            </Link>
          ))}
        </div>
      )}

      {/* Fallback single link when no quick actions */}
      {(!quickActions || quickActions.length === 0) && (
        <Link
          href={config.linkHref}
          className="mt-4 px-4 py-2 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition btn-tactile"
        >
          {config.linkText}
        </Link>
      )}
    </div>
  );
}
