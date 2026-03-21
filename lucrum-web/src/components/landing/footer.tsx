"use client";

/**
 * Landing Page Footer
 * Clean, standard footer with essential links.
 */

import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-10 border-t border-white/[0.04] bg-void">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-accent-400 flex items-center justify-center">
                <span className="text-void font-bold text-xs">L</span>
              </div>
              <span className="text-base font-bold text-white tracking-tight">
                Lucrum<span className="text-accent">.</span>
              </span>
            </Link>
            <p className="text-sm text-neutral-500 max-w-xs">
              AI 量化策略验证平台
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-medium text-white mb-3">产品</h4>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  策略工作台
                </Link>
              </li>
              <li>
                <Link href="/dashboard/marketplace" className="hover:text-white transition-colors">
                  策略市场
                </Link>
              </li>
              <li>
                <Link href="/dashboard/advisor" className="hover:text-white transition-colors">
                  AI 顾问
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-medium text-white mb-3">支持</h4>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li>
                <Link href="https://docs.lurus.cn" target="_blank" className="hover:text-white transition-colors">
                  文档中心
                </Link>
              </li>
              <li>
                <Link href="mailto:contact@lurus.cn" className="hover:text-white transition-colors">
                  联系我们
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-medium text-white mb-3">关于</h4>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li>
                <Link href="https://lurus.cn" target="_blank" className="hover:text-white transition-colors">
                  Lurus 官网
                </Link>
              </li>
              <li>
                <Link href="https://github.com/UU114/AI-QTRD" target="_blank" className="hover:text-white transition-colors">
                  GitHub
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-neutral-600">
            &copy; {new Date().getFullYear()} Lucrum by Lurus
          </p>
          <p className="text-xs text-neutral-700">
            回测结果不代表未来收益
          </p>
        </div>
      </div>
    </footer>
  );
}
