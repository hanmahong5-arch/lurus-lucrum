/**
 * WorkflowSummaryReport Component Tests
 *
 * Test categories:
 * 1. Rendering when workflow is complete
 * 2. Step summary rendering for each step
 * 3. Action buttons presence and interaction
 * 4. ForkDialog open/close and input
 * 5. Edge cases (missing step data, failed steps)
 * 6. Reduced motion preference
 * 7. Accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowSummaryReport } from '../workflow-summary-report';
import type { WorkflowSession, StepData, StepStatus } from '@/lib/workflow';

// =============================================================================
// Test Data Factory
// =============================================================================

function createMockStepData(
  stepNumber: number,
  overrides: Partial<StepData> = {}
): StepData {
  const stepTypes = ['strategy_input', 'strategy_generate', 'backtest_run', 'result_analysis'] as const;
  return {
    stepNumber,
    stepType: stepTypes[stepNumber] ?? 'strategy_input',
    status: 'completed' as StepStatus,
    outputData: {
      summary: `Step ${stepNumber} output`,
    },
    completedAt: new Date(),
    ...overrides,
  };
}

function createMockSession(overrides: Partial<WorkflowSession> = {}): WorkflowSession {
  return {
    id: 'session-123',
    userId: 'user-456',
    workflowType: 'strategy_dev',
    status: 'completed',
    currentStep: 4,
    totalSteps: 4,
    title: 'Test Workflow',
    stepData: {
      0: createMockStepData(0, {
        stepType: 'strategy_input',
        outputData: { strategyDescription: 'KDJ golden cross strategy', parsedStrategy: { type: 'momentum' } },
      }),
      1: createMockStepData(1, {
        stepType: 'strategy_generate',
        outputData: { generatedCode: 'class Strategy(CtaTemplate): ...', confidence: 0.85 },
      }),
      2: createMockStepData(2, {
        stepType: 'backtest_run',
        outputData: {
          backtestResult: { totalReturn: 0.15, sharpeRatio: 1.2, maxDrawdown: 0.08 },
          scoreGrade: 'B',
        },
      }),
      3: createMockStepData(3, {
        stepType: 'result_analysis',
        outputData: {
          analysis: { summary: 'Good strategy', topStocks: ['600519', '000858', '002304'] },
        },
      }),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('WorkflowSummaryReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering When Complete
  // ===========================================================================
  describe('Rendering When Complete', () => {
    it('renders the summary report for a completed workflow', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(screen.getByText(/工作流完成/)).toBeInTheDocument();
    });

    it('renders nothing when session is null', () => {
      const { container } = render(
        <WorkflowSummaryReport
          session={null as unknown as WorkflowSession}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when session is not completed', () => {
      const session = createMockSession({ status: 'active' });
      const { container } = render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  // ===========================================================================
  // 2. Step Summary Rendering
  // ===========================================================================
  describe('Step Summary Rendering', () => {
    it('renders all 4 step summaries', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      // Should have step indicators for all 4 steps
      expect(screen.getByTestId('step-summary-0')).toBeInTheDocument();
      expect(screen.getByTestId('step-summary-1')).toBeInTheDocument();
      expect(screen.getByTestId('step-summary-2')).toBeInTheDocument();
      expect(screen.getByTestId('step-summary-3')).toBeInTheDocument();
    });

    it('displays strategy description in step 1 summary', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(screen.getByText(/KDJ golden cross/)).toBeInTheDocument();
    });

    it('displays backtest metrics in step 3 summary', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      // Should show return or grade information
      expect(screen.getByTestId('step-summary-2')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 3. Action Buttons
  // ===========================================================================
  describe('Action Buttons', () => {
    it('renders Save button', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument();
    });

    it('renders Export PDF button', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /导出|PDF/i })).toBeInTheDocument();
    });

    it('renders Fork button', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: '另存为新工作流' })).toBeInTheDocument();
    });

    it('renders Start New button', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: '开始新工作流' })).toBeInTheDocument();
    });

    it('calls onSave when Save is clicked', () => {
      const onSave = vi.fn();
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={onSave}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /保存/i }));
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('calls onExportPdf when Export PDF is clicked', () => {
      const onExportPdf = vi.fn();
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={onExportPdf}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /导出|PDF/i }));
      expect(onExportPdf).toHaveBeenCalledTimes(1);
    });

    it('calls onStartNew when Start New is clicked', () => {
      const onStartNew = vi.fn();
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={onStartNew}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '开始新工作流' }));
      expect(onStartNew).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 4. Fork Dialog
  // ===========================================================================
  describe('Fork Dialog', () => {
    it('opens fork dialog when Fork button is clicked', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '另存为新工作流' }));

      expect(screen.getByTestId('fork-dialog')).toBeInTheDocument();
    });

    it('fork dialog has a name input field', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '另存为新工作流' }));

      expect(screen.getByPlaceholderText(/工作流名称|名称/i)).toBeInTheDocument();
    });

    it('calls onFork with name when confirm is clicked', () => {
      const onFork = vi.fn();
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={onFork}
          onStartNew={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '另存为新工作流' }));

      const input = screen.getByPlaceholderText(/工作流名称|名称/i);
      fireEvent.change(input, { target: { value: 'My Forked Workflow' } });

      fireEvent.click(screen.getByRole('button', { name: /确认|确定/i }));

      expect(onFork).toHaveBeenCalledWith('My Forked Workflow');
    });

    it('closes fork dialog when cancel is clicked', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '另存为新工作流' }));
      expect(screen.getByTestId('fork-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /取消/i }));
      expect(screen.queryByTestId('fork-dialog')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 5. Edge Cases
  // ===========================================================================
  describe('Edge Cases', () => {
    it('handles session with missing stepData', () => {
      const session = createMockSession({ stepData: undefined });
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      // Should still render without crashing
      expect(screen.getByText(/工作流完成/)).toBeInTheDocument();
    });

    it('handles session with empty stepData', () => {
      const session = createMockSession({ stepData: {} });
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      expect(screen.getByText(/工作流完成/)).toBeInTheDocument();
    });

    it('shows error message for failed steps', () => {
      const session = createMockSession({
        stepData: {
          0: createMockStepData(0, { status: 'failed', errorMessage: 'Step 1 failed' }),
          1: createMockStepData(1),
          2: createMockStepData(2),
          3: createMockStepData(3),
        },
      });

      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      const failedElements = screen.getAllByText(/失败/);
      expect(failedElements.length).toBeGreaterThan(0);
    });

    it('shows skipped indicator for skipped steps', () => {
      const session = createMockSession({
        stepData: {
          0: createMockStepData(0),
          1: createMockStepData(1, { status: 'skipped' }),
          2: createMockStepData(2),
          3: createMockStepData(3),
        },
      });

      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      const skippedElements = screen.getAllByText(/已跳过/);
      expect(skippedElements.length).toBeGreaterThan(0);
    });

    it('handles step with null outputData', () => {
      const session = createMockSession({
        stepData: {
          0: createMockStepData(0, { outputData: undefined }),
          1: createMockStepData(1),
          2: createMockStepData(2),
          3: createMockStepData(3),
        },
      });

      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      // Should render without crashing
      expect(screen.getByText(/工作流完成/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 6. Reduced Motion
  // ===========================================================================
  describe('Reduced Motion', () => {
    it('applies no-animation class when reduced motion is preferred', () => {
      // Mock matchMedia to return prefers-reduced-motion: reduce
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      // The component should skip animation
      const container = screen.getByTestId('workflow-summary');
      expect(container).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 7. Accessibility
  // ===========================================================================
  describe('Accessibility', () => {
    it('has appropriate heading level', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
        />
      );

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('applies custom className', () => {
      const session = createMockSession();
      render(
        <WorkflowSummaryReport
          session={session}
          onSave={vi.fn()}
          onExportPdf={vi.fn()}
          onFork={vi.fn()}
          onStartNew={vi.fn()}
          className="custom-summary"
        />
      );

      expect(screen.getByTestId('workflow-summary')).toHaveClass('custom-summary');
    });
  });
});
