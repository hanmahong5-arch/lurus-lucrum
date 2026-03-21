"use client";

/**
 * Landing Page Header
 * Minimal navigation bar. Transparent on hero, solid on scroll.
 */

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export function Header() {
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-void/90 backdrop-blur-xl border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-400 flex items-center justify-center">
              <span className="text-void font-bold text-sm">L</span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Lucrum<span className="text-accent">.</span>
            </span>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            {status === "loading" ? (
              <div className="w-16 h-8 rounded bg-white/5 animate-pulse" />
            ) : session ? (
              <Link
                href="/dashboard"
                className="px-4 py-1.5 text-sm font-medium text-white bg-primary/90 hover:bg-primary rounded-lg transition-colors btn-tactile"
              >
                控制台
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm text-neutral-400 hover:text-white transition-colors hidden sm:block"
                >
                  登录
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-1.5 text-sm font-medium text-white bg-primary/90 hover:bg-primary rounded-lg transition-colors btn-tactile"
                >
                  免费开始
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
