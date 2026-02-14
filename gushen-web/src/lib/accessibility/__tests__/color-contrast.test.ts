/**
 * Color Contrast Utility Tests
 *
 * Verifies WCAG 2.1 contrast ratio calculations against known values.
 * Uses reference values from W3C examples and the WebAIM contrast checker.
 */

import { describe, it, expect } from 'vitest';
import {
  getRelativeLuminance,
  getContrastRatio,
  checkContrast,
  hexToRgb,
  checkHexContrast,
  suggestMinOpacityForAA,
  type RGBColor,
} from '../color-contrast';

describe('ColorContrast', () => {
  describe('getRelativeLuminance', () => {
    it('returns 0 for pure black', () => {
      expect(getRelativeLuminance([0, 0, 0])).toBeCloseTo(0, 4);
    });

    it('returns 1 for pure white', () => {
      expect(getRelativeLuminance([255, 255, 255])).toBeCloseTo(1, 4);
    });

    it('returns correct luminance for pure red', () => {
      // Red coefficient is 0.2126
      const lum = getRelativeLuminance([255, 0, 0]);
      expect(lum).toBeGreaterThan(0.2);
      expect(lum).toBeLessThan(0.22);
    });

    it('returns correct luminance for pure green', () => {
      // Green coefficient is 0.7152 (dominant)
      const lum = getRelativeLuminance([0, 255, 0]);
      expect(lum).toBeGreaterThan(0.71);
      expect(lum).toBeLessThan(0.72);
    });

    it('returns correct luminance for pure blue', () => {
      // Blue coefficient is 0.0722
      const lum = getRelativeLuminance([0, 0, 255]);
      expect(lum).toBeGreaterThan(0.07);
      expect(lum).toBeLessThan(0.08);
    });

    it('returns higher luminance for lighter colors', () => {
      const dark = getRelativeLuminance([50, 50, 50]);
      const light = getRelativeLuminance([200, 200, 200]);
      expect(light).toBeGreaterThan(dark);
    });
  });

  describe('getContrastRatio', () => {
    it('returns 21 for black on white', () => {
      const ratio = getContrastRatio([0, 0, 0], [255, 255, 255]);
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('returns 1 for same color', () => {
      const ratio = getContrastRatio([128, 128, 128], [128, 128, 128]);
      expect(ratio).toBeCloseTo(1, 4);
    });

    it('is symmetric (order does not matter)', () => {
      const ratio1 = getContrastRatio([255, 0, 0], [0, 0, 255]);
      const ratio2 = getContrastRatio([0, 0, 255], [255, 0, 0]);
      expect(ratio1).toBeCloseTo(ratio2, 4);
    });

    it('returns ratio >= 1 always', () => {
      const ratio = getContrastRatio([100, 100, 100], [200, 200, 200]);
      expect(ratio).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkContrast', () => {
    it('passes AA normal for black on white (21:1)', () => {
      const result = checkContrast([0, 0, 0], [255, 255, 255]);
      expect(result.passesAANormal).toBe(true);
      expect(result.passesAALarge).toBe(true);
      expect(result.passesAAANormal).toBe(true);
      expect(result.passesAAALarge).toBe(true);
    });

    it('fails all for very low contrast', () => {
      // Two very similar grays
      const result = checkContrast([120, 120, 120], [130, 130, 130]);
      expect(result.passesAANormal).toBe(false);
      expect(result.passesAALarge).toBe(false);
      expect(result.passesAAANormal).toBe(false);
      expect(result.ratio).toBeLessThan(3);
    });

    it('correctly identifies AA-large-only pass (~3.5:1)', () => {
      // #767676 on white is approximately 4.54:1 (passes AA normal)
      // #888888 on white gives about 3.54:1 (passes AA large, fails AA normal)
      const result = checkContrast([136, 136, 136], [255, 255, 255]);
      expect(result.passesAALarge).toBe(true);
      expect(result.passesAANormal).toBe(false);
      expect(result.ratio).toBeGreaterThanOrEqual(3);
      expect(result.ratio).toBeLessThan(4.5);
    });

    it('verifies design system bg-void (#09090b) with text-foreground (#fafafa)', () => {
      // Our primary text on primary background
      const result = checkContrast([250, 250, 250], [9, 9, 11]);
      expect(result.passesAANormal).toBe(true);
      expect(result.ratio).toBeGreaterThan(4.5);
    });

    it('verifies design system foreground-muted (#a1a1aa) on bg-void (#09090b)', () => {
      const result = checkContrast([161, 161, 170], [9, 9, 11]);
      expect(result.passesAALarge).toBe(true);
    });
  });

  describe('hexToRgb', () => {
    it('parses 6-digit hex with #', () => {
      expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]);
    });

    it('parses 6-digit hex without #', () => {
      expect(hexToRgb('00ff00')).toEqual([0, 255, 0]);
    });

    it('parses 3-digit hex with #', () => {
      expect(hexToRgb('#f00')).toEqual([255, 0, 0]);
    });

    it('parses 3-digit hex without #', () => {
      expect(hexToRgb('0f0')).toEqual([0, 255, 0]);
    });

    it('returns null for invalid hex', () => {
      expect(hexToRgb('xyz')).toBeNull();
      expect(hexToRgb('#gg0000')).toBeNull();
      expect(hexToRgb('')).toBeNull();
      expect(hexToRgb('#12345')).toBeNull();
    });

    it('handles uppercase hex', () => {
      expect(hexToRgb('#FF00FF')).toEqual([255, 0, 255]);
    });

    it('parses design system bg-void correctly', () => {
      expect(hexToRgb('#09090b')).toEqual([9, 9, 11]);
    });
  });

  describe('checkHexContrast', () => {
    it('calculates contrast for hex color pairs', () => {
      const result = checkHexContrast('#000000', '#ffffff');
      expect(result).not.toBeNull();
      expect(result!.ratio).toBeCloseTo(21, 0);
      expect(result!.passesAANormal).toBe(true);
    });

    it('returns null for invalid foreground', () => {
      expect(checkHexContrast('invalid', '#ffffff')).toBeNull();
    });

    it('returns null for invalid background', () => {
      expect(checkHexContrast('#000000', 'invalid')).toBeNull();
    });

    it('verifies primary color on bg-void', () => {
      // Primary blue (#3b82f6) on dark background (#09090b)
      const result = checkHexContrast('#3b82f6', '#09090b');
      expect(result).not.toBeNull();
      expect(result!.passesAALarge).toBe(true);
    });
  });

  describe('suggestMinOpacityForAA', () => {
    it('returns an opacity value for valid combinations', () => {
      // White on black should pass at any visible opacity
      const opacity = suggestMinOpacityForAA([255, 255, 255], [0, 0, 0]);
      expect(opacity).not.toBeNull();
      expect(opacity!).toBeGreaterThan(0);
      expect(opacity!).toBeLessThanOrEqual(1);
    });

    it('returns null when full opacity cannot pass AA', () => {
      // Very similar colors will never pass
      const opacity = suggestMinOpacityForAA([130, 130, 130], [120, 120, 120]);
      expect(opacity).toBeNull();
    });

    it('returns a lower opacity for high-contrast pairs', () => {
      const whiteOnBlack = suggestMinOpacityForAA([255, 255, 255], [0, 0, 0]);
      const grayOnBlack = suggestMinOpacityForAA([200, 200, 200], [0, 0, 0]);
      // White needs less opacity than gray to achieve same contrast
      expect(whiteOnBlack).not.toBeNull();
      expect(grayOnBlack).not.toBeNull();
      expect(whiteOnBlack!).toBeLessThanOrEqual(grayOnBlack!);
    });
  });
});
