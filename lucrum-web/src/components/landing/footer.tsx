"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-12 border-t border-border bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-400 flex items-center justify-center">
                <span className="text-primary-600 font-bold text-lg">G</span>
              </div>
              <span className="text-xl font-bold text-white">
                Lucrum<span className="text-accent">.</span>
              </span>
            </Link>
            <p className="text-white/50 max-w-sm">
              AI驱动的量化交易平台，让每个人都能享受专业级的交易体验。
              <span className="block mt-1 text-sm">
                AI-powered quantitative trading for everyone.
              </span>
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-medium mb-4">产品 / Product</h4>
            <ul className="space-y-2 text-white/50">
              <li>
                <Link href="/dashboard" className="hover:text-white transition">
                  策略编辑器
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/trading"
                  className="hover:text-white transition"
                >
                  交易面板
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/advisor"
                  className="hover:text-white transition"
                >
                  AI投资顾问
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/UU114/AI-QTRD"
                  target="_blank"
                  className="hover:text-white transition"
                >
                  开源项目
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-medium mb-4">支持 / Support</h4>
            <ul className="space-y-2 text-white/50">
              <li>
                <Link
                  href="/dashboard/advisor"
                  className="hover:text-white transition"
                >
                  AI帮助
                </Link>
              </li>
              <li>
                <Link
                  href="mailto:contact@lurus.cn"
                  className="hover:text-white transition"
                >
                  联系我们
                </Link>
              </li>
              <li>
                <Link
                  href="https://lurus.cn"
                  target="_blank"
                  className="hover:text-white transition"
                >
                  Lurus官网
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/UU114/AI-QTRD"
                  target="_blank"
                  className="hover:text-white transition"
                >
                  GitHub
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            © 2024 Lucrum by Lurus. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-white/40 text-sm">
            <span>Powered by</span>
            <span className="text-accent">DeepSeek</span>
            <span>+</span>
            <span className="text-white/60">VeighNa</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
