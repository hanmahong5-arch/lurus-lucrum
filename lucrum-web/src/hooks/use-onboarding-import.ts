/**
 * Onboarding Import Hook
 *
 * Provides tiered demo flows and strategy import actions.
 * Story 3.4: Tiered Onboarding Import
 *
 * @module hooks/use-onboarding-import
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getBuiltinTemplateById,
  type BuiltinTemplate,
} from "@/lib/strategy-templates/builtin-templates";
import {
  useStrategyWorkspaceStore,
} from "@/lib/stores/strategy-workspace-store";
import { showToast } from "@/lib/toast";

// =============================================================================
// CONSTANTS
// =============================================================================

const SIMPLE_TEMPLATE_ID = "builtin-dual-ma";
const INTERMEDIATE_TEMPLATE_ID = "builtin-kdj";
const ADVANCED_TEMPLATE_ID = "builtin-multi-factor";

const DASHBOARD_PATH = "/dashboard";
const VALIDATION_PATH = "/dashboard/strategy-validation";

const PREVIEW_TRADING_DAYS = 250;
const PREVIEW_START_PRICE = 1800;
const PREVIEW_VOLATILITY = 0.02;
const DEFAULT_INITIAL_CAPITAL = 100000;
const DEFAULT_COMMISSION = 0.0003;
const DEFAULT_SLIPPAGE = 0.001;
const DEFAULT_SYMBOL = "600519";

// =============================================================================
// TYPES
// =============================================================================

export interface UseOnboardingImportReturn {
  fillAndRunSimple: () => Promise<void>;
  fillIntermediate: () => void;
  fillAdvanced: () => void;
  importToEditor: (code: string, description: string) => void;
  importToWorkflow: (code: string, description: string) => void;
  isAutoRunning: boolean;
  autoRunError: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================

function fillWorkspaceWithTemplate(template: BuiltinTemplate): void {
  const store = useStrategyWorkspaceStore.getState();
  store.updateGeneratedCode(template.code);
  store.updateStrategyInput(template.prompt);
  setTimeout(() => {
    useStrategyWorkspaceStore.getState().saveDraft();
  }, 0);
}

function fillWorkspaceWithCode(code: string, description: string): void {
  const store = useStrategyWorkspaceStore.getState();
  store.updateGeneratedCode(code);
  store.updateStrategyInput(description);
  setTimeout(() => {
    useStrategyWorkspaceStore.getState().saveDraft();
  }, 0);
}

// =============================================================================
// HOOK
// =============================================================================

export function useOnboardingImport(): UseOnboardingImportReturn {
  const router = useRouter();
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoRunError, setAutoRunError] = useState<string | null>(null);

  const fillAndRunSimple = useCallback(async () => {
    const template = getBuiltinTemplateById(SIMPLE_TEMPLATE_ID);
    if (!template) {
      setAutoRunError("Template not found");
      return;
    }

    setIsAutoRunning(true);
    setAutoRunError(null);

    try {
      fillWorkspaceWithTemplate(template);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { runBacktest, generateBacktestData } =
        await import("@/lib/backtest");

      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const klines = generateBacktestData(
        PREVIEW_TRADING_DAYS,
        PREVIEW_START_PRICE,
        PREVIEW_VOLATILITY,
      );

      const config = {
        symbol: DEFAULT_SYMBOL,
        initialCapital: DEFAULT_INITIAL_CAPITAL,
        commission: DEFAULT_COMMISSION,
        slippage: DEFAULT_SLIPPAGE,
        startDate: startDate.toISOString().split("T")[0] ?? "",
        endDate: endDate.toISOString().split("T")[0] ?? "",
        timeframe: "1d" as const,
      };

      const backtestResult = await runBacktest(template.code, klines, config);

      const store = useStrategyWorkspaceStore.getState();
      store.setBacktestResult(backtestResult);

      showToast.success("\u56DE\u6D4B\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u8BC4\u5206\u7ED3\u679C");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Auto-run backtest failed";
      setAutoRunError(message);
      showToast.error("\u81EA\u52A8\u56DE\u6D4B\u5931\u8D25: " + message);
    } finally {
      setIsAutoRunning(false);
    }
  }, []);

  const fillIntermediate = useCallback(() => {
    const template = getBuiltinTemplateById(INTERMEDIATE_TEMPLATE_ID);
    if (!template) return;
    fillWorkspaceWithTemplate(template);
    showToast.info("\u7B56\u7565\u5DF2\u52A0\u8F7D\uFF0C\u8BF7\u9009\u62E9\u80A1\u7968\u540E\u5F00\u59CB\u56DE\u6D4B");
  }, []);

  const fillAdvanced = useCallback(() => {
    const template = getBuiltinTemplateById(ADVANCED_TEMPLATE_ID);
    if (!template) return;
    fillWorkspaceWithTemplate(template);
    showToast.info("\u7B56\u7565\u5DF2\u52A0\u8F7D\uFF0C\u524D\u5F80\u591A\u80A1\u9A8C\u8BC1");
    router.push(VALIDATION_PATH);
  }, [router]);

  const importToEditor = useCallback(
    (code: string, description: string) => {
      if (!code) return;
      fillWorkspaceWithCode(code, description);
      showToast.success("\u7B56\u7565\u5DF2\u5BFC\u5165\u7F16\u8F91\u5668");
      router.push(DASHBOARD_PATH);
    },
    [router]
  );

  const importToWorkflow = useCallback(
    (code: string, description: string) => {
      if (!code) return;
      fillWorkspaceWithCode(code, description);
      showToast.success("\u7B56\u7565\u5DF2\u52A0\u8F7D\u5230\u5DE5\u4F5C\u6D41");
      router.push(DASHBOARD_PATH);
    },
    [router]
  );

  return {
    fillAndRunSimple,
    fillIntermediate,
    fillAdvanced,
    importToEditor,
    importToWorkflow,
    isAutoRunning,
    autoRunError,
  };
}
