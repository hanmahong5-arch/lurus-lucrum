"use client";

/**
 * ContextualHelp Component
 *
 * A small "?" icon that reveals a help panel specific to the current page context.
 * Uses Radix Popover to display help content on click.
 *
 * Each page defines its own help sections via the CONTEXTUAL_HELP_CONTENT registry.
 */

import * as React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface HelpSection {
  /** Section title */
  title: string;
  /** Help content paragraphs */
  content: string[];
}

export interface ContextualHelpProps {
  /** Help sections to display */
  sections: HelpSection[];
  /** Optional title for the help panel */
  title?: string;
  /** Button size variant */
  size?: "sm" | "md";
  /** Additional className */
  className?: string;
  /** Popover side */
  side?: "top" | "right" | "bottom" | "left";
}

// =============================================================================
// Component
// =============================================================================

export function ContextualHelp({
  sections,
  title,
  size = "sm",
  className,
  side = "bottom",
}: ContextualHelpProps) {
  if (sections.length === 0) return null;

  const iconSize = size === "sm" ? "w-4 h-4 text-[10px]" : "w-5 h-5 text-xs";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "border border-white/10 text-white/40",
            "hover:border-white/30 hover:text-white/60 hover:bg-white/5",
            "transition-all focus:outline-none focus:ring-1 focus:ring-accent/50",
            iconSize,
            className,
          )}
          aria-label="帮助"
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="end"
        className="w-80 max-h-[400px] overflow-y-auto bg-surface-modal border border-white/10 shadow-xl p-0 rounded-lg"
      >
        <div className="p-4 space-y-4">
          {/* Panel title */}
          {title && (
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <span className="text-xs font-semibold text-accent">
                {title}
              </span>
            </div>
          )}

          {/* Help sections */}
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-1.5">
              <h4 className="text-xs font-medium text-white/80">
                {section.title}
              </h4>
              {section.content.map((paragraph, pIdx) => (
                <p
                  key={pIdx}
                  className="text-xs text-white/50 leading-relaxed"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// Pre-defined help content for each page context
// =============================================================================

export const CONTEXTUAL_HELP_CONTENT: Record<string, HelpSection[]> = {
  strategyWorkbench: [
    {
      title: "如何写好策略描述",
      content: [
        '明确买入条件、卖出条件和风控参数。例如: "当MACD金叉且RSI<30时买入，RSI>70时卖出，止损5%"',
        "可以组合多个指标，但建议不超过3个条件，过于复杂的策略容易过拟合。",
      ],
    },
    {
      title: "参数调整技巧",
      content: [
        "均线周期: 短期(5-10), 中期(20-60), 长期(120-250)。周期越短信号越多但噪音也越大。",
        "止损比例: 3-5%适合短线, 5-10%适合波段, >10%适合中长线。",
        "仓位比例: 建议单只股票不超过总资金的30%，分散风险。",
      ],
    },
  ],

  validation: [
    {
      title: "单股 vs 板块 vs 多股",
      content: [
        "单股验证: 快速检验策略在特定股票上的表现, 适合初步测试。",
        "板块验证: 批量测试整个行业板块, 验证策略的普适性。推荐优先使用。",
        "多股组合: 自选多只股票组合, 适合精细化验证。",
      ],
    },
    {
      title: "过滤条件建议",
      content: [
        "排除ST股: ST股涨跌幅限制为5%, 交易规则不同, 建议默认排除。",
        "排除次新股: 上市不足一年的股票数据不足, 回测结果参考价值有限。",
        "市值过滤: 小市值股票流动性差, 实盘可能无法按回测价格成交。",
      ],
    },
  ],

  trading: [
    {
      title: "A股交易规则",
      content: [
        "一手 = 100股, 买入数量必须是100的整数倍。",
        "T+1交易: 今天买入的股票, 最早明天才能卖出。",
        "涨跌幅限制: 普通股票每日涨跌幅上限10%, 创业板/科创板20%。",
      ],
    },
    {
      title: "手续费计算",
      content: [
        "佣金: 通常万分之3, 最低5元/笔 (买卖双向收取)。",
        "印花税: 成交金额的千分之1, 仅卖出时收取。",
        "过户费: 成交金额的十万分之2 (沪市收取, 深市免)。",
      ],
    },
    {
      title: "风险控制",
      content: [
        "单只股票仓位建议不超过总资金的30%。",
        "每日交易次数建议不超过5次, 避免情绪化操作。",
        "设置止损线并严格执行, 切勿持续补仓摊低成本。",
      ],
    },
  ],

  marketplace: [
    {
      title: "评级含义",
      content: [
        "S级: 卓越 — 各项指标均处于顶尖水平, 非常稀少。",
        "A级: 优秀 — 收益与风险平衡良好, 适合实际使用。",
        "B级: 良好 — 基本面不错, 有一定改进空间。",
        "C级: 一般 — 需要谨慎评估, 建议优化后再使用。",
        "D级: 需改进 — 不建议直接使用, 存在明显不足。",
      ],
    },
    {
      title: "如何选择策略",
      content: [
        "不要只看收益率, 关注夏普比率和最大回撤的平衡。",
        "检查回测时间跨度: 至少覆盖一个完整牛熊周期(3-5年)。",
        "留意交易频率: 频繁交易的策略实盘成本可能远超回测。",
      ],
    },
  ],

  history: [
    {
      title: "回测结果解读",
      content: [
        "对比同一策略在不同参数下的表现, 寻找稳健区间。",
        "关注最大回撤发生的时间段, 判断策略对市场环境的适应性。",
        "优先选择在多种市场环境下均表现稳定的策略。",
      ],
    },
  ],

  advisor: [
    {
      title: "AI 顾问使用技巧",
      content: [
        "提供具体的股票代码或行业, AI的分析会更精准。",
        "可以要求AI从不同投资流派的角度分析, 获取多元视角。",
        "辩论模式可以帮助你同时看到看多和看空的理由。",
      ],
    },
  ],
};
