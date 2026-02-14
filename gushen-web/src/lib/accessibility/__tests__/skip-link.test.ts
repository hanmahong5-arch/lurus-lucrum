/**
 * Skip Link Utility Tests
 *
 * Verifies skip-to-main-content functionality,
 * including focus management and scroll behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  skipToMainContent,
  MAIN_CONTENT_ID,
  SKIP_LINK_TEXT_ZH,
  SKIP_LINK_TEXT_EN,
  SKIP_LINK_CLASSES,
} from '../skip-link';

describe('SkipLink', () => {
  let mainContent: HTMLElement;

  beforeEach(() => {
    mainContent = document.createElement('main');
    mainContent.id = MAIN_CONTENT_ID;
    mainContent.textContent = 'Main content area';
    document.body.appendChild(mainContent);
  });

  afterEach(() => {
    mainContent.remove();
  });

  describe('constants', () => {
    it('exports a stable main content ID', () => {
      expect(MAIN_CONTENT_ID).toBe('main-content');
    });

    it('exports Chinese skip link text', () => {
      expect(SKIP_LINK_TEXT_ZH).toBeTruthy();
      expect(typeof SKIP_LINK_TEXT_ZH).toBe('string');
    });

    it('exports English skip link text', () => {
      expect(SKIP_LINK_TEXT_EN).toBe('Skip to main content');
    });

    it('exports CSS class string for skip link styling', () => {
      expect(SKIP_LINK_CLASSES).toContain('sr-only');
      expect(SKIP_LINK_CLASSES).toContain('focus:not-sr-only');
      expect(SKIP_LINK_CLASSES).toContain('focus:fixed');
      expect(SKIP_LINK_CLASSES).toContain('focus:z-[9999]');
    });
  });

  describe('skipToMainContent', () => {
    it('focuses the main content element', () => {
      const focusSpy = vi.spyOn(mainContent, 'focus');
      const result = skipToMainContent();

      expect(result).toBe(true);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: false });
    });

    it('adds tabindex="-1" if not already focusable', () => {
      skipToMainContent();
      expect(mainContent.getAttribute('tabindex')).toBe('-1');
    });

    it('does not override existing tabindex', () => {
      mainContent.setAttribute('tabindex', '0');
      skipToMainContent();
      expect(mainContent.getAttribute('tabindex')).toBe('0');
    });

    it('scrolls the element into view', () => {
      const scrollSpy = vi.spyOn(mainContent, 'scrollIntoView');
      skipToMainContent();
      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('returns false when target element does not exist', () => {
      mainContent.remove();
      const result = skipToMainContent();
      expect(result).toBe(false);
      // Re-add for afterEach cleanup
      document.body.appendChild(mainContent);
    });

    it('accepts a custom target ID', () => {
      const customTarget = document.createElement('div');
      customTarget.id = 'custom-target';
      document.body.appendChild(customTarget);

      const focusSpy = vi.spyOn(customTarget, 'focus');
      const result = skipToMainContent('custom-target');

      expect(result).toBe(true);
      expect(focusSpy).toHaveBeenCalled();

      customTarget.remove();
    });

    it('returns false for non-existent custom target', () => {
      const result = skipToMainContent('nonexistent-target');
      expect(result).toBe(false);
    });
  });
});
