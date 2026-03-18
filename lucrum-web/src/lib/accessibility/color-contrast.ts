/**
 * WCAG 2.1 Color Contrast Utilities
 *
 * Provides functions to calculate relative luminance and contrast ratios
 * per WCAG 2.1 guidelines. Used for verifying AA/AAA compliance of
 * color combinations in the design system.
 *
 * References:
 * - https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * - https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

// WCAG 2.1 AA minimum contrast ratios
const WCAG_AA_NORMAL_TEXT = 4.5;
const WCAG_AA_LARGE_TEXT = 3;
const WCAG_AAA_NORMAL_TEXT = 7;
const WCAG_AAA_LARGE_TEXT = 4.5;

/**
 * RGB color tuple [red, green, blue], each in range 0-255.
 */
export type RGBColor = [number, number, number];

/**
 * Result of a WCAG contrast check.
 */
export interface ContrastResult {
  /** The calculated contrast ratio (e.g. 4.5) */
  ratio: number;
  /** Whether the contrast meets WCAG AA for normal text (>= 4.5:1) */
  passesAANormal: boolean;
  /** Whether the contrast meets WCAG AA for large text (>= 3:1) */
  passesAALarge: boolean;
  /** Whether the contrast meets WCAG AAA for normal text (>= 7:1) */
  passesAAANormal: boolean;
  /** Whether the contrast meets WCAG AAA for large text (>= 4.5:1) */
  passesAAALarge: boolean;
}

/**
 * Convert a single sRGB channel value (0-255) to linear light.
 * Per WCAG 2.1 relative luminance formula.
 */
function sRGBToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance of an RGB color.
 *
 * @param rgb - Color as [R, G, B] with each value 0-255
 * @returns Relative luminance value between 0 (black) and 1 (white)
 */
export function getRelativeLuminance(rgb: RGBColor): number {
  const [r, g, b] = rgb;
  const rLinear = sRGBToLinear(r);
  const gLinear = sRGBToLinear(g);
  const bLinear = sRGBToLinear(b);
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate the contrast ratio between two colors.
 *
 * @param foreground - Foreground color as [R, G, B]
 * @param background - Background color as [R, G, B]
 * @returns Contrast ratio (always >= 1), e.g. 4.5 for 4.5:1
 */
export function getContrastRatio(foreground: RGBColor, background: RGBColor): number {
  const lum1 = getRelativeLuminance(foreground);
  const lum2 = getRelativeLuminance(background);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check a foreground/background pair against all WCAG contrast thresholds.
 *
 * @param foreground - Foreground color as [R, G, B]
 * @param background - Background color as [R, G, B]
 * @returns ContrastResult with ratio and pass/fail for each level
 */
export function checkContrast(foreground: RGBColor, background: RGBColor): ContrastResult {
  const ratio = getContrastRatio(foreground, background);
  return {
    ratio,
    passesAANormal: ratio >= WCAG_AA_NORMAL_TEXT,
    passesAALarge: ratio >= WCAG_AA_LARGE_TEXT,
    passesAAANormal: ratio >= WCAG_AAA_NORMAL_TEXT,
    passesAAALarge: ratio >= WCAG_AAA_LARGE_TEXT,
  };
}

/**
 * Parse a hex color string to RGB tuple.
 * Supports #RGB, #RRGGBB formats (with or without leading #).
 *
 * @param hex - Hex color string, e.g. "#ff0000" or "f00"
 * @returns RGB tuple [R, G, B] or null if invalid
 */
export function hexToRgb(hex: string): RGBColor | null {
  const cleaned = hex.replace(/^#/, '');
  if (cleaned.length === 3) {
    const c0 = cleaned.charAt(0);
    const c1 = cleaned.charAt(1);
    const c2 = cleaned.charAt(2);
    const r = parseInt(c0 + c0, 16);
    const g = parseInt(c1 + c1, 16);
    const b = parseInt(c2 + c2, 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

/**
 * Check contrast ratio between two hex color strings.
 * Convenience wrapper around checkContrast.
 *
 * @param fgHex - Foreground hex color
 * @param bgHex - Background hex color
 * @returns ContrastResult or null if either color is invalid
 */
export function checkHexContrast(fgHex: string, bgHex: string): ContrastResult | null {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  return checkContrast(fg, bg);
}

/**
 * Suggest the minimum foreground opacity (over the given background)
 * needed to pass WCAG AA normal text contrast.
 *
 * @param foreground - Foreground color as [R, G, B]
 * @param background - Background color as [R, G, B]
 * @returns Minimum opacity (0-1) to pass AA, or null if it cannot pass even at full opacity
 */
export function suggestMinOpacityForAA(
  foreground: RGBColor,
  background: RGBColor
): number | null {
  // Check if full-opacity foreground passes
  const fullCheck = checkContrast(foreground, background);
  if (!fullCheck.passesAANormal) return null;

  // Binary search for minimum opacity
  let low = 0;
  let high = 1;
  const PRECISION = 0.01;

  while (high - low > PRECISION) {
    const mid = (low + high) / 2;
    const blended: RGBColor = [
      Math.round(foreground[0] * mid + background[0] * (1 - mid)),
      Math.round(foreground[1] * mid + background[1] * (1 - mid)),
      Math.round(foreground[2] * mid + background[2] * (1 - mid)),
    ];
    const ratio = getContrastRatio(blended, background);
    if (ratio >= WCAG_AA_NORMAL_TEXT) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Math.ceil(high * 100) / 100;
}
