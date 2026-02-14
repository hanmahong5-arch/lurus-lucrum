/**
 * Cover Page Renderer
 * Renders the first page of the PDF report with title, strategy info, and grade badge.
 *
 * @module lib/report/renderers/cover-page
 */

import type { jsPDF } from "jspdf";
import type { CoverData } from "../types";
import {
  PAGE,
  CONTENT,
  FONT,
  FONT_SIZE,
  COLOR,
  GRADE_COLORS,
} from "../constants";

/** RGB tuple type alias */
type RGB = readonly [number, number, number];

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
 * Render the cover page onto the given jsPDF document.
 *
 * @param doc - jsPDF document instance
 * @param data - Cover page data
 * @param hasChinese - Whether Chinese font is available
 */
export function renderCoverPage(
  doc: jsPDF,
  data: CoverData,
  hasChinese: boolean
): void {
  const font = hasChinese ? FONT.CJK : FONT.FALLBACK;
  const centerX = PAGE.WIDTH / 2;

  // Accent bar at top
  setFill(doc, COLOR.ACCENT);
  doc.rect(0, 0, PAGE.WIDTH, 6, "F");

  // Title
  let y = 60;
  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.TITLE);
  setText(doc, COLOR.TEXT);
  doc.text(data.title, centerX, y, { align: "center" });

  // Grade badge
  y += 20;
  const gradeColor: RGB = GRADE_COLORS[data.grade] ?? COLOR.GRADE_C;
  const badgeRadius = 18;
  setFill(doc, gradeColor);
  doc.circle(centerX, y + badgeRadius / 2, badgeRadius, "F");
  setText(doc, COLOR.TEXT_WHITE);
  doc.setFontSize(22);
  doc.setFont(FONT.FALLBACK, "bold");
  doc.text(data.grade, centerX, y + badgeRadius / 2 + 3, { align: "center" });

  // Score below badge
  y += badgeRadius + 16;
  setText(doc, COLOR.TEXT);
  doc.setFont(FONT.MONO, "normal");
  doc.setFontSize(FONT_SIZE.HEADING);
  doc.text(`${data.score} / 100`, centerX, y, { align: "center" });

  // Divider line
  y += 16;
  setDraw(doc, COLOR.DIVIDER);
  doc.setLineWidth(0.5);
  doc.line(CONTENT.START_X + 30, y, PAGE.WIDTH - CONTENT.START_X - 30, y);

  // Strategy name
  y += 16;
  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.SUBTITLE);
  setText(doc, COLOR.TEXT);
  doc.text(data.strategyName, centerX, y, { align: "center" });

  // Parameters summary (if any)
  if (data.parametersSummary) {
    y += 10;
    doc.setFontSize(FONT_SIZE.BODY);
    setText(doc, COLOR.TEXT_MUTED);
    doc.text(data.parametersSummary, centerX, y, { align: "center" });
  }

  // Info rows (target, date range, generated at)
  y += 20;
  doc.setFontSize(FONT_SIZE.BODY);
  setText(doc, COLOR.TEXT_MUTED);

  const infoRows: Array<[string, string]> = [];
  if (data.targetInfo) {
    infoRows.push([
      hasChinese ? "\u56DE\u6D4B\u6807\u7684" : "Target",
      data.targetInfo,
    ]);
  }
  infoRows.push([
    hasChinese ? "\u56DE\u6D4B\u533A\u95F4" : "Period",
    data.dateRange,
  ]);
  infoRows.push([
    hasChinese ? "\u751F\u6210\u65F6\u95F4" : "Generated",
    data.generatedAt,
  ]);

  for (const [label, value] of infoRows) {
    doc.setFont(font, "normal");
    setText(doc, COLOR.TEXT_MUTED);
    doc.text(`${label}: `, centerX - 5, y, { align: "right" });
    setText(doc, COLOR.TEXT);
    doc.text(value, centerX + 5, y, { align: "left" });
    y += 8;
  }

  // Footer accent bar
  setFill(doc, COLOR.ACCENT);
  doc.rect(0, PAGE.HEIGHT - 4, PAGE.WIDTH, 4, "F");
}
