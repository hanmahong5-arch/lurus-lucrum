/**
 * useReportExport Hook
 * Provides PDF export functionality with loading state and toast notifications.
 *
 * @module lib/report/use-report-export
 */

import { useState, useCallback } from "react";
import type { UnifiedBacktestResult } from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";
import type { PdfGenerateOptions, PdfGenerateResult } from "./types";

export interface UseReportExportOptions {
  /** Callback fired after successful generation */
  onSuccess?: (result: PdfGenerateResult) => void;
  /** Callback fired on generation failure */
  onError?: (error: string) => void;
}

export interface UseReportExportReturn {
  /** Whether PDF is currently being generated */
  isExporting: boolean;
  /** Trigger PDF export */
  exportPdf: (
    result: UnifiedBacktestResult,
    score?: StrategyScore | null,
    options?: PdfGenerateOptions
  ) => Promise<void>;
}

/**
 * Hook for PDF report export with loading state management.
 * Toast notifications are handled by the consumer component to keep this hook pure.
 */
export function useReportExport(
  hookOptions: UseReportExportOptions = {}
): UseReportExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(
    async (
      result: UnifiedBacktestResult,
      score: StrategyScore | null = null,
      options: PdfGenerateOptions = {}
    ): Promise<void> => {
      if (isExporting) return;

      setIsExporting(true);
      try {
        // Dynamic import to keep PDF generation code out of initial bundle
        const { generatePdfReport } = await import("./pdf-generator");
        const genResult = await generatePdfReport(result, score, options);

        if (genResult.success) {
          hookOptions.onSuccess?.(genResult);
        } else {
          hookOptions.onError?.(
            genResult.error || "PDF generation failed"
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        hookOptions.onError?.(message);
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting, hookOptions]
  );

  return { isExporting, exportPdf };
}
