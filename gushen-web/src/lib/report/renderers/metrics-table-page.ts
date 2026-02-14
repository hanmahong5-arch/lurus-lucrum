/**
 * Metrics Table Page Renderer
 * Renders the 3-category metrics table (return, risk, trading).
 *
 * @module lib/report/renderers/metrics-table-page
 */

import type { jsPDF } from "jspdf";
import type { MetricsData, MetricRow } from "../types";
import {
  CONTENT,
  FONT,
  FONT_SIZE,
  COLOR,
  TABLE,
} from "../constants";

/** RGB tuple type alias */
type RGB = readonly [number, number, number];

/** Section titles */
const SECTION_TITLES = {
  returnMetrics: {
    zh: "\u6536\u76CA\u6307\u6807",
    en: "Return Metrics",
  },
  riskMetrics: {
    zh: "\u98CE\u9669\u6307\u6807",
    en: "Risk Metrics",
  },
  tradingMetrics: {
    zh: "\u4EA4\u6613\u6307\u6807",
    en: "Trading Metrics",
  },
};

/** Apply RGB color to jsPDF fill */
function setFill(doc: jsPDF, color: RGB): void {
  doc.setFillColor(color[0], color[1], color[2]);
}

/** Apply RGB color to jsPDF text */
function setText(doc: jsPDF, color: RGB): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

/** Apply RGB color to jsPDF draw */
function setDraw(doc: jsPDF, color: RGB): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

/**
 * Render a single metrics section table.
 *
 * @returns The Y position after the rendered table
 */
function renderMetricsSection(
  doc: jsPDF,
  title: string,
  rows: MetricRow[],
  startY: number,
  hasChinese: boolean
): number {
  const font = hasChinese ? FONT.CJK : FONT.FALLBACK;
  let y = startY;

  // Section title
  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.SUBHEADING);
  setText(doc, COLOR.TEXT);
  doc.text(title, CONTENT.START_X, y);
  y += 8;

  // Table header
  const labelX = CONTENT.START_X;
  const valueX = CONTENT.START_X + CONTENT.WIDTH - 2;

  setFill(doc, COLOR.TABLE_HEADER_BG);
  doc.rect(CONTENT.START_X, y, CONTENT.WIDTH, TABLE.HEADER_HEIGHT, "F");

  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.SMALL);
  setText(doc, COLOR.TEXT_WHITE);
  doc.text(
    hasChinese ? "\u6307\u6807" : "Metric",
    labelX + TABLE.CELL_PADDING,
    y + TABLE.HEADER_HEIGHT - 2
  );
  doc.text(
    hasChinese ? "\u6570\u503C" : "Value",
    valueX - TABLE.CELL_PADDING,
    y + TABLE.HEADER_HEIGHT - 2,
    { align: "right" }
  );
  y += TABLE.HEADER_HEIGHT;

  // Table rows
  rows.forEach((row, index) => {
    const bgColor: RGB =
      index % 2 === 0 ? COLOR.TABLE_ROW_EVEN : COLOR.TABLE_ROW_ODD;

    setFill(doc, bgColor);
    doc.rect(CONTENT.START_X, y, CONTENT.WIDTH, TABLE.ROW_HEIGHT, "F");

    // Label
    doc.setFont(font, "normal");
    doc.setFontSize(FONT_SIZE.BODY);
    setText(doc, COLOR.TEXT);
    doc.text(
      row.label,
      labelX + TABLE.CELL_PADDING,
      y + TABLE.ROW_HEIGHT - 2
    );

    // Value with highlight color
    const valueColor: RGB =
      row.highlight === "profit"
        ? COLOR.PROFIT
        : row.highlight === "loss"
          ? COLOR.LOSS
          : COLOR.TEXT;
    setText(doc, valueColor);
    doc.setFont(FONT.MONO, "normal");
    doc.text(
      row.value,
      valueX - TABLE.CELL_PADDING,
      y + TABLE.ROW_HEIGHT - 2,
      { align: "right" }
    );

    y += TABLE.ROW_HEIGHT;
  });

  // Bottom border
  setDraw(doc, COLOR.TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.line(CONTENT.START_X, y, CONTENT.START_X + CONTENT.WIDTH, y);

  return y + 8;
}

/**
 * Render the metrics table page.
 *
 * @param doc - jsPDF document instance
 * @param data - Metrics table data
 * @param hasChinese - Whether Chinese font is available
 */
export function renderMetricsTablePage(
  doc: jsPDF,
  data: MetricsData,
  hasChinese: boolean
): void {
  const font = hasChinese ? FONT.CJK : FONT.FALLBACK;
  let y: number = CONTENT.START_Y;

  // Page title
  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.HEADING);
  setText(doc, COLOR.TEXT);
  doc.text(
    hasChinese
      ? "\u8BE6\u7EC6\u6307\u6807"
      : "Detailed Metrics",
    CONTENT.START_X,
    y
  );
  y += 14;

  // Render sections
  const sections = [
    { key: "returnMetrics" as const, rows: data.returnMetrics },
    { key: "riskMetrics" as const, rows: data.riskMetrics },
    { key: "tradingMetrics" as const, rows: data.tradingMetrics },
  ];

  for (const section of sections) {
    const titleObj = SECTION_TITLES[section.key];
    const title = hasChinese ? titleObj.zh : titleObj.en;
    y = renderMetricsSection(doc, title, section.rows, y, hasChinese);
  }
}
