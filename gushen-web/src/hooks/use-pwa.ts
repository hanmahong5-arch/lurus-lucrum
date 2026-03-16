"use client";

/**
 * PWA Service Worker Registration Hook
 *
 * Registers the service worker on mount and provides
 * push notification subscription utilities.
 */

import { useEffect, useState, useCallback } from "react";

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Check if already installed as PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setSwRegistration(reg);
        console.log("[PWA] Service worker registered");
      })
      .catch((err) => {
        console.warn("[PWA] SW registration failed:", err);
      });

    // Listen for installability
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setIsInstallable(true);
      // Store the event for later use
      (window as unknown as { deferredPrompt?: Event }).deferredPrompt = e;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const deferredPrompt = (
      window as unknown as { deferredPrompt?: { prompt: () => Promise<void> } }
    ).deferredPrompt;
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    setIsInstallable(false);
    return true;
  }, []);

  return {
    isInstallable,
    isInstalled,
    swRegistration,
    promptInstall,
  };
}
