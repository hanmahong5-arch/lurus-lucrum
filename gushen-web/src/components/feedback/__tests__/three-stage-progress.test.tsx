/**
 * ThreeStageProgress Component Tests
 *
 * Tests:
 * - Three-stage rendering (data loading, signal calc, metrics calc)
 * - Stage status transitions (waiting -> in-progress -> completed -> error)
 * - Percentage display updates
 * - Completion callback with delay
 * - Error state display
 * - Accessibility (aria-label, aria-valuenow, aria-live)
 * - Reduced motion support
 * - buildStagesFromProgress utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  ThreeStageProgress,
  buildStagesFromProgress,
  DEFAULT_BACKTEST_STAGES,
  type StageInfo,
  type StageStatus,
} from "../three-stage-progress";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createStages = (
  overrides: Partial<Record<number, Partial<StageInfo>>> = {},
): StageInfo[] => {
  const defaults: StageInfo[] = [
    {
      id: "data-loading",
      label: "\u6570\u636E\u52A0\u8F7D",
      status: "waiting",
      progress: 0,
    },
    {
      id: "signal-calc",
      label: "\u4FE1\u53F7\u8BA1\u7B97",
      status: "waiting",
      progress: 0,
    },
    {
      id: "metrics-calc",
      label: "\u6307\u6807\u7EDF\u8BA1",
      status: "waiting",
      progress: 0,
    },
  ];

  return defaults.map((stage, index) => ({
    ...stage,
    ...overrides[index],
  }));
};

const ALL_WAITING = createStages();

const FIRST_IN_PROGRESS = createStages({
  0: { status: "in-progress", progress: 50 },
});

const FIRST_DONE_SECOND_IN_PROGRESS = createStages({
  0: { status: "completed", progress: 100 },
  1: { status: "in-progress", progress: 30 },
});

const ALL_COMPLETED = createStages({
  0: { status: "completed", progress: 100 },
  1: { status: "completed", progress: 100 },
  2: { status: "completed", progress: 100 },
});

const SECOND_ERROR = createStages({
  0: { status: "completed", progress: 100 },
  1: {
    status: "error",
    progress: 0,
    errorMessage: "\u56DE\u6D4B\u5F15\u64CE\u5185\u90E8\u9519\u8BEF",
  },
});

// =============================================================================
// RENDERING TESTS
// =============================================================================

describe("ThreeStageProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders all 3 stage labels", () => {
      render(<ThreeStageProgress stages={ALL_WAITING} />);
      expect(
        screen.getByText("\u6570\u636E\u52A0\u8F7D"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("\u4FE1\u53F7\u8BA1\u7B97"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("\u6307\u6807\u7EDF\u8BA1"),
      ).toBeInTheDocument();
    });

    it("renders the panel title", () => {
      render(<ThreeStageProgress stages={ALL_WAITING} />);
      expect(
        screen.getByText("\u56DE\u6D4B\u8FDB\u5EA6"),
      ).toBeInTheDocument();
    });

    it("renders stage number indicators", () => {
      const { container } = render(
        <ThreeStageProgress stages={ALL_WAITING} />,
      );
      // Circled digits: \u2460 \u2461 \u2462
      expect(container.textContent).toContain("\u2460");
      expect(container.textContent).toContain("\u2461");
      expect(container.textContent).toContain("\u2462");
    });

    it("applies custom className", () => {
      const { container } = render(
        <ThreeStageProgress stages={ALL_WAITING} className="my-custom" />,
      );
      expect(container.firstChild).toHaveClass("my-custom");
    });
  });

  // =============================================================================
  // STATUS TRANSITIONS
  // =============================================================================

  describe("stage status transitions", () => {
    it("all stages show 'waiting' text when waiting", () => {
      const { container } = render(
        <ThreeStageProgress stages={ALL_WAITING} />,
      );
      const waitingTexts = screen.getAllByText("\u7B49\u5F85\u4E2D");
      expect(waitingTexts).toHaveLength(3);
      // All stages should have data-stage-status="waiting"
      const stageElements = container.querySelectorAll(
        "[data-stage-status='waiting']",
      );
      expect(stageElements).toHaveLength(3);
    });

    it("shows percentage for in-progress stage", () => {
      render(<ThreeStageProgress stages={FIRST_IN_PROGRESS} />);
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("shows check icon for completed stages", () => {
      const { container } = render(
        <ThreeStageProgress stages={ALL_COMPLETED} />,
      );
      const completedStages = container.querySelectorAll(
        "[data-stage-status='completed']",
      );
      expect(completedStages).toHaveLength(3);
    });

    it("shows X icon for error stage", () => {
      const { container } = render(
        <ThreeStageProgress stages={SECOND_ERROR} />,
      );
      const errorStages = container.querySelectorAll(
        "[data-stage-status='error']",
      );
      expect(errorStages).toHaveLength(1);
    });

    it("mixed state: first completed, second in-progress, third waiting", () => {
      const { container } = render(
        <ThreeStageProgress stages={FIRST_DONE_SECOND_IN_PROGRESS} />,
      );
      expect(
        container.querySelectorAll("[data-stage-status='completed']"),
      ).toHaveLength(1);
      expect(
        container.querySelectorAll("[data-stage-status='in-progress']"),
      ).toHaveLength(1);
      expect(
        container.querySelectorAll("[data-stage-status='waiting']"),
      ).toHaveLength(1);
      expect(screen.getByText("30%")).toBeInTheDocument();
    });
  });

  // =============================================================================
  // PERCENTAGE UPDATES
  // =============================================================================

  describe("percentage display", () => {
    it("rounds percentage to nearest integer", () => {
      const stages = createStages({
        0: { status: "in-progress", progress: 33.7 },
      });
      render(<ThreeStageProgress stages={stages} />);
      expect(screen.getByText("34%")).toBeInTheDocument();
    });

    it("shows 0% for in-progress with 0 progress", () => {
      const stages = createStages({
        0: { status: "in-progress", progress: 0 },
      });
      render(<ThreeStageProgress stages={stages} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("shows 100% for in-progress at max", () => {
      const stages = createStages({
        0: { status: "in-progress", progress: 100 },
      });
      render(<ThreeStageProgress stages={stages} />);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("does not show percentage for waiting stages", () => {
      render(<ThreeStageProgress stages={ALL_WAITING} />);
      expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    });

    it("does not show percentage for completed stages", () => {
      render(<ThreeStageProgress stages={ALL_COMPLETED} />);
      expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    });
  });

  // =============================================================================
  // COMPLETION CALLBACK
  // =============================================================================

  describe("completion callback", () => {
    it("fires onComplete after 500ms delay when all stages complete", () => {
      const onComplete = vi.fn();
      render(
        <ThreeStageProgress stages={ALL_COMPLETED} onComplete={onComplete} />,
      );

      // Should not fire immediately
      expect(onComplete).not.toHaveBeenCalled();

      // Advance timer by 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("does not fire onComplete before delay", () => {
      const onComplete = vi.fn();
      render(
        <ThreeStageProgress stages={ALL_COMPLETED} onComplete={onComplete} />,
      );

      act(() => {
        vi.advanceTimersByTime(499);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });

    it("does not fire onComplete when stages are not all completed", () => {
      const onComplete = vi.fn();
      render(
        <ThreeStageProgress
          stages={FIRST_IN_PROGRESS}
          onComplete={onComplete}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });

    it("does not fire onComplete when there is an error", () => {
      const onComplete = vi.fn();
      render(
        <ThreeStageProgress stages={SECOND_ERROR} onComplete={onComplete} />,
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });

    it("fires onComplete only once even on re-render", () => {
      const onComplete = vi.fn();
      const { rerender } = render(
        <ThreeStageProgress stages={ALL_COMPLETED} onComplete={onComplete} />,
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);

      // Re-render with same completed stages
      rerender(
        <ThreeStageProgress stages={ALL_COMPLETED} onComplete={onComplete} />,
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should still be 1
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("cleans up timer on unmount", () => {
      const onComplete = vi.fn();
      const { unmount } = render(
        <ThreeStageProgress stages={ALL_COMPLETED} onComplete={onComplete} />,
      );

      // Unmount before timer fires
      unmount();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // ERROR STATE
  // =============================================================================

  describe("error state", () => {
    it("displays error message below stages", () => {
      render(<ThreeStageProgress stages={SECOND_ERROR} />);
      expect(
        screen.getByText(
          "\u56DE\u6D4B\u5F15\u64CE\u5185\u90E8\u9519\u8BEF",
        ),
      ).toBeInTheDocument();
    });

    it("error message has role=alert", () => {
      render(<ThreeStageProgress stages={SECOND_ERROR} />);
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
    });

    it("sets data-has-error=true when a stage has error", () => {
      const { container } = render(
        <ThreeStageProgress stages={SECOND_ERROR} />,
      );
      expect(
        container.querySelector("[data-has-error='true']"),
      ).toBeInTheDocument();
    });

    it("sets data-has-error=false when no error", () => {
      const { container } = render(
        <ThreeStageProgress stages={ALL_WAITING} />,
      );
      expect(
        container.querySelector("[data-has-error='false']"),
      ).toBeInTheDocument();
    });

    it("does not show error detail when no error message", () => {
      const stagesWithErrorNoMessage = createStages({
        0: { status: "completed", progress: 100 },
        1: { status: "error", progress: 0 },
      });
      const { container } = render(
        <ThreeStageProgress stages={stagesWithErrorNoMessage} />,
      );
      // Error container exists but no paragraphs inside (because errorMessage is undefined)
      const alertElements = container.querySelectorAll("[role='alert']");
      expect(alertElements).toHaveLength(0);
    });
  });

  // =============================================================================
  // DATA ATTRIBUTES
  // =============================================================================

  describe("data attributes", () => {
    it("sets data-all-completed=true when all stages done", () => {
      const { container } = render(
        <ThreeStageProgress stages={ALL_COMPLETED} />,
      );
      expect(
        container.querySelector("[data-all-completed='true']"),
      ).toBeInTheDocument();
    });

    it("sets data-all-completed=false when not all stages done", () => {
      const { container } = render(
        <ThreeStageProgress stages={FIRST_IN_PROGRESS} />,
      );
      expect(
        container.querySelector("[data-all-completed='false']"),
      ).toBeInTheDocument();
    });

    it("each stage row has data-stage-id attribute", () => {
      const { container } = render(
        <ThreeStageProgress stages={ALL_WAITING} />,
      );
      expect(
        container.querySelector("[data-stage-id='data-loading']"),
      ).toBeInTheDocument();
      expect(
        container.querySelector("[data-stage-id='signal-calc']"),
      ).toBeInTheDocument();
      expect(
        container.querySelector("[data-stage-id='metrics-calc']"),
      ).toBeInTheDocument();
    });
  });

  // =============================================================================
  // ACCESSIBILITY
  // =============================================================================

  describe("accessibility", () => {
    it("has role=group on the container", () => {
      render(<ThreeStageProgress stages={ALL_WAITING} />);
      expect(screen.getByRole("group")).toBeInTheDocument();
    });

    it("container has aria-label", () => {
      render(<ThreeStageProgress stages={ALL_WAITING} />);
      const group = screen.getByRole("group");
      expect(group).toHaveAttribute("aria-label", "Backtest progress");
    });

    it("has aria-live=polite on the stage list", () => {
      const { container } = render(
        <ThreeStageProgress stages={ALL_WAITING} />,
      );
      const liveRegion = container.querySelector("[aria-live='polite']");
      expect(liveRegion).toBeInTheDocument();
    });

    it("each progress bar has aria-valuenow", () => {
      render(<ThreeStageProgress stages={FIRST_IN_PROGRESS} />);
      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars).toHaveLength(3);

      // First stage: in-progress at 50%
      expect(progressBars[0]).toHaveAttribute("aria-valuenow", "50");
      // Second stage: waiting at 0%
      expect(progressBars[1]).toHaveAttribute("aria-valuenow", "0");
      // Third stage: waiting at 0%
      expect(progressBars[2]).toHaveAttribute("aria-valuenow", "0");
    });

    it("each progress bar has descriptive aria-label", () => {
      render(<ThreeStageProgress stages={FIRST_IN_PROGRESS} />);
      const progressBars = screen.getAllByRole("progressbar");

      expect(progressBars[0]).toHaveAttribute(
        "aria-label",
        expect.stringContaining("\u6570\u636E\u52A0\u8F7D"),
      );
      expect(progressBars[0]).toHaveAttribute(
        "aria-label",
        expect.stringContaining("in progress"),
      );
    });
  });

  // =============================================================================
  // REDUCED MOTION
  // =============================================================================

  describe("reduced motion support", () => {
    it("uses motion-safe classes for transitions", () => {
      const { container } = render(
        <ThreeStageProgress stages={FIRST_IN_PROGRESS} />,
      );

      // The progress indicator for the in-progress stage should have motion-safe classes
      const inProgressStage = container.querySelector(
        "[data-stage-status='in-progress']",
      );
      expect(inProgressStage).toBeInTheDocument();

      // Check that the indicator uses motion-safe prefix (Tailwind approach)
      // The actual CSS class will be present in the element
      const indicator = inProgressStage?.querySelector(
        "[class*='motion-safe']",
      );
      expect(indicator).toBeInTheDocument();
    });
  });
});

// =============================================================================
// buildStagesFromProgress UTILITY TESTS
// =============================================================================

describe("buildStagesFromProgress", () => {
  it("returns 3 stages", () => {
    const stages = buildStagesFromProgress("init", 0);
    expect(stages).toHaveLength(3);
  });

  it("maps init phase to first stage in-progress", () => {
    const stages = buildStagesFromProgress("init", 25);
    expect(stages[0]!.status).toBe("in-progress");
    expect(stages[0]!.progress).toBe(25);
    expect(stages[1]!.status).toBe("waiting");
    expect(stages[2]!.status).toBe("waiting");
  });

  it("maps fetching_data to first stage in-progress", () => {
    const stages = buildStagesFromProgress("fetching_data", 80);
    expect(stages[0]!.status).toBe("in-progress");
    expect(stages[0]!.progress).toBe(80);
    expect(stages[1]!.status).toBe("waiting");
    expect(stages[2]!.status).toBe("waiting");
  });

  it("maps running_backtest to second stage, first completed", () => {
    const stages = buildStagesFromProgress("running_backtest", 60);
    expect(stages[0]!.status).toBe("completed");
    expect(stages[0]!.progress).toBe(100);
    expect(stages[1]!.status).toBe("in-progress");
    expect(stages[1]!.progress).toBe(60);
    expect(stages[2]!.status).toBe("waiting");
  });

  it("maps calculating_stats to third stage, first two completed", () => {
    const stages = buildStagesFromProgress("calculating_stats", 40);
    expect(stages[0]!.status).toBe("completed");
    expect(stages[1]!.status).toBe("completed");
    expect(stages[2]!.status).toBe("in-progress");
    expect(stages[2]!.progress).toBe(40);
  });

  it("maps generating_report to third stage", () => {
    const stages = buildStagesFromProgress("generating_report", 90);
    expect(stages[0]!.status).toBe("completed");
    expect(stages[1]!.status).toBe("completed");
    expect(stages[2]!.status).toBe("in-progress");
    expect(stages[2]!.progress).toBe(90);
  });

  it("sets error status on the active stage when error provided", () => {
    const stages = buildStagesFromProgress(
      "running_backtest",
      50,
      "Engine error",
    );
    expect(stages[0]!.status).toBe("completed");
    expect(stages[1]!.status).toBe("error");
    expect(stages[1]!.errorMessage).toBe("Engine error");
    expect(stages[2]!.status).toBe("waiting");
  });

  it("clamps progress between 0 and 100", () => {
    const stagesOver = buildStagesFromProgress("fetching_data", 150);
    expect(stagesOver[0]!.progress).toBe(100);

    const stagesUnder = buildStagesFromProgress("fetching_data", -10);
    expect(stagesUnder[0]!.progress).toBe(0);
  });

  it("uses default stage index 0 for unknown phase", () => {
    const stages = buildStagesFromProgress("unknown_phase", 50);
    expect(stages[0]!.status).toBe("in-progress");
    expect(stages[0]!.progress).toBe(50);
  });

  it("preserves default stage labels", () => {
    const stages = buildStagesFromProgress("init", 0);
    expect(stages[0]!.label).toBe("\u6570\u636E\u52A0\u8F7D");
    expect(stages[1]!.label).toBe("\u4FE1\u53F7\u8BA1\u7B97");
    expect(stages[2]!.label).toBe("\u6307\u6807\u7EDF\u8BA1");
  });

  it("preserves default stage IDs", () => {
    const stages = buildStagesFromProgress("init", 0);
    expect(stages[0]!.id).toBe("data-loading");
    expect(stages[1]!.id).toBe("signal-calc");
    expect(stages[2]!.id).toBe("metrics-calc");
  });
});

// =============================================================================
// DEFAULT_BACKTEST_STAGES CONSTANT TESTS
// =============================================================================

describe("DEFAULT_BACKTEST_STAGES", () => {
  it("has exactly 3 stages", () => {
    expect(DEFAULT_BACKTEST_STAGES).toHaveLength(3);
  });

  it("each stage has id and label", () => {
    DEFAULT_BACKTEST_STAGES.forEach((stage) => {
      expect(stage.id).toBeDefined();
      expect(stage.id.length).toBeGreaterThan(0);
      expect(stage.label).toBeDefined();
      expect(stage.label.length).toBeGreaterThan(0);
    });
  });
});
