import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { EnhancedErrorBoundary } from "@/components/providers/enhanced-error-boundary";
import { ToastSystem } from "@/components/feedback/toast-system";
import { StatusBar } from "@/components/layout/status-bar";
import { GlobalCommandPalette } from "@/components/command-palette";
import { SkipLink } from "@/components/accessibility/skip-link";
import { LiveRegionProvider } from "@/components/accessibility/live-region";
import { PWAInstallBanner } from "@/components/pwa/install-banner";
import { I18nProvider } from "@/lib/i18n/context";
import { AchievementToastManager } from "@/components/achievements/achievement-toast";
import {
  LUCRUM_THEME_COOKIE,
  parseThemeCookie,
  THEMES,
  ThemeProvider,
} from "@/lib/theme";

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

// NOTE: viewport.themeColor is intentionally omitted — Next 14's metadata API
// bakes the value at build time, but Lucrum's theme is runtime-switchable.
// `<ThemeProvider>` patches the `<meta name="theme-color">` tag in the DOM
// after hydration using each theme's `metaThemeColor` from the registry.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Lucrum | AI-Powered Quantitative Trading Platform",
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lucrum",
  },
  openGraph: {
    title: "Lucrum | AI-Powered Quantitative Trading",
    description:
      "Describe your strategy in plain language, let AI do the rest.",
    type: "website",
    locale: "zh_CN",
    alternateLocale: "en_US",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  // Resolve the active theme from the cookie so first paint carries the
  // correct `data-theme` attribute — no FOUC on hard refresh.
  const themeId = parseThemeCookie(cookies().get(LUCRUM_THEME_COOKIE)?.value);
  const initialMetaThemeColor = THEMES[themeId].metaThemeColor;
  return (
    <html
      lang="zh"
      data-theme={themeId}
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content={initialMetaThemeColor} />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased bg-background text-foreground md:pb-7">
        {/* Skip to main content link for keyboard users (Story 7.3 / WCAG 2.4.1) */}
        <SkipLink />
        {/* ARIA live region provider for screen reader announcements (Story 7.3 / WCAG 4.1.3) */}
        <LiveRegionProvider />
        <AuthSessionProvider session={session}>
          <I18nProvider>
            <ThemeProvider initialTheme={themeId}>
              {/* Enhanced error boundary with recovery UI and workspace preservation */}
              <EnhancedErrorBoundary componentName="App">
                {children}
              </EnhancedErrorBoundary>
              {/* Global command palette (Story 6.1) */}
              <GlobalCommandPalette />
              {/* Toast notification system (Story 1.2) */}
              <ToastSystem />
              {/* Achievement unlock toast manager (Attention Economy P1) */}
              <AchievementToastManager />
              {/* PWA install banner (Phase 4 Task 4) */}
              <PWAInstallBanner />
              {/* Bottom status bar (Story 1.3) */}
              <StatusBar />
            </ThemeProvider>
          </I18nProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
