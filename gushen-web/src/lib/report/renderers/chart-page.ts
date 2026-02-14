/**
 * Chart Page Renderer
 * Captures an HTML element (equity curve chart) as an image via html2canvas
 * and renders it onto a PDF page.
 *
 * @module lib/report/renderers/chart-page
 */

import type { jsPDF } from "jspdf";
import type { ChartImageData } from "../types";
import {
  CONTENT,
  FONT,
  FONT_SIZE,
  COLOR,
  LIMITS,
} from "../constants";

/** RGB tuple type alias */
type RGB = readonly [number, number, number];

/** Apply RGB color to jsPDF text */
function setText(doc: jsPDF, color: RGB): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

/**
 * Capture an HTML element as a base64 PNG image using html2canvas.
 * This is called before PDF generation to prepare the chart snapshot.
 *
 * @param element - The HTML element containing the chart
 * @returns ChartImageData with base64 data URL, or null if capture fails
 */
export async function captureChartImage(
  element: HTMLElement
): Promise<ChartImageData | null> {
  try {
    // Dynamic import to keep html2canvas out of initial bundle
    const html2canvasModule = await import("html2canvas");
    const html2canvas = html2canvasModule.default;

    const canvas = await html2canvas(element, {
      scale: LIMITS.CHART_SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    console.error("[PDF Report] Chart capture failed:", error);
    return null;
  }
}

/**
 * Render the chart page.
 * If chartImage is null, renders a placeholder message.
 *
 * @param doc - jsPDF document instance
 * @param chartImage - Captured chart image data, or null
 * @param hasChinese - Whether Chinese font is available
 */
export function renderChartPage(
  doc: jsPDF,
  chartImage: ChartImageData | null,
  hasChinese: boolean
): void {
  const font = hasChinese ? FONT.CJK : FONT.FALLBACK;
  let y = CONTENT.START_Y;

  // Page title
  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.HEADING);
  setText(doc, COLOR.TEXT);
  doc.text(
    hasChinese
      ? "\u51C0\u503C\u66F2\u7EBF"
      : "Equity Curve",
    CONTENT.START_X,
    y
  );
  y += 12;

  if (chartImage) {
    // Calculate image dimensions to fit within content area
    const maxWidth = CONTENT.WIDTH;
    const maxHeight = 160; // Leave room for title and footer
    const aspectRatio = chartImage.width / chartImage.height;

    let imgWidth = maxWidth;
    let imgHeight = imgWidth / aspectRatio;

    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = imgHeight * aspectRatio;
    }

    // Center horizontally
    const imgX = CONTENT.START_X + (CONTENT.WIDTH - imgWidth) / 2;

    doc.addImage(chartImage.dataUrl, "PNG", imgX, y, imgWidth, imgHeight);
    y += imgHeight + 8;

    // Caption
    doc.setFont(font, "normal");
    doc.setFontSize(FONT_SIZE.SMALL);
    setText(doc, COLOR.TEXT_MUTED);
    doc.text(
      hasChinese
        ? "\u8D44\u4EA7\u51C0\u503C\u53D8\u5316\u53CA\u56DE\u64A4\u533A\u95F4"
        : "Portfolio equity change and drawdown periods",
      CONTENT.START_X + CONTENT.WIDTH / 2,
      y,
      { align: "center" }
    );
  } else {
    // Placeholder when chart is not available
    y += 40;
    doc.setFont(font, "normal");
    doc.setFontSize(FONT_SIZE.BODY);
    setText(doc, COLOR.TEXT_MUTED);
    doc.text(
      hasChinese
        ? "\u56FE\u8868\u4E0D\u53EF\u7528 (Chart unavailable)"
        : "Chart unavailable",
      CONTENT.START_X + CONTENT.WIDTH / 2,
      y,
      { align: "center" }
    );
  }
}
