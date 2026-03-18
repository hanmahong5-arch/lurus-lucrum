/**
 * SimulatedDataBanner Component Tests
 *
 * Tests:
 * - Shows when visible=true, hides when visible=false
 * - Dismiss button hides banner and saves to sessionStorage
 * - "切换真实数据" link calls onSwitchToReal callback
 * - Banner stays hidden after dismissal (sessionStorage)
 * - Role="alert" for accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimulatedDataBanner } from '../simulated-data-banner';

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockSessionStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionStorage[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(mockSessionStorage)) {
      delete mockSessionStorage[key];
    }
  }),
  get length() {
    return Object.keys(mockSessionStorage).length;
  },
  key: vi.fn((_index: number) => null),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

describe('SimulatedDataBanner', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders nothing when visible=false', () => {
      const { container } = render(<SimulatedDataBanner visible={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders banner when visible=true', () => {
      render(<SimulatedDataBanner visible={true} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/当前使用模拟数据/)).toBeInTheDocument();
    });
  });

  describe('dismiss', () => {
    it('hides banner when close button is clicked', () => {
      render(<SimulatedDataBanner visible={true} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('关闭提示'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('saves dismiss state to sessionStorage', () => {
      render(<SimulatedDataBanner visible={true} />);
      fireEvent.click(screen.getByLabelText('关闭提示'));

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'lucrum:sim-banner-dismissed',
        '1',
      );
    });

    it('stays hidden if already dismissed in session', () => {
      mockSessionStorage['lucrum:sim-banner-dismissed'] = '1';

      const { container } = render(<SimulatedDataBanner visible={true} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('switch to real data', () => {
    it('renders "切换真实数据" link when onSwitchToReal is provided', () => {
      const onSwitch = vi.fn();
      render(
        <SimulatedDataBanner visible={true} onSwitchToReal={onSwitch} />,
      );
      expect(screen.getByText('切换真实数据')).toBeInTheDocument();
    });

    it('calls onSwitchToReal when link is clicked', () => {
      const onSwitch = vi.fn();
      render(
        <SimulatedDataBanner visible={true} onSwitchToReal={onSwitch} />,
      );
      fireEvent.click(screen.getByText('切换真实数据'));
      expect(onSwitch).toHaveBeenCalledOnce();
    });

    it('does not render "切换真实数据" link when onSwitchToReal is not provided', () => {
      render(<SimulatedDataBanner visible={true} />);
      expect(screen.queryByText('切换真实数据')).not.toBeInTheDocument();
    });
  });

  describe('disableSticky', () => {
    it('applies sticky positioning by default', () => {
      render(<SimulatedDataBanner visible={true} />);
      const banner = screen.getByRole('alert');
      expect(banner.className).toContain('sticky');
    });

    it('removes sticky positioning when disableSticky=true', () => {
      render(<SimulatedDataBanner visible={true} disableSticky={true} />);
      const banner = screen.getByRole('alert');
      expect(banner.className).not.toContain('sticky');
    });
  });

  describe('accessibility', () => {
    it('has role="alert"', () => {
      render(<SimulatedDataBanner visible={true} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live="polite"', () => {
      render(<SimulatedDataBanner visible={true} />);
      const banner = screen.getByRole('alert');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });

    it('close button has aria-label', () => {
      render(<SimulatedDataBanner visible={true} />);
      expect(screen.getByLabelText('关闭提示')).toBeInTheDocument();
    });
  });
});
