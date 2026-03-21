"use client";

/**
 * CTA Section - Social proof + final call to action.
 * Low friction, professional tone.
 */

import Link from "next/link";

// Aggregate numbers (showcase data)
const SOCIAL_PROOF = [
  { value: "12,800+", label: "次回测验证" },
  { value: "3,200+", label: "投资者信赖" },
] as const;

export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.03] to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* Social proof */}
        <div className="flex justify-center gap-8 sm:gap-16 mb-12">
          {SOCIAL_PROOF.map((item) => (
            <div key={item.label}>
              <span className="text-xl sm:text-2xl font-mono tabular-nums font-bold text-white">
                {item.value}
              </span>
              <span className="text-sm text-neutral-500 ml-2">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          验证你的第一个策略
        </h2>

        {/* CTA */}
        <div className="mt-8">
          <Link
            href="/auth/register"
            className="inline-flex items-center px-8 py-3.5 text-base font-medium text-white bg-primary hover:bg-primary-600 rounded-xl transition-all btn-tactile shadow-glow-primary/20 hover:shadow-glow-primary/40"
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
