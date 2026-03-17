/**
 * Strategy Generation & Optimization Hooks
 *
 * Connects to gushen-web /api/strategy/* endpoints.
 */

import { useMutation } from "@tanstack/react-query";
import { gushenApi } from "@/lib/api/client";

// ============================================================
// Types
// ============================================================

interface GenerateRequest {
  prompt: string;
  strategyType?: string;
}

interface GenerateResponse {
  success: boolean;
  code: string;
  cached: boolean;
  cacheKey: string;
  usage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface ExplainResponse {
  success: boolean;
  action: "explain_strategy";
  explanation: {
    summary: string;
    indicators: { name: string; purpose: string; currentConfig: string }[];
    entryLogic: string;
    exitLogic: string;
    riskManagement: string;
    strengths: string[];
    weaknesses: string[];
    suitableMarkets: string[];
  };
}

interface SuggestParamsResponse {
  success: boolean;
  action: "suggest_params";
  suggestions: {
    name: string;
    currentValue: number;
    suggestedValue: number;
    reason: string;
    expectedImprovement: string;
    confidence: "high" | "medium" | "low";
  }[];
}

// ============================================================
// Hooks
// ============================================================

export function useGenerateStrategy() {
  return useMutation({
    mutationFn: async (request: GenerateRequest) => {
      const { data } = await gushenApi.post<GenerateResponse>(
        "/strategy/generate",
        request,
      );
      if (!data.success) throw new Error("Strategy generation failed");
      return data;
    },
  });
}

export function useExplainStrategy() {
  return useMutation({
    mutationFn: async (strategyCode: string) => {
      const { data } = await gushenApi.post<ExplainResponse>(
        "/strategy/optimize",
        { action: "explain_strategy", strategyCode },
      );
      if (!data.success) throw new Error("Strategy explanation failed");
      return data.explanation;
    },
  });
}

export function useSuggestParams() {
  return useMutation({
    mutationFn: async (params: {
      strategyCode: string;
      currentParameters?: Record<string, number>;
      backtestResult?: Record<string, number>;
    }) => {
      const { data } = await gushenApi.post<SuggestParamsResponse>(
        "/strategy/optimize",
        {
          action: "suggest_params",
          ...params,
        },
      );
      if (!data.success) throw new Error("Parameter suggestion failed");
      return data.suggestions;
    },
  });
}
