/**
 * Skip Link Component
 *
 * Renders a visually hidden link that becomes visible on focus.
 * Allows keyboard users to skip repeated navigation and jump
 * directly to the main content area.
 *
 * WCAG 2.1 AA: Success Criterion 2.4.1 (Bypass Blocks)
 */

'use client';

import {
  MAIN_CONTENT_ID,
  SKIP_LINK_TEXT_ZH,
  SKIP_LINK_CLASSES,
  skipToMainContent,
} from '@/lib/accessibility/skip-link';

interface SkipLinkProps {
  /** Target element ID to skip to. Default: 'main-content' */
  targetId?: string;
  /** Link text. Default: Chinese "Skip to main content" */
  label?: string;
}

/**
 * Skip to Main Content Link
 *
 * This component is placed at the very beginning of the page
 * (before any navigation). It is visually hidden until the user
 * presses Tab, at which point it appears and can be activated
 * to jump focus to the main content area.
 */
export function SkipLink({
  targetId = MAIN_CONTENT_ID,
  label = SKIP_LINK_TEXT_ZH,
}: SkipLinkProps) {
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    skipToMainContent(targetId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      skipToMainContent(targetId);
    }
  }

  return (
    <a
      href={`#${targetId}`}
      className={SKIP_LINK_CLASSES}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid="skip-link"
    >
      {label}
    </a>
  );
}
