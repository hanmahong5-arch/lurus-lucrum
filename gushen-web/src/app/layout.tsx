import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastSystem } from "@/components/feedback/toast-system";
import { StatusBar } from "@/components/layout/status-bar";
import { GlobalCommandPalette } from "@/components/command-palette";
import { SkipLink } from "@/components/accessibility/skip-link";
import { LiveRegionProvider } from "@/components/accessibility/live-region";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GuShen | AI-Powered Quantitative Trading Platform",
  description:
    "Transform your trading ideas into automated strategies with natural language. No coding required. Powered by advanced AI and VeighNa quantitative framework.",
  keywords: [
    "quantitative trading",
    "AI trading",
    "algorithmic trading",
    "natural language strategy",
    "DeepSeek",
    "VeighNa",
  ],
  authors: [{ name: "Lurus" }],
  openGraph: {
    title: "GuShen | AI-Powered Quantitative Trading",
    description:
      "Describe your strategy in plain language, let AI do the rest.",
    type: "website",
    locale: "zh_CN",
    alternateLocale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased bg-background text-foreground md:pb-7">
        {/* Skip to main content link for keyboard users (Story 7.3 / WCAG 2.4.1) */}
        <SkipLink />
        {/* ARIA live region provider for screen reader announcements (Story 7.3 / WCAG 4.1.3) */}
        <LiveRegionProvider />
        <AuthSessionProvider>
          {/* ErrorBoundary component handles logging internally */}
          {/* ErrorBoundary 组件内部处理日志记录 */}
          <ErrorBoundary componentName="App">
            {children}
          </ErrorBoundary>
          {/* Global command palette (Story 6.1) */}
          <GlobalCommandPalette />
          {/* Toast notification system (Story 1.2) */}
          <ToastSystem />
          {/* Bottom status bar (Story 1.3) */}
          <StatusBar />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
