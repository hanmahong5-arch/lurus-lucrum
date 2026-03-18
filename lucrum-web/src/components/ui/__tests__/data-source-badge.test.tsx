/**
 * DataSourceBadge Component Tests
 *
 * Tests:
 * - Renders all 3 variants (DB, API, Simulated) with correct labels and colors
 * - Tooltip displays detail text or default text
 * - Accepts custom className
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataSourceBadge } from '../data-source-badge';

describe('DataSourceBadge', () => {
  describe('variant rendering', () => {
    it('renders DB variant with "数据库" label', () => {
      render(<DataSourceBadge type="db" />);
      expect(screen.getByText('数据库')).toBeInTheDocument();
    });

    it('renders API variant with "API" label', () => {
      render(<DataSourceBadge type="api" />);
      expect(screen.getByText('API')).toBeInTheDocument();
    });

    it('renders Simulated variant with "模拟" label', () => {
      render(<DataSourceBadge type="simulated" />);
      expect(screen.getByText('模拟')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies DB source color classes', () => {
      const { container } = render(<DataSourceBadge type="db" />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('source-db');
    });

    it('applies API source color classes', () => {
      const { container } = render(<DataSourceBadge type="api" />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('source-api');
    });

    it('applies Simulated source color classes', () => {
      const { container } = render(<DataSourceBadge type="simulated" />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('source-sim');
    });

    it('applies custom className', () => {
      const { container } = render(
        <DataSourceBadge type="db" className="ml-4" />,
      );
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('ml-4');
    });
  });

  describe('dot indicator', () => {
    it('renders a colored dot for each variant', () => {
      const { container } = render(<DataSourceBadge type="db" />);
      const dot = container.querySelector('.rounded-full.w-1\\.5');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('tooltip', () => {
    it('shows default tooltip text for DB variant on hover', async () => {
      const user = userEvent.setup();
      render(<DataSourceBadge type="db" />);
      await user.hover(screen.getByText('数据库'));
      const tooltip = await waitFor(() => screen.getByRole('tooltip'));
      expect(tooltip).toHaveTextContent('真实历史数据，来自本地数据库');
    });

    it('shows default tooltip text for API variant on hover', async () => {
      const user = userEvent.setup();
      render(<DataSourceBadge type="api" />);
      await user.hover(screen.getByText('API'));
      const tooltip = await waitFor(() => screen.getByRole('tooltip'));
      expect(tooltip).toHaveTextContent('实时拉取，可能有延迟');
    });

    it('shows default tooltip text for Simulated variant on hover', async () => {
      const user = userEvent.setup();
      render(<DataSourceBadge type="simulated" />);
      await user.hover(screen.getByText('模拟'));
      const tooltip = await waitFor(() => screen.getByRole('tooltip'));
      expect(tooltip).toHaveTextContent('模拟生成数据，仅供参考');
    });

    it('shows custom detail text instead of default on hover', async () => {
      const user = userEvent.setup();
      render(<DataSourceBadge type="api" detail="Custom detail text" />);
      await user.hover(screen.getByText('API'));
      const tooltip = await waitFor(() => screen.getByRole('tooltip'));
      expect(tooltip).toHaveTextContent('Custom detail text');
    });
  });
});
