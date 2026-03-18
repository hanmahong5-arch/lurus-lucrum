"use client";

/**
 * Dashboard Navigation Header Component
 * 仪表盘导航头部组件
 *
 * Unified navigation component for all dashboard pages
 * 所有仪表盘页面的统一导航组件
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation items definition
// 导航项定义
const NAV_ITEMS = [
  { href: "/dashboard", label: "策略编辑器", labelEn: "Strategy" },
  {
    href: "/dashboard/strategy-validation",
    label: "策略验证",
    labelEn: "Validation",
  },
  { href: "/dashboard/trading", label: "交易面板", labelEn: "Trading" },
  { href: "/dashboard/advisor", label: "投资顾问", labelEn: "Advisor" },
  { href: "/dashboard/history", label: "历史记录", labelEn: "History" },
];

interface NavHeaderProps {
  /** Show bilingual labels (Chinese + English) */
  /** 显示双语标签（中文 + 英文） */
  showEnglish?: boolean;
  /** Custom className for the header */
  /** 头部自定义类名 */
  className?: string;
}

export function NavHeader({
  showEnglish = false,
  className = "",
}: NavHeaderProps) {
  const pathname = usePathname();

  /**
   * Check if a nav item is active
   * 检查导航项是否激活
   */
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <header
      className={`sticky top-0 z-50 bg-[#1a1f36]/80 backdrop-blur-xl border-b border-[#2a2f46] ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f5a623] to-[#f5c623] flex items-center justify-center">
              <span className="text-[#1a1f36] font-bold">G</span>
            </div>
            <span className="text-lg font-bold text-white">
              Lucrum<span className="text-[#f5a623]">.</span>
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition ${
                  isActive(item.href)
                    ? "text-[#f5a623] font-medium"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {item.label}
                {showEnglish && (
                  <span className="text-white/30 ml-1 text-xs">
                    / {item.labelEn}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/50">演示账户</span>
            <div className="w-8 h-8 rounded-full bg-[#f5a623]/20 flex items-center justify-center">
              <span className="text-[#f5a623] text-sm">D</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default NavHeader;
