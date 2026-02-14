/**
 * Live Region Announcer Tests
 *
 * Verifies that ARIA live regions are created, announce messages,
 * and clean up properly. Ensures screen reader announcements
 * work correctly for dynamic content updates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLiveAnnouncer, type LiveAnnouncer } from '../live-region';

describe('LiveRegion', () => {
  let announcer: LiveAnnouncer;

  beforeEach(() => {
    // Clean up any existing live regions
    document.getElementById('a11y-live-region-polite')?.remove();
    document.getElementById('a11y-live-region-assertive')?.remove();
    announcer = createLiveAnnouncer();
  });

  afterEach(() => {
    announcer.destroy();
  });

  describe('createLiveAnnouncer', () => {
    it('creates polite and assertive live region elements', () => {
      const polite = document.getElementById('a11y-live-region-polite');
      const assertive = document.getElementById('a11y-live-region-assertive');

      expect(polite).not.toBeNull();
      expect(assertive).not.toBeNull();
    });

    it('sets correct ARIA attributes on polite region', () => {
      const polite = document.getElementById('a11y-live-region-polite');
      expect(polite?.getAttribute('role')).toBe('status');
      expect(polite?.getAttribute('aria-live')).toBe('polite');
      expect(polite?.getAttribute('aria-atomic')).toBe('true');
    });

    it('sets correct ARIA attributes on assertive region', () => {
      const assertive = document.getElementById('a11y-live-region-assertive');
      expect(assertive?.getAttribute('role')).toBe('status');
      expect(assertive?.getAttribute('aria-live')).toBe('assertive');
      expect(assertive?.getAttribute('aria-atomic')).toBe('true');
    });

    it('makes live regions visually hidden', () => {
      const polite = document.getElementById('a11y-live-region-polite');
      expect(polite?.style.position).toBe('absolute');
      expect(polite?.style.width).toBe('1px');
      expect(polite?.style.height).toBe('1px');
      expect(polite?.style.overflow).toBe('hidden');
    });

    it('reuses existing elements on re-creation', () => {
      // Create a second announcer while first is alive
      const announcer2 = createLiveAnnouncer();
      const allPolite = document.querySelectorAll('#a11y-live-region-polite');
      expect(allPolite).toHaveLength(1); // Should reuse, not duplicate
      announcer2.destroy();
    });
  });

  describe('announce', () => {
    it('announces a polite message after delay', async () => {
      announcer.announce('Test message');

      // Wait for the clear delay + message setting
      await vi.waitFor(() => {
        const polite = document.getElementById('a11y-live-region-polite');
        expect(polite?.textContent).toBe('Test message');
      }, { timeout: 500 });
    });

    it('announces an assertive message', async () => {
      announcer.announce('Urgent message', 'assertive');

      await vi.waitFor(() => {
        const assertive = document.getElementById('a11y-live-region-assertive');
        expect(assertive?.textContent).toBe('Urgent message');
      }, { timeout: 500 });
    });

    it('does not announce empty strings', () => {
      announcer.announce('');
      announcer.announce('   ');

      const polite = document.getElementById('a11y-live-region-polite');
      expect(polite?.textContent).toBe('');
    });

    it('defaults to polite politeness', async () => {
      announcer.announce('Default politeness');

      await vi.waitFor(() => {
        const polite = document.getElementById('a11y-live-region-polite');
        expect(polite?.textContent).toBe('Default politeness');
      }, { timeout: 500 });

      const assertive = document.getElementById('a11y-live-region-assertive');
      expect(assertive?.textContent).toBe('');
    });
  });

  describe('clear', () => {
    it('clears all live region content', async () => {
      // First announce a message and wait for it to appear
      announcer.announce('Polite msg');

      await vi.waitFor(() => {
        const polite = document.getElementById('a11y-live-region-polite');
        expect(polite?.textContent).toBe('Polite msg');
      }, { timeout: 500 });

      // Now clear
      announcer.clear();

      const polite = document.getElementById('a11y-live-region-polite');
      const assertive = document.getElementById('a11y-live-region-assertive');
      expect(polite?.textContent).toBe('');
      expect(assertive?.textContent).toBe('');
    });
  });

  describe('destroy', () => {
    it('removes live region elements from DOM', () => {
      announcer.destroy();

      expect(document.getElementById('a11y-live-region-polite')).toBeNull();
      expect(document.getElementById('a11y-live-region-assertive')).toBeNull();
    });

    it('can be called multiple times without error', () => {
      announcer.destroy();
      announcer.destroy(); // Should not throw
    });
  });
});
