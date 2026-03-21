"use client";

/**
 * Continue Work Banner
 *
 * Displays a subtle, dismissible banner at the top of the dashboard
 * when the user has an unfinished strategy draft from a previous session.
 * Reads draft info from strategy-workspace-store.
 *
 * - Only shown on first mount; dismissed for the current session.
 * - Uses sessionStorage to track dismissal state.
 *
 * @module components/dashboard/continue-work-banner
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  useStrategyWorkspaceStore,
  selectDrafts,
  selectStrategyInput,
  selectGeneratedCode,
} from "@/lib/stores/strategy-workspace-store";

// Session storage key to track dismissal within current browser session
const DISMISS_KEY = "lucrum:continue-banner-dismissed";

export function ContinueWorkBanner() {
  const router = useRouter();
  const drafts = useStrategyWorkspaceStore(selectDrafts);
  const strategyInput = useStrategyWorkspaceStore(selectStrategyInput);
  const generatedCode = useStrategyWorkspaceStore(selectGeneratedCode);
  const [dismissed, setDismissed] = useState(true); // Start hidden, show after mount check

  // Check session dismissal state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wasDismissed = sessionStorage.getItem(DISMISS_KEY) === "true";
    setDismissed(wasDismissed);
  }, []);

  // Determine draft info to display
  const draftInfo = useMemo(() => {
    // If current workspace has code, user is already working — no banner needed
    if (generatedCode) return null;

    // Check the latest draft for a strategy name or input
    const latestDraft = drafts[0];
    if (!latestDraft) return null;

    const draftInput = latestDraft.workspace.strategyInput;
    const draftCode = latestDraft.workspace.generatedCode;

    // Only show banner if the draft has meaningful content
    if (!draftInput && !draftCode) return null;

    // Extract a display name from the draft
    let displayName = "";
    if (draftCode) {
      const classMatch = draftCode.match(/class\s+(\w+)\s*[\(:]/);
      if (classMatch?.[1] && classMatch[1] !== "AIStrategy") {
        displayName = classMatch[1].replace(/Strategy$/, "");
      }
    }
    if (!displayName && draftInput) {
      displayName =
        draftInput.length > 30
          ? draftInput.slice(0, 30) + "..."
          : draftInput;
    }
    if (!displayName) {
      displayName = "未命名策略";
    }

    return { displayName, draftId: latestDraft.id };
  }, [drafts, generatedCode]);

  // Don't render if dismissed or nothing to show
  if (dismissed || !draftInfo) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "true");
    }
  };

  const handleContinue = () => {
    // Load the draft via the store and navigate
    const { loadDraft } = useStrategyWorkspaceStore.getState();
    loadDraft(draftInfo.draftId);
    handleDismiss();
    // Navigate to dashboard (already here, but force edit mode)
    router.replace("/dashboard", { scroll: false });
  };

  return (
    <div
      className={cn(
        "mx-4 mt-2 px-4 py-3 rounded-lg",
        "bg-accent/5 border border-accent/15",
        "flex items-center justify-between gap-3",
        "animate-in fade-in slide-in-from-top-2 duration-300",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-2 h-2 rounded-full bg-accent shrink-0 animate-pulse" />
        <span className="text-sm text-neutral-300 truncate">
          继续编辑「<span className="text-accent font-medium">{draftInfo.displayName}</span>」
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleContinue}
          className="px-3 py-1.5 text-xs font-medium text-accent hover:text-accent/80 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-md transition-all btn-tactile"
        >
          继续
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors rounded"
          aria-label="关闭"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
