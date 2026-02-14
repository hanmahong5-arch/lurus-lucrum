/**
 * BatchProgressBar Component Tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BatchProgressBar } from "../batch-progress-bar";

describe("BatchProgressBar", () => {
  it("should not render when idle", () => {
    const { container } = render(
      <BatchProgressBar status="idle" completed={0} total={0} failed={0} elapsedMs={0} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("should render progress when running", () => {
    render(
      <BatchProgressBar status="running" completed={5} total={20} failed={1} elapsedMs={3000} currentItem="600519" />,
    );
    expect(screen.getByTestId("batch-progress-bar")).toBeTruthy();
    expect(screen.getByText("5/20")).toBeTruthy();
  });

  it("should show failed badge when failures exist", () => {
    render(
      <BatchProgressBar status="running" completed={10} total={20} failed={3} elapsedMs={5000} />,
    );
    const badge = screen.getByTestId("failed-badge");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain("3");
  });

  it("should not show failed badge when no failures", () => {
    render(
      <BatchProgressBar status="running" completed={10} total={20} failed={0} elapsedMs={5000} />,
    );
    expect(screen.queryByTestId("failed-badge")).toBeNull();
  });

  it("should show cancel button when running", () => {
    const onCancel = vi.fn();
    render(
      <BatchProgressBar status="running" completed={5} total={20} failed={0} elapsedMs={3000} onCancel={onCancel} />,
    );
    const btn = screen.getByTestId("cancel-button");
    fireEvent.click(btn);
    expect(onCancel).toHaveBeenCalled();
  });

  it("should not show cancel button when complete", () => {
    render(
      <BatchProgressBar status="complete" completed={20} total={20} failed={0} elapsedMs={10000} onCancel={vi.fn()} />,
    );
    expect(screen.queryByTestId("cancel-button")).toBeNull();
  });

  it("should show correct progress bar width", () => {
    render(
      <BatchProgressBar status="running" completed={10} total={20} failed={0} elapsedMs={5000} />,
    );
    const fill = screen.getByTestId("progress-fill");
    expect(fill.style.width).toBe("50%");
  });
});
