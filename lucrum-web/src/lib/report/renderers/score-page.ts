/**
 * Score Page Renderer
 * Renders the strategy score summary page with grade, breakdown bars, and core metrics.
 *
 * @module lib/report/renderers/score-page
 */

import type { jsPDF } from "jspdf";
import type { ScoreData } from "../types";
import {
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

/** Dimension label mapping */
const DIMENSION_LABELS: Record<string, string> = {
  profitability: "\u6536\u76CA\u6027",
  risk: "\u98CE\u63A7",
  stability: "\u7A33\u5B9A\u6027",
  efficiency: "\u4EA4\u6613\u6548\u7387",
};

const DIMENSION_LABELS_EN: Record<string, string> = {
  profitability: "Profitability",
  risk: "Risk Control",
  stability: "Stability",
  efficiency: "Efficiency",
};

/**
 * Render the score summary page.
 *
 * @param doc - jsPDF document instance
 * @param data - Score data
 * @param hasChinese - Whether Chinese font is available
 */
export function renderScorePage(
  doc: jsPDF,
  data: ScoreData,
  hasChinese: boolean
): void {
  const font = hasChinese ? FONT.CJK : FONT.FALLBACK;
  let y = CONTENT.START_Y;

  // Page title
  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.HEADING);
  setText(doc, COLOR.TEXT);
  doc.text(
    hasChinese ? "\u7B56\u7565\u8BC4\u5206\u6982\u89C8" : "Score Overview",
    CONTENT.START_X,
    y
  );

  // Grade display
  y += 16;
  const gradeColor: RGB = GRADE_COLORS[data.grade] ?? COLOR.GRADE_C;

  // Grade circle
  const circleX = CONTENT.START_X + 20;
  const circleY = y + 12;
  setFill(doc, gradeColor);
  doc.circle(circleX, circleY, 14, "F");
  setText(doc, COLOR.TEXT_WHITE);
  doc.setFont(FONT.FALLBACK, "bold");
  doc.setFontSize(18);
  doc.text(data.grade, circleX, circleY + 3, { align: "center" });

  // Score and description beside grade
  setText(doc, COLOR.TEXT);
  doc.setFont(FONT.MONO, "normal");
  doc.setFontSize(FONT_SIZE.SUBTITLE);
  doc.text(`${data.score}`, circleX + 24, circleY - 2);

  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.BODY);
  setText(doc, COLOR.TEXT_MUTED);
  doc.text(`/ 100  ${data.description}`, circleX + 42, circleY - 2);

  // Dimension breakdown bars
  y = circleY + 24;
  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.SUBHEADING);
  setText(doc, COLOR.TEXT);
  doc.text(
    hasChinese
      ? "\u7EF4\u5EA6\u5206\u6790"
      : "Dimension Breakdown",
    CONTENT.START_X,
    y
  );

  y += 10;
  const barX = CONTENT.START_X + 40;
  const barWidth = CONTENT.WIDTH - 80;
  const barHeight = 8;

  const dimensions: Array<keyof typeof DIMENSION_LABELS> = [
    "profitability",
    "risk",
    "stability",
    "efficiency",
  ];

  for (const dim of dimensions) {
    const score = data.breakdown[dim as keyof typeof data.breakdown] ?? 0;
    const label = hasChinese
      ? (DIMENSION_LABELS[dim] ?? dim)
      : (DIMENSION_LABELS_EN[dim] ?? dim);

    // Label
    doc.setFont(font, "normal");
    doc.setFontSize(FONT_SIZE.SMALL);
    setText(doc, COLOR.TEXT);
    doc.text(label, CONTENT.START_X, y + barHeight / 2 + 1);

    // Background bar
    setFill(doc, COLOR.BAR_BG);
    doc.roundedRect(barX, y, barWidth, barHeight, 2, 2, "F");

    // Fill bar
    const fillWidth = Math.max(0, (score / 100) * barWidth);
    if (fillWidth > 0) {
      setFill(doc, COLOR.BAR_FILL);
      doc.roundedRect(barX, y, fillWidth, barHeight, 2, 2, "F");
    }

    // Score value
    doc.setFont(FONT.MONO, "normal");
    doc.setFontSize(FONT_SIZE.SMALL);
    setText(doc, COLOR.TEXT);
    doc.text(`${Math.round(score)}`, barX + barWidth + 4, y + barHeight / 2 + 1);

    y += barHeight + 8;
  }

  // Core metrics section
  y += 8;
  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.SUBHEADING);
  setText(doc, COLOR.TEXT);
  doc.text(
    hasChinese
      ? "\u6838\u5FC3\u6307\u6807"
      : "Core Metrics",
    CONTENT.START_X,
    y
  );

  y += 12;
  const metrics = data.coreMetrics;
  const coreItems: Array<{ label: string; value: string }> = [
    {
      label: hasChinese ? "\u603B\u6536\u76CA\u7387" : "Total Return",
      value: `${metrics.totalReturn.toFixed(2)}%`,
    },
    {
      label: hasChinese
        ? "\u5E74\u5316\u6536\u76CA\u7387"
        : "Annualized Return",
      value: `${metrics.annualizedReturn.toFixed(2)}%`,
    },
    {
      label: hasChinese ? "\u6700\u5927\u56DE\u64A4" : "Max Drawdown",
      value: `${metrics.maxDrawdown.toFixed(2)}%`,
    },
    {
      label: hasChinese ? "\u590F\u666E\u6BD4\u7387" : "Sharpe Ratio",
      value: metrics.sharpeRatio.toFixed(2),
    },
  ];

  // Render core metrics as a 2x2 grid of boxes
  const boxWidth = (CONTENT.WIDTH - 10) / 2;
  const boxHeight = 24;
  let col = 0;

  for (const item of coreItems) {
    const bx = CONTENT.START_X + col * (boxWidth + 10);
    const by = y;

    // Box border
    setDraw(doc, COLOR.DIVIDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, boxWidth, boxHeight, 2, 2, "S");

    // Label
    doc.setFont(font, "normal");
    doc.setFontSize(FONT_SIZE.SMALL);
    setText(doc, COLOR.TEXT_MUTED);
    doc.text(item.label, bx + 4, by + 9);

    // Value
    doc.setFont(FONT.MONO, "normal");
    doc.setFontSize(FONT_SIZE.SUBHEADING);
    setText(doc, COLOR.TEXT);
    doc.text(item.value, bx + 4, by + 20);

    col++;
    if (col >= 2) {
      col = 0;
      y += boxHeight + 6;
    }
  }

  // Benchmark comparison (if available)
  if (data.benchmarkAlpha != null || data.benchmarkBeta != null) {
    y += boxHeight + 14;
    doc.setFont(font, "normal");
    doc.setFontSize(FONT_SIZE.BODY);
    setText(doc, COLOR.TEXT_MUTED);

    const benchmarkParts: string[] = [];
    if (data.benchmarkAlpha != null) {
      benchmarkParts.push(`Alpha: ${data.benchmarkAlpha.toFixed(2)}`);
    }
    if (data.benchmarkBeta != null) {
      benchmarkParts.push(`Beta: ${data.benchmarkBeta.toFixed(2)}`);
    }
    doc.text(
      `${hasChinese ? "\u57FA\u51C6\u5BF9\u6BD4" : "Benchmark"}: ${benchmarkParts.join("  |  ")}`,
      CONTENT.START_X,
      y
    );
  }
}
