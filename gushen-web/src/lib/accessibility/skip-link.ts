/**
 * Skip Navigation Link Utilities
 *
 * Provides helpers for implementing "skip to main content" links,
 * a WCAG 2.1 AA requirement (Success Criterion 2.4.1: Bypass Blocks).
 *
 * Skip links allow keyboard users to bypass repeated navigation blocks
 * and jump directly to the main content area.
 */

/** Default ID for the main content landmark */
export const MAIN_CONTENT_ID = 'main-content';

/** Default skip link text in Chinese (primary) and English (fallback) */
export const SKIP_LINK_TEXT_ZH = '\u8df3\u81f3\u4e3b\u5185\u5bb9';
export const SKIP_LINK_TEXT_EN = 'Skip to main content';

/**
 * Scroll to and focus the main content area.
 *
 * @param targetId - The ID of the target element (default: 'main-content')
 * @returns true if the target was found and focused, false otherwise
 */
export function skipToMainContent(targetId: string = MAIN_CONTENT_ID): boolean {
  const target = document.getElementById(targetId);
  if (!target) return false;

  // Make the element focusable if it isn't already
  if (!target.getAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }

  target.focus({ preventScroll: false });
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return true;
}

/**
 * Generate CSS class string for a visually-hidden-until-focused skip link.
 * When the link receives focus (via Tab), it becomes visible.
 */
export const SKIP_LINK_CLASSES = [
  'sr-only',
  'focus:not-sr-only',
  'focus:fixed',
  'focus:top-4',
  'focus:left-4',
  'focus:z-[9999]',
  'focus:px-4',
  'focus:py-2',
  'focus:bg-primary',
  'focus:text-white',
  'focus:rounded-md',
  'focus:outline-none',
  'focus:ring-2',
  'focus:ring-white',
  'focus:ring-offset-2',
  'focus:ring-offset-background',
  'focus:shadow-lg',
  'focus:text-sm',
  'focus:font-medium',
].join(' ');
