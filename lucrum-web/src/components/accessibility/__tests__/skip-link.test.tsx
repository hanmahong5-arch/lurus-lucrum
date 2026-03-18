/**
 * SkipLink Component Tests
 *
 * Verifies the skip-to-main-content link renders correctly,
 * has proper accessibility attributes, and navigates to the
 * main content area on activation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkipLink } from '../skip-link';
import { MAIN_CONTENT_ID, SKIP_LINK_TEXT_ZH } from '@/lib/accessibility/skip-link';

describe('SkipLink', () => {
  let mainContent: HTMLElement;

  beforeEach(() => {
    mainContent = document.createElement('main');
    mainContent.id = MAIN_CONTENT_ID;
    mainContent.textContent = 'Main content';
    document.body.appendChild(mainContent);
  });

  afterEach(() => {
    mainContent.remove();
  });

  it('renders a link element', () => {
    render(<SkipLink />);
    const link = screen.getByTestId('skip-link');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
  });

  it('has correct href pointing to main content', () => {
    render(<SkipLink />);
    const link = screen.getByTestId('skip-link');
    expect(link.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`);
  });

  it('displays default Chinese text', () => {
    render(<SkipLink />);
    const link = screen.getByTestId('skip-link');
    expect(link.textContent).toBe(SKIP_LINK_TEXT_ZH);
  });

  it('accepts custom label', () => {
    render(<SkipLink label="Skip to content" />);
    const link = screen.getByTestId('skip-link');
    expect(link.textContent).toBe('Skip to content');
  });

  it('accepts custom target ID', () => {
    render(<SkipLink targetId="custom-content" />);
    const link = screen.getByTestId('skip-link');
    expect(link.getAttribute('href')).toBe('#custom-content');
  });

  it('has sr-only class for visual hiding', () => {
    render(<SkipLink />);
    const link = screen.getByTestId('skip-link');
    expect(link.className).toContain('sr-only');
  });

  it('has focus:not-sr-only class for visibility on focus', () => {
    render(<SkipLink />);
    const link = screen.getByTestId('skip-link');
    expect(link.className).toContain('focus:not-sr-only');
  });

  it('focuses main content on click', async () => {
    render(<SkipLink />);
    const link = screen.getByTestId('skip-link');
    const focusSpy = vi.spyOn(mainContent, 'focus');

    const user = userEvent.setup();
    await user.click(link);

    expect(focusSpy).toHaveBeenCalled();
  });
});
