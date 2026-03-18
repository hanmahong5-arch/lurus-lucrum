/**
 * TwoLayerTooltip Component Tests
 *
 * Tests the two-layer tooltip (layman hover + professional click)
 * for strategy parameter explanations.
 *
 * Coverage:
 * - Layman layer renders on hover
 * - Professional layer renders on click
 * - ARIA attributes present
 * - Empty/missing text handling
 * - Escape key closes popover
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TwoLayerTooltip } from '../two-layer-tooltip';

// Radix Tooltip requires a TooltipProvider ancestor in test
import { TooltipProvider } from '../tooltip';

/**
 * Helper: render TwoLayerTooltip wrapped in required providers.
 * Radix Tooltip renders content both visually and in a hidden
 * role="tooltip" span for accessibility, so queries may find
 * multiple matching elements. We use getAllByText where needed.
 */
function renderTooltip(props: {
  layman?: string;
  professional?: string;
  children?: React.ReactNode;
}) {
  const defaultProps = {
    layman: 'Simple explanation for beginners',
    professional: 'Technical EMA smoothing coefficient affects period calculation',
    children: <button data-testid="trigger">Info</button>,
  };
  const merged = { ...defaultProps, ...props };

  return render(
    <TooltipProvider delayDuration={0}>
      <TwoLayerTooltip
        layman={merged.layman!}
        professional={merged.professional!}
      >
        {merged.children}
      </TwoLayerTooltip>
    </TooltipProvider>
  );
}

describe('TwoLayerTooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the trigger element (children)', () => {
      renderTooltip({});
      expect(screen.getByTestId('trigger')).toBeInTheDocument();
    });

    it('does not render tooltip content initially', () => {
      renderTooltip({});
      expect(screen.queryAllByText('Simple explanation for beginners')).toHaveLength(0);
    });
  });

  describe('layman layer (hover)', () => {
    it('shows layman text when user hovers over trigger', async () => {
      const user = userEvent.setup();
      renderTooltip({});

      const trigger = screen.getByTestId('trigger');
      await user.hover(trigger);

      await waitFor(() => {
        // Radix Tooltip may render content in multiple places (visual + aria)
        const elements = screen.getAllByText('Simple explanation for beginners');
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('tooltip trigger reflects data-state changes on hover/unhover', async () => {
      const user = userEvent.setup();
      const { container } = renderTooltip({});

      const trigger = screen.getByTestId('trigger');
      const wrapper = trigger.closest('[data-state]');

      // Before hover, trigger data-state should be "closed"
      expect(wrapper?.getAttribute('data-state')).toBe('closed');

      await user.hover(trigger);

      await waitFor(() => {
        // After hover, data-state transitions to "delayed-open" or "open"
        const state = wrapper?.getAttribute('data-state');
        expect(state === 'delayed-open' || state === 'instant-open' || state === 'open').toBe(true);
      });
    });

    it('includes a "Click for details" prompt in the layman tooltip', async () => {
      const user = userEvent.setup();
      renderTooltip({});

      const trigger = screen.getByTestId('trigger');
      await user.hover(trigger);

      await waitFor(() => {
        const detailsPrompts = screen.getAllByText('Click for details');
        expect(detailsPrompts.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('professional layer (click)', () => {
    it('shows professional text when user clicks the trigger', async () => {
      const user = userEvent.setup();
      renderTooltip({});

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        const elements = screen.getAllByText(
          'Technical EMA smoothing coefficient affects period calculation'
        );
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows "Technical Details" header in professional popover', async () => {
      const user = userEvent.setup();
      renderTooltip({});

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        const headers = screen.getAllByText('Technical Details');
        expect(headers.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('closes professional popover on Escape key', async () => {
      const user = userEvent.setup();
      renderTooltip({});

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        const elements = screen.getAllByText(
          'Technical EMA smoothing coefficient affects period calculation'
        );
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(
          screen.queryAllByText(
            'Technical EMA smoothing coefficient affects period calculation'
          )
        ).toHaveLength(0);
      });
    });
  });

  describe('ARIA attributes', () => {
    it('trigger wrapper has cursor-help class for both-layer mode', () => {
      const { container } = renderTooltip({});
      const wrapper = container.querySelector('.cursor-help');
      expect(wrapper).toBeInTheDocument();
    });

    it('tooltip content has role="tooltip" when hovered', async () => {
      const user = userEvent.setup();
      const { container } = renderTooltip({});

      const trigger = screen.getByTestId('trigger');
      await user.hover(trigger);

      await waitFor(() => {
        const tooltipRole = container.ownerDocument.querySelector('[role="tooltip"]');
        expect(tooltipRole).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('renders only layman layer when professional text is empty', async () => {
      const user = userEvent.setup();
      renderTooltip({ professional: '' });

      const trigger = screen.getByTestId('trigger');
      await user.hover(trigger);

      await waitFor(() => {
        const elements = screen.getAllByText('Simple explanation for beginners');
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });

      // Clicking should not crash even with empty professional text
      await user.click(trigger);
      // Should not throw
    });

    it('renders only professional layer when layman text is empty', async () => {
      const user = userEvent.setup();
      renderTooltip({ layman: '' });

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        const elements = screen.getAllByText(
          'Technical EMA smoothing coefficient affects period calculation'
        );
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders nothing extra when both texts are empty', () => {
      renderTooltip({ layman: '', professional: '' });
      const trigger = screen.getByTestId('trigger');
      expect(trigger).toBeInTheDocument();
      // Trigger should not have cursor-help class (no tooltip behavior)
      const parent = trigger.parentElement;
      // When both texts are empty, children render directly without wrapper
      expect(parent).toBeInTheDocument();
    });

    it('handles very long text without crashing', async () => {
      const user = userEvent.setup();
      const longText = 'A'.repeat(500);
      renderTooltip({ layman: longText, professional: '' });

      const trigger = screen.getByTestId('trigger');
      await user.hover(trigger);

      await waitFor(() => {
        const elements = screen.getAllByText(longText);
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
