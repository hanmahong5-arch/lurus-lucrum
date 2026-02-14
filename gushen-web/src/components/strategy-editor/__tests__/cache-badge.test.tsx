/**
 * CacheBadge Component Tests
 *
 * Test categories:
 * 1. Visibility control (cached vs not cached)
 * 2. Badge text and relative time display
 * 3. Refresh button interaction
 * 4. Edge cases (null/invalid timestamps)
 * 5. Loading state during refresh
 * 6. Accessibility (ARIA attributes)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CacheBadge } from '../cache-badge';

// =============================================================================
// Test Suite
// =============================================================================

describe('CacheBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Visibility Control
  // ===========================================================================
  describe('Visibility Control', () => {
    it('renders nothing when cached is false', () => {
      const { container } = render(
        <CacheBadge cached={false} cachedAt={null} onRefresh={vi.fn()} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders badge when cached is true', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} />
      );

      expect(screen.getByText('来自缓存')).toBeInTheDocument();
    });

    it('renders nothing when cached is undefined', () => {
      const { container } = render(
        <CacheBadge cached={undefined as unknown as boolean} cachedAt={null} onRefresh={vi.fn()} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  // ===========================================================================
  // 2. Badge Text and Relative Time
  // ===========================================================================
  describe('Badge Text and Relative Time', () => {
    it('displays "来自缓存" label', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} />
      );

      expect(screen.getByText('来自缓存')).toBeInTheDocument();
    });

    it('shows relative time for recent cache (seconds ago)', () => {
      const fiveSecondsAgo = new Date(Date.now() - 5 * 1000);
      render(
        <CacheBadge cached={true} cachedAt={fiveSecondsAgo} onRefresh={vi.fn()} />
      );

      // Should show "刚刚" or seconds-based relative time
      expect(screen.getByTestId('cache-badge-time')).toBeInTheDocument();
    });

    it('shows relative time for hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      render(
        <CacheBadge cached={true} cachedAt={twoHoursAgo} onRefresh={vi.fn()} />
      );

      const timeEl = screen.getByTestId('cache-badge-time');
      expect(timeEl.textContent).toContain('2');
    });

    it('shows relative time for days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      render(
        <CacheBadge cached={true} cachedAt={threeDaysAgo} onRefresh={vi.fn()} />
      );

      const timeEl = screen.getByTestId('cache-badge-time');
      expect(timeEl.textContent).toContain('3');
    });
  });

  // ===========================================================================
  // 3. Refresh Button Interaction
  // ===========================================================================
  describe('Refresh Button', () => {
    it('renders a refresh button', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} />
      );

      expect(screen.getByRole('button', { name: /刷新/i })).toBeInTheDocument();
    });

    it('calls onRefresh when refresh button is clicked', () => {
      const onRefresh = vi.fn();
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={onRefresh} />
      );

      fireEvent.click(screen.getByRole('button', { name: /刷新/i }));

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('disables refresh button when refreshing is true', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} refreshing={true} />
      );

      const button = screen.getByRole('button', { name: /刷新/i });
      expect(button).toBeDisabled();
    });
  });

  // ===========================================================================
  // 4. Edge Cases
  // ===========================================================================
  describe('Edge Cases', () => {
    it('handles null cachedAt gracefully', () => {
      render(
        <CacheBadge cached={true} cachedAt={null} onRefresh={vi.fn()} />
      );

      expect(screen.getByText('来自缓存')).toBeInTheDocument();
      expect(screen.getByText('缓存时间未知')).toBeInTheDocument();
    });

    it('handles undefined cachedAt gracefully', () => {
      render(
        <CacheBadge cached={true} cachedAt={undefined as unknown as Date} onRefresh={vi.fn()} />
      );

      expect(screen.getByText('来自缓存')).toBeInTheDocument();
      expect(screen.getByText('缓存时间未知')).toBeInTheDocument();
    });

    it('handles invalid Date cachedAt gracefully', () => {
      render(
        <CacheBadge cached={true} cachedAt={new Date('invalid')} onRefresh={vi.fn()} />
      );

      expect(screen.getByText('来自缓存')).toBeInTheDocument();
      expect(screen.getByText('缓存时间未知')).toBeInTheDocument();
    });

    it('handles string cachedAt (ISO format)', () => {
      const isoString = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      render(
        <CacheBadge cached={true} cachedAt={isoString as unknown as Date} onRefresh={vi.fn()} />
      );

      expect(screen.getByText('来自缓存')).toBeInTheDocument();
      // Should parse and show relative time
      expect(screen.getByTestId('cache-badge-time')).toBeInTheDocument();
    });

    it('handles numeric timestamp cachedAt', () => {
      const timestamp = Date.now() - 30 * 60 * 1000;
      render(
        <CacheBadge cached={true} cachedAt={timestamp as unknown as Date} onRefresh={vi.fn()} />
      );

      expect(screen.getByText('来自缓存')).toBeInTheDocument();
      expect(screen.getByTestId('cache-badge-time')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 5. Loading State
  // ===========================================================================
  describe('Loading State', () => {
    it('shows loading indicator when refreshing', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} refreshing={true} />
      );

      expect(screen.getByTestId('cache-badge-spinner')).toBeInTheDocument();
    });

    it('does not show loading indicator when not refreshing', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} refreshing={false} />
      );

      expect(screen.queryByTestId('cache-badge-spinner')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 6. Accessibility
  // ===========================================================================
  describe('Accessibility', () => {
    it('has role="status" on the badge container', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has aria-label on the badge', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} />
      );

      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label');
    });

    it('refresh button has accessible name', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} />
      );

      const button = screen.getByRole('button', { name: /刷新/i });
      expect(button).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 7. Custom className
  // ===========================================================================
  describe('Custom className', () => {
    it('applies custom className', () => {
      const now = new Date();
      render(
        <CacheBadge cached={true} cachedAt={now} onRefresh={vi.fn()} className="custom-class" />
      );

      expect(screen.getByRole('status')).toHaveClass('custom-class');
    });
  });
});
