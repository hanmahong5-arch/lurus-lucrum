/**
 * StrategySelector Component Tests
 * Test coverage: 95%+
 *
 * Test categories:
 * 1. Grouped Display - User and builtin strategy grouping
 * 2. Selection & Callbacks - Strategy selection and callbacks
 * 3. Edge Cases - Null/empty/invalid data handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrategySelector } from '../config-panel';
import type { StrategyOption } from '../config-panel';

// =============================================================================
// Test Data Factory
// =============================================================================

/**
 * Create a mock strategy option
 */
function createMockStrategy(overrides: Partial<StrategyOption> = {}): StrategyOption {
  return {
    id: 'test_strategy',
    name: '测试策略',
    nameEn: 'Test Strategy',
    description: '这是一个测试策略描述',
    type: 'builtin',
    ...overrides,
  };
}

/**
 * Create multiple mock strategies with different types
 */
function createMockStrategies(userCount = 2, builtinCount = 3): StrategyOption[] {
  const userStrategies = Array.from({ length: userCount }, (_, i) =>
    createMockStrategy({
      id: `user_strategy_${i + 1}`,
      name: `用户策略 ${i + 1}`,
      nameEn: `User Strategy ${i + 1}`,
      description: `用户自定义策略描述 ${i + 1}`,
      type: 'custom',
    })
  );

  const builtinStrategies = Array.from({ length: builtinCount }, (_, i) =>
    createMockStrategy({
      id: `builtin_strategy_${i + 1}`,
      name: `内置策略 ${i + 1}`,
      nameEn: `Builtin Strategy ${i + 1}`,
      description: `内置策略描述 ${i + 1}`,
      type: 'builtin',
    })
  );

  return [...userStrategies, ...builtinStrategies];
}

// Helper to open select dropdown
async function openSelectDropdown() {
  const trigger = screen.getByTestId('strategy-select');
  await userEvent.click(trigger);
  // Wait for dropdown to appear
  await waitFor(() => {
    expect(document.querySelector('[role="listbox"]')).toBeInTheDocument();
  });
}

// =============================================================================
// Test Suite
// =============================================================================

describe('StrategySelector', () => {
  const mockOnStrategyChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Grouped Display
  // ===========================================================================
  describe('Grouped Display', () => {
    it('shows "我的策略" group when user strategies exist', async () => {
      const strategies = createMockStrategies(2, 3);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      expect(within(listbox as HTMLElement).getByText(/我的策略/)).toBeInTheDocument();
    });

    it('shows "预定义策略" group', async () => {
      const strategies = createMockStrategies(2, 3);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      expect(within(listbox as HTMLElement).getByText(/预定义策略/)).toBeInTheDocument();
    });

    it('does not show "我的策略" group when no user strategies', async () => {
      const strategies = createMockStrategies(0, 3);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      expect(within(listbox as HTMLElement).queryByText(/我的策略/)).not.toBeInTheDocument();
    });

    it('displays user strategies before builtin strategies', async () => {
      const strategies = createMockStrategies(2, 2);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      const text = listbox.textContent || '';

      // User strategy group should appear before builtin group
      const userGroupIndex = text.indexOf('我的策略');
      const builtinGroupIndex = text.indexOf('预定义策略');

      expect(userGroupIndex).toBeLessThan(builtinGroupIndex);
    });

    it('shows separator between groups when both exist', async () => {
      const strategies = createMockStrategies(2, 2);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      const builtinLabel = within(listbox as HTMLElement).getByText(/预定义策略/);
      // The separator is a border-t class on the parent SelectLabel
      expect(builtinLabel.className).toContain('border-t');
    });
  });

  // ===========================================================================
  // 2. Selection & Callbacks
  // ===========================================================================
  describe('Selection & Callbacks', () => {
    it('calls onStrategyChange when strategy is selected', async () => {
      const strategies = createMockStrategies(0, 3);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      const option = within(listbox as HTMLElement).getByText('内置策略 2');
      await userEvent.click(option);

      expect(mockOnStrategyChange).toHaveBeenCalledWith('builtin_strategy_2');
    });

    it('displays selected strategy name in trigger', () => {
      const strategies = createMockStrategies(0, 3);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy="builtin_strategy_2"
          onStrategyChange={mockOnStrategyChange}
        />
      );

      expect(screen.getByText('内置策略 2')).toBeInTheDocument();
    });

    it('shows 🎯 icon for custom strategies in dropdown', async () => {
      const strategies = createMockStrategies(2, 1);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      // Check for 🎯 icon in user strategies section
      const icons = within(listbox as HTMLElement).getAllByText('🎯');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('shows 📈 icon for builtin strategies in dropdown', async () => {
      const strategies = createMockStrategies(0, 2);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      // Check for 📈 icon in builtin strategies
      const icons = within(listbox as HTMLElement).getAllByText('📈');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('displays strategy description after selection', () => {
      const strategies = createMockStrategies(0, 2);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy="builtin_strategy_1"
          onStrategyChange={mockOnStrategyChange}
        />
      );

      expect(screen.getByText(/内置策略描述 1/)).toBeInTheDocument();
    });

    it('shows custom strategy indicator for user strategies', () => {
      const strategies = createMockStrategies(2, 1);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy="user_strategy_1"
          onStrategyChange={mockOnStrategyChange}
        />
      );

      // Description section shows "Custom Strategy" indicator
      expect(screen.getByText(/Custom Strategy/)).toBeInTheDocument();
    });

    it('displays English name when available', () => {
      const strategies = createMockStrategies(0, 1);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      // English name should be visible
      expect(screen.getByText(/Builtin Strategy 1/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 3. Edge Cases
  // ===========================================================================
  describe('Edge Cases', () => {
    it('shows placeholder when no strategy is selected', () => {
      const strategies = createMockStrategies(0, 2);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy=""
          onStrategyChange={mockOnStrategyChange}
        />
      );

      // Trigger should exist and contain placeholder text
      const trigger = screen.getByTestId('strategy-select');
      expect(trigger.textContent).toContain('Select a strategy');
    });

    it('renders without crashing when strategies array is empty', async () => {
      render(
        <StrategySelector
          strategies={[]}
          selectedStrategy=""
          onStrategyChange={mockOnStrategyChange}
        />
      );

      // Should render trigger
      expect(screen.getByTestId('strategy-select')).toBeInTheDocument();

      // Open dropdown
      await userEvent.click(screen.getByTestId('strategy-select'));

      // Dropdown should be accessible (may be empty)
      await waitFor(() => {
        expect(document.querySelector('[role="listbox"]')).toBeInTheDocument();
      });
    });

    it('handles empty strategy name gracefully', async () => {
      const strategies = [createMockStrategy({ id: 'empty_name', name: '' })];

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy=""
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await userEvent.click(screen.getByTestId('strategy-select'));

      // Should not crash
      await waitFor(() => {
        expect(document.querySelector('[role="listbox"]')).toBeInTheDocument();
      });
    });

    it('truncates long strategy names in dropdown', async () => {
      const longName = '这是一个非常非常非常非常非常长的策略名称用于测试截断功能是否正常工作';
      // Use type: 'custom' because truncate class is only applied to user strategies
      const strategies = [createMockStrategy({ id: 'long_name', name: longName, type: 'custom' })];

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy="long_name"
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      // Check for truncate class in dropdown items (only applied to custom/user strategies)
      const items = document.querySelectorAll('.truncate');
      expect(items.length).toBeGreaterThan(0);
    });

    it('handles invalid selectedStrategy ID gracefully', () => {
      const strategies = createMockStrategies(0, 2);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy="non_existent_id"
          onStrategyChange={mockOnStrategyChange}
        />
      );

      // Should not crash and trigger should exist
      const trigger = screen.getByTestId('strategy-select');
      expect(trigger).toBeInTheDocument();
      // Description should not be shown for invalid strategy
      expect(screen.queryByText(/内置策略描述/)).not.toBeInTheDocument();
    });

    it('handles special characters in description', () => {
      const strategies = [createMockStrategy({
        id: 'special_chars',
        name: '特殊字符策略',
        description: '描述包含特殊字符：<test> & "quotes"',
      })];

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy="special_chars"
          onStrategyChange={mockOnStrategyChange}
        />
      );

      // Should render special characters properly (escaped)
      expect(screen.getByText(/描述包含特殊字符/)).toBeInTheDocument();
    });

    it('treats undefined type as builtin', async () => {
      const strategies = [createMockStrategy({ id: 'undefined_type', type: undefined })];

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;

      // Should be in builtin group, not user group
      expect(within(listbox as HTMLElement).queryByText(/我的策略/)).not.toBeInTheDocument();
      expect(within(listbox as HTMLElement).getByText(/预定义策略/)).toBeInTheDocument();
    });

    it('handles strategy without nameEn', () => {
      const strategies = [createMockStrategy({ id: 'no_en', nameEn: undefined })];

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy="no_en"
          onStrategyChange={mockOnStrategyChange}
        />
      );

      // Should render without English name
      expect(screen.getByText('测试策略')).toBeInTheDocument();
    });

    it('handles multiple selections correctly', async () => {
      const strategies = createMockStrategies(0, 3);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy="builtin_strategy_1"
          onStrategyChange={mockOnStrategyChange}
        />
      );

      // Select a different strategy
      await openSelectDropdown();
      const listbox = document.querySelector('[role="listbox"]')!;
      await userEvent.click(within(listbox as HTMLElement).getByText('内置策略 2'));

      expect(mockOnStrategyChange).toHaveBeenCalledWith('builtin_strategy_2');
    });

    it('renders correct icons in dropdown items', async () => {
      const strategies = createMockStrategies(1, 1);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[1]!.id}  // Select builtin strategy to avoid rerender issues
          onStrategyChange={mockOnStrategyChange}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;

      // Both icons should be present in the dropdown
      expect(within(listbox as HTMLElement).getAllByText('🎯').length).toBeGreaterThanOrEqual(1);
      expect(within(listbox as HTMLElement).getAllByText('📈').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 4. Accessibility
  // ===========================================================================
  describe('Accessibility', () => {
    it('has accessible select trigger', () => {
      const strategies = createMockStrategies(0, 2);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      const trigger = screen.getByTestId('strategy-select');
      expect(trigger).toHaveAttribute('role', 'combobox');
    });

    it('supports keyboard navigation', async () => {
      const strategies = createMockStrategies(0, 3);

      render(
        <StrategySelector
          strategies={strategies}
          selectedStrategy={strategies[0]!.id}
          onStrategyChange={mockOnStrategyChange}
        />
      );

      const trigger = screen.getByTestId('strategy-select');

      // Focus and open with Enter
      trigger.focus();
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(document.querySelector('[role="listbox"]')).toBeInTheDocument();
      });
    });
  });
});
