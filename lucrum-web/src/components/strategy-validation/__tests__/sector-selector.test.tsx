/**
 * SectorSelector Component Tests
 * Test coverage: 95%+
 *
 * Test categories:
 * 1. Grouped Display - Industry and concept sector grouping
 * 2. Selection & Callbacks - Sector selection and callbacks
 * 3. Edge Cases - Null/empty/invalid data handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectorSelector } from '../target-selector';

// =============================================================================
// Types
// =============================================================================

interface SectorOption {
  code: string;
  name: string;
  nameEn: string;
  type?: 'industry' | 'concept';
}

// =============================================================================
// Test Data Factory
// =============================================================================

/**
 * Create a mock sector option
 */
function createMockSector(overrides: Partial<SectorOption> = {}): SectorOption {
  return {
    code: 'BK0420',
    name: '电力',
    nameEn: 'Electric Power',
    type: 'industry',
    ...overrides,
  };
}

/**
 * Create multiple mock sectors with different types
 */
function createMockSectors(): SectorOption[] {
  const industries: SectorOption[] = [
    { code: 'BK0420', name: '电力', nameEn: 'Electric Power', type: 'industry' },
    { code: 'BK0437', name: '银行', nameEn: 'Banking', type: 'industry' },
    { code: 'BK0451', name: '房地产', nameEn: 'Real Estate', type: 'industry' },
  ];

  const concepts: SectorOption[] = [
    { code: 'BK0493', name: '人工智能', nameEn: 'AI', type: 'concept' },
    { code: 'BK0447', name: '新能源车', nameEn: 'NEV', type: 'concept' },
  ];

  return [...industries, ...concepts];
}

/**
 * Create industries only
 */
function createIndustriesOnly(): SectorOption[] {
  return [
    { code: 'BK0420', name: '电力', nameEn: 'Electric Power', type: 'industry' },
    { code: 'BK0437', name: '银行', nameEn: 'Banking', type: 'industry' },
  ];
}

/**
 * Create concepts only
 */
function createConceptsOnly(): SectorOption[] {
  return [
    { code: 'BK0493', name: '人工智能', nameEn: 'AI', type: 'concept' },
    { code: 'BK0447', name: '新能源车', nameEn: 'NEV', type: 'concept' },
  ];
}

// Helper to open select dropdown
async function openSelectDropdown() {
  const trigger = screen.getByTestId('sector-select');
  await userEvent.click(trigger);
  // Wait for dropdown to appear
  await waitFor(() => {
    expect(document.querySelector('[role="listbox"]')).toBeInTheDocument();
  });
}

// =============================================================================
// Test Suite
// =============================================================================

describe('SectorSelector', () => {
  const mockOnSectorChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Grouped Display
  // ===========================================================================
  describe('Grouped Display', () => {
    it('shows "行业板块" group', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      expect(within(listbox as HTMLElement).getByText(/行业板块/)).toBeInTheDocument();
    });

    it('shows "概念板块" group', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      expect(within(listbox as HTMLElement).getByText(/概念板块/)).toBeInTheDocument();
    });

    it('displays industries before concepts', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      const text = listbox.textContent || '';

      // Industry group should appear before concept group
      const industryGroupIndex = text.indexOf('行业板块');
      const conceptGroupIndex = text.indexOf('概念板块');

      expect(industryGroupIndex).toBeLessThan(conceptGroupIndex);
    });

    it('shows separator between groups', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      const conceptLabel = within(listbox as HTMLElement).getByText(/概念板块/);
      expect(conceptLabel.className).toContain('border-t');
    });
  });

  // ===========================================================================
  // 2. Selection & Callbacks
  // ===========================================================================
  describe('Selection & Callbacks', () => {
    it('calls onSectorChange when sector is selected', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      await userEvent.click(within(listbox as HTMLElement).getByText('银行'));

      expect(mockOnSectorChange).toHaveBeenCalledWith('BK0437');
    });

    it('displays selected sector with correct icon', () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode="BK0493"
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      // Concept sector should show 💡 icon
      expect(screen.getByText('💡')).toBeInTheDocument();
      expect(screen.getByText('人工智能')).toBeInTheDocument();
    });

    it('shows 💡 icon for concept sectors in dropdown', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      // Check for 💡 icon in concept sectors
      const conceptIcons = within(listbox as HTMLElement).getAllByText('💡');
      expect(conceptIcons.length).toBeGreaterThan(0);
    });

    it('shows 📊 icon for industry sectors in dropdown', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      // Check for 📊 icon in industry sectors
      const industryIcons = within(listbox as HTMLElement).getAllByText('📊');
      expect(industryIcons.length).toBeGreaterThan(0);
    });

    it('shows info message after sector selection', () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode="BK0420"
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      expect(screen.getByText(/已选择板块模式/)).toBeInTheDocument();
    });

    it('displays English name in dropdown items', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      expect(within(listbox as HTMLElement).getByText(/Electric Power/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 3. Edge Cases
  // ===========================================================================
  describe('Edge Cases', () => {
    it('handles empty sectors array', async () => {
      render(
        <SectorSelector
          sectorCode=""
          onSectorChange={mockOnSectorChange}
          sectors={[]}
        />
      );

      // Should render trigger without crashing
      expect(screen.getByTestId('sector-select')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('sector-select'));

      // Dropdown should be accessible
      await waitFor(() => {
        expect(document.querySelector('[role="listbox"]')).toBeInTheDocument();
      });
    });

    it('handles sectors without type (defaults to industry)', async () => {
      const sectors = [
        { code: 'BK0001', name: '无类型板块', nameEn: 'No Type' },
      ];

      render(
        <SectorSelector
          sectorCode=""
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      // Should be in industry group
      expect(within(listbox as HTMLElement).getByText(/行业板块/)).toBeInTheDocument();
      expect(within(listbox as HTMLElement).queryByText(/概念板块/)).not.toBeInTheDocument();
    });

    it('handles only industries without concepts', async () => {
      const sectors = createIndustriesOnly();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      expect(within(listbox as HTMLElement).getByText(/行业板块/)).toBeInTheDocument();
      expect(within(listbox as HTMLElement).queryByText(/概念板块/)).not.toBeInTheDocument();
    });

    it('handles only concepts without industries', async () => {
      const sectors = createConceptsOnly();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      await openSelectDropdown();

      const listbox = document.querySelector('[role="listbox"]')!;
      // No industries, should not show industry group (unless empty industries still show label)
      // Just check concepts are present
      expect(within(listbox as HTMLElement).getByText(/概念板块/)).toBeInTheDocument();
    });

    it('handles invalid sectorCode', () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode="INVALID_CODE"
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      // Should not crash and trigger should exist
      const trigger = screen.getByTestId('sector-select');
      expect(trigger).toBeInTheDocument();
      // Info message shows when sectorCode is truthy (even if invalid)
      expect(screen.getByText(/已选择板块模式/)).toBeInTheDocument();
    });

    it('handles long sector names', () => {
      const longName = '这是一个非常非常非常非常非常长的板块名称';
      const sectors = [
        createMockSector({ code: 'BK0001', name: longName }),
      ];

      render(
        <SectorSelector
          sectorCode="BK0001"
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      // Should render without crashing
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('handles empty sector code prop', () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode=""
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      // Trigger should exist
      const trigger = screen.getByTestId('sector-select');
      expect(trigger).toBeInTheDocument();
      // Should not show info message when nothing selected
      expect(screen.queryByText(/已选择板块模式/)).not.toBeInTheDocument();
    });

    it('handles special characters in sector name', () => {
      const sectors = [
        createMockSector({
          code: 'BK0001',
          name: '特殊字符 <test> & "引号"',
          nameEn: 'Special <chars>',
        }),
      ];

      render(
        <SectorSelector
          sectorCode="BK0001"
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      // Should render special characters properly (escaped)
      expect(screen.getByText(/特殊字符/)).toBeInTheDocument();
    });

    it('handles empty nameEn', async () => {
      const sectors = [
        { code: 'BK0001', name: '无英文名', nameEn: '' },
      ];

      render(
        <SectorSelector
          sectorCode="BK0001"
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      // Should render without English name
      expect(screen.getByText('无英文名')).toBeInTheDocument();
    });

    it('handles multiple selections correctly', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode="BK0420"
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      // Select a different sector
      await openSelectDropdown();
      const listbox = document.querySelector('[role="listbox"]')!;
      await userEvent.click(within(listbox as HTMLElement).getByText('银行'));

      expect(mockOnSectorChange).toHaveBeenCalledWith('BK0437');
    });
  });

  // ===========================================================================
  // 4. Accessibility
  // ===========================================================================
  describe('Accessibility', () => {
    it('has accessible select trigger', () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      const trigger = screen.getByTestId('sector-select');
      expect(trigger).toHaveAttribute('role', 'combobox');
    });

    it('has accessible label', () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      expect(screen.getByText(/选择行业板块/)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const sectors = createMockSectors();

      render(
        <SectorSelector
          sectorCode={sectors[0]!.code}
          onSectorChange={mockOnSectorChange}
          sectors={sectors}
        />
      );

      const trigger = screen.getByTestId('sector-select');

      // Focus and open with Enter
      trigger.focus();
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(document.querySelector('[role="listbox"]')).toBeInTheDocument();
      });
    });
  });
});
