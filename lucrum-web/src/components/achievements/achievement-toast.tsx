"use client";

/**
 * Achievement Toast
 *
 * Displays a celebratory toast notification when a user unlocks an achievement.
 * Uses the sonner toast system with a custom styled component and CSS sparkle animation.
 *
 * The component polls the achievement store for pending toasts and shows them
 * sequentially with a small delay between each.
 *
 * @module components/achievements/achievement-toast
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  useAchievementStore,
  ACHIEVEMENTS,
  type AchievementDef,
} from "@/lib/stores/achievement-store";

// =============================================================================
// Styles (CSS-in-JS for the sparkle animation)
// =============================================================================

const SPARKLE_KEYFRAMES = `
@keyframes achievement-sparkle {
  0% { opacity: 0; transform: scale(0.5) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
  100% { opacity: 0; transform: scale(0.5) rotate(360deg); }
}
@keyframes achievement-glow {
  0% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.6), 0 0 40px rgba(245, 158, 11, 0.2); }
  100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.3); }
}
@keyframes achievement-slide-in {
  0% { opacity: 0; transform: translateY(10px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
`;

// Inject keyframes once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = SPARKLE_KEYFRAMES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// =============================================================================
// Toast Content Component
// =============================================================================

function AchievementToastContent({ achievement }: { achievement: AchievementDef }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "12px",
        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(59, 130, 246, 0.1))",
        border: "1px solid rgba(245, 158, 11, 0.3)",
        animation: "achievement-slide-in 0.4s ease-out, achievement-glow 2s ease-in-out infinite",
        position: "relative",
        overflow: "hidden",
        minWidth: "280px",
      }}
    >
      {/* Sparkle pseudo-element via dedicated span */}
      <span
        style={{
          position: "absolute",
          top: "4px",
          right: "8px",
          fontSize: "10px",
          animation: "achievement-sparkle 1.5s ease-in-out infinite",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        &#x2728;
      </span>
      <span
        style={{
          position: "absolute",
          bottom: "6px",
          right: "24px",
          fontSize: "8px",
          animation: "achievement-sparkle 1.5s ease-in-out 0.5s infinite",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        &#x2728;
      </span>

      {/* Emoji badge */}
      <div
        style={{
          fontSize: "32px",
          lineHeight: 1,
          flexShrink: 0,
          filter: "drop-shadow(0 0 8px rgba(245, 158, 11, 0.4))",
        }}
      >
        {achievement.emoji}
      </div>

      {/* Text content */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#fbbf24",
            marginBottom: "2px",
          }}
        >
          {achievement.name} \u2014 \u5DF2\u89E3\u9501\uFF01
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.6)",
            lineHeight: 1.4,
          }}
        >
          {achievement.reward}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Toast Trigger Hook
// =============================================================================

/**
 * Show an achievement unlock toast via the sonner toast system.
 */
function showAchievementToast(achievement: AchievementDef) {
  injectStyles();
  toast.custom(
    () => <AchievementToastContent achievement={achievement} />,
    {
      duration: 6000,
      position: "bottom-right",
    },
  );
}

// =============================================================================
// AchievementToastManager Component
// =============================================================================

/**
 * Mount this component once in your layout. It watches the achievement store
 * for pending toast notifications and displays them via sonner.
 *
 * @example
 * ```tsx
 * <AchievementToastManager />
 * ```
 */
export function AchievementToastManager() {
  const pendingToasts = useAchievementStore((s) => s.pendingToasts);
  const consumeToast = useAchievementStore((s) => s.consumeToast);
  const processingRef = useRef(false);

  useEffect(() => {
    if (pendingToasts.length === 0 || processingRef.current) return;

    processingRef.current = true;

    // Show toasts with a staggered delay
    const timer = setTimeout(() => {
      const achievementId = consumeToast();
      if (achievementId) {
        const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
        if (def) {
          showAchievementToast(def);
        }
      }
      processingRef.current = false;
    }, 800);

    return () => {
      clearTimeout(timer);
      processingRef.current = false;
    };
  }, [pendingToasts, consumeToast]);

  // This component renders nothing — it's a side-effect manager
  return null;
}

export default AchievementToastManager;
