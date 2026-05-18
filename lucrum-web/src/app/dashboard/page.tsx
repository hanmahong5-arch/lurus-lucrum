"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAsyncTask } from "@/hooks/use-async-task";
import { useAbortController } from "@/hooks/use-abort-controller";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ErrorCard } from "@/components/ui/error-card";
import { PanelSkeleton, ChartSkeleton, FormSkeleton, TabContentSkeleton } from "@/components/ui/loading-skeleton";
import type { BacktestResult } from "@/lib/backtest/types";
import { toAppError, type AppError } from "@/lib/errors/error-types";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ContinueWorkBanner } from "@/components/dashboard/continue-work-banner";
import { useOnboardingImport } from "@/hooks/use-onboarding-import";
import { parseStrategyParameters, updateParameterInCode } from "@/lib/strategy/parameter-parser";
import { extractCodeProgressively } from "@/lib/strategy/generate-shared";
import { useUserWorkspace } from "@/hooks/use-user-workspace";
import { useUserActions } from "@/hooks/use-user-actions";
import type { CompactBacktestConfigData } from "@/components/strategy-editor/compact-backtest-config";
import {
  useUserPreferencesStore,
  selectSplitPanelRatio,
  selectCodePreviewCollapsed,
} from "@/lib/stores/user-preferences-store";
import {
  useStrategyWorkspaceStore,
  selectWorkspace,
  selectAutoSaveStatus,
  selectHasUnsavedChanges,
  selectStrategyInput,
  selectGeneratedCode,
  selectIsGenerating,
  selectIsBacktesting,
  selectStrategyName,
  selectViewMode,
  selectGenCacheInfo,
  selectFocusedLine,
  selectLastError,
  selectLatestBacktestSummary,
} from "@/lib/stores/strategy-workspace-store";
import { generateStrategyName } from "@/lib/strategy/auto-name";
import { useAchievementStore } from "@/lib/stores/achievement-store";
import { useFeatureUsage } from "@/hooks/use-feature-usage";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";
import { trackUsage } from "@/lib/paywall/usage-tracker";

// ---------------------------------------------------------------------------
// Dynamic imports — heavy components loaded on demand to reduce initial bundle
// ---------------------------------------------------------------------------

const StrategyInput = dynamic(
  () => import("@/components/strategy-editor/strategy-input").then((m) => ({ default: m.StrategyInput })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const CodePreview = dynamic(
  () => import("@/components/strategy-editor/code-preview").then((m) => ({ default: m.CodePreview })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const BacktestPanel = dynamic(
  () => import("@/components/strategy-editor/backtest-panel").then((m) => ({ default: m.BacktestPanel })),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> },
);

const ParameterEditor = dynamic(
  () => import("@/components/strategy-editor/parameter-editor").then((m) => ({ default: m.ParameterEditor })),
  { ssr: false, loading: () => <FormSkeleton /> },
);

const EventTimelinePanel = dynamic(
  () => import("@/components/history/event-timeline-panel").then((m) => ({ default: m.EventTimelinePanel })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const ResumeTaskBanner = dynamic(
  () => import("@/components/dashboard/resume-task-banner").then((m) => ({ default: m.ResumeTaskBanner })),
  { ssr: false },
);

const StrategyGuideCard = dynamic(
  () => import("@/components/strategy-editor/strategy-guide-card").then((m) => ({ default: m.StrategyGuideCard })),
  { ssr: false },
);

const StrategyLogicSummary = dynamic(
  () => import("@/components/strategy-editor/strategy-logic-summary").then((m) => ({ default: m.StrategyLogicSummary })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const WorkspaceStatusBar = dynamic(
  () => import("@/components/dashboard/workspace-status-bar").then((m) => ({ default: m.WorkspaceStatusBar })),
  { ssr: false },
);

const TieredDemoSelector = dynamic(
  () => import("@/components/onboarding").then((m) => ({ default: m.TieredDemoSelector })),
  { ssr: false, loading: () => <TabContentSkeleton /> },
);

const ResizableSplitPanel = dynamic(
  () => import("@/components/strategy-editor/resizable-split-panel").then((m) => ({ default: m.ResizableSplitPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const WorkbenchToolbar = dynamic(
  () => import("@/components/strategy-editor/workbench-toolbar").then((m) => ({ default: m.WorkbenchToolbar })),
  { ssr: false },
);

const TemplateQuickSelect = dynamic(
  () => import("@/components/strategy-editor/template-quick-select").then((m) => ({ default: m.TemplateQuickSelect })),
  { ssr: false, loading: () => <FormSkeleton /> },
);

const QuickPreviewPanel = dynamic(
  () => import("@/components/strategy-editor/quick-preview-panel").then((m) => ({ default: m.QuickPreviewPanel })),
  { ssr: false, loading: () => <ChartSkeleton height={160} /> },
);

const GenerationFeedback = dynamic(
  () => import("@/components/strategy-editor/generation-feedback").then((m) => ({ default: m.GenerationFeedback })),
  { ssr: false },
);

const CompactBacktestConfig = dynamic(
  () => import("@/components/strategy-editor/compact-backtest-config").then((m) => ({ default: m.CompactBacktestConfig })),
  { ssr: false, loading: () => <FormSkeleton /> },
);

const BacktestRunningView = dynamic(
  () => import("@/components/backtest/backtest-running-view").then((m) => ({ default: m.BacktestRunningView })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const BacktestResultsView = dynamic(
  () => import("@/components/backtest/backtest-results-view").then((m) => ({ default: m.BacktestResultsView })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const ContextPanel = dynamic(
  () => import("@/components/dashboard/context-panel").then((m) => ({ default: m.ContextPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

export default function DashboardPage() {
  // Initialize user workspace for data isolation
  const { isReady, user } = useUserWorkspace();

  // User action tracking for smart suggestions
  const { trackAction } = useUserActions();

  // Achievement system
  const recordAchievementStat = useAchievementStore((s) => s.recordStat);
  const recordAchievementLogin = useAchievementStore((s) => s.recordLogin);
  const recordAchievementStock = useAchievementStore((s) => s.recordStockValidated);

  // Zustand store state
  const workspace = useStrategyWorkspaceStore(selectWorkspace);
  const autoSaveStatus = useStrategyWorkspaceStore(selectAutoSaveStatus);
  const hasUnsavedChanges = useStrategyWorkspaceStore(selectHasUnsavedChanges);
  const strategyInput = useStrategyWorkspaceStore(selectStrategyInput);
  const generatedCode = useStrategyWorkspaceStore(selectGeneratedCode);
  const isGenerating = useStrategyWorkspaceStore(selectIsGenerating);
  const isBacktesting = useStrategyWorkspaceStore(selectIsBacktesting);
  const strategyName = useStrategyWorkspaceStore(selectStrategyName);
  const viewModeStore = useStrategyWorkspaceStore(selectViewMode);
  const genCacheInfo = useStrategyWorkspaceStore(selectGenCacheInfo);
  const focusedLine = useStrategyWorkspaceStore(selectFocusedLine);
  const lastError = useStrategyWorkspaceStore(selectLastError);
  const latestBacktestSummary = useStrategyWorkspaceStore(selectLatestBacktestSummary);

  const {
    updateStrategyInput,
    updateGeneratedCode,
    setGenerating,
    setGenerationError,
    setBacktesting,
    saveDraft,
    markAsUnsaved,
    setStrategyName,
    setGenCacheInfo,
    setFocusedLine,
    setLastError,
    setLatestBacktestSummary,
    beginInflightTask,
    clearInflightTask,
    setViewMode: setViewModeStore,
  } = useStrategyWorkspaceStore();

  // User preferences
  const savedSplitRatio = useUserPreferencesStore(selectSplitPanelRatio);
  const setSplitPanelRatio = useUserPreferencesStore((s) => s.setSplitPanelRatio);
  const codePreviewCollapsed = useUserPreferencesStore(selectCodePreviewCollapsed);
  const setCodePreviewCollapsed = useUserPreferencesStore((s) => s.setCodePreviewCollapsed);

  // Local state (UI-only ephemeral; everything user-facing lives in the store)
  const [showHistory, setShowHistory] = useState(false);
  const generateTask = useAsyncTask();

  // View mode: URL-synced for browser back/forward navigation
  // edit = /dashboard (clean URL), running = ?mode=running, results = ?mode=results
  // URL is the source of truth on first render; subsequent updates flow URL → store.
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlMode = (searchParams.get('mode') as 'edit' | 'running' | 'results') || null;
  const viewMode = urlMode ?? viewModeStore;

  const setViewMode = useCallback((mode: 'edit' | 'running' | 'results') => {
    setViewModeStore(mode);
    const params = new URLSearchParams(searchParams.toString());
    if (mode === 'edit') {
      params.delete('mode');
    } else {
      params.set('mode', mode);
    }
    const qs = params.toString();
    router.replace(`/dashboard${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [searchParams, router, setViewModeStore]);

  // Keep store in sync when URL changes (e.g. browser back/forward).
  useEffect(() => {
    if (urlMode && urlMode !== viewModeStore) {
      setViewModeStore(urlMode);
    }
  }, [urlMode, viewModeStore, setViewModeStore]);

  // Latest full backtest result lives in memory only (too large to persist);
  // a metric summary goes to the store so /history rehydration works.
  const [latestBacktestResult, setLatestBacktestResult] = useState<BacktestResult | null>(null);

  // Adapter for code paths that still expect the old `setError` signature.
  const error = lastError
    ? ({
        code: lastError.code,
        title: lastError.title,
        description: lastError.description,
        severity: 'error' as AppError['severity'],
        recoveryActions: [],
      } satisfies AppError)
    : null;
  const setError = useCallback(
    (err: AppError | null) => {
      if (!err) {
        setLastError(undefined);
      } else {
        setLastError({ code: err.code, title: err.title, description: err.description });
      }
    },
    [setLastError],
  );

  // Deep-link hydration from /dashboard/history. When the URL carries
  // ?historyId=<num> (or "B<num>" — the prefix /dashboard/history puts on
  // entry ids), fetch the saved backtest and restore the workspace exactly
  // as it was: code + prompt + name + result, then switch to results view.
  // strategyCode / strategyPrompt / strategyName were embedded in the saved
  // config by handleBacktestResult above; older rows without them just skip
  // the hydration and the user lands in edit mode with empty workspace.
  useEffect(() => {
    const historyId = searchParams.get('historyId');
    if (!historyId) return;
    const numId = historyId.startsWith('B') ? historyId.slice(1) : historyId;
    if (!/^\d+$/.test(numId)) return;

    let cancelled = false;
    void fetch(`/api/history/backtests/${numId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: unknown) => {
        if (cancelled) return;
        const data = (payload as { success?: boolean; data?: Record<string, unknown> } | null)?.data;
        if (!data) return;
        const cfg = data.config as
          | { strategyCode?: string; strategyPrompt?: string; strategyName?: string }
          | null;
        if (cfg?.strategyCode) updateGeneratedCode(cfg.strategyCode);
        if (cfg?.strategyPrompt) updateStrategyInput(cfg.strategyPrompt);
        if (cfg?.strategyName) setStrategyName(cfg.strategyName, 'user');
        if (data.result) {
          setLatestBacktestResult(data.result as BacktestResult);
          setViewMode('results');
        }
      })
      .catch((err) => {
        console.warn('[Dashboard] history hydration failed:', err);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Paywall: AI generation quota check
  const { usage, plan: userPlan, isBlocked: isFeatureBlocked, refresh: refreshUsage } = useFeatureUsage();
  const [aiUpgradeDialogOpen, setAiUpgradeDialogOpen] = useState(false);

  // Safety hooks: abort generation on unmount or re-trigger
  const createSignal = useAbortController();
  // Track whether strategy code changed while backtest is running
  const [codeChangedDuringBacktest, setCodeChangedDuringBacktest] = useState(false);

  // Onboarding import hook for tiered demo flows
  const {
    fillAndRunSimple,
    fillIntermediate,
    fillAdvanced,
    isAutoRunning,
    autoRunError,
  } = useOnboardingImport();

  // Calculate current workflow step
  const currentWorkflowStep = useMemo(() => {
    if (!generatedCode && !isGenerating) return "strategy";
    if (isGenerating) return "strategy";
    if (!workspace.lastBacktestResult && !isBacktesting) return "parameters";
    if (isBacktesting) return "backtest";
    return "backtest";
  }, [generatedCode, isGenerating, isBacktesting, workspace.lastBacktestResult]);

  // Parse current parameters from generated code
  const currentParameters = useMemo(() => {
    if (!generatedCode) return [];
    const parseResult = parseStrategyParameters(generatedCode);
    return parseResult.parameters.map((p) => ({
      name: p.name,
      value: p.value,
    }));
  }, [generatedCode]);

  // Extract strategy logic summary
  const logicSummary = useMemo(() => {
    if (!generatedCode || !strategyInput) return null;
    return extractLogicSummary(strategyInput, generatedCode, currentParameters);
  }, [generatedCode, strategyInput, currentParameters]);

  // Refs
  const strategyInputRef = useRef<HTMLDivElement>(null);
  const backtestPanelRef = useRef<{ runBacktest: () => void } | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  // Auto-save mechanism - debounced 3 seconds
  useEffect(() => {
    if (workspace.autoSaveStatus === 'unsaved') {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, 3000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [workspace.autoSaveStatus, saveDraft]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Save draft before unmount
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges) {
        saveDraft();
      }
    };
  }, [hasUnsavedChanges, saveDraft]);

  // Record daily login for achievement streak tracking
  useEffect(() => {
    recordAchievementLogin();
  }, [recordAchievementLogin]);

  /**
   * Persist strategy to database
   */
  const saveStrategyToDatabase = useCallback(async (
    name: string,
    code: string,
    description: string,
    strategyType: string = 'ai_generated',
  ) => {
    const controller = new AbortController();
    try {
      const parseResult = parseStrategyParameters(code);
      const parameters = parseResult.parameters.reduce((acc, p) => {
        acc[p.name] = p.value;
        return acc;
      }, {} as Record<string, unknown>);

      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'strategy',
          data: {
            strategyName: name,
            strategyCode: code,
            description,
            parameters,
            strategyType,
            isActive: true,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn('[Dashboard] Failed to save strategy to database:', response.status);
        return;
      }
      // The server is authoritative on naming — accept any rename it performed
      // (e.g. seq bump to avoid collision). Skip if the user has since edited
      // the name locally (lock flag).
      const json: unknown = await response.json().catch(() => null);
      const returned = (json as { data?: { strategyName?: string } } | null)
        ?.data?.strategyName;
      if (
        typeof returned === 'string'
        && returned !== name
        && !useStrategyWorkspaceStore.getState().current.nameLockedByUser
      ) {
        setStrategyName(returned, 'auto');
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.warn('[Dashboard] Error saving strategy to database:', err);
    }
  }, [setStrategyName]);

  // Handle AI strategy generation via SSE.
  //
  // Streams from `/api/strategy/generate/stream` so the editor fills in token
  // by token instead of waiting ~52s for the full response (cold-cache LLM).
  // Cache hits still arrive as a single content frame followed by [DONE], so
  // the consumer code path is identical for hit and miss.
  //
  // Server protocol (matches `lib/llm/sse-transform.ts`):
  //   data: {"content":"<delta>"}\n\n      — append to buffer
  //   data: {"error":{...}}\n\n             — terminal failure
  //   data: [DONE]\n\n                       — clean end
  const handleGenerate = useCallback(async (prompt: string) => {
    // If already generating, do nothing (prevent double-click)
    if (isGenerating) return;

    // Paywall: client-side pre-check for AI call quota
    if (isFeatureBlocked("ai_call")) {
      setAiUpgradeDialogOpen(true);
      return;
    }

    const applyFallback = (appErr: AppError) => {
      setError(appErr);
      setGenerationError(appErr.description);
      generateTask.fail(appErr.description);
      const fallbackCode = generateFallbackCode(prompt);
      updateGeneratedCode(fallbackCode);
      const fallbackName = generateStrategyName({ prompt, code: fallbackCode });
      setStrategyName(fallbackName, 'auto');
      saveStrategyToDatabase(fallbackName, fallbackCode, prompt, 'ai_generated');
    };

    setGenerating(true);
    updateGeneratedCode("");
    setError(null);
    setGenerationError(null);
    setGenCacheInfo(undefined);
    updateStrategyInput(prompt);
    const taskLabel = `策略生成 — ${prompt.slice(0, 25)}${prompt.length > 25 ? '...' : ''}`;
    generateTask.registerTask({ type: 'generate', title: taskLabel });
    beginInflightTask({ kind: 'generate', startedAt: new Date(), label: taskLabel });

    // Create abort signal — aborts previous generation if any
    const signal = createSignal();

    let assembled = "";
    let firstChunkRendered = false;

    try {
      const response = await fetch("/api/strategy/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal,
      });

      // Server may emit a single SSE error frame at any status (auth, quota,
      // upstream LLM down). Always parse the body as SSE and let the reader
      // surface the error frame uniformly — no JSON-vs-SSE branching.
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error(`HTTP ${response.status} (no response body)`);
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let sawDone = false;
      let streamError: AppError | null = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = (line.startsWith("data: ") ? line.slice(6) : line.slice(5)).trim();
          if (!data) continue;
          if (data === "[DONE]") {
            sawDone = true;
            continue;
          }

          let parsed: {
            content?: unknown;
            meta?: { cached?: unknown; savedTokens?: unknown };
            error?: { code?: string; title?: string; description?: string; severity?: string; recoveryActions?: unknown };
          };
          try {
            parsed = JSON.parse(data);
          } catch {
            // Corrupt frame — best-effort skip rather than abort.
            continue;
          }

          if (parsed.meta) {
            const cached = parsed.meta.cached === true;
            const savedTokens = typeof parsed.meta.savedTokens === 'number' ? parsed.meta.savedTokens : 0;
            setGenCacheInfo({ fromCache: cached, savedTokens });
          }

          if (parsed.error) {
            streamError = {
              code: parsed.error.code ?? 'STRATEGY_STREAM_ERROR',
              title: parsed.error.title ?? '策略生成失败',
              description: parsed.error.description ?? '未知错误',
              severity: (parsed.error.severity === 'warning' ? 'warning' : 'error') as AppError['severity'],
              recoveryActions: Array.isArray(parsed.error.recoveryActions)
                ? (parsed.error.recoveryActions as AppError['recoveryActions'])
                : [],
            };
            break;
          }

          if (typeof parsed.content === "string" && parsed.content.length > 0) {
            assembled += parsed.content;
            // Show clean Python in the editor as it streams — strip the
            // ```python opener even before the closing fence arrives so the
            // user never sees a raw markdown fence.
            updateGeneratedCode(extractCodeProgressively(assembled));
            if (!firstChunkRendered) {
              setCodePreviewCollapsed(false);
              firstChunkRendered = true;
            }
          }
        }

        if (streamError) break;
      }

      if (streamError) {
        applyFallback(streamError);
        return;
      }

      if (!assembled) {
        throw new Error("No code generated");
      }

      const finalCode = extractCodeProgressively(assembled).trim();
      updateGeneratedCode(finalCode);
      if (!firstChunkRendered) setCodePreviewCollapsed(false);

      generateTask.complete({ codeLength: finalCode.length });
      trackAction('strategy-generated', { prompt: prompt.slice(0, 50) });
      trackUsage("ai"); // Client-side usage tracking for paywall
      void refreshUsage(); // Refresh server-side usage data
      recordAchievementStat('totalStrategies', 1);
      setTimeout(() => saveDraft(), 0);

      const name = generateStrategyName({ prompt, code: finalCode });
      setStrategyName(name, 'auto');
      saveStrategyToDatabase(name, finalCode, prompt, 'ai_generated');

      if (!sawDone) {
        // Stream closed without [DONE] but produced code — usually a
        // network drop right at the end. Code is saved; only log so the
        // user isn't bothered.
        console.warn('[Dashboard] Generation stream closed without [DONE] — possible truncation');
      }
    } catch (err) {
      // If aborted (user navigated away or triggered new generation), do nothing
      if (err instanceof Error && err.name === "AbortError") return;

      console.error("Generation error:", err);
      const appErr = toAppError(err, 'STRATEGY_GEN_FAILED');
      // Override with actionable Chinese message
      appErr.title = 'AI 策略生成失败';
      appErr.recoveryActions = [
        { type: 'retry', label: '重试' },
        { type: 'custom', label: '使用模板' },
        { type: 'custom', label: '修改描述' },
      ];
      applyFallback(appErr);
    } finally {
      setGenerating(false);
      clearInflightTask();
    }
  }, [isGenerating, isFeatureBlocked, createSignal, updateStrategyInput, updateGeneratedCode, setGenerating, setGenerationError, saveDraft, saveStrategyToDatabase, trackAction, refreshUsage, recordAchievementStat, setCodePreviewCollapsed, beginInflightTask, clearInflightTask, generateTask, setError, setGenCacheInfo, setStrategyName]);

  // Handle template selection — abort generation if in progress.
  //
  // When `code` is provided (the BUILTIN_TEMPLATES path), load the curated
  // Python directly into the workspace instead of leaving the user to click
  // 生成 and wait for an LLM round-trip that produces strictly-worse output.
  // Without this, the hand-written template code in `BUILTIN_TEMPLATES` is
  // dead weight — the click flow only ever populated the prompt textarea.
  // Onboarding (`use-onboarding-import.ts`) already does this; the regular
  // template-click path was the outlier.
  const handleSelectTemplate = useCallback((prompt: string, code?: string) => {
    if (isGenerating) {
      // Abort current generation before loading template
      createSignal(); // This aborts the previous signal
      setGenerating(false);
    }
    updateStrategyInput(prompt);
    if (code && code.trim().length > 0) {
      updateGeneratedCode(code);
      // Auto-expand the code preview so the curated code lands in view
      // rather than collapsed behind the prompt panel.
      setCodePreviewCollapsed(false);
      // Persist immediately as a builtin-template strategy so /dashboard/history
      // captures it. Strategy name is derived the same way AI-generated runs
      // do, keeping the timeline naming consistent.
      const name = generateStrategyName({ prompt, code });
      setStrategyName(name, 'auto');
      saveStrategyToDatabase(name, code, prompt, 'builtin_template');
      setTimeout(() => saveDraft(), 0);
    }
    strategyInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [
    isGenerating,
    createSignal,
    setGenerating,
    updateStrategyInput,
    updateGeneratedCode,
    setCodePreviewCollapsed,
    saveDraft,
    saveStrategyToDatabase,
    setStrategyName,
  ]);

  // User-facing abort for an in-flight streaming generation. createSignal()
  // aborts the controller currently held by useAbortController as a side
  // effect; the new signal returned is unused (and in turn aborted by the
  // next createSignal() call). We then clear isGenerating immediately so the
  // UI flips back to the Generate button without waiting for the fetch's
  // catch path to settle.
  const abortGeneration = useCallback(() => {
    if (!isGenerating) return;
    createSignal();
    setGenerating(false);
  }, [isGenerating, createSignal, setGenerating]);

  // Handle code update from parameter editor
  const handleCodeUpdate = useCallback((newCode: string) => {
    updateGeneratedCode(newCode);
    // Warn if backtest is running and code was modified
    if (isBacktesting) {
      setCodeChangedDuringBacktest(true);
    }
  }, [updateGeneratedCode, isBacktesting]);

  // Handle rerun backtest
  const handleRerunBacktest = useCallback(() => {
    backtestPanelRef.current?.runBacktest();
  }, []);

  // Handle backtest state changes — transition to running/results views
  const handleBacktestStart = useCallback(() => {
    setBacktesting(true);
    setCodeChangedDuringBacktest(false);
    setCodePreviewCollapsed(true); // Auto-collapse code on backtest start
    setViewMode("running");
    beginInflightTask({
      kind: 'backtest',
      startedAt: new Date(),
      label: `回测 — ${strategyName || '策略'}`,
    });
  }, [setBacktesting, setCodePreviewCollapsed, setViewMode, beginInflightTask, strategyName]);

  const handleBacktestEnd = useCallback(() => {
    setBacktesting(false);
    clearInflightTask();
    // If we received a result via onBacktestResult, transition happens there.
    // If no result arrived (error case), fall back to edit view after brief delay.
    setTimeout(() => {
      const currentMode = new URLSearchParams(window.location.search).get('mode') || 'edit';
      if (currentMode === "running") {
        setViewMode("edit");
      }
    }, 200);
  }, [setBacktesting, setViewMode, clearInflightTask]);

  // Handle backtest result data — triggers transition to full results view
  const handleBacktestResult = useCallback((result: BacktestResult) => {
    setLatestBacktestResult(result);
    // Persist a compact metric snapshot so navigation back to /dashboard
    // restores the result chip even after the full BacktestResult is GC'd.
    const summarySymbol = result.backtestMeta?.targetSymbol ?? result.config?.symbol;
    setLatestBacktestSummary({
      totalReturn: typeof result.totalReturn === 'number' ? result.totalReturn : undefined,
      sharpeRatio: typeof result.sharpeRatio === 'number' ? result.sharpeRatio : undefined,
      maxDrawdown: typeof result.maxDrawdown === 'number' ? result.maxDrawdown : undefined,
      winRate: typeof result.winRate === 'number' ? result.winRate : undefined,
      symbol: typeof summarySymbol === 'string' ? summarySymbol : undefined,
      completedAt: new Date(),
    });
    setViewMode("results");
    // Track for suggestion engine: positive return = good backtest
    const totalReturn = typeof result.totalReturn === 'number'
      ? result.totalReturn
      : parseFloat(String(result.totalReturn ?? '0'));
    trackAction('backtest-complete', { positive: totalReturn > 0 });

    // Achievement tracking: record backtest completion and best metrics
    recordAchievementStat('totalBacktests', 1);
    if (typeof result.sharpeRatio === 'number' && isFinite(result.sharpeRatio)) {
      recordAchievementStat('bestSharpe', result.sharpeRatio);
    }
    if (isFinite(totalReturn)) {
      recordAchievementStat('bestReturn', totalReturn);
    }
    // Track unique stock validated
    const symbol = result.backtestMeta?.targetSymbol ?? result.config?.symbol;
    if (symbol) {
      recordAchievementStock(symbol);
    }

    // Persist to /api/history so /dashboard/history actually has data.
    // Fire-and-forget — a failed save shouldn't block the results view.
    // Server validates required fields (symbol/dates/config/result); skip
    // the call if any are missing rather than fail the request.
    const persistSymbol = result.backtestMeta?.targetSymbol ?? result.config?.symbol;
    const startDate = result.backtestMeta?.timeRange?.start ?? result.config?.startDate;
    const endDate = result.backtestMeta?.timeRange?.end ?? result.config?.endDate;
    if (persistSymbol && startDate && endDate && result.config) {
      // Embed strategyCode + prompt in the persisted config so /dashboard/history
      // → "在编辑器中打开" can rehydrate the workspace exactly as it was. The
      // backtest_history table has a free-form `config` text(JSON) column, so we
      // tuck these fields in there rather than requiring a schema change. The
      // engine itself ignores them.
      const persistedConfig = {
        ...result.config,
        strategyCode: generatedCode,
        strategyPrompt: strategyInput,
        strategyName,
      };
      void fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'backtest',
          data: {
            symbol: persistSymbol,
            stockName: result.backtestMeta?.targetName ?? null,
            // ISO timestamps land here from the engine; the schema expects
            // YYYY-MM-DD, so trim to the date prefix.
            startDate: String(startDate).slice(0, 10),
            endDate: String(endDate).slice(0, 10),
            timeframe: '1d',
            config: persistedConfig,
            result,
            dataSource: result.backtestMeta?.dataSource ?? 'unknown',
            dataCoverage: result.backtestMeta?.dataQuality?.completeness ?? null,
            totalReturn: isFinite(totalReturn) ? totalReturn : null,
            sharpeRatio: typeof result.sharpeRatio === 'number' && isFinite(result.sharpeRatio)
              ? result.sharpeRatio : null,
            maxDrawdown: typeof result.maxDrawdown === 'number' && isFinite(result.maxDrawdown)
              ? result.maxDrawdown : null,
            winRate: typeof result.winRate === 'number' && isFinite(result.winRate)
              ? result.winRate : null,
            executionTime: typeof result.executionTime === 'number' ? result.executionTime : null,
          },
        }),
      }).catch((err) => {
        console.warn('[Dashboard] Failed to persist backtest history:', err);
      });
    }
  }, [trackAction, recordAchievementStat, recordAchievementStock, generatedCode, strategyInput, strategyName, setViewMode, setLatestBacktestSummary]);

  // Resume handler — wired to ResumeTaskBanner; re-fires the in-flight kind
  // when the user opts in.
  const handleResumeTask = useCallback((task: { kind: 'generate' | 'backtest' }) => {
    if (task.kind === 'generate' && strategyInput) {
      void handleGenerate(strategyInput);
    } else if (task.kind === 'backtest') {
      backtestPanelRef.current?.runBacktest();
    }
  }, [strategyInput, handleGenerate]);

  // Handle AI assistant parameter application — applies the param then auto
  // re-runs the backtest so the user sees the impact without a second click.
  // Mirrors handleApplyAllAISuggestions; the 100ms delay lets the workspace
  // store finish persisting before backtestPanelRef.current.runBacktest reads it.
  const handleApplyAIParameter = useCallback(
    (name: string, value: number | string | boolean) => {
      if (!generatedCode) return;
      const updatedCode = updateParameterInCode(generatedCode, name, value);
      if (updatedCode !== generatedCode) {
        updateGeneratedCode(updatedCode);
        markAsUnsaved();
        setTimeout(() => handleRerunBacktest(), 100);
      }
    },
    [generatedCode, updateGeneratedCode, markAsUnsaved, handleRerunBacktest]
  );

  // Handle AI assistant batch suggestions
  const handleApplyAllAISuggestions = useCallback(
    (suggestions: Array<{ name: string; value: number | string | boolean }>) => {
      if (!generatedCode || suggestions.length === 0) return;
      let updatedCode = generatedCode;
      for (const suggestion of suggestions) {
        updatedCode = updateParameterInCode(updatedCode, suggestion.name, suggestion.value);
      }
      if (updatedCode !== generatedCode) {
        updateGeneratedCode(updatedCode);
        markAsUnsaved();
        setTimeout(() => handleRerunBacktest(), 100);
      }
    },
    [generatedCode, updateGeneratedCode, markAsUnsaved, handleRerunBacktest]
  );

  // Handle export
  const handleExport = useCallback(() => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${strategyName || "strategy"}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generatedCode, strategyName]);

  // Loading skeleton
  if (!isReady) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border h-14" />
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 py-4">
          <div className="space-y-4 animate-pulse">
            <div className="w-full h-10 bg-surface rounded-lg" />
            <div className="flex gap-4 h-[calc(100vh-160px)]">
              <div className="flex-1 bg-surface rounded-xl" />
              <div className="flex-1 bg-surface rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Dashboard Header */}
      <DashboardHeader />

      {/* Continue last work banner — only when in edit mode and no code */}
      {viewMode === "edit" && !generatedCode && !isGenerating && (
        <ContinueWorkBanner />
      )}

      {/* Workbench Toolbar */}
      <WorkbenchToolbar
        strategyName={strategyName}
        onNameChange={(name) => setStrategyName(name, 'user')}
        onSave={saveDraft}
        onToggleHistory={() => setShowHistory((p) => !p)}
        historyVisible={showHistory}
        onExport={handleExport}
        hasCode={!!generatedCode}
      />

      {/* Resume-task banner when an inflight task survived a navigation */}
      <ResumeTaskBanner onResume={handleResumeTask} />

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-2">
          <ErrorCard
            error={error}
            compact
            onAction={(action) => {
              if (action.label === '重试' && strategyInput) {
                setError(null);
                void handleGenerate(strategyInput);
              } else if (action.label === '使用模板') {
                setError(null);
              } else if (action.label === '修改描述') {
                setError(null);
                strategyInputRef.current?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />
        </div>
      )}

      {/* Warning: code changed during backtest */}
      {codeChangedDuringBacktest && isBacktesting && (
        <div className="mx-4 mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-xs">
            策略已修改，当前回测结果可能不准确
          </p>
        </div>
      )}

      {/* Main content: mode-based rendering */}
      <main className="flex-1 min-h-0">
        {/* ===== RUNNING MODE: Full-width backtest progress ===== */}
        {viewMode === "running" && (
          <BacktestRunningView
            strategyName={strategyName}
            symbol=""
            onCancel={() => setViewMode("edit")}
          />
        )}

        {/* ===== RESULTS MODE: Full-width professional results view ===== */}
        {viewMode === "results" && latestBacktestResult && (
          <BacktestResultsView
            result={latestBacktestResult}
            strategyName={strategyName}
            onBackToEdit={() => setViewMode("edit")}
            onRerunWithEdit={() => setViewMode("edit")}
            onExportReport={handleExport}
          />
        )}

        {/* ===== EDIT MODE: Split panel layout ===== */}
        {viewMode === "edit" && (
          <div className="px-2 sm:px-4 py-2 sm:py-3">
            {/* Context panel: market overview and quick actions for returning users */}
            {!generatedCode && !isGenerating && (
              <ContextPanel className="mb-3 max-w-[1920px]" />
            )}

            {/* Onboarding: shown when no code */}
            {!generatedCode && !isGenerating && (
              <TieredDemoSelector
                onSimple={fillAndRunSimple}
                onIntermediate={fillIntermediate}
                onAdvanced={fillAdvanced}
                isAutoRunning={isAutoRunning}
                autoRunError={autoRunError}
                className="mb-3 max-w-[1920px] mx-auto"
              />
            )}

            {/* Desktop: Resizable split panel */}
            <div className="hidden lg:block h-[calc(100vh-180px)] max-w-[1920px] mx-auto">
              <ResizableSplitPanel
                initialRatio={savedSplitRatio}
                onRatioChange={setSplitPanelRatio}
                left={
                  <LeftPanel
                    strategyInputRef={strategyInputRef}
                    strategyInput={strategyInput}
                    generatedCode={generatedCode}
                    isGenerating={isGenerating}
                    isBacktesting={isBacktesting}
                    hasUnsavedChanges={hasUnsavedChanges}
                    cacheInfo={genCacheInfo}
                    onGenerate={handleGenerate}
                    onStopGenerate={abortGeneration}
                    onUpdateInput={updateStrategyInput}
                    onSelectTemplate={handleSelectTemplate}
                    onCodeUpdate={handleCodeUpdate}
                    onRerunBacktest={handleRerunBacktest}
                    onParameterFocus={(l: number | null) => setFocusedLine(l ?? undefined)}
                    onBacktestStart={handleBacktestStart}
                    onBacktestEnd={handleBacktestEnd}
                    showHistory={showHistory}
                  />
                }
                right={
                  <RightPanel
                    generatedCode={generatedCode}
                    isGenerating={isGenerating}
                    isBacktesting={isBacktesting}
                    focusedLine={focusedLine}
                    onHighlightClear={() => setFocusedLine(undefined)}
                    logicSummary={logicSummary}
                    onBacktestStart={handleBacktestStart}
                    onBacktestEnd={handleBacktestEnd}
                    onBacktestResult={handleBacktestResult}
                    workspace={workspace}
                    currentParameters={currentParameters}
                    onSelectTemplate={handleSelectTemplate}
                    onApplyParameter={handleApplyAIParameter}
                    onApplyAllSuggestions={handleApplyAllAISuggestions}
                    codePreviewCollapsed={codePreviewCollapsed}
                    onCodeCollapseChange={setCodePreviewCollapsed}
                  />
                }
              />
            </div>

            {/* Mobile: Stacked layout */}
            <div className="lg:hidden max-w-2xl mx-auto space-y-4">
              <LeftPanel
                strategyInputRef={strategyInputRef}
                strategyInput={strategyInput}
                generatedCode={generatedCode}
                isGenerating={isGenerating}
                isBacktesting={isBacktesting}
                hasUnsavedChanges={hasUnsavedChanges}
                cacheInfo={genCacheInfo}
                onGenerate={handleGenerate}
                onStopGenerate={abortGeneration}
                onUpdateInput={updateStrategyInput}
                onSelectTemplate={handleSelectTemplate}
                onCodeUpdate={handleCodeUpdate}
                onRerunBacktest={handleRerunBacktest}
                onParameterFocus={(l: number | null) => setFocusedLine(l ?? undefined)}
                onBacktestStart={handleBacktestStart}
                onBacktestEnd={handleBacktestEnd}
                showHistory={showHistory}
              />
              <RightPanel
                generatedCode={generatedCode}
                isGenerating={isGenerating}
                isBacktesting={isBacktesting}
                focusedLine={focusedLine}
                onHighlightClear={() => setFocusedLine(undefined)}
                logicSummary={logicSummary}
                onBacktestStart={handleBacktestStart}
                onBacktestEnd={handleBacktestEnd}
                onBacktestResult={handleBacktestResult}
                workspace={workspace}
                currentParameters={currentParameters}
                onSelectTemplate={handleSelectTemplate}
                onApplyParameter={handleApplyAIParameter}
                onApplyAllSuggestions={handleApplyAllAISuggestions}
                codePreviewCollapsed={codePreviewCollapsed}
                onCodeCollapseChange={setCodePreviewCollapsed}
              />
            </div>

            {/* Risk Disclaimer */}
            <div className="mx-4 mb-2 p-3 bg-loss/5 border border-loss/20 rounded-xl max-w-[1920px] lg:mx-auto lg:w-full lg:px-4">
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="text-loss font-medium">风险提示</span>
                {" "}本工具生成的策略代码仅供学习研究使用，不构成任何投资建议。量化交易存在市场风险，
                历史回测结果不代表未来收益。
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Floating strategy workflow guide */}
      <StrategyGuideCard currentStep={currentWorkflowStep} />

      {/* Bottom status bar */}
      {user?.id && <WorkspaceStatusBar userId={user.id} />}

      {/* AI generation paywall dialog */}
      <UpgradeDialog
        open={aiUpgradeDialogOpen}
        onOpenChange={setAiUpgradeDialogOpen}
        variant="limit"
        featureName="ai_call"
        used={usage.ai_call?.used ?? 0}
        limit={usage.ai_call?.limit ?? 0}
        resetAt={usage.ai_call?.resetAt}
      />
    </div>
  );
}

// =============================================================================
// LEFT PANEL (Input side)
// =============================================================================

interface LeftPanelProps {
  strategyInputRef: React.RefObject<HTMLDivElement>;
  strategyInput: string;
  generatedCode: string;
  isGenerating: boolean;
  isBacktesting: boolean;
  hasUnsavedChanges: boolean;
  cacheInfo: { fromCache: boolean; savedTokens: number } | undefined;
  onGenerate: (prompt: string) => Promise<void>;
  onStopGenerate: () => void;
  onUpdateInput: (input: string) => void;
  onSelectTemplate: (prompt: string, code?: string) => void;
  onCodeUpdate: (newCode: string) => void;
  onRerunBacktest: () => void;
  onParameterFocus: (line: number | null) => void;
  onBacktestStart: () => void;
  onBacktestEnd: () => void;
  showHistory: boolean;
}

function LeftPanel({
  strategyInputRef,
  strategyInput,
  generatedCode,
  isGenerating,
  isBacktesting,
  hasUnsavedChanges,
  cacheInfo,
  onGenerate,
  onStopGenerate,
  onUpdateInput,
  onSelectTemplate,
  onCodeUpdate,
  onRerunBacktest,
  onParameterFocus,
  onBacktestStart,
  onBacktestEnd,
  showHistory,
}: LeftPanelProps) {
  return (
    <div className="space-y-4 p-3">
      {/* Strategy input */}
      <div ref={strategyInputRef}>
        <StrategyInput
          onGenerate={onGenerate}
          isLoading={isGenerating}
          value={strategyInput}
          onChange={onUpdateInput}
          onStop={onStopGenerate}
        />
      </div>

      {/* Generation feedback (token count, cost, cache badge) */}
      <GenerationFeedback
        isGenerating={isGenerating}
        generatedCode={generatedCode}
        fromCache={cacheInfo?.fromCache ?? false}
        savedCost={
          cacheInfo?.fromCache
            ? // DeepSeek output token pricing (CNY): same formula GenerationFeedback
              // uses internally for the running token estimate, so the two numbers
              // stay aligned.
              (cacheInfo.savedTokens / 1000) * 0.0014
            : undefined
        }
      />

      {/* Template Quick Select (visual cards with category chips) */}
      {!generatedCode && !isGenerating && (
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-sm font-medium text-neutral-200">模板快选</span>
          </div>
          <TemplateQuickSelect
            onSelectTemplate={onSelectTemplate}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      )}

      {/* Parameter Editor (when code is generated) */}
      {generatedCode && (
        <ParameterEditor
          code={generatedCode}
          onCodeUpdate={onCodeUpdate}
          onRerunBacktest={onRerunBacktest}
          isBacktesting={isBacktesting}
          onParameterFocus={onParameterFocus}
        />
      )}

      {/* Compact Backtest Config (when code is generated) */}
      {generatedCode && (
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm font-medium text-neutral-200">回测配置</span>
          </div>
          <CompactBacktestConfig
            onRunBacktest={() => {
              onBacktestStart();
              // The actual backtest is handled by BacktestPanel in right panel
              // This is a simplified trigger
              onRerunBacktest();
            }}
            isRunning={isBacktesting}
            hasStrategyCode={!!generatedCode}
          />
        </div>
      )}

      {/* Event Timeline Panel (collapsible) — replaces the old draft-only history */}
      {showHistory && <EventTimelinePanel />}
    </div>
  );
}

// =============================================================================
// RIGHT PANEL (Preview / Results side)
// =============================================================================

interface RightPanelProps {
  generatedCode: string;
  isGenerating: boolean;
  isBacktesting: boolean;
  focusedLine: number | undefined;
  onHighlightClear: () => void;
  logicSummary: ReturnType<typeof extractLogicSummary> | null;
  onBacktestStart: () => void;
  onBacktestEnd: () => void;
  onBacktestResult: (result: BacktestResult) => void;
  workspace: ReturnType<typeof selectWorkspace>;
  currentParameters: Array<{ name: string; value: unknown }>;
  onSelectTemplate: (prompt: string, code?: string) => void;
  onApplyParameter: (name: string, value: number | string | boolean) => void;
  onApplyAllSuggestions: (suggestions: Array<{ name: string; value: number | string | boolean }>) => void;
  codePreviewCollapsed: boolean;
  onCodeCollapseChange: (collapsed: boolean) => void;
}

function RightPanel({
  generatedCode,
  isGenerating,
  isBacktesting,
  focusedLine,
  onHighlightClear,
  logicSummary,
  onBacktestStart,
  onBacktestEnd,
  onBacktestResult,
  workspace,
  currentParameters,
  onSelectTemplate,
  onApplyParameter,
  onApplyAllSuggestions,
  codePreviewCollapsed,
  onCodeCollapseChange,
}: RightPanelProps) {
  return (
    <div className="space-y-4 p-3">
      {/* 1. Quick Preview Panel — highest priority, shows results first */}
      <QuickPreviewPanel
        strategyCode={generatedCode}
        isGenerating={isGenerating}
      />

      {/* 2. Full Backtest Panel — action area */}
      <BacktestPanel
        strategyCode={generatedCode}
        onBacktestStart={onBacktestStart}
        onBacktestEnd={onBacktestEnd}
        onResult={onBacktestResult}
      />

      {/* 3. Strategy Logic Summary — readable summary */}
      {(generatedCode || isGenerating) && logicSummary && (
        <StrategyLogicSummary
          conditions={logicSummary.conditions}
          confidence={logicSummary.confidence}
          params={logicSummary.params}
          code={generatedCode}
          state={isGenerating ? "loading" : "default"}
        />
      )}

      {/* 4. Code Preview — lowest priority, default collapsed */}
      <CodePreview
        code={generatedCode}
        isLoading={isGenerating}
        collapsible={true}
        defaultCollapsed={codePreviewCollapsed}
        onCollapseChange={onCodeCollapseChange}
        highlightedLine={focusedLine}
        onHighlightClear={onHighlightClear}
      />

      {/* Navigation to full validation */}
      {generatedCode && !isGenerating && (
        <div className="flex justify-center">
          <Link
            href="/dashboard/strategy-validation"
            className={
              "inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg " +
              "bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 " +
              "text-primary hover:from-primary/30 hover:to-accent/30 transition-all btn-tactile"
            }
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            进入完整验证
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Fallback code generator when API is unavailable
 */
function generateFallbackCode(prompt: string): string {
  const hasMA = prompt.includes("均线") || prompt.toLowerCase().includes("ma");
  const hasRSI = prompt.includes("RSI") || prompt.includes("rsi");
  const hasMACD = prompt.includes("MACD") || prompt.includes("macd");

  let code = `"""
AI Generated Trading Strategy (Fallback Mode)

Strategy Description:
${prompt}

Generated by Lucrum AI
"""

from vnpy.trader.object import BarData
from vnpy_ctastrategy import CtaTemplate, StopOrder
from vnpy.trader.constant import Interval

class AIStrategy(CtaTemplate):
    """AI-Generated CTA Strategy"""

    author = "Lucrum AI"

    # Parameters
`;

  if (hasMA) {
    code += `    fast_window = 5
    slow_window = 20
`;
  }
  if (hasRSI) {
    code += `    rsi_window = 14
    rsi_buy = 30
    rsi_sell = 70
`;
  }
  if (hasMACD) {
    code += `    macd_fast = 12
    macd_slow = 26
    macd_signal = 9
`;
  }

  code += `    fixed_size = 1

    # Variables
    inited = False
    trading = False
`;

  if (hasMA) {
    code += `    fast_ma = 0.0
    slow_ma = 0.0
`;
  }
  if (hasRSI) {
    code += `    rsi_value = 0.0
`;
  }

  code += `
    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)

    def on_bar(self, bar: BarData):
        """Process new bar data"""
        if not self.inited:
            return
`;

  if (hasMA) {
    code += `
        # Calculate moving averages
        am = self.cta_engine.get_am(self.vt_symbol)
        self.fast_ma = am.sma(self.fast_window)
        self.slow_ma = am.sma(self.slow_window)

        # MA crossover signal
        if self.fast_ma > self.slow_ma and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.fast_ma < self.slow_ma and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
`;
  }

  if (hasRSI) {
    code += `
        # Calculate RSI
        am = self.cta_engine.get_am(self.vt_symbol)
        self.rsi_value = am.rsi(self.rsi_window)

        # RSI signal
        if self.rsi_value < self.rsi_buy and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.rsi_value > self.rsi_sell and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
`;
  }

  code += `
        self.put_event()
`;

  return code;
}

/**
 * Extract strategy logic summary from user prompt and generated code
 */
function extractLogicSummary(
  prompt: string,
  code: string,
  params: Array<{ name: string; value: unknown }>,
): {
  conditions: { buy: string; sell: string; position: string };
  confidence: "high" | "medium" | "low";
  params: Record<string, string>;
} {
  const lines = prompt.split(/[，,。.；;\n]+/).map((s) => s.trim()).filter(Boolean);

  let buy = "";
  let sell = "";
  let position = "";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!buy && (lower.includes("\u4E70\u5165") || lower.includes("\u505A\u591A") || lower.includes("\u91D1\u53C9") || lower.includes("buy"))) {
      buy = line;
    } else if (!sell && (lower.includes("\u5356\u51FA") || lower.includes("\u505A\u7A7A") || lower.includes("\u6B7B\u53C9") || lower.includes("sell") || lower.includes("\u6B62\u635F") || lower.includes("\u6B62\u76C8"))) {
      sell = line;
    } else if (!position && (lower.includes("\u4ED3\u4F4D") || lower.includes("\u8D44\u91D1") || lower.includes("position") || lower.includes("\u6BD4\u4F8B"))) {
      position = line;
    }
  }

  if (!buy && !sell) {
    buy = prompt.length > 60 ? prompt.substring(0, 60) + "..." : prompt;
    sell = "\u672A\u660E\u786E\u6307\u5B9A";
    position = "\u9ED8\u8BA4\u4ED3\u4F4D\u7BA1\u7406";
  }
  if (!sell) sell = "\u672A\u660E\u786E\u6307\u5B9A";
  if (!position) position = "\u9ED8\u8BA4\u4ED3\u4F4D\u7BA1\u7406";

  const paramMap: Record<string, string> = {};
  for (const p of params) {
    paramMap[p.name] = String(p.value);
  }

  return {
    conditions: { buy, sell, position },
    confidence: "medium" as const,
    params: paramMap,
  };
}
