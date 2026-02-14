/**
 * Export PDF Button Component
 * Triggers PDF report generation with loading state and toast notifications.
 *
 * @module components/backtest/export-pdf-button
 */

"use client";

import { useCallback } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";
import { useReportExport } from "@/lib/report/use-report-export";
import type { UnifiedBacktestResult } from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";
import type { PdfGenerateOptions } from "@/lib/report/types";

// =============================================================================
// TYPES
// =============================================================================

export interface ExportPdfButtonProps {
  /** Backtest result data to export */
  result: UnifiedBacktestResult;
  /** Optional strategy score */
  score?: StrategyScore | null;
  /** HTML element to capture as equity curve chart */
  chartElement?: HTMLElement | null;
  /** Custom filename (without .pdf extension) */
  filename?: string;
  /** Button variant */
  variant?: "primary" | "outline" | "ghost" | "secondary";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Additional CSS class */
  className?: string;
  /** Whether to include equity curve chart */
  includeChart?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ExportPdfButton({
  result,
  score = null,
  chartElement = null,
  filename,
  variant = "outline",
  size = "sm",
  className,
  includeChart = true,
}: ExportPdfButtonProps) {
  const { isExporting, exportPdf } = useReportExport({
    onSuccess: () => {
      showToast.success("\u62A5\u544A\u5BFC\u51FA\u5B8C\u6210");
    },
    onError: (error) => {
      showToast.error(
        `\u62A5\u544A\u751F\u6210\u5931\u8D25: ${error}`
      );
    },
  });

  const handleClick = useCallback(() => {
    showToast.info(
      "\u6B63\u5728\u751F\u6210\u62A5\u544A...",
      { duration: 3000 }
    );

    const options: PdfGenerateOptions = {
      includeChart,
      chartElement,
      filename,
    };

    void exportPdf(result, score, options);
  }, [result, score, chartElement, filename, includeChart, exportPdf]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isExporting}
      aria-label={
        isExporting
          ? "\u6B63\u5728\u751F\u6210 PDF \u62A5\u544A"
          : "\u5BFC\u51FA PDF \u62A5\u544A"
      }
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 mr-2" />
      )}
      {isExporting ? "\u751F\u6210\u4E2D..." : "\u5BFC\u51FA PDF"}
    </Button>
  );
}

export default ExportPdfButton;
