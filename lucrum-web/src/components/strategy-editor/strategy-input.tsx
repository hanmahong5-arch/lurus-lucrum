"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import { cn } from "@/lib/utils";

/**
 * Strategy Input Component Props
 * 策略输入组件属性
 */
interface StrategyInputProps {
  onGenerate: (prompt: string) => Promise<void>;
  isLoading?: boolean;
  /** Controlled value for external state management / 受控值，用于外部状态管理 */
  value?: string;
  /** Callback when value changes / 值变化时的回调 */
  onChange?: (value: string) => void;
}

/**
 * Example strategies with descriptions
 * 带描述的示例策略
 */
const exampleStrategies = [
  {
    prompt: "当5日均线穿过20日均线时买入，RSI超过70时卖出，止损5%",
    label: "双均线+RSI",
    desc: "经典趋势跟踪",
  },
  {
    prompt: "如果价格突破布林带上轨，且成交量放大50%，则开多仓，跌破中轨止损",
    label: "布林带突破",
    desc: "波动率策略",
  },
  {
    prompt: "MACD金叉买入，死叉卖出，止损5%，止盈15%",
    label: "MACD策略",
    desc: "动量交易",
  },
  {
    prompt: "当KDJ在20以下金叉时买入，在80以上死叉时卖出，仓位50%",
    label: "KDJ超买超卖",
    desc: "均值回归",
  },
  {
    prompt: "价格创20日新高且成交量大于20日均量2倍时买入，跌破10日最低价止损",
    label: "动量突破",
    desc: "趋势追踪",
  },
];

/**
 * Input hints for better strategy descriptions
 * 输入提示，帮助用户写出更好的策略描述
 */
const inputHints = [
  "技术指标：均线(MA)、RSI、MACD、KDJ、布林带、ATR 等",
  "买卖条件：金叉/死叉、突破/跌破、超买/超卖",
  "风控参数：止损比例、止盈目标、仓位大小",
  "时间周期：日线、周线、小时线等",
];

export function StrategyInput({
  onGenerate,
  isLoading = false,
  value: controlledValue,
  onChange: onControlledChange,
}: StrategyInputProps) {
  // Support both controlled and uncontrolled modes
  // 同时支持受控和非受控模式
  const [internalValue, setInternalValue] = useState("");
  const isControlled = controlledValue !== undefined;
  const prompt = isControlled ? controlledValue : internalValue;

  const [showExamples, setShowExamples] = useState(false);
  const [showHints, setShowHints] = useState(true);

  // Sync internal state when controlled value changes
  // 当受控值变化时同步内部状态
  useEffect(() => {
    if (isControlled && controlledValue !== internalValue) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue, isControlled, internalValue]);

  // Handle value change for both modes
  // 处理两种模式的值变化
  const handleValueChange = useCallback(
    (newValue: string) => {
      if (isControlled && onControlledChange) {
        onControlledChange(newValue);
      } else {
        setInternalValue(newValue);
      }
    },
    [isControlled, onControlledChange],
  );

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isLoading) return;
    await onGenerate(prompt);
  }, [prompt, isLoading, onGenerate]);

  const handleExample = useCallback(
    (example: string) => {
      handleValueChange(example);
      setShowExamples(false);
      setShowHints(false);
    },
    [handleValueChange],
  );

  const handleClear = useCallback(() => {
    handleValueChange("");
  }, [handleValueChange]);

  // Character count and limit
  // 字符计数和限制
  const charCount = prompt.length;
  const charLimit = 1000;
  const isNearLimit = charCount > charLimit * 0.8;
  const isOverLimit = charCount > charLimit;

  return (
    <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <span className="text-sm font-medium text-white">
            策略描述 / Strategy Description
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowHints(!showHints);
              setShowExamples(false);
            }}
            className={cn(
              "px-2 py-1 text-xs rounded transition",
              showHints
                ? "bg-accent/30 text-accent"
                : "bg-white/10 hover:bg-white/20 text-white/70",
            )}
          >
            💡 提示
          </button>
          <button
            onClick={() => {
              setShowExamples(!showExamples);
              setShowHints(false);
            }}
            className={cn(
              "px-2 py-1 text-xs rounded transition",
              showExamples
                ? "bg-accent/30 text-accent"
                : "bg-white/10 hover:bg-white/20 text-white/70",
            )}
          >
            📋 示例
          </button>
        </div>
      </div>

      {/* Hints panel / 提示面板 */}
      {showHints && (
        <div className="px-4 py-3 bg-accent/10 border-b border-accent/20">
          <p className="text-xs text-accent mb-2 font-medium">
            💡 描述策略时可以包含以下要素：
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {inputHints.map((hint, index) => (
              <div
                key={index}
                className="text-xs text-white/60 flex items-start gap-2"
              >
                <span className="text-accent">•</span>
                <span>{hint}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Examples dropdown */}
      {showExamples && (
        <div className="px-4 py-3 bg-primary/30 border-b border-border">
          <p className="text-xs text-white/50 mb-2">
            点击使用示例策略 / Click to use example:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {exampleStrategies.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExample(example.prompt)}
                className="flex flex-col items-start px-3 py-2 text-sm bg-surface/50 hover:bg-surface rounded-lg transition group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-accent font-medium text-xs">
                    {example.label}
                  </span>
                  <span className="text-white/40 text-xs">{example.desc}</span>
                </div>
                <span className="text-white/70 text-xs text-left group-hover:text-white transition">
                  {example.prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4">
        <textarea
          value={prompt}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={`描述你的交易策略，例如：
• 买入条件：5日均线上穿20日均线
• 卖出条件：RSI超过70或跌破10日均线
• 风控：止损5%，止盈15%
• 仓位：每次买入50%资金

Describe your trading strategy in plain language...`}
          className={cn(
            "w-full h-40 p-4 bg-primary/50 rounded-lg border",
            "text-white placeholder:text-white/30 resize-none",
            "focus:outline-none focus:ring-2 transition-all",
            isOverLimit
              ? "border-loss/50 focus:ring-loss/30 focus:border-loss/50"
              : "border-border focus:ring-accent/50 focus:border-accent/50",
          )}
          disabled={isLoading}
          maxLength={charLimit + 100} // Allow slight overflow for user awareness
        />

        {/* Character count and action buttons */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClear}
              disabled={!prompt || isLoading}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 disabled:opacity-50 transition"
            >
              清空 / Clear
            </button>
            <span
              className={cn(
                "text-xs",
                isOverLimit
                  ? "text-loss"
                  : isNearLimit
                    ? "text-yellow-400/70"
                    : "text-white/30",
              )}
            >
              {charCount} / {charLimit} 字符
              {isOverLimit && " (超出限制)"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!prompt || isLoading || isOverLimit}
              className="gap-1"
              onClick={async () => {
                if (!prompt.trim()) return;
                // Optimize the strategy description using AI
                // 使用AI优化策略描述
                const optimizedPrompt = `${prompt}\n\n请优化以上策略，添加：
1. 明确的入场和出场条件
2. 合理的止盈止损比例
3. 仓位管理建议`;
                handleValueChange(optimizedPrompt);
              }}
            >
              <span>✨</span>
              AI优化
            </Button>
            <DisabledWithReason
              disabled={!prompt || isLoading || isOverLimit}
              reason={!prompt ? '请输入策略描述' : isLoading ? '生成中...' : '描述过长，请精简'}
            >
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!prompt || isLoading || isOverLimit}
                className="min-w-[120px]"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
                    生成中...
                  </span>
                ) : (
                  "生成策略 / Generate"
                )}
              </Button>
            </DisabledWithReason>
          </div>
        </div>
      </div>
    </div>
  );
}
