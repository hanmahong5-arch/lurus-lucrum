"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useEffect } from "react";

// Demo strategy examples that cycle through
const strategyExamples = [
  "当5日均线穿过20日均线时买入",
  "When RSI drops below 30, buy the dip",
  "如果MACD金叉且成交量放大，开多仓",
  "Buy when price breaks above 52-week high",
  "当KDJ超卖且布林带收窄时建仓",
];

// Simulated generated code
const generatedCode = `def entry_signal(data):
    """AI Generated Strategy / AI生成的策略"""
    ma5 = data['close'].rolling(5).mean()
    ma20 = data['close'].rolling(20).mean()

    # Buy when MA5 crosses above MA20
    # 当5日均线上穿20日均线时买入
    if ma5.iloc[-1] > ma20.iloc[-1] and \\
       ma5.iloc[-2] <= ma20.iloc[-2]:
        return Signal.BUY

    return Signal.HOLD`;

export function HeroSection() {
  const [currentExample, setCurrentExample] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [displayText, setDisplayText] = useState("");

  // Typing animation effect
  useEffect(() => {
    const example = strategyExamples[currentExample] ?? "";
    let index = 0;
    setIsTyping(true);
    setDisplayText("");

    const typingInterval = setInterval(() => {
      if (example && index < example.length) {
        setDisplayText(example.slice(0, index + 1));
        index++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);

        // Move to next example after delay
        setTimeout(() => {
          setCurrentExample((prev) => (prev + 1) % strategyExamples.length);
        }, 3000);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, [currentExample]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid opacity-50" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left column - Copy */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              <span className="text-sm text-accent font-medium">
                AI-Powered Trading / AI驱动交易
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
              <span className="text-white">用一句话</span>
              <br />
              <span className="text-gradient">生成量化策略</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-white/70 max-w-xl">
              告别复杂的编程，只需用自然语言描述你的交易想法， AI
              将自动生成可执行的策略代码。
              <span className="block mt-2 text-white/50">
                No coding required. Describe your strategy in plain language.
              </span>
            </p>

            {/* Stats */}
            <div className="flex gap-8">
              <div>
                <div className="text-3xl font-bold text-profit">+53.17%</div>
                <div className="text-sm text-white/50">累计收益率</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">70%+</div>
                <div className="text-sm text-white/50">开发效率提升</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">0</div>
                <div className="text-sm text-white/50">代码经验要求</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="animate-glow">
                  免费体验 / Try Free
                </Button>
              </Link>
              <Link href="/dashboard/advisor">
                <Button variant="outline" size="lg">
                  AI顾问 / AI Advisor
                </Button>
              </Link>
            </div>
          </div>

          {/* Right column - Interactive demo */}
          <div className="relative">
            {/* Strategy Editor Card */}
            <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-2xl">
              {/* Editor header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-primary/50 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-loss/80" />
                  <div className="w-3 h-3 rounded-full bg-accent/80" />
                  <div className="w-3 h-3 rounded-full bg-profit/80" />
                </div>
                <span className="text-sm text-white/50 ml-2">
                  策略编辑器 / Strategy Editor
                </span>
              </div>

              {/* Input area */}
              <div className="p-6 border-b border-border">
                <label className="block text-sm text-white/50 mb-2">
                  📝 用自然语言描述你的策略 / Describe your strategy
                </label>
                <div className="relative">
                  <div className="min-h-[60px] p-4 bg-primary/50 rounded-lg border border-border text-white">
                    {displayText}
                    {isTyping && (
                      <span className="inline-block w-0.5 h-5 bg-accent ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1.5 text-xs bg-accent/20 text-accent rounded-md hover:bg-accent/30 transition">
                    ✨ AI优化
                  </button>
                  <button className="px-3 py-1.5 text-xs bg-white/10 text-white/70 rounded-md hover:bg-white/20 transition">
                    示例
                  </button>
                </div>
              </div>

              {/* Generated code area */}
              <div className="p-6">
                <label className="block text-sm text-white/50 mb-2">
                  🤖 AI生成的策略代码 / Generated Code
                </label>
                <pre className="p-4 bg-primary/80 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono text-profit/90">
                    {generatedCode}
                  </code>
                </pre>

                {/* Result actions */}
                <div className="flex gap-2 mt-4">
                  <Link href="/dashboard" className="flex-1">
                    <Button size="sm" className="w-full">
                      运行回测 / Backtest
                    </Button>
                  </Link>
                  <Link href="/dashboard/trading" className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      开始交易 / Trade
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -right-4 px-3 py-1.5 bg-profit/20 border border-profit/30 rounded-full text-profit text-sm">
              回测胜率 65%
            </div>
            <div className="absolute -bottom-4 -left-4 px-3 py-1.5 bg-accent/20 border border-accent/30 rounded-full text-accent text-sm">
              DeepSeek AI
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
