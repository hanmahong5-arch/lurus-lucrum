"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Heading */}
        <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
          准备好开始了吗？
          <span className="block text-2xl lg:text-3xl mt-2 text-white/60">
            Ready to get started?
          </span>
        </h2>

        {/* Description */}
        <p className="text-xl text-white/60 mb-8 max-w-2xl mx-auto">
          无需信用卡，无需编程经验。注册即可免费体验所有功能。
          <span className="block text-base mt-2 text-white/40">
            No credit card required. No coding experience needed. Free to try
            all features.
          </span>
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Link href="/dashboard">
            <Button size="lg" className="min-w-[200px]">
              立即体验 / Try Now
            </Button>
          </Link>
          <Link href="/dashboard/advisor">
            <Button variant="outline" size="lg" className="min-w-[200px]">
              咨询AI顾问 / Ask AI Advisor
            </Button>
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-8 text-white/40 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-profit">✓</span>
            <span>免费试用 / Free Trial</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-profit">✓</span>
            <span>数据安全 / Secure Data</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-profit">✓</span>
            <span>专业支持 / Pro Support</span>
          </div>
        </div>
      </div>
    </section>
  );
}
