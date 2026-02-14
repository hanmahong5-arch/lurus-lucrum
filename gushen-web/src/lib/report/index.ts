/**
 * PDF Report Module - Barrel Export
 * @module lib/report
 */

export { generatePdfReport } from "./pdf-generator";
export { assembleReportData, generateFilename } from "./report-data-assembler";
export { captureChartImage } from "./renderers/chart-page";
export { useReportExport } from "./use-report-export";
export type {
  ReportData,
  PdfGenerateOptions,
  PdfGenerateResult,
  ChartImageData,
} from "./types";
