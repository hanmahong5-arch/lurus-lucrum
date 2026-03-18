"use client";

/**
 * PWA Install Banner
 *
 * Shows a dismissible banner suggesting the user to install the PWA.
 * Only appears on mobile when the app is installable.
 */

import { useState, useCallback } from "react";
import { usePWA } from "@/hooks/use-pwa";
import { Download, X } from "lucide-react";

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  const handleInstall = useCallback(async () => {
    await promptInstall();
  }, [promptInstall]);

  // Don't show if already installed, not installable, or dismissed
  if (!isInstallable || isInstalled || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-surface/95 backdrop-blur-xl border-t border-accent/20 md:hidden safe-area-pb">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-400 flex items-center justify-center shrink-0">
          <span className="text-primary-600 font-bold text-lg">G</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">
            添加到主屏幕
          </div>
          <div className="text-[11px] text-white/50">
            获取更快的访问速度和推送通知
          </div>
        </div>
        <button
          onClick={() => void handleInstall()}
          className="px-3 py-1.5 bg-accent text-primary-600 rounded-lg text-xs font-medium hover:bg-accent/90 transition shrink-0"
        >
          <Download className="w-3.5 h-3.5 inline mr-1" />
          安装
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-white/30 hover:text-white/60 transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
