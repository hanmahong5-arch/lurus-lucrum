/**
 * Keyboard Navigation Utility Tests
 *
 * Verifies roving tabindex pattern, activation key handlers,
 * and keyboard navigation helpers for accessible widgets.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KEYS,
  createRovingTabindex,
  isNativelyInteractive,
  onActivationKey,
} from '../keyboard-navigation';

describe('KeyboardNavigation', () => {
  describe('KEYS constants', () => {
    it('defines standard keyboard keys', () => {
      expect(KEYS.ENTER).toBe('Enter');
      expect(KEYS.SPACE).toBe(' ');
      expect(KEYS.ESCAPE).toBe('Escape');
      expect(KEYS.TAB).toBe('Tab');
      expect(KEYS.ARROW_UP).toBe('ArrowUp');
      expect(KEYS.ARROW_DOWN).toBe('ArrowDown');
      expect(KEYS.ARROW_LEFT).toBe('ArrowLeft');
      expect(KEYS.ARROW_RIGHT).toBe('ArrowRight');
      expect(KEYS.HOME).toBe('Home');
      expect(KEYS.END).toBe('End');
    });
  });

  describe('createRovingTabindex', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.innerHTML = `
        <button class="item">Item 1</button>
        <button class="item">Item 2</button>
        <button class="item">Item 3</button>
      `;
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('initializes tabindex on first item', () => {
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
      });
      controller.init();

      const items = container.querySelectorAll('.item');
      expect(items[0]!.getAttribute('tabindex')).toBe('0');
      expect(items[1]!.getAttribute('tabindex')).toBe('-1');
      expect(items[2]!.getAttribute('tabindex')).toBe('-1');

      controller.destroy();
    });

    it('reports current index', () => {
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
      });
      controller.init();

      expect(controller.getCurrentIndex()).toBe(0);
      controller.destroy();
    });

    it('programmatically focuses item at index', () => {
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
      });
      controller.init();

      controller.focusItem(2);
      expect(controller.getCurrentIndex()).toBe(2);

      const items = container.querySelectorAll('.item');
      expect(items[2]!.getAttribute('tabindex')).toBe('0');
      expect(items[0]!.getAttribute('tabindex')).toBe('-1');

      controller.destroy();
    });

    it('clamps out-of-range indices', () => {
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
      });
      controller.init();

      controller.focusItem(100);
      expect(controller.getCurrentIndex()).toBe(2); // Clamped to last

      controller.focusItem(-5);
      expect(controller.getCurrentIndex()).toBe(0); // Clamped to first

      controller.destroy();
    });

    it('calls onActivate on Enter key', () => {
      const onActivate = vi.fn();
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
        onActivate,
      });
      controller.init();

      const firstItem = container.querySelector('.item') as HTMLElement;
      firstItem.focus();

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(enterEvent);

      expect(onActivate).toHaveBeenCalledTimes(1);
      expect(onActivate).toHaveBeenCalledWith(firstItem, 0);

      controller.destroy();
    });

    it('calls onActivate on Space key', () => {
      const onActivate = vi.fn();
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
        onActivate,
      });
      controller.init();

      const firstItem = container.querySelector('.item') as HTMLElement;
      firstItem.focus();

      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(spaceEvent);

      expect(onActivate).toHaveBeenCalledTimes(1);
      controller.destroy();
    });

    it('moves focus on ArrowDown in vertical mode', () => {
      const onFocusChange = vi.fn();
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
        orientation: 'vertical',
        onFocusChange,
      });
      controller.init();

      const firstItem = container.querySelector('.item') as HTMLElement;
      firstItem.focus();

      const downEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(downEvent);

      expect(controller.getCurrentIndex()).toBe(1);
      expect(onFocusChange).toHaveBeenCalled();

      controller.destroy();
    });

    it('moves focus on ArrowRight in horizontal mode', () => {
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
        orientation: 'horizontal',
      });
      controller.init();

      const firstItem = container.querySelector('.item') as HTMLElement;
      firstItem.focus();

      const rightEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(rightEvent);

      expect(controller.getCurrentIndex()).toBe(1);
      controller.destroy();
    });

    it('wraps focus from last to first when wrap is true', () => {
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
        orientation: 'vertical',
        wrap: true,
      });
      controller.init();

      controller.focusItem(2); // Move to last

      const items = container.querySelectorAll('.item');
      (items[2] as HTMLElement).focus();

      const downEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(downEvent);

      expect(controller.getCurrentIndex()).toBe(0); // Wrapped to first
      controller.destroy();
    });

    it('jumps to first on Home key', () => {
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
      });
      controller.init();

      controller.focusItem(2);

      const items = container.querySelectorAll('.item');
      (items[2] as HTMLElement).focus();

      const homeEvent = new KeyboardEvent('keydown', {
        key: 'Home',
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(homeEvent);

      expect(controller.getCurrentIndex()).toBe(0);
      controller.destroy();
    });

    it('jumps to last on End key', () => {
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
      });
      controller.init();

      const firstItem = container.querySelector('.item') as HTMLElement;
      firstItem.focus();

      const endEvent = new KeyboardEvent('keydown', {
        key: 'End',
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(endEvent);

      expect(controller.getCurrentIndex()).toBe(2);
      controller.destroy();
    });

    it('handles empty container gracefully', () => {
      const emptyContainer = document.createElement('div');
      document.body.appendChild(emptyContainer);

      const controller = createRovingTabindex({
        container: emptyContainer,
        itemSelector: '.item',
      });
      controller.init(); // Should not throw

      controller.focusItem(0); // Should not throw
      expect(controller.getCurrentIndex()).toBe(0);

      controller.destroy();
      document.body.removeChild(emptyContainer);
    });

    it('cleans up event listeners on destroy', () => {
      const removeListenerSpy = vi.spyOn(container, 'removeEventListener');
      const controller = createRovingTabindex({
        container,
        itemSelector: '.item',
      });
      controller.init();
      controller.destroy();

      expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('isNativelyInteractive', () => {
    it('returns true for text input', () => {
      const input = document.createElement('input');
      input.type = 'text';
      expect(isNativelyInteractive(input)).toBe(true);
    });

    it('returns true for textarea', () => {
      const textarea = document.createElement('textarea');
      expect(isNativelyInteractive(textarea)).toBe(true);
    });

    it('returns true for select', () => {
      const select = document.createElement('select');
      expect(isNativelyInteractive(select)).toBe(true);
    });

    it('returns false for button input', () => {
      const input = document.createElement('input');
      input.type = 'button';
      expect(isNativelyInteractive(input)).toBe(false);
    });

    it('returns false for submit input', () => {
      const input = document.createElement('input');
      input.type = 'submit';
      expect(isNativelyInteractive(input)).toBe(false);
    });

    it('returns false for regular div', () => {
      const div = document.createElement('div');
      expect(isNativelyInteractive(div)).toBe(false);
    });

    it('returns false for button element', () => {
      const button = document.createElement('button');
      expect(isNativelyInteractive(button)).toBe(false);
    });
  });

  describe('onActivationKey', () => {
    it('calls handler on Enter key', () => {
      const handler = vi.fn();
      const keyHandler = onActivationKey(handler);

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      keyHandler(enterEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(enterEvent);
    });

    it('calls handler on Space key', () => {
      const handler = vi.fn();
      const keyHandler = onActivationKey(handler);

      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      keyHandler(spaceEvent);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not call handler on other keys', () => {
      const handler = vi.fn();
      const keyHandler = onActivationKey(handler);

      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      keyHandler(tabEvent);

      expect(handler).not.toHaveBeenCalled();
    });

    it('prevents default on activation keys', () => {
      const handler = vi.fn();
      const keyHandler = onActivationKey(handler);

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(enterEvent, 'preventDefault');
      keyHandler(enterEvent);

      expect(preventSpy).toHaveBeenCalled();
    });
  });
});
