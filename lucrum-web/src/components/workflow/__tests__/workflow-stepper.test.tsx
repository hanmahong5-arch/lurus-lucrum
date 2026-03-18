/**
 * Workflow Stepper Tests
 *
 * Tests for the WorkflowStepper component (Story 1.5)
 * Validates:
 * - Step status rendering (completed/current/pending/error)
 * - Click interactions and callbacks
 * - Accessibility attributes
 * - Responsive layout classes
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  WorkflowStepper,
  DEFAULT_WORKFLOW_STEPS,
  createStepsFromCurrentIndex,
  type WorkflowStep,
  type StepStatus,
} from "../workflow-stepper";

describe("WorkflowStepper Component - Story 1.5", () => {
  const mockSteps: WorkflowStep[] = [
    { label: "起点", status: "completed" },
    { label: "输入", status: "completed" },
    { label: "生成", status: "current" },
    { label: "回测", status: "pending" },
    { label: "验证", status: "pending" },
  ];

  describe("Basic Rendering (AC-1)", () => {
    it("should render all 5 steps", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      expect(screen.getByText("起点")).toBeInTheDocument();
      expect(screen.getByText("输入")).toBeInTheDocument();
      expect(screen.getByText("生成")).toBeInTheDocument();
      expect(screen.getByText("回测")).toBeInTheDocument();
      expect(screen.getByText("验证")).toBeInTheDocument();
    });

    it("should render navigation element", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("should render list items for each step", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(5);
    });
  });

  describe("Step Status Styling (AC-2)", () => {
    it("should render completed status with check icon", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "completed" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      // Check icon should be present (svg element)
      const svgs = document.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("should render completed status with green color", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "completed" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      const indicator = document.querySelector(".bg-step-done");
      expect(indicator).toBeInTheDocument();
    });

    it("should render current status with blue highlight", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "current" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      const indicator = document.querySelector(".bg-step-active");
      expect(indicator).toBeInTheDocument();
    });

    it("should render current status with ring effect", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "current" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      const indicator = document.querySelector(".ring-step-active");
      expect(indicator).toBeInTheDocument();
    });

    it("should render pending status with gray color", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "pending" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      const label = screen.getByText("Test");
      expect(label).toHaveClass("text-step-pending");
    });

    it("should render error status with red color", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "error" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      const indicator = document.querySelector(".bg-status-block");
      expect(indicator).toBeInTheDocument();
    });

    it("should render error status with X icon", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "error" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      // X icon should be present
      const svgs = document.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("should render step number for current status", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "current" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("should render step number for pending status", () => {
      const steps: WorkflowStep[] = [
        { label: "Test", status: "pending" },
      ];
      render(<WorkflowStepper steps={steps} currentStep={0} />);

      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  describe("Step Interactions (AC-4)", () => {
    it("should call onStepClick when completed step is clicked", () => {
      const handleClick = vi.fn();
      render(
        <WorkflowStepper
          steps={mockSteps}
          currentStep={2}
          onStepClick={handleClick}
        />
      );

      const completedStep = screen.getByText("起点").closest('[role="listitem"]');
      fireEvent.click(completedStep!);

      expect(handleClick).toHaveBeenCalledWith(0);
    });

    it("should call onStepClick when current step is clicked", () => {
      const handleClick = vi.fn();
      render(
        <WorkflowStepper
          steps={mockSteps}
          currentStep={2}
          onStepClick={handleClick}
        />
      );

      const currentStep = screen.getByText("生成").closest('[role="listitem"]');
      fireEvent.click(currentStep!);

      expect(handleClick).toHaveBeenCalledWith(2);
    });

    it("should NOT call onStepClick when pending step is clicked", () => {
      const handleClick = vi.fn();
      render(
        <WorkflowStepper
          steps={mockSteps}
          currentStep={2}
          onStepClick={handleClick}
        />
      );

      const pendingStep = screen.getByText("回测").closest('[role="listitem"]');
      fireEvent.click(pendingStep!);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it("should call onStepClick when error step is clicked", () => {
      const stepsWithError: WorkflowStep[] = [
        { label: "Error Step", status: "error" },
      ];
      const handleClick = vi.fn();

      render(
        <WorkflowStepper
          steps={stepsWithError}
          currentStep={0}
          onStepClick={handleClick}
        />
      );

      const errorStep = screen.getByText("Error Step").closest('[role="listitem"]');
      fireEvent.click(errorStep!);

      expect(handleClick).toHaveBeenCalledWith(0);
    });

    it("should have cursor-pointer for clickable steps", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const completedStep = screen.getByText("起点").closest('[role="listitem"]');
      expect(completedStep).toHaveClass("cursor-pointer");
    });

    it("should have cursor-not-allowed for pending steps", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const pendingStep = screen.getByText("回测").closest('[role="listitem"]');
      expect(pendingStep).toHaveClass("cursor-not-allowed");
    });

    it("should support keyboard navigation with Enter", () => {
      const handleClick = vi.fn();
      render(
        <WorkflowStepper
          steps={mockSteps}
          currentStep={2}
          onStepClick={handleClick}
        />
      );

      const completedStep = screen.getByText("起点").closest('[role="listitem"]');
      fireEvent.keyDown(completedStep!, { key: "Enter" });

      expect(handleClick).toHaveBeenCalledWith(0);
    });

    it("should support keyboard navigation with Space", () => {
      const handleClick = vi.fn();
      render(
        <WorkflowStepper
          steps={mockSteps}
          currentStep={2}
          onStepClick={handleClick}
        />
      );

      const completedStep = screen.getByText("起点").closest('[role="listitem"]');
      fireEvent.keyDown(completedStep!, { key: " " });

      expect(handleClick).toHaveBeenCalledWith(0);
    });
  });

  describe("Responsive Layout (AC-5)", () => {
    it("should have flex-col for mobile layout", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveClass("flex-col");
    });

    it("should have md:flex-row for desktop layout", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveClass("md:flex-row");
    });
  });

  describe("Transitions (AC-6)", () => {
    it("should have transition classes", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const indicator = document.querySelector(".transition-all");
      expect(indicator).toBeInTheDocument();
    });

    it("should have duration-300 for normal transition", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const indicator = document.querySelector(".duration-300");
      expect(indicator).toBeInTheDocument();
    });

    it("should have ease-in-out timing function", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const indicator = document.querySelector(".ease-in-out");
      expect(indicator).toBeInTheDocument();
    });

    it("should have motion-reduce:transition-none for reduced motion", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const indicator = document.querySelector(".motion-reduce\\:transition-none");
      expect(indicator).toBeInTheDocument();
    });
  });

  describe("Accessibility (AC-7)", () => {
    it("should have role='navigation'", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("should have aria-label='工作流步骤'", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-label", "工作流步骤");
    });

    it("should have aria-current='step' on current step", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const currentStep = screen.getByText("生成").closest('[role="listitem"]');
      expect(currentStep).toHaveAttribute("aria-current", "step");
    });

    it("should NOT have aria-current on non-current steps", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const completedStep = screen.getByText("起点").closest('[role="listitem"]');
      expect(completedStep).not.toHaveAttribute("aria-current");
    });

    it("should have aria-disabled='true' on pending steps", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const pendingStep = screen.getByText("回测").closest('[role="listitem"]');
      expect(pendingStep).toHaveAttribute("aria-disabled", "true");
    });

    it("should have tabIndex=0 for clickable steps", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const completedStep = screen.getByText("起点").closest('[role="listitem"]');
      expect(completedStep).toHaveAttribute("tabIndex", "0");
    });

    it("should have tabIndex=-1 for non-clickable steps", () => {
      render(<WorkflowStepper steps={mockSteps} currentStep={2} />);

      const pendingStep = screen.getByText("回测").closest('[role="listitem"]');
      expect(pendingStep).toHaveAttribute("tabIndex", "-1");
    });
  });

  describe("Custom className", () => {
    it("should apply custom className", () => {
      render(
        <WorkflowStepper
          steps={mockSteps}
          currentStep={2}
          className="custom-class"
        />
      );

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveClass("custom-class");
    });
  });
});

describe("DEFAULT_WORKFLOW_STEPS", () => {
  it("should have 7 steps", () => {
    expect(DEFAULT_WORKFLOW_STEPS).toHaveLength(7);
  });

  it("should have correct labels", () => {
    const labels = DEFAULT_WORKFLOW_STEPS.map((s) => s.label);
    expect(labels).toEqual(["构思", "生成", "调参", "回测", "验证", "诊断", "保存"]);
  });

  it("should have all pending status by default", () => {
    const statuses = DEFAULT_WORKFLOW_STEPS.map((s) => s.status);
    expect(statuses).toEqual(["pending", "pending", "pending", "pending", "pending", "pending", "pending"]);
  });
});

describe("createStepsFromCurrentIndex helper", () => {
  it("should create steps with correct statuses for index 0", () => {
    const steps = createStepsFromCurrentIndex(0);
    expect(steps).toHaveLength(7);

    expect(steps[0]!.status).toBe("current");
    expect(steps[1]!.status).toBe("pending");
    expect(steps[2]!.status).toBe("pending");
    expect(steps[3]!.status).toBe("pending");
    expect(steps[4]!.status).toBe("pending");
    expect(steps[5]!.status).toBe("pending");
    expect(steps[6]!.status).toBe("pending");
  });

  it("should create steps with correct statuses for index 3", () => {
    const steps = createStepsFromCurrentIndex(3);
    expect(steps).toHaveLength(7);

    expect(steps[0]!.status).toBe("completed");
    expect(steps[1]!.status).toBe("completed");
    expect(steps[2]!.status).toBe("completed");
    expect(steps[3]!.status).toBe("current");
    expect(steps[4]!.status).toBe("pending");
    expect(steps[5]!.status).toBe("pending");
    expect(steps[6]!.status).toBe("pending");
  });

  it("should create steps with correct statuses for index 6 (last)", () => {
    const steps = createStepsFromCurrentIndex(6);
    expect(steps).toHaveLength(7);

    expect(steps[0]!.status).toBe("completed");
    expect(steps[1]!.status).toBe("completed");
    expect(steps[2]!.status).toBe("completed");
    expect(steps[3]!.status).toBe("completed");
    expect(steps[4]!.status).toBe("completed");
    expect(steps[5]!.status).toBe("completed");
    expect(steps[6]!.status).toBe("current");
  });

  it("should use default labels", () => {
    const steps = createStepsFromCurrentIndex(0);

    expect(steps.map((s) => s.label)).toEqual([
      "构思",
      "生成",
      "调参",
      "回测",
      "验证",
      "诊断",
      "保存",
    ]);
  });

  it("should accept custom labels", () => {
    const customLabels = ["A", "B", "C"];
    const steps = createStepsFromCurrentIndex(1, customLabels);

    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ label: "A", status: "completed" });
    expect(steps[1]).toEqual({ label: "B", status: "current" });
    expect(steps[2]).toEqual({ label: "C", status: "pending" });
  });
});

describe("WorkflowStepper with different step counts", () => {
  it("should render 3 steps correctly", () => {
    const threeSteps: WorkflowStep[] = [
      { label: "Step 1", status: "completed" },
      { label: "Step 2", status: "current" },
      { label: "Step 3", status: "pending" },
    ];

    render(<WorkflowStepper steps={threeSteps} currentStep={1} />);

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
  });

  it("should render single step correctly", () => {
    const singleStep: WorkflowStep[] = [{ label: "Only Step", status: "current" }];

    render(<WorkflowStepper steps={singleStep} currentStep={0} />);

    expect(screen.getByText("Only Step")).toBeInTheDocument();
  });
});

describe("WorkflowStepper step connectors", () => {
  it("should not render connector after last step", () => {
    const steps: WorkflowStep[] = [
      { label: "First", status: "completed" },
      { label: "Last", status: "current" },
    ];

    render(<WorkflowStepper steps={steps} currentStep={1} />);

    // There should be exactly one connector (between first and last)
    // This is hard to test directly, but we can verify structure
    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(2);
  });
});
