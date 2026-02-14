/**
 * Keyboard Navigation Utilities
 *
 * Provides helpers for implementing keyboard-accessible interactive
 * components per WCAG 2.1 AA (Success Criterion 2.1.1: Keyboard).
 *
 * Covers common patterns:
 * - Arrow key navigation within groups (roving tabindex)
 * - Enter/Space activation
 * - Escape to dismiss
 * - Home/End to jump to first/last
 */

/**
 * Standard keyboard keys used in accessible widgets.
 * Using constants prevents typos and improves readability.
 */
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

export type KeyName = (typeof KEYS)[keyof typeof KEYS];

/**
 * Options for roving tabindex keyboard navigation.
 */
export interface RovingTabindexOptions {
  /** The container element holding navigable items */
  container: HTMLElement;
  /** CSS selector for navigable items within the container */
  itemSelector: string;
  /** Navigation orientation: 'horizontal' uses Left/Right, 'vertical' uses Up/Down, 'both' uses all */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Whether navigation wraps around from last to first and vice versa */
  wrap?: boolean;
  /** Callback when an item is activated (Enter/Space) */
  onActivate?: (element: HTMLElement, index: number) => void;
  /** Callback when focus moves to a new item */
  onFocusChange?: (element: HTMLElement, index: number) => void;
}

/**
 * Interface for a roving tabindex controller.
 */
export interface RovingTabindexController {
  /** Set up the roving tabindex. Call this after DOM is ready. */
  init(): void;
  /** Clean up event listeners. */
  destroy(): void;
  /** Programmatically focus item at the given index. */
  focusItem(index: number): void;
  /** Get the currently focused item index, or -1 if none. */
  getCurrentIndex(): number;
}

/**
 * Create a roving tabindex controller for a group of items.
 *
 * Implements the WAI-ARIA roving tabindex pattern:
 * - Only one item in the group has tabindex="0" (others have tabindex="-1")
 * - Arrow keys move focus between items
 * - Home/End jump to first/last
 * - Enter/Space activate the focused item
 *
 * @param options - Configuration for the roving tabindex
 * @returns Controller with init/destroy methods
 */
export function createRovingTabindex(
  options: RovingTabindexOptions
): RovingTabindexController {
  const {
    container,
    itemSelector,
    orientation = 'vertical',
    wrap = true,
    onActivate,
    onFocusChange,
  } = options;

  let currentIndex = 0;

  function getItems(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
  }

  function updateTabindex(items: HTMLElement[], focusIndex: number): void {
    items.forEach((item, i) => {
      item.setAttribute('tabindex', i === focusIndex ? '0' : '-1');
    });
  }

  function focusItem(index: number): void {
    const items = getItems();
    if (items.length === 0) return;

    // Clamp index
    const safeIndex = Math.max(0, Math.min(index, items.length - 1));
    currentIndex = safeIndex;

    updateTabindex(items, currentIndex);
    items[currentIndex].focus();
    onFocusChange?.(items[currentIndex], currentIndex);
  }

  function moveFocus(direction: -1 | 1): void {
    const items = getItems();
    if (items.length === 0) return;

    let nextIndex = currentIndex + direction;

    if (wrap) {
      nextIndex = (nextIndex + items.length) % items.length;
    } else {
      nextIndex = Math.max(0, Math.min(nextIndex, items.length - 1));
    }

    focusItem(nextIndex);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (!container.contains(target)) return;

    const items = getItems();
    if (items.length === 0) return;

    // Find current target index
    const targetIndex = items.indexOf(target);
    if (targetIndex >= 0) {
      currentIndex = targetIndex;
    }

    const prevKeys =
      orientation === 'horizontal'
        ? [KEYS.ARROW_LEFT]
        : orientation === 'vertical'
        ? [KEYS.ARROW_UP]
        : [KEYS.ARROW_UP, KEYS.ARROW_LEFT];

    const nextKeys =
      orientation === 'horizontal'
        ? [KEYS.ARROW_RIGHT]
        : orientation === 'vertical'
        ? [KEYS.ARROW_DOWN]
        : [KEYS.ARROW_DOWN, KEYS.ARROW_RIGHT];

    if (prevKeys.includes(event.key as KeyName)) {
      event.preventDefault();
      moveFocus(-1);
    } else if (nextKeys.includes(event.key as KeyName)) {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === KEYS.HOME) {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === KEYS.END) {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === KEYS.ENTER || event.key === KEYS.SPACE) {
      event.preventDefault();
      onActivate?.(items[currentIndex], currentIndex);
    }
  }

  function init(): void {
    const items = getItems();
    if (items.length > 0) {
      updateTabindex(items, currentIndex);
    }
    container.addEventListener('keydown', handleKeyDown);
  }

  function destroy(): void {
    container.removeEventListener('keydown', handleKeyDown);
  }

  return {
    init,
    destroy,
    focusItem,
    getCurrentIndex: () => currentIndex,
  };
}

/**
 * Check if an element is a keyboard-interactive element that should
 * not have its default behavior overridden.
 *
 * @param element - The DOM element to check
 * @returns true if the element is natively interactive
 */
export function isNativelyInteractive(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  const type = element.getAttribute('type')?.toLowerCase();

  if (tag === 'input' && type !== 'button' && type !== 'submit' && type !== 'reset') {
    return true;
  }
  if (tag === 'textarea' || tag === 'select') {
    return true;
  }
  if (element.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Create a keyboard event handler that activates on Enter or Space.
 * Useful for making non-button elements keyboard-accessible.
 *
 * @param handler - The activation handler
 * @returns Keyboard event handler
 */
export function onActivationKey(
  handler: (event: KeyboardEvent) => void
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (event.key === KEYS.ENTER || event.key === KEYS.SPACE) {
      event.preventDefault();
      handler(event);
    }
  };
}
