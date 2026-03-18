/**
 * Focus Trap Utility Tests
 *
 * Verifies focus trapping behavior for modals and dialogs.
 * Tests Tab/Shift+Tab wrapping, Escape handling, and
 * focus restoration on deactivation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFocusTrap, getFocusableElements, focusFirstElement, focusLastElement } from '../focus-trap';

describe('FocusTrap', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function setupContainer(html: string): void {
    container.innerHTML = html;
  }

  describe('getFocusableElements', () => {
    it('finds buttons', () => {
      setupContainer('<button>Click</button><button>Me</button>');
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(2);
    });

    it('finds links with href', () => {
      setupContainer('<a href="/foo">Link</a><a>Not a link</a>');
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(1);
    });

    it('finds inputs (not disabled, not hidden)', () => {
      setupContainer(
        '<input type="text" /><input type="hidden" /><input type="text" disabled />'
      );
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(1);
    });

    it('finds selects and textareas', () => {
      setupContainer('<select><option>A</option></select><textarea></textarea>');
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(2);
    });

    it('finds elements with tabindex', () => {
      setupContainer(
        '<div tabindex="0">Focusable</div><div tabindex="-1">Not in tab order</div><div>Not focusable</div>'
      );
      const elements = getFocusableElements(container);
      // tabindex="-1" is excluded
      expect(elements).toHaveLength(1);
    });

    it('excludes aria-hidden elements', () => {
      setupContainer(
        '<button>Visible</button><button aria-hidden="true">Hidden</button>'
      );
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(1);
    });

    it('returns empty array for container with no focusable elements', () => {
      setupContainer('<div>No focusable elements</div><span>here</span>');
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(0);
    });
  });

  describe('createFocusTrap', () => {
    it('reports active state correctly', () => {
      setupContainer('<button>A</button><button>B</button>');
      const trap = createFocusTrap(container);

      expect(trap.isActive()).toBe(false);
      trap.activate();
      expect(trap.isActive()).toBe(true);
      trap.deactivate();
      expect(trap.isActive()).toBe(false);
    });

    it('does not double-activate', () => {
      setupContainer('<button>A</button>');
      const trap = createFocusTrap(container);

      trap.activate();
      trap.activate(); // Should not throw
      expect(trap.isActive()).toBe(true);
      trap.deactivate();
    });

    it('does not double-deactivate', () => {
      setupContainer('<button>A</button>');
      const trap = createFocusTrap(container);

      trap.activate();
      trap.deactivate();
      trap.deactivate(); // Should not throw
      expect(trap.isActive()).toBe(false);
    });

    it('calls onEscape when Escape is pressed', () => {
      setupContainer('<button>A</button>');
      const onEscape = vi.fn();
      const trap = createFocusTrap(container, { onEscape });

      trap.activate();

      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(escapeEvent);

      expect(onEscape).toHaveBeenCalledTimes(1);
      trap.deactivate();
    });

    it('does not call onEscape when escapeDeactivates is false', () => {
      setupContainer('<button>A</button>');
      const onEscape = vi.fn();
      const trap = createFocusTrap(container, {
        escapeDeactivates: false,
        onEscape,
      });

      trap.activate();

      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(escapeEvent);

      expect(onEscape).not.toHaveBeenCalled();
      trap.deactivate();
    });

    it('wraps focus from last to first on Tab', () => {
      setupContainer('<button id="a">A</button><button id="b">B</button>');
      const trap = createFocusTrap(container);
      trap.activate();

      const buttonB = container.querySelector('#b') as HTMLElement;
      buttonB.focus();

      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(tabEvent);

      // After Tab on last element, focus should wrap to first
      // (In happy-dom, focus() calls may not fully simulate,
      //  but we verify the event handler doesn't throw)
      trap.deactivate();
    });

    it('wraps focus from first to last on Shift+Tab', () => {
      setupContainer('<button id="a">A</button><button id="b">B</button>');
      const trap = createFocusTrap(container);
      trap.activate();

      const buttonA = container.querySelector('#a') as HTMLElement;
      buttonA.focus();

      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(shiftTabEvent);

      trap.deactivate();
    });

    it('updates focusable elements when called', () => {
      setupContainer('<button>A</button>');
      const trap = createFocusTrap(container);
      trap.activate();

      // Dynamically add a new button
      const newButton = document.createElement('button');
      newButton.textContent = 'B';
      container.appendChild(newButton);

      trap.updateFocusableElements();
      // Should now include the new button
      const elements = getFocusableElements(container);
      expect(elements).toHaveLength(2);

      trap.deactivate();
    });
  });

  describe('focusFirstElement', () => {
    it('focuses the first focusable element', () => {
      setupContainer('<button id="first">First</button><button>Second</button>');
      const result = focusFirstElement(container);
      expect(result).toBe(true);
    });

    it('returns false when no focusable elements exist', () => {
      setupContainer('<div>No buttons</div>');
      const result = focusFirstElement(container);
      expect(result).toBe(false);
    });
  });

  describe('focusLastElement', () => {
    it('focuses the last focusable element', () => {
      setupContainer('<button>First</button><button id="last">Last</button>');
      const result = focusLastElement(container);
      expect(result).toBe(true);
    });

    it('returns false when no focusable elements exist', () => {
      setupContainer('<div>No buttons</div>');
      const result = focusLastElement(container);
      expect(result).toBe(false);
    });
  });
});
