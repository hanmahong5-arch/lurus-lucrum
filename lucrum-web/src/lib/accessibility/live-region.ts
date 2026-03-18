/**
 * ARIA Live Region Announcer
 *
 * Provides a mechanism to announce dynamic content changes to screen readers
 * using ARIA live regions. Essential for SPAs where content updates without
 * page navigation.
 *
 * Two politeness levels:
 * - "polite": Announces at the next opportunity (after current speech)
 * - "assertive": Interrupts current speech immediately (use sparingly)
 *
 * Usage:
 *   const announcer = createLiveAnnouncer();
 *   announcer.announce("Backtest completed. Score: A.");
 *   // ... later ...
 *   announcer.destroy();
 */

/** Politeness level for ARIA live regions */
export type AriaLivePoliteness = 'polite' | 'assertive';

/**
 * Interface for the live region announcer.
 */
export interface LiveAnnouncer {
  /** Announce a message to screen readers. */
  announce(message: string, politeness?: AriaLivePoliteness): void;
  /** Clear the current announcement. */
  clear(): void;
  /** Remove the announcer from the DOM. */
  destroy(): void;
}

/** ID prefix for live region elements */
const LIVE_REGION_ID_PREFIX = 'a11y-live-region';

/** Delay before clearing announcement to ensure screen reader picks it up */
const CLEAR_DELAY_MS = 150;

/**
 * Create a live region element with the specified politeness.
 */
function createLiveRegionElement(
  politeness: AriaLivePoliteness,
  id: string
): HTMLDivElement {
  const el = document.createElement('div');
  el.id = id;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', politeness);
  el.setAttribute('aria-atomic', 'true');
  // Visually hidden but accessible to screen readers
  Object.assign(el.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  return el;
}

/**
 * Create a live region announcer that manages ARIA live region elements.
 *
 * @returns LiveAnnouncer instance
 */
export function createLiveAnnouncer(): LiveAnnouncer {
  const politeId = `${LIVE_REGION_ID_PREFIX}-polite`;
  const assertiveId = `${LIVE_REGION_ID_PREFIX}-assertive`;

  // Reuse existing elements if they exist (e.g., after HMR)
  let politeRegion = document.getElementById(politeId) as HTMLDivElement | null;
  let assertiveRegion = document.getElementById(assertiveId) as HTMLDivElement | null;

  if (!politeRegion) {
    politeRegion = createLiveRegionElement('polite', politeId);
    document.body.appendChild(politeRegion);
  }

  if (!assertiveRegion) {
    assertiveRegion = createLiveRegionElement('assertive', assertiveId);
    document.body.appendChild(assertiveRegion);
  }

  let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function announce(message: string, politeness: AriaLivePoliteness = 'polite'): void {
    if (!message.trim()) return;

    const region = politeness === 'assertive' ? assertiveRegion : politeRegion;
    if (!region) return;

    // Clear timeout if pending
    if (clearTimeoutId !== null) {
      clearTimeout(clearTimeoutId);
      clearTimeoutId = null;
    }

    // Clear first, then set new message after a brief delay
    // This ensures screen readers detect the change even if the same message is repeated
    region.textContent = '';

    clearTimeoutId = setTimeout(() => {
      region.textContent = message;
    }, CLEAR_DELAY_MS);
  }

  function clear(): void {
    if (clearTimeoutId !== null) {
      clearTimeout(clearTimeoutId);
      clearTimeoutId = null;
    }
    if (politeRegion) politeRegion.textContent = '';
    if (assertiveRegion) assertiveRegion.textContent = '';
  }

  function destroy(): void {
    clear();
    politeRegion?.remove();
    assertiveRegion?.remove();
    politeRegion = null;
    assertiveRegion = null;
  }

  return { announce, clear, destroy };
}

/**
 * Singleton announcer instance for app-wide use.
 * Lazily initialized on first call.
 */
let globalAnnouncer: LiveAnnouncer | null = null;

/**
 * Get the global live announcer singleton.
 * Creates it if it does not exist yet.
 *
 * @returns The global LiveAnnouncer
 */
export function getGlobalAnnouncer(): LiveAnnouncer {
  if (!globalAnnouncer) {
    globalAnnouncer = createLiveAnnouncer();
  }
  return globalAnnouncer;
}

/**
 * Announce a message using the global announcer.
 * Convenience function for quick one-off announcements.
 *
 * @param message - The message to announce
 * @param politeness - ARIA live politeness level (default: 'polite')
 */
export function announce(
  message: string,
  politeness: AriaLivePoliteness = 'polite'
): void {
  getGlobalAnnouncer().announce(message, politeness);
}
