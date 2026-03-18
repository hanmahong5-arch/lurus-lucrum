"use client";

import { useState, useCallback } from "react";
import {
  normalizePlanTier,
  getLimitsForPlan,
  type PlanTier,
} from "@/lib/config/plan-limits";
import type { UpgradeDialogVariant } from "@/components/paywall/upgrade-dialog";

// =============================================================================
// TYPES
// =============================================================================

export interface UpgradeGateState {
  open: boolean;
  variant: UpgradeDialogVariant;
  featureName: string;
  templateName: string;
  sharpeRatio: number;
  used: number;
  limit: number;
  resetAt: string;
}

const INITIAL_STATE: UpgradeGateState = {
  open: false,
  variant: "lock",
  featureName: "",
  templateName: "",
  sharpeRatio: 0,
  used: 0,
  limit: 0,
  resetAt: "",
};

/** Minimum tier required for each gated feature */
const FEATURE_TIERS: Record<string, PlanTier> = {
  multi_stock: "basic",
  ai_advisor: "basic",
  strategy_diagnostic: "basic",
  marketplace_subscribe: "basic",
  data_export_csv: "basic",
  debate_mode: "pro",
  pdf_export: "pro",
  parameter_sensitivity: "pro",
  strategy_publish: "pro",
  walk_forward: "pro",
  sector_scanner: "pro",
};

const TIER_ORDER: Record<PlanTier, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing feature upgrade gates.
 * Returns helpers to check feature access and trigger the upgrade dialog.
 */
export function useUpgradeGate(currentPlanCode: string | undefined | null) {
  const [state, setState] = useState<UpgradeGateState>(INITIAL_STATE);
  const currentTier = normalizePlanTier(currentPlanCode);

  /**
   * Check if user has access to a feature. Returns true if accessible.
   */
  const hasAccess = useCallback(
    (feature: string): boolean => {
      const requiredTier = FEATURE_TIERS[feature];
      if (!requiredTier) return true;
      return TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];
    },
    [currentTier],
  );

  /**
   * Get the minimum required tier for a feature.
   */
  const requiredTierFor = useCallback((feature: string): PlanTier => {
    return FEATURE_TIERS[feature] ?? "free";
  }, []);

  /**
   * Attempt to access a gated feature. If blocked, opens upgrade dialog
   * and returns false. If allowed, returns true.
   */
  const gate = useCallback(
    (feature: string): boolean => {
      if (hasAccess(feature)) return true;

      setState({
        open: true,
        variant: "lock",
        featureName: feature,
        templateName: "",
        sharpeRatio: 0,
        used: 0,
        limit: 0,
        resetAt: "",
      });
      return false;
    },
    [hasAccess],
  );

  /**
   * Show the "aha" upgrade nudge (e.g. after good backtest results).
   */
  const showAha = useCallback((sharpeRatio: number) => {
    setState({
      ...INITIAL_STATE,
      open: true,
      variant: "aha",
      sharpeRatio,
    });
  }, []);

  /**
   * Show the "limit" upgrade nudge (quota exceeded).
   */
  const showLimit = useCallback(
    (featureName: string, used: number, limit: number, resetAt?: string) => {
      setState({
        ...INITIAL_STATE,
        open: true,
        variant: "limit",
        featureName,
        used,
        limit,
        resetAt: resetAt ?? "",
      });
    },
    [],
  );

  /**
   * Show the "upsell" upgrade nudge (results page pro metrics).
   */
  const showUpsell = useCallback(() => {
    setState({ ...INITIAL_STATE, open: true, variant: "upsell" });
  }, []);

  /**
   * Close the dialog.
   */
  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const setOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, open }));
  }, []);

  return {
    /** Current plan tier */
    currentTier,
    /** Plan limits for current tier */
    limits: getLimitsForPlan(currentTier),
    /** Check feature access */
    hasAccess,
    /** Get required tier for a feature */
    requiredTierFor,
    /** Gate a feature (returns true if allowed, shows dialog if not) */
    gate,
    /** Show aha upgrade nudge */
    showAha,
    /** Show limit upgrade nudge */
    showLimit,
    /** Show upsell upgrade nudge */
    showUpsell,
    /** Dialog state */
    dialogState: state,
    /** Close dialog */
    closeDialog: close,
    /** Set dialog open state */
    setDialogOpen: setOpen,
  };
}
