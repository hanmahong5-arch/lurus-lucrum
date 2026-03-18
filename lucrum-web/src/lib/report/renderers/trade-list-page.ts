/**
 * Trade List Page Renderer
 * Renders a table of the first N trades with P&L highlighting.
 *
 * @module lib/report/renderers/trade-list-page
 */

import type { jsPDF } from "jspdf";
import type { TradeListData } from "../types";
import {
  PAGE,
  CONTENT,
  FONT,
  FONT_SIZE,
  COLOR,
  TABLE,
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

/** Column definitions for trade table */
const COLUMNS = [
  { label: "\u65E5\u671F", labelEn: "Date", width: 28, align: "left" as const },
  { label: "\u65B9\u5411", labelEn: "Side", width: 16, align: "center" as const },
  { label: "\u6807\u7684", labelEn: "Symbol", width: 28, align: "left" as const },
  { label: "\u4EF7\u683C", labelEn: "Price", width: 24, align: "right" as const },
  { label: "\u6570\u91CF", labelEn: "Qty", width: 22, align: "right" as const },
  { label: "\u76C8\u4E8F", labelEn: "P&L", width: 28, align: "right" as const },
];

/**
 * Render the trade list page.
 *
 * @param doc - jsPDF document instance
 * @param data - Trade list data
 * @param hasChinese - Whether Chinese font is available
 */
export function renderTradeListPage(
  doc: jsPDF,
  data: TradeListData,
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
      ? `\u4EA4\u6613\u8BB0\u5F55 (${data.totalTrades} \u7B14)`
      : `Trade History (${data.totalTrades} trades)`,
    CONTENT.START_X,
    y
  );
  y += 12;

  // Calculate column positions
  const totalDefinedWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const scale = CONTENT.WIDTH / totalDefinedWidth;
  let xOffset = CONTENT.START_X;
  const colPositions = COLUMNS.map((c) => {
    const x = xOffset;
    const w = c.width * scale;
    xOffset += w;
    return { ...c, x, w };
  });

  // Table header
  setFill(doc, COLOR.TABLE_HEADER_BG);
  doc.rect(CONTENT.START_X, y, CONTENT.WIDTH, TABLE.HEADER_HEIGHT, "F");

  doc.setFont(font, "normal");
  doc.setFontSize(FONT_SIZE.TINY);
  setText(doc, COLOR.TEXT_WHITE);

  for (const col of colPositions) {
    const headerLabel = hasChinese ? col.label : col.labelEn;
    if (col.align === "right") {
      doc.text(headerLabel, col.x + col.w - TABLE.CELL_PADDING, y + TABLE.HEADER_HEIGHT - 2, {
        align: "right",
      });
    } else if (col.align === "center") {
      doc.text(headerLabel, col.x + col.w / 2, y + TABLE.HEADER_HEIGHT - 2, {
        align: "center",
      });
    } else {
      doc.text(headerLabel, col.x + TABLE.CELL_PADDING, y + TABLE.HEADER_HEIGHT - 2);
    }
  }
  y += TABLE.HEADER_HEIGHT;

  // Table rows
  for (let i = 0; i < data.trades.length; i++) {
    const trade = data.trades[i]!;

    // Check for page overflow
    if (y + TABLE.ROW_HEIGHT > PAGE.HEIGHT - CONTENT.START_Y) {
      break;
    }

    // Row background
    const bgColor: RGB =
      i % 2 === 0 ? COLOR.TABLE_ROW_EVEN : COLOR.TABLE_ROW_ODD;
    setFill(doc, bgColor);
    doc.rect(CONTENT.START_X, y, CONTENT.WIDTH, TABLE.ROW_HEIGHT, "F");

    doc.setFontSize(FONT_SIZE.TINY);
    const textY = y + TABLE.ROW_HEIGHT - 2;

    // Date
    doc.setFont(FONT.MONO, "normal");
    setText(doc, COLOR.TEXT);
    doc.text(trade.date, colPositions[0]!.x + TABLE.CELL_PADDING, textY);

    // Type (buy/sell)
    const typeColor: RGB =
      trade.type === "buy" ? COLOR.PROFIT : COLOR.LOSS;
    const typeLabel =
      trade.type === "buy"
        ? hasChinese
          ? "\u4E70\u5165"
          : "BUY"
        : hasChinese
          ? "\u5356\u51FA"
          : "SELL";
    doc.setFont(font, "normal");
    setText(doc, typeColor);
    doc.text(typeLabel, colPositions[1]!.x + colPositions[1]!.w / 2, textY, {
      align: "center",
    });

    // Symbol
    doc.setFont(FONT.MONO, "normal");
    setText(doc, COLOR.TEXT);
    doc.text(trade.symbol, colPositions[2]!.x + TABLE.CELL_PADDING, textY);

    // Price
    doc.text(
      trade.price,
      colPositions[3]!.x + colPositions[3]!.w - TABLE.CELL_PADDING,
      textY,
      { align: "right" }
    );

    // Quantity
    doc.text(
      trade.quantity,
      colPositions[4]!.x + colPositions[4]!.w - TABLE.CELL_PADDING,
      textY,
      { align: "right" }
    );

    // P&L
    const pnlColor: RGB =
      trade.pnlHighlight === "profit"
        ? COLOR.PROFIT
        : trade.pnlHighlight === "loss"
          ? COLOR.LOSS
          : COLOR.TEXT;
    setText(doc, pnlColor);
    doc.text(
      trade.pnl,
      colPositions[5]!.x + colPositions[5]!.w - TABLE.CELL_PADDING,
      textY,
      { align: "right" }
    );

    y += TABLE.ROW_HEIGHT;
  }

  // Bottom border
  setDraw(doc, COLOR.TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.line(CONTENT.START_X, y, CONTENT.START_X + CONTENT.WIDTH, y);

  // "More trades" footer if needed
  if (data.hasMore) {
    y += 8;
    doc.setFont(font, "normal");
    doc.setFontSize(FONT_SIZE.SMALL);
    setText(doc, COLOR.TEXT_MUTED);
    doc.text(
      hasChinese
        ? `... \u53E6\u6709 ${data.moreCount} \u7B14\u4EA4\u6613\u672A\u663E\u793A`
        : `... and ${data.moreCount} more trades`,
      CONTENT.START_X + CONTENT.WIDTH / 2,
      y,
      { align: "center" }
    );
  }
}
