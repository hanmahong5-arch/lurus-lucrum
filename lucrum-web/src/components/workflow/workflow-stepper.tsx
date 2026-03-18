/**
 * Workflow Stepper Component
 * 工作流步骤导航组件
 *
 * Displays workflow progress with 7 steps:
 * ① 构思 → ② 生成 → ③ 调参 → ④ 回测 → ⑤ 验证 → ⑥ 诊断 → ⑦ 保存
 *
 * Supports horizontal (desktop) and vertical (mobile) layouts.
 *
 * Story 1.5: 工作流步骤导航
 */

"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types / 类型
// =============================================================================

/**
 * Step status types
 */
export type StepStatus = "completed" | "current" | "pending" | "error";

/**
 * Workflow step configuration
 */
export interface WorkflowStep {
  /** Step label text */
  label: string;
  /** Step status */
  status: StepStatus;
}

/**
 * WorkflowStepper component props
 */
export interface WorkflowStepperProps {
  /** Array of workflow steps */
  steps: WorkflowStep[];
  /** Current active step index (0-based) */
  currentStep: number;
  /** Callback when a step is clicked */
  onStepClick?: (index: number) => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Default Steps / 默认步骤
// =============================================================================

/**
 * Default workflow steps for strategy workflow
 */
export const DEFAULT_WORKFLOW_STEPS: WorkflowStep[] = [
  { label: "构思", status: "pending" },
  { label: "生成", status: "pending" },
  { label: "调参", status: "pending" },
  { label: "回测", status: "pending" },
  { label: "验证", status: "pending" },
  { label: "诊断", status: "pending" },
  { label: "保存", status: "pending" },
];

// =============================================================================
// Step Indicator Component
// =============================================================================

interface StepIndicatorProps {
  index: number;
  status: StepStatus;
}

function StepIndicator({ index, status }: StepIndicatorProps) {
  const baseClasses =
    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ease-in-out motion-reduce:transition-none";

  const statusClasses: Record<StepStatus, string> = {
    completed: "bg-step-done text-white",
    current: "bg-step-active text-white ring-2 ring-step-active ring-offset-2 ring-offset-void",
    pending: "bg-step-pending/20 text-step-pending border border-step-pending",
    error: "bg-status-block text-white",
  };

  return (
    <div className={cn(baseClasses, statusClasses[status])}>
      {status === "completed" ? (
        <Check className="w-4 h-4" aria-hidden="true" />
      ) : status === "error" ? (
        <X className="w-4 h-4" aria-hidden="true" />
      ) : (
        <span>{index}</span>
      )}
    </div>
  );
}

// =============================================================================
// Step Connector Component
// =============================================================================

interface StepConnectorProps {
  isCompleted: boolean;
}

/**
 * StepConnector - Horizontal line connecting workflow steps
 *
 * Note: Responsive layout (horizontal on desktop, vertical on mobile)
 * is handled via CSS flex-direction, not via component logic.
 * The connector uses CSS classes that adapt to the flex container.
 */
function StepConnector({ isCompleted }: StepConnectorProps) {
  return (
    <div
      className={cn(
        "transition-all duration-300 ease-in-out motion-reduce:transition-none",
        // Horizontal connector - CSS flex handles responsive stacking
        "flex-1 h-0.5 mx-2",
        // Hidden on mobile where steps stack vertically
        "hidden md:block",
        isCompleted ? "bg-step-done" : "border-t-2 border-dashed border-step-pending"
      )}
      aria-hidden="true"
    />
  );
}

// =============================================================================
// Single Step Component
// =============================================================================

interface SingleStepProps {
  step: WorkflowStep;
  index: number;
  isLast: boolean;
  isClickable: boolean;
  isCurrent: boolean;
  onClick?: () => void;
}

/**
 * SingleStep - Individual step in the workflow
 *
 * Layout is responsive via CSS:
 * - Desktop (md+): Horizontal layout (flex-col for indicator+label stacked)
 * - Mobile (<md): Vertical stacking handled by parent flex-col
 */
function SingleStep({
  step,
  index,
  isLast,
  isClickable,
  isCurrent,
  onClick,
}: SingleStepProps) {
  const handleClick = () => {
    if (isClickable && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && isClickable && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // Determine if step should show completed connector
  const showCompletedConnector = step.status === "completed";

  return (
    <>
      <div
        role="listitem"
        aria-current={isCurrent ? "step" : undefined}
        aria-disabled={!isClickable}
        tabIndex={isClickable ? 0 : -1}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-2 transition-opacity duration-300 ease-in-out motion-reduce:transition-none",
          // Desktop: indicator on top, label below (flex-col)
          // Mobile: indicator left, label right (flex-row)
          "flex-row md:flex-col",
          isClickable ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-60"
        )}
      >
        <StepIndicator index={index} status={step.status} />
        <span
          className={cn(
            "text-xs font-medium transition-colors duration-300 ease-in-out motion-reduce:transition-none",
            step.status === "completed" && "text-step-done",
            step.status === "current" && "text-step-active",
            step.status === "pending" && "text-step-pending",
            step.status === "error" && "text-status-block"
          )}
        >
          {step.label}
        </span>
      </div>

      {/* Connector to next step (hidden on mobile) */}
      {!isLast && (
        <StepConnector isCompleted={showCompletedConnector} />
      )}
    </>
  );
}

// =============================================================================
// Main WorkflowStepper Component
// =============================================================================

/**
 * WorkflowStepper - Workflow step navigation component
 *
 * Displays workflow progress with support for:
 * - 4 step states: completed, current, pending, error
 * - Horizontal (desktop) and vertical (mobile) layouts
 * - Click navigation to completed/current steps
 * - Accessible keyboard navigation
 *
 * @example
 * ```tsx
 * import { WorkflowStepper, DEFAULT_WORKFLOW_STEPS } from '@/components/workflow/workflow-stepper';
 *
 * const [steps, setSteps] = useState(DEFAULT_WORKFLOW_STEPS);
 *
 * <WorkflowStepper
 *   steps={steps}
 *   currentStep={2}
 *   onStepClick={(index) => console.log('Navigate to step', index)}
 * />
 * ```
 */
export function WorkflowStepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: WorkflowStepperProps) {
  return (
    <nav
      role="navigation"
      aria-label="工作流步骤"
      className={cn(
        // Base layout
        "flex items-center",
        // Responsive: vertical on mobile, horizontal on desktop
        "flex-col md:flex-row",
        // Spacing
        "gap-1 md:gap-0",
        // Padding
        "p-4",
        className
      )}
    >
      <div
        role="list"
        className={cn(
          "flex items-center",
          // Responsive layout
          "flex-col md:flex-row",
          // Spacing
          "gap-1 md:gap-0",
          // Full width on desktop
          "w-full md:w-auto"
        )}
      >
        {steps.map((step, index) => {
          const isClickable = step.status !== "pending";
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <SingleStep
              key={`step-${index}-${step.label}`}
              step={step}
              index={index}
              isLast={isLast}
              isClickable={isClickable}
              isCurrent={isCurrent}
              onClick={onStepClick ? () => onStepClick(index) : undefined}
            />
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Helper function to create steps with proper status based on current step
 */
export function createStepsFromCurrentIndex(
  currentIndex: number,
  labels: string[] = ["构思", "生成", "调参", "回测", "验证", "诊断", "保存"]
): WorkflowStep[] {
  return labels.map((label, index) => ({
    label,
    status:
      index < currentIndex
        ? "completed"
        : index === currentIndex
          ? "current"
          : "pending",
  }));
}

export default WorkflowStepper;
