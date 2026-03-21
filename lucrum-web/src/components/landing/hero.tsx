"use client";

/**
 * Hero Section - Statement + Proof
 * Shows headline, subheadline, and 3 aggregate stats.
 * No interactive demo, no code preview. Pure aspiration.
 */

import Link from "next/link";

// Aggregate platform stats (showcase data)
const PLATFORM_STATS = [
  { value: "48.3%", label: "策略库年化最高" },
  { value: "1.67", label: "平均夏普比率" },
  { value: "12,800+", label: "累计回测验证" },
] as const;

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background: subtle grid + gradient orbs */}
      <div className="absolute inset-0 bg-grid-small opacity-40" />
      <div className="absolute top-1/3 -left-32 w-[500px] h-[500px] bg-primary/[0.06] rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] bg-accent/[0.04] rounded-full blur-[100px]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.15] tracking-tight">
          <span className="text-white">量化策略</span>
          <span className="text-neutral-500">，</span>
          <span className="text-gradient">经过验证</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          不是&ldquo;可能赚钱&rdquo;，而是已回测验证的量化模型。
          <br className="hidden sm:block" />
          用自然语言描述想法，AI 生成策略，历史数据说话。
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 sm:gap-14 mt-12">
          {PLATFORM_STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-white">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-neutral-500 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/auth/register"
            className="inline-flex items-center px-7 py-3 text-base font-medium text-white bg-primary hover:bg-primary-600 rounded-xl transition-all btn-tactile shadow-glow-primary/20 hover:shadow-glow-primary/40"
          >
            免费开始
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <p className="text-xs text-neutral-600 mt-3">
            不需要信用卡 &middot; 10秒注册
          </p>
        </div>
      </div>
    </section>
  );
}
