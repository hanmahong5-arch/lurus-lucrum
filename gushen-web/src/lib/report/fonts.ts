/**
 * PDF Report Font Loading
 * Async font loader with caching for Chinese (NotoSansSC) support.
 *
 * @module lib/report/fonts
 */

import type { jsPDF } from "jspdf";

// =============================================================================
// FONT CONFIGURATION
// =============================================================================

const FONT_URL = "/fonts/NotoSansSC-Regular.ttf";
const FONT_NAME = "NotoSansSC";
const FONT_STYLE = "normal";

/** Module-level cache for loaded font base64 data */
let cachedFontBase64: string | null = null;

/** Whether font load has been attempted */
let fontLoadAttempted = false;

/** Whether font loaded successfully */
let fontLoadSuccess = false;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Load and register NotoSansSC font into a jsPDF instance.
 * The font file is fetched once and cached in memory for subsequent calls.
 *
 * @param doc - jsPDF document instance
 * @returns true if font loaded successfully, false if fallback needed
 */
export async function loadChineseFont(doc: jsPDF): Promise<boolean> {
  // If previously failed, don't retry
  if (fontLoadAttempted && !fontLoadSuccess) {
    return false;
  }

  try {
    // Use cached font if available
    if (!cachedFontBase64) {
      fontLoadAttempted = true;
      const response = await fetch(FONT_URL);

      if (!response.ok) {
        throw new Error(
          `Font fetch failed: ${response.status} ${response.statusText}. ` +
          `Expected font at ${FONT_URL}. Place NotoSansSC-Regular.ttf in public/fonts/.`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert to base64
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]!);
      }
      cachedFontBase64 = btoa(binary);
      fontLoadSuccess = true;
    }

    // Register font with jsPDF
    doc.addFileToVFS(`${FONT_NAME}.ttf`, cachedFontBase64);
    doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, FONT_STYLE);

    return true;
  } catch (error) {
    fontLoadSuccess = false;
    console.error("[PDF Report] Chinese font load failed:", error);
    return false;
  }
}

/**
 * Get the appropriate font name based on whether Chinese font is available.
 *
 * @param hasChinese - Whether Chinese font was loaded successfully
 * @returns Font name to use
 */
export function getFontName(hasChinese: boolean): string {
  return hasChinese ? FONT_NAME : "helvetica";
}

/**
 * Reset font cache (useful for testing).
 */
export function resetFontCache(): void {
  cachedFontBase64 = null;
  fontLoadAttempted = false;
  fontLoadSuccess = false;
}
