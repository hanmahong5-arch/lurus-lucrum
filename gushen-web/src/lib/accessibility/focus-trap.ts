/**
 * Focus Trap Management
 *
 * Provides utilities for trapping keyboard focus within a container element
 * (e.g., modals, dialogs, dropdown menus). Essential for WCAG 2.1 AA
 * keyboard navigation compliance.
 *
 * Usage:
 *   const trap = createFocusTrap(containerElement);
 *   trap.activate();
 *   // ... user interacts within container ...
 *   trap.deactivate();
 */

/** Selector for all focusable elements per WAI-ARIA practices */
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'details > summary',
  'audio[controls]',
  'video[controls]',
].join(', ');

/**
 * Interface for a focus trap instance.
 */
export interface FocusTrap {
  /** Activate the focus trap. Moves focus into container and traps Tab key. */
  activate(): void;
  /** Deactivate the trap. Restores focus to previously focused element. */
  deactivate(): void;
  /** Whether the trap is currently active. */
  isActive(): boolean;
  /** Update the list of focusable elements (call after DOM changes). */
  updateFocusableElements(): void;
}

/**
 * Options for creating a focus trap.
 */
export interface FocusTrapOptions {
  /** Element to focus when trap activates. Defaults to first focusable element. */
  initialFocus?: HTMLElement | null;
  /** Element to focus when trap deactivates. Defaults to previously focused element. */
  returnFocusTo?: HTMLElement | null;
  /** Whether pressing Escape deactivates the trap. Default: true */
  escapeDeactivates?: boolean;
  /** Callback invoked when Escape is pressed (if escapeDeactivates is true). */
  onEscape?: () => void;
}

/**
 * Get all focusable elements within a container.
 *
 * @param container - The container element to search within
 * @returns Array of focusable HTMLElements in DOM order
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
  return Array.from(elements).filter((el) => {
    // Filter out elements that are not visible
    if (el.offsetParent === null && el.tagName !== 'BODY') return false;
    // Filter out elements with aria-hidden
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

/**
 * Create a focus trap for the given container element.
 *
 * @param container - The DOM element to trap focus within
 * @param options - Configuration options
 * @returns FocusTrap instance with activate/deactivate methods
 */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {}
): FocusTrap {
  const {
    initialFocus = null,
    returnFocusTo = null,
    escapeDeactivates = true,
    onEscape,
  } = options;

  let active = false;
  let previouslyFocused: HTMLElement | null = null;
  let focusableElements: HTMLElement[] = [];

  function updateFocusableElements(): void {
    focusableElements = getFocusableElements(container);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!active) return;

    if (event.key === 'Escape' && escapeDeactivates) {
      event.preventDefault();
      event.stopPropagation();
      onEscape?.();
      return;
    }

    if (event.key !== 'Tab') return;

    updateFocusableElements();

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    if (event.shiftKey) {
      // Shift+Tab: wrap from first to last
      if (activeElement === firstFocusable || !container.contains(activeElement)) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab: wrap from last to first
      if (activeElement === lastFocusable || !container.contains(activeElement)) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  function activate(): void {
    if (active) return;
    active = true;
    previouslyFocused = document.activeElement as HTMLElement;

    updateFocusableElements();

    // Add keydown listener on container
    document.addEventListener('keydown', handleKeyDown, true);

    // Focus initial element
    requestAnimationFrame(() => {
      if (initialFocus) {
        initialFocus.focus();
      } else if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        // If no focusable elements, make container focusable
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    });
  }

  function deactivate(): void {
    if (!active) return;
    active = false;

    document.removeEventListener('keydown', handleKeyDown, true);

    // Restore focus
    const restoreTo = returnFocusTo ?? previouslyFocused;
    if (restoreTo && typeof restoreTo.focus === 'function') {
      restoreTo.focus();
    }
  }

  return {
    activate,
    deactivate,
    isActive: () => active,
    updateFocusableElements,
  };
}

/**
 * Move focus to the first focusable element within a container.
 *
 * @param container - Container to search for focusable elements
 * @returns true if focus was moved, false if no focusable element found
 */
export function focusFirstElement(container: HTMLElement): boolean {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[0].focus();
    return true;
  }
  return false;
}

/**
 * Move focus to the last focusable element within a container.
 *
 * @param container - Container to search for focusable elements
 * @returns true if focus was moved, false if no focusable element found
 */
export function focusLastElement(container: HTMLElement): boolean {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[elements.length - 1].focus();
    return true;
  }
  return false;
}
