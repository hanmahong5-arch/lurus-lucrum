/**
 * Tailwind CSS Configuration - Lucrum Quant Trading Command Center
 * 量化交易指挥中心设计系统配置
 *
 * Design Philosophy: "The Quant's Cockpit"
 * - Control: Responsive and deliberate interactions
 * - Precision: Pixel-perfect alignment, monospaced financial data
 * - Focus: Dark mode, high contrast data, low contrast structure
 */

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ============================================
      // COLOR PALETTE - "Psychology of Wealth & Risk"
      // ============================================
      colors: {
        // Backgrounds - Deep, rich voids (not pure black)
        void: {
          DEFAULT: "#09090b",
          50: "#18181b",
          100: "#0f0f12",
        },
        surface: {
          DEFAULT: "#18181b",
          hover: "#27272a",
          active: "#3f3f46",
          border: "#27272a",
        },
        // Primary - Electric Trust Blue
        primary: {
          DEFAULT: "#3b82f6",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        // Accent - Gold/Warning for VIP/High Priority
        accent: {
          DEFAULT: "#f59e0b",
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        // Semantic - Market Sentiment (CN Mode: Red=Up, Green=Down)
        // These use CSS variables for runtime switching
        profit: "rgb(var(--color-profit) / <alpha-value>)",
        loss: "rgb(var(--color-loss) / <alpha-value>)",
        // Neon variants for active signals
        "profit-neon": "rgb(var(--color-profit-neon) / <alpha-value>)",
        "loss-neon": "rgb(var(--color-loss-neon) / <alpha-value>)",
        // Muted variants for fear mitigation
        "profit-muted": "rgb(var(--color-profit-muted) / <alpha-value>)",
        "loss-muted": "rgb(var(--color-loss-muted) / <alpha-value>)",
        // Neutral data colors
        neutral: {
          DEFAULT: "#71717a",
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
        // Chart colors
        chart: {
          blue: "#3b82f6",
          cyan: "#06b6d4",
          purple: "#8b5cf6",
          pink: "#ec4899",
          orange: "#f97316",
          yellow: "#eab308",
        },
        // Legacy compatibility
        background: "#09090b",
        border: "#27272a",

        // ============================================
        // LUCRUM EXTENDED DESIGN TOKENS
        // ============================================

        // Score Colors - 策略评分色 (AC-1)
        "score-s": "rgb(var(--lucrum-color-score-s) / <alpha-value>)",
        "score-a": "rgb(var(--lucrum-color-score-a) / <alpha-value>)",
        "score-b": "rgb(var(--lucrum-color-score-b) / <alpha-value>)",
        "score-c": "rgb(var(--lucrum-color-score-c) / <alpha-value>)",
        "score-d": "rgb(var(--lucrum-color-score-d) / <alpha-value>)",

        // Data Source Colors - 数据源标识色 (AC-2)
        "source-db": "rgb(var(--lucrum-color-source-db) / <alpha-value>)",
        "source-api": "rgb(var(--lucrum-color-source-api) / <alpha-value>)",
        "source-sim": "rgb(var(--lucrum-color-source-sim) / <alpha-value>)",

        // Banner Colors - 横幅警告色
        "banner-warn": "rgb(var(--lucrum-color-banner-warn) / <alpha-value>)",

        // AI Visual Language - AI 视觉语言令牌 (AC-3)
        ai: "rgb(var(--lucrum-color-ai) / <alpha-value>)",
        "ai-bg": "rgb(var(--lucrum-bg-ai) / 0.10)",
        "ai-border": "rgb(var(--lucrum-border-ai) / 0.20)",

        // Workflow Step Colors - 工作流步骤色 (AC-4)
        "step-active": "rgb(var(--lucrum-color-step-active) / <alpha-value>)",
        "step-done": "rgb(var(--lucrum-color-step-done) / <alpha-value>)",
        "step-pending": "rgb(var(--lucrum-color-step-pending) / <alpha-value>)",

        // Status Light Colors - 状态灯色 (AC-5)
        "status-ready": "rgb(var(--lucrum-color-status-ready) / <alpha-value>)",
        "status-warn": "rgb(var(--lucrum-color-status-warn) / <alpha-value>)",
        "status-block": "rgb(var(--lucrum-color-status-block) / <alpha-value>)",

        // Chart Extension Colors - 图表扩展色 (AC-7)
        "chart-benchmark": "rgb(var(--lucrum-color-chart-benchmark) / <alpha-value>)",
        "chart-signal": "rgb(var(--lucrum-color-chart-signal) / <alpha-value>)",
      },

      // ============================================
      // BACKGROUND COLORS EXTENSION (AC-6)
      // ============================================
      backgroundColor: {
        // Surface Level Extension - 背景层级扩展
        "surface-elevated": "rgb(var(--lucrum-bg-surface-elevated) / <alpha-value>)",
        "surface-modal": "rgb(var(--lucrum-bg-surface-modal) / <alpha-value>)",
      },

      // ============================================
      // TYPOGRAPHY - "Data is King"
      // ============================================
      fontFamily: {
        // Headings - Clean, modern sans-serif
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
        // Data/Code - Monospaced with tabular numbers
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
        data: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        // Data-specific sizes (AC-8: data-sm adjusted to 13px for better readability)
        "data-xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        "data-sm": ["0.8125rem", { lineHeight: "1.25rem", letterSpacing: "0.01em" }], // 13px (was 12px)
        "data-base": ["0.875rem", { lineHeight: "1.5rem", letterSpacing: "0" }],
        "data-lg": ["1rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "data-xl": ["1.25rem", { lineHeight: "2rem", letterSpacing: "-0.02em" }],
        "data-2xl": ["1.5rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }],
        // Stat numbers
        "stat-sm": ["1.5rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "stat-md": ["2rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "stat-lg": ["2.5rem", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "stat-xl": ["3rem", { lineHeight: "1", letterSpacing: "-0.03em" }],
        // Display - Large score/hero numbers (AC-8)
        display: ["clamp(2rem, 5vw, 3rem)", { lineHeight: "1.1", fontWeight: "700" }],
      },

      // ============================================
      // SPACING & SIZING
      // ============================================
      spacing: {
        "4.5": "1.125rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      borderWidth: {
        "0.5": "0.5px",
      },

      // ============================================
      // SHADOWS - Glass & Glow Aesthetic
      // ============================================
      boxShadow: {
        // Glass panel shadows
        glass: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        "glass-sm": "0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
        // Glow effects for active elements
        "glow-primary": "0 0 10px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)",
        "glow-accent": "0 0 10px rgba(245, 158, 11, 0.5), 0 0 20px rgba(245, 158, 11, 0.3)",
        "glow-profit": "0 0 10px rgb(var(--color-profit-neon) / 0.5), 0 0 20px rgb(var(--color-profit-neon) / 0.3)",
        "glow-loss": "0 0 10px rgb(var(--color-loss-neon) / 0.5), 0 0 20px rgb(var(--color-loss-neon) / 0.3)",
        // Inset for pressed buttons
        "inset-sm": "inset 0 1px 2px rgba(0, 0, 0, 0.3)",
        "inset-md": "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
        // Card elevation
        "card-sm": "0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)",
        "card-md": "0 4px 6px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
        "card-lg": "0 10px 15px rgba(0, 0, 0, 0.4), 0 4px 6px rgba(0, 0, 0, 0.3)",
      },

      // ============================================
      // BACKDROP BLUR - Glassmorphism
      // ============================================
      backdropBlur: {
        xs: "2px",
      },

      // ============================================
      // ANIMATIONS - "The Pulse" & Tactile Feedback
      // ============================================
      animation: {
        // Data pulse - satisfies craving for "live action"
        "pulse-data": "pulse-data 0.3s ease-out",
        "pulse-profit": "pulse-profit 0.3s ease-out",
        "pulse-loss": "pulse-loss 0.3s ease-out",
        // Glow animations
        glow: "glow 2s ease-in-out infinite alternate",
        "glow-pulse": "glow-pulse 1.5s ease-in-out infinite",
        // AI pulse animation (AC-3)
        "ai-pulse": "ai-pulse 1.5s ease-in-out infinite",
        // Loading/Processing
        "thinking-dot": "thinking-dot 1.4s infinite ease-in-out both",
        "data-stream": "data-stream 0.8s ease-in-out infinite",
        "scan-line": "scan-line 2s linear infinite",
        // Slide animations
        "slide-up": "slide-up 0.2s ease-out",
        "slide-down": "slide-down 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        // Chart animations
        "draw-line": "draw-line 1s ease-out forwards",
        // Tactile button press
        "button-press": "button-press 0.1s ease-out",
      },
      keyframes: {
        // Data update pulse
        "pulse-data": {
          "0%": { backgroundColor: "rgba(59, 130, 246, 0.2)" },
          "100%": { backgroundColor: "transparent" },
        },
        "pulse-profit": {
          "0%": { backgroundColor: "rgb(var(--color-profit-neon) / 0.3)" },
          "100%": { backgroundColor: "transparent" },
        },
        "pulse-loss": {
          "0%": { backgroundColor: "rgb(var(--color-loss-neon) / 0.3)" },
          "100%": { backgroundColor: "transparent" },
        },
        // Glow effects
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(59, 130, 246, 0.3), 0 0 10px rgba(59, 130, 246, 0.2)" },
          "100%": { boxShadow: "0 0 15px rgba(59, 130, 246, 0.5), 0 0 25px rgba(59, 130, 246, 0.3)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        // AI pulse animation keyframes (AC-3)
        "ai-pulse": {
          "0%, 100%": {
            opacity: "0.7",
            borderColor: "rgb(var(--lucrum-border-ai) / 0.20)",
          },
          "50%": {
            opacity: "1",
            borderColor: "rgb(var(--lucrum-border-ai) / 0.40)",
          },
        },
        // Thinking/Processing animation
        "thinking-dot": {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.5" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
        "data-stream": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        // Slide animations
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Chart line drawing
        "draw-line": {
          "0%": { strokeDashoffset: "1000" },
          "100%": { strokeDashoffset: "0" },
        },
        // Tactile button press
        "button-press": {
          "0%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(1px)" },
          "100%": { transform: "translateY(0)" },
        },
      },

      // ============================================
      // TRANSITIONS
      // ============================================
      transitionDuration: {
        "50": "50ms",
        "250": "250ms",
        "400": "400ms",
      },
      transitionTimingFunction: {
        "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "smooth-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      // ============================================
      // Z-INDEX SCALE
      // ============================================
      zIndex: {
        "60": "60",
        "70": "70",
        "80": "80",
        "90": "90",
        "100": "100",
      },

      // ============================================
      // BACKGROUND IMAGES
      // ============================================
      backgroundImage: {
        // Grid patterns
        "grid-small": `linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)`,
        "grid-large": `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
        // Data stream gradient
        "data-stream": "linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.3), transparent)",
        // Equity curve gradient
        "equity-profit": "linear-gradient(180deg, rgb(var(--color-profit) / 0.3), transparent)",
        "equity-loss": "linear-gradient(180deg, rgb(var(--color-loss) / 0.3), transparent)",
        // Scan effect
        "scan-gradient": "linear-gradient(180deg, transparent, rgba(59, 130, 246, 0.1), transparent)",
      },
      backgroundSize: {
        "grid-small": "20px 20px",
        "grid-large": "50px 50px",
      },
    },
  },
  plugins: [
    // Custom plugin for utility classes
    function ({ addUtilities, addComponents, theme }: { addUtilities: Function; addComponents: Function; theme: Function }) {
      // Tabular numbers for financial data alignment
      addUtilities({
        ".tabular-nums": {
          fontVariantNumeric: "tabular-nums",
        },
        ".font-data": {
          fontFamily: theme("fontFamily.mono"),
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.02em",
        },
        // Glass panel effect
        ".glass-panel": {
          backgroundColor: "rgba(24, 24, 27, 0.8)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          boxShadow: theme("boxShadow.glass"),
        },
        ".glass-panel-sm": {
          backgroundColor: "rgba(24, 24, 27, 0.6)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.03)",
          boxShadow: theme("boxShadow.glass-sm"),
        },
        // Glow active state
        ".glow-active": {
          boxShadow: theme("boxShadow.glow-primary"),
        },
        ".glow-active-accent": {
          boxShadow: theme("boxShadow.glow-accent"),
        },
        // Button tactile effect
        ".btn-tactile": {
          transition: "transform 0.1s ease-out, box-shadow 0.1s ease-out",
          "&:active": {
            transform: "translateY(1px)",
            boxShadow: theme("boxShadow.inset-sm"),
          },
        },
        // Data cell pulse (for live updates)
        ".data-pulse-profit": {
          animation: "pulse-profit 0.3s ease-out",
        },
        ".data-pulse-loss": {
          animation: "pulse-loss 0.3s ease-out",
        },
        // Scan line effect
        ".scan-effect": {
          position: "relative",
          overflow: "hidden",
          "&::after": {
            content: '""',
            position: "absolute",
            top: "0",
            left: "0",
            right: "0",
            height: "2px",
            background: "linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent)",
            animation: "scan-line 2s linear infinite",
          },
        },
        // Text glow
        ".text-glow-primary": {
          textShadow: "0 0 10px rgba(59, 130, 246, 0.5)",
        },
        ".text-glow-accent": {
          textShadow: "0 0 10px rgba(245, 158, 11, 0.5)",
        },
        ".text-glow-profit": {
          textShadow: "0 0 10px rgb(var(--color-profit-neon) / 0.5)",
        },
        ".text-glow-loss": {
          textShadow: "0 0 10px rgb(var(--color-loss-neon) / 0.5)",
        },
        // AI Mark utility class (AC-3)
        ".ai-mark": {
          borderLeft: "3px solid rgb(var(--lucrum-color-ai))",
          backgroundColor: "rgb(var(--lucrum-bg-ai) / 0.10)",
          paddingLeft: theme("spacing.3"),
          color: "rgb(var(--lucrum-color-ai))",
        },
        // AI Mark with pulse animation
        ".ai-mark-pulse": {
          borderLeft: "3px solid rgb(var(--lucrum-color-ai))",
          backgroundColor: "rgb(var(--lucrum-bg-ai) / 0.10)",
          paddingLeft: theme("spacing.3"),
          color: "rgb(var(--lucrum-color-ai))",
          animation: "ai-pulse 1.5s ease-in-out infinite",
        },
      });

      // Component classes
      addComponents({
        // Stat card styling
        ".stat-card": {
          display: "flex",
          flexDirection: "column",
          padding: theme("spacing.4"),
          backgroundColor: theme("colors.surface.DEFAULT"),
          borderRadius: theme("borderRadius.lg"),
          border: "1px solid rgba(255, 255, 255, 0.05)",
          ".stat-value": {
            fontFamily: theme("fontFamily.mono"),
            fontVariantNumeric: "tabular-nums",
            fontSize: theme("fontSize.stat-md")[0],
            lineHeight: "1",
            letterSpacing: "-0.02em",
          },
          ".stat-label": {
            fontSize: theme("fontSize.xs")[0],
            color: theme("colors.neutral.400"),
            marginTop: theme("spacing.1"),
          },
        },
        // Terminal/Code block styling
        ".terminal-block": {
          backgroundColor: "#0d0d0d",
          borderRadius: theme("borderRadius.lg"),
          border: "1px solid rgba(255, 255, 255, 0.05)",
          fontFamily: theme("fontFamily.mono"),
          fontSize: theme("fontSize.sm")[0],
          lineHeight: "1.6",
          overflow: "hidden",
        },
        // Ticker tape styling
        ".ticker-tape": {
          display: "flex",
          alignItems: "center",
          gap: theme("spacing.4"),
          padding: `${theme("spacing.2")} ${theme("spacing.4")}`,
          backgroundColor: "rgba(9, 9, 11, 0.95)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          fontFamily: theme("fontFamily.mono"),
          fontSize: theme("fontSize.xs")[0],
          fontVariantNumeric: "tabular-nums",
        },
      });
    },
  ],
};

export default config;
