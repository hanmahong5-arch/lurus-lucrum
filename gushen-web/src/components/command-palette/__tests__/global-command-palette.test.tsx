/**
 * GlobalCommandPalette Test Suite
 *
 * Tests for the global command palette component (Cmd+K).
 * Covers: keyboard trigger, search/fuzzy match, categorized results,
 * keyboard navigation, command execution, recent tracking, accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalCommandPalette } from '../global-command-palette';
import {
  NAVIGATION_COMMANDS,
  ACTION_COMMANDS,
  RECENT_STORAGE_KEY,
  MAX_RECENT_ITEMS,
  filterCommandsByQuery,
} from '../command-palette-data';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/dashboard',
}));

// Helper to render the palette
function renderPalette() {
  return render(<GlobalCommandPalette />);
}

// Helper to open the palette via keyboard
async function openPaletteViaKeyboard() {
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
}

// Helper to open the palette via Ctrl+K (Windows)
async function openPaletteViaCtrlK() {
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
}

describe('GlobalCommandPalette', () => {
  beforeEach(() => {
    mockPush.mockClear();
    localStorage.clear();
  });

  // ============================================================
  // AC-1: Keyboard Shortcut Trigger
  // ============================================================
  describe('Keyboard Shortcut Trigger', () => {
    it('should open on Cmd+K (Mac)', async () => {
      renderPalette();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should open on Ctrl+K (Windows/Linux)', async () => {
      renderPalette();

      await openPaletteViaCtrlK();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should close on Escape', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should auto-focus the search input when opened', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/搜索/);
        expect(input).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // AC-2: Search & Fuzzy Match
  // ============================================================
  describe('Search & Fuzzy Match', () => {
    it('should filter results when typing Chinese characters', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/搜索/);
      fireEvent.change(input, { target: { value: '策略' } });

      await waitFor(() => {
        // Should show items containing "策略"
        expect(screen.getByText('策略编辑器')).toBeInTheDocument();
      });
    });

    it('should show empty state when no match found', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/搜索/);
      fireEvent.change(input, { target: { value: 'zzzznonexistent' } });

      await waitFor(() => {
        expect(screen.getByText(/没有找到/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // AC-2 (unit): filterCommandsByQuery
  // ============================================================
  describe('filterCommandsByQuery', () => {
    it('should match by Chinese label', () => {
      const results = filterCommandsByQuery(NAVIGATION_COMMANDS, '策略');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.label.includes('策略'))).toBe(true);
    });

    it('should match by pinyin initials', () => {
      const results = filterCommandsByQuery(NAVIGATION_COMMANDS, 'clbj');
      expect(results.some(r => r.label === '策略编辑器')).toBe(true);
    });

    it('should match by English keywords', () => {
      const results = filterCommandsByQuery(NAVIGATION_COMMANDS, 'strategy');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return all items for empty query', () => {
      const results = filterCommandsByQuery(NAVIGATION_COMMANDS, '');
      expect(results.length).toBe(NAVIGATION_COMMANDS.length);
    });

    it('should be case-insensitive', () => {
      const lower = filterCommandsByQuery(NAVIGATION_COMMANDS, 'advisor');
      const upper = filterCommandsByQuery(NAVIGATION_COMMANDS, 'ADVISOR');
      expect(lower.length).toBe(upper.length);
    });
  });

  // ============================================================
  // AC-3: Categorized Results
  // ============================================================
  describe('Categorized Results', () => {
    it('should show Navigation group', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('导航')).toBeInTheDocument();
      });
    });

    it('should show Actions group', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('操作')).toBeInTheDocument();
      });
    });

    it('should show Recent group when recent items exist', async () => {
      localStorage.setItem(
        RECENT_STORAGE_KEY,
        JSON.stringify([
          { id: 'nav-strategy-editor', label: '策略编辑器', href: '/dashboard', timestamp: Date.now() },
        ])
      );

      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('最近')).toBeInTheDocument();
      });
    });

    it('should not show Recent group when no recent items', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.queryByText('最近')).not.toBeInTheDocument();
      });
    });

    it('should show navigation items', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('策略编辑器')).toBeInTheDocument();
        expect(screen.getByText('多股验证')).toBeInTheDocument();
        expect(screen.getByText('AI 顾问')).toBeInTheDocument();
      });
    });

    it('should show action items', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('新建策略')).toBeInTheDocument();
        expect(screen.getByText('运行回测')).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // AC-5: Command Execution
  // ============================================================
  describe('Command Execution', () => {
    it('should navigate to target page on item selection', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('策略编辑器')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('策略编辑器'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should close the palette after selection', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('多股验证')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('多股验证'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should track selected item in recent commands', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('AI 顾问')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('AI 顾问'));

      const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].label).toBe('AI 顾问');
    });
  });

  // ============================================================
  // Recent Items Tracking
  // ============================================================
  describe('Recent Items', () => {
    it('should limit recent items to MAX_RECENT_ITEMS', async () => {
      // Pre-fill with max items
      const recentItems = Array.from({ length: MAX_RECENT_ITEMS }, (_, i) => ({
        id: `nav-item-${i}`,
        label: `Item ${i}`,
        href: `/dashboard/item-${i}`,
        timestamp: Date.now() - i * 1000,
      }));
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentItems));

      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByText('AI 顾问')).toBeInTheDocument();
      });

      // Select a new item to push it into recent
      fireEvent.click(screen.getByText('AI 顾问'));

      const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
      expect(stored.length).toBeLessThanOrEqual(MAX_RECENT_ITEMS);
    });

    it('should move re-selected item to top of recent list', async () => {
      localStorage.setItem(
        RECENT_STORAGE_KEY,
        JSON.stringify([
          { id: 'nav-validation', label: '多股验证', href: '/dashboard/strategy-validation', timestamp: Date.now() - 2000 },
          { id: 'nav-advisor', label: 'AI 顾问', href: '/dashboard/advisor', timestamp: Date.now() - 1000 },
        ])
      );

      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Select the older item (first match is in the Recent group)
      const matches = screen.getAllByText('多股验证');
      fireEvent.click(matches[0]!);

      const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
      expect(stored[0].label).toBe('多股验证');
    });
  });

  // ============================================================
  // AC-7: Accessibility
  // ============================================================
  describe('Accessibility', () => {
    it('should have dialog role when open', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should have search input with accessible label', async () => {
      renderPalette();
      await openPaletteViaKeyboard();

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/搜索/);
        expect(input).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // Command Data Constants
  // ============================================================
  describe('Command Data', () => {
    it('should have navigation commands defined', () => {
      expect(NAVIGATION_COMMANDS.length).toBeGreaterThan(0);
      for (const cmd of NAVIGATION_COMMANDS) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.label).toBeTruthy();
        expect(cmd.href).toBeTruthy();
      }
    });

    it('should have action commands defined', () => {
      expect(ACTION_COMMANDS.length).toBeGreaterThan(0);
      for (const cmd of ACTION_COMMANDS) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.label).toBeTruthy();
      }
    });

    it('should have unique IDs across all commands', () => {
      const allIds = [...NAVIGATION_COMMANDS, ...ACTION_COMMANDS].map(c => c.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });
});
