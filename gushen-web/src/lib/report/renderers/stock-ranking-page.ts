/**
 * Stock Ranking Page Renderer
 * Renders the multi-stock ranking table with gold/silver/bronze top-3 styling.
 *
 * @module lib/report/renderers/stock-ranking-page
 */

import type { jsPDF } from "jspdf";
import type { StockRankingData } from "../types";
import {
  PAGE,
  CONTENT,
  FONT,
  FONT_SIZE,
  COLOR,
  TABLE,
  LIMITS,
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

/** Column definitions for ranking table */
const COLUMNS = [
  { label: "#", labelEn: "#", width: 10, align: "center" as const },
  { label: "\u4EE3\u7801", labelEn: "Symbol", width: 20, align: "left" as const },
  { label: "\u540D\u79F0", labelEn: "Name", width: 28, align: "left" as const },
  { label: "\u6536\u76CA\u7387", labelEn: "Return", width: 22, align: "right" as const },
  { label: "\u80DC\u7387", labelEn: "Win%", width: 18, align: "right" as const },
  { label: "\u590F\u666E", labelEn: "Sharpe", width: 18, align: "right" as const },
  { label: "\u56DE\u64A4", labelEn: "MaxDD", width: 20, align: "right" as const },
  { label: "\u4EA4\u6613\u6570", labelEn: "Trades", width: 16, align: "right" as const },
];

/** Medal colors for top 3 */
const MEDAL_COLORS: RGB[] = [
  COLOR.GOLD,
  COLOR.SILVER,
  COLOR.BRONZE,
];

/**
 * Render the stock ranking page.
 * Handles pagination internally if there are more stocks than MAX_STOCKS_PER_PAGE.
 *
 * @param doc - jsPDF document instance
 * @param data - Stock ranking data
 * @param hasChinese - Whether Chinese font is available
 */
export function renderStockRankingPage(
  doc: jsPDF,
  data: StockRankingData,
  hasChinese: boolean
): void {
  const font = hasChinese ? FONT.CJK : FONT.FALLBACK;
  const stocks = data.stocks;
  const maxPerPage = LIMITS.MAX_STOCKS_PER_PAGE;
  let pageIndex = 0;

  for (let startIdx = 0; startIdx < stocks.length; startIdx += maxPerPage) {
    // Add new page for continuation pages
    if (pageIndex > 0) {
      doc.addPage();
    }

    const pageStocks = stocks.slice(startIdx, startIdx + maxPerPage);
    let y = CONTENT.START_Y;

    // Page title
    doc.setFont(font, "normal");
    doc.setFontSize(FONT_SIZE.HEADING);
    setText(doc, COLOR.TEXT);

    const titleSuffix =
      stocks.length > maxPerPage
        ? ` (${startIdx + 1}-${Math.min(startIdx + maxPerPage, stocks.length)} / ${stocks.length})`
        : ` (${stocks.length})`;
    doc.text(
      (hasChinese ? "\u4E2A\u80A1\u6392\u540D" : "Stock Ranking") + titleSuffix,
      CONTENT.START_X,
      y
    );

    // Failed count note
    if (data.failedCount && data.failedCount > 0 && pageIndex === 0) {
      y += 8;
      doc.setFontSize(FONT_SIZE.SMALL);
      setText(doc, COLOR.LOSS);
      doc.text(
        hasChinese
          ? `${data.failedCount} \u53EA\u80A1\u7968\u56DE\u6D4B\u5931\u8D25`
          : `${data.failedCount} stocks failed`,
        CONTENT.START_X,
        y
      );
    }
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
    for (const stock of pageStocks) {
      if (y + TABLE.ROW_HEIGHT > PAGE.HEIGHT - CONTENT.START_Y) break;

      const bgColor: RGB =
        (stock.rank - 1) % 2 === 0 ? COLOR.TABLE_ROW_EVEN : COLOR.TABLE_ROW_ODD;
      setFill(doc, bgColor);
      doc.rect(CONTENT.START_X, y, CONTENT.WIDTH, TABLE.ROW_HEIGHT, "F");

      const textY = y + TABLE.ROW_HEIGHT - 2;
      doc.setFontSize(FONT_SIZE.TINY);

      // Rank (with medal color for top 3)
      const medalColor = stock.rank <= 3 ? MEDAL_COLORS[stock.rank - 1] : undefined;
      if (medalColor) {
        setText(doc, medalColor);
        doc.setFont(FONT.FALLBACK, "bold");
      } else {
        setText(doc, COLOR.TEXT);
        doc.setFont(FONT.MONO, "normal");
      }
      doc.text(
        `${stock.rank}`,
        colPositions[0]!.x + colPositions[0]!.w / 2,
        textY,
        { align: "center" }
      );

      // Symbol
      doc.setFont(FONT.MONO, "normal");
      setText(doc, COLOR.TEXT);
      doc.text(stock.symbol, colPositions[1]!.x + TABLE.CELL_PADDING, textY);

      // Name
      doc.setFont(font, "normal");
      doc.text(stock.name, colPositions[2]!.x + TABLE.CELL_PADDING, textY);

      // Total Return (with P&L color)
      const returnColor: RGB =
        stock.totalReturnHighlight === "profit"
          ? COLOR.PROFIT
          : stock.totalReturnHighlight === "loss"
            ? COLOR.LOSS
            : COLOR.TEXT;
      doc.setFont(FONT.MONO, "normal");
      setText(doc, returnColor);
      doc.text(
        stock.totalReturn,
        colPositions[3]!.x + colPositions[3]!.w - TABLE.CELL_PADDING,
        textY,
        { align: "right" }
      );

      // Win Rate
      setText(doc, COLOR.TEXT);
      doc.text(
        stock.winRate,
        colPositions[4]!.x + colPositions[4]!.w - TABLE.CELL_PADDING,
        textY,
        { align: "right" }
      );

      // Sharpe Ratio
      doc.text(
        stock.sharpeRatio,
        colPositions[5]!.x + colPositions[5]!.w - TABLE.CELL_PADDING,
        textY,
        { align: "right" }
      );

      // Max Drawdown
      setText(doc, COLOR.LOSS);
      doc.text(
        stock.maxDrawdown,
        colPositions[6]!.x + colPositions[6]!.w - TABLE.CELL_PADDING,
        textY,
        { align: "right" }
      );

      // Trade Count
      setText(doc, COLOR.TEXT);
      doc.text(
        `${stock.tradeCount}`,
        colPositions[7]!.x + colPositions[7]!.w - TABLE.CELL_PADDING,
        textY,
        { align: "right" }
      );

      y += TABLE.ROW_HEIGHT;
    }

    // Bottom border
    setDraw(doc, COLOR.TABLE_BORDER);
    doc.setLineWidth(0.3);
    doc.line(CONTENT.START_X, y, CONTENT.START_X + CONTENT.WIDTH, y);

    // Summary row on last page
    if (startIdx + maxPerPage >= stocks.length) {
      y += 10;
      doc.setFont(font, "normal");
      doc.setFontSize(FONT_SIZE.SMALL);
      setText(doc, COLOR.TEXT_MUTED);

      const summaryLabel = hasChinese ? "\u5E73\u5747" : "Average";
      doc.text(
        `${summaryLabel}: ${hasChinese ? "\u6536\u76CA" : "Return"} ${data.averageReturn}  |  ` +
          `${hasChinese ? "\u80DC\u7387" : "Win%"} ${data.averageWinRate}  |  ` +
          `${hasChinese ? "\u590F\u666E" : "Sharpe"} ${data.averageSharpe}`,
        CONTENT.START_X,
        y
      );
    }

    pageIndex++;
  }
}
