/**
 * PDF Report Generator
 * Main orchestrator that assembles data, renders each page, and triggers download.
 *
 * Pipeline: cover -> score -> chart -> metrics -> trades -> stock ranking
 * Pages are conditionally included based on data availability.
 *
 * @module lib/report/pdf-generator
 */

import type { UnifiedBacktestResult } from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";
import type { PdfGenerateOptions, PdfGenerateResult, ReportData } from "./types";
import { PAGE } from "./constants";
import { loadChineseFont } from "./fonts";
import { assembleReportData, generateFilename } from "./report-data-assembler";
import { captureChartImage } from "./renderers/chart-page";
import {
  renderCoverPage,
  renderScorePage,
  renderMetricsTablePage,
  renderTradeListPage,
  renderStockRankingPage,
  renderChartPage,
} from "./renderers";

/**
 * Generate a PDF report from backtest results and trigger browser download.
 *
 * @param result - The unified backtest result
 * @param score - Optional strategy score
 * @param options - Generation options (chart element, filename, etc.)
 * @returns PdfGenerateResult with success status and filename
 */
export async function generatePdfReport(
  result: UnifiedBacktestResult,
  score: StrategyScore | null = null,
  options: PdfGenerateOptions = {}
): Promise<PdfGenerateResult> {
  const filename = options.filename || generateFilename(result);

  try {
    // Step 1: Assemble report data
    const reportData: ReportData = assembleReportData(result, score);

    // Step 2: Capture chart image if requested
    if (options.includeChart !== false && options.chartElement) {
      reportData.chartImage = await captureChartImage(options.chartElement);
    }

    // Step 3: Create jsPDF document (dynamic import for code splitting)
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Step 4: Load Chinese font
    const hasChinese = await loadChineseFont(doc);

    // Step 5: Render pages in sequence
    // Page 1: Cover
    renderCoverPage(doc, reportData.cover, hasChinese);

    // Page 2: Score (if available)
    if (reportData.score) {
      doc.addPage();
      renderScorePage(doc, reportData.score, hasChinese);
    }

    // Page 3: Chart (if image captured or placeholder)
    if (
      reportData.chartImage ||
      (options.includeChart !== false && options.chartElement)
    ) {
      doc.addPage();
      renderChartPage(doc, reportData.chartImage, hasChinese);
    }

    // Page 4: Metrics
    doc.addPage();
    renderMetricsTablePage(doc, reportData.metrics, hasChinese);

    // Page 5: Trade list (if trades exist)
    if (reportData.tradeList) {
      doc.addPage();
      renderTradeListPage(doc, reportData.tradeList, hasChinese);
    }

    // Page 6+: Stock ranking (if multi-stock mode)
    if (reportData.stockRanking) {
      doc.addPage();
      renderStockRankingPage(doc, reportData.stockRanking, hasChinese);
    }

    // Step 6: Trigger download
    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename}.pdf`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 100);

    return {
      success: true,
      filename: `${filename}.pdf`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error during PDF generation";
    console.error("[PDF Report] Generation failed:", error);

    return {
      success: false,
      filename: `${filename}.pdf`,
      error: message,
    };
  }
}
