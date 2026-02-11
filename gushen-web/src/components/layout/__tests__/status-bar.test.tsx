/**
 * Status Bar Tests
 *
 * Tests for the StatusBar component (Story 1.3)
 * Validates:
 * - Component rendering
 * - All status variants
 * - Zustand store integration
 * - Accessibility attributes
 * - Conditional slot rendering
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "../status-bar";
import { useStatusBarStore } from "@/lib/stores/status-bar-store";

// Reset store before each test
beforeEach(() => {
  useStatusBarStore.getState().reset();
});

describe("StatusBar Component - Story 1.3", () => {
  describe("Component Rendering", () => {
    it("should render without errors", () => {
      const { container } = render(<StatusBar />);
      expect(container).toBeInTheDocument();
    });

    it("should have role='status' for accessibility", () => {
      render(<StatusBar />);
      const statusBar = screen.getByRole("status");
      expect(statusBar).toBeInTheDocument();
    });

    it("should have aria-live='polite' for screen readers", () => {
      render(<StatusBar />);
      const statusBar = screen.getByRole("status");
      expect(statusBar).toHaveAttribute("aria-live", "polite");
    });

    it("should have aria-label for status bar", () => {
      render(<StatusBar />);
      const statusBar = screen.getByRole("status");
      expect(statusBar).toHaveAttribute("aria-label", "系统状态栏");
    });

    it("should be fixed at bottom with correct height", () => {
      render(<StatusBar />);
      const statusBar = screen.getByRole("status");
      expect(statusBar).toHaveClass("fixed", "bottom-0", "h-7");
    });

    it("should be hidden on mobile (hidden md:flex)", () => {
      render(<StatusBar />);
      const statusBar = screen.getByRole("status");
      expect(statusBar).toHaveClass("hidden", "md:flex");
    });
  });

  describe("Save Status Slot (AC-2)", () => {
    it("should display '已保存' when status is saved", () => {
      useStatusBarStore.getState().setSaveStatus("saved");
      render(<StatusBar />);
      expect(screen.getByText("已保存")).toBeInTheDocument();
    });

    it("should display '保存中...' when status is saving", () => {
      useStatusBarStore.getState().setSaveStatus("saving");
      render(<StatusBar />);
      expect(screen.getByText("保存中...")).toBeInTheDocument();
    });

    it("should display '未保存' when status is unsaved", () => {
      useStatusBarStore.getState().setSaveStatus("unsaved");
      render(<StatusBar />);
      expect(screen.getByText("未保存")).toBeInTheDocument();
    });

    it("should display '保存失败' when status is error", () => {
      useStatusBarStore.getState().setSaveStatus("error");
      render(<StatusBar />);
      expect(screen.getByText("保存失败")).toBeInTheDocument();
    });

    it("should have green indicator for saved status", () => {
      useStatusBarStore.getState().setSaveStatus("saved");
      render(<StatusBar />);
      const indicator = document.querySelector(".bg-status-ready");
      expect(indicator).toBeInTheDocument();
    });

    it("should have blue indicator for saving status", () => {
      useStatusBarStore.getState().setSaveStatus("saving");
      render(<StatusBar />);
      const indicator = document.querySelector(".bg-primary");
      expect(indicator).toBeInTheDocument();
    });

    it("should have gray indicator for unsaved status", () => {
      useStatusBarStore.getState().setSaveStatus("unsaved");
      render(<StatusBar />);
      const indicator = document.querySelector(".bg-step-pending");
      expect(indicator).toBeInTheDocument();
    });

    it("should have red indicator for error status", () => {
      useStatusBarStore.getState().setSaveStatus("error");
      render(<StatusBar />);
      const indicator = document.querySelector(".bg-status-block");
      expect(indicator).toBeInTheDocument();
    });
  });

  describe("Data Source Slot (AC-3)", () => {
    it("should not render when dataSource is null", () => {
      useStatusBarStore.getState().setDataSource(null);
      render(<StatusBar />);
      expect(screen.queryByText("数据:")).not.toBeInTheDocument();
    });

    it("should display 'DB' for database source", () => {
      useStatusBarStore.getState().setDataSource("db");
      render(<StatusBar />);
      expect(screen.getByText("DB")).toBeInTheDocument();
      expect(screen.getByText("数据:")).toBeInTheDocument();
    });

    it("should display 'API' for API source", () => {
      useStatusBarStore.getState().setDataSource("api");
      render(<StatusBar />);
      expect(screen.getByText("API")).toBeInTheDocument();
    });

    it("should display '模拟' for simulated source", () => {
      useStatusBarStore.getState().setDataSource("simulated");
      render(<StatusBar />);
      expect(screen.getByText("模拟")).toBeInTheDocument();
    });

    it("should have blue color class for DB source", () => {
      useStatusBarStore.getState().setDataSource("db");
      render(<StatusBar />);
      const dbLabel = screen.getByText("DB");
      expect(dbLabel).toHaveClass("text-source-db");
    });

    it("should have yellow color class for API source", () => {
      useStatusBarStore.getState().setDataSource("api");
      render(<StatusBar />);
      const apiLabel = screen.getByText("API");
      expect(apiLabel).toHaveClass("text-source-api");
    });

    it("should have gray color class for simulated source", () => {
      useStatusBarStore.getState().setDataSource("simulated");
      render(<StatusBar />);
      const simLabel = screen.getByText("模拟");
      expect(simLabel).toHaveClass("text-source-sim");
    });
  });

  describe("Workflow Step Slot (AC-4)", () => {
    it("should not render when workflowStep is null", () => {
      useStatusBarStore.getState().setWorkflowStep(null);
      render(<StatusBar />);
      expect(screen.queryByText("步骤")).not.toBeInTheDocument();
    });

    it("should display workflow step when set", () => {
      useStatusBarStore.getState().setWorkflowStep({ current: 2, total: 4 });
      render(<StatusBar />);
      expect(screen.getByText("步骤")).toBeInTheDocument();
      expect(screen.getByText("2/4")).toBeInTheDocument();
    });

    it("should display correct step numbers", () => {
      useStatusBarStore.getState().setWorkflowStep({ current: 1, total: 5 });
      render(<StatusBar />);
      expect(screen.getByText("1/5")).toBeInTheDocument();
    });

    it("should have tabular-nums class for proper number alignment", () => {
      useStatusBarStore.getState().setWorkflowStep({ current: 3, total: 4 });
      render(<StatusBar />);
      const stepNumbers = screen.getByText("3/4");
      expect(stepNumbers).toHaveClass("tabular-nums");
    });
  });

  describe("Network Status Slot (AC-5)", () => {
    it("should display checkmark when online", () => {
      useStatusBarStore.getState().setNetworkStatus("online");
      render(<StatusBar />);
      expect(screen.getByText("✓")).toBeInTheDocument();
    });

    it("should display X and text when offline", () => {
      // Mock navigator.onLine so useNetworkStatusListener reads false
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      useStatusBarStore.getState().setNetworkStatus("offline");
      render(<StatusBar />);
      expect(screen.getByText("✕")).toBeInTheDocument();
      expect(screen.getByText("网络断开")).toBeInTheDocument();
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    });

    it("should have green color when online", () => {
      useStatusBarStore.getState().setNetworkStatus("online");
      render(<StatusBar />);
      const networkSlot = screen.getByText("✓").parentElement;
      expect(networkSlot).toHaveClass("text-status-ready");
    });

    it("should have red color when offline", () => {
      // Mock navigator.onLine so useNetworkStatusListener reads false
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      useStatusBarStore.getState().setNetworkStatus("offline");
      render(<StatusBar />);
      const networkSlot = screen.getByText("✕").parentElement;
      expect(networkSlot).toHaveClass("text-status-block");
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    });
  });

  describe("Dividers", () => {
    it("should render divider when dataSource is set", () => {
      useStatusBarStore.getState().setDataSource("db");
      render(<StatusBar />);
      const dividers = document.querySelectorAll(".bg-neutral-700");
      expect(dividers.length).toBeGreaterThan(0);
    });

    it("should render divider when workflowStep is set", () => {
      useStatusBarStore.getState().setWorkflowStep({ current: 1, total: 4 });
      render(<StatusBar />);
      const dividers = document.querySelectorAll(".bg-neutral-700");
      expect(dividers.length).toBeGreaterThan(0);
    });

    it("should have aria-hidden on dividers", () => {
      useStatusBarStore.getState().setDataSource("db");
      render(<StatusBar />);
      const divider = document.querySelector(".bg-neutral-700");
      expect(divider).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Zustand Store Integration (AC-8)", () => {
    it("should respond to save status changes", () => {
      const { rerender } = render(<StatusBar />);
      expect(screen.getByText("已保存")).toBeInTheDocument();

      useStatusBarStore.getState().setSaveStatus("saving");
      rerender(<StatusBar />);
      expect(screen.getByText("保存中...")).toBeInTheDocument();
    });

    it("should respond to data source changes", () => {
      const { rerender } = render(<StatusBar />);
      expect(screen.queryByText("DB")).not.toBeInTheDocument();

      useStatusBarStore.getState().setDataSource("db");
      rerender(<StatusBar />);
      expect(screen.getByText("DB")).toBeInTheDocument();
    });

    it("should respond to workflow step changes", () => {
      const { rerender } = render(<StatusBar />);
      expect(screen.queryByText("步骤")).not.toBeInTheDocument();

      useStatusBarStore.getState().setWorkflowStep({ current: 2, total: 4 });
      rerender(<StatusBar />);
      expect(screen.getByText("2/4")).toBeInTheDocument();
    });

    it("should respond to network status changes", () => {
      const { rerender } = render(<StatusBar />);
      expect(screen.getByText("✓")).toBeInTheDocument();

      // Mock navigator.onLine before setting offline
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      useStatusBarStore.getState().setNetworkStatus("offline");
      rerender(<StatusBar />);
      expect(screen.getByText("网络断开")).toBeInTheDocument();
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    });

    it("should reset to initial state", () => {
      // Mock navigator.onLine for offline state
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      useStatusBarStore.getState().setSaveStatus("error");
      useStatusBarStore.getState().setDataSource("api");
      useStatusBarStore.getState().setWorkflowStep({ current: 3, total: 5 });
      useStatusBarStore.getState().setNetworkStatus("offline");

      const { rerender } = render(<StatusBar />);
      expect(screen.getByText("保存失败")).toBeInTheDocument();
      expect(screen.getByText("API")).toBeInTheDocument();
      expect(screen.getByText("网络断开")).toBeInTheDocument();

      // Restore navigator.onLine before reset (reset sets online)
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      useStatusBarStore.getState().reset();
      rerender(<StatusBar />);

      expect(screen.getByText("已保存")).toBeInTheDocument();
      expect(screen.queryByText("API")).not.toBeInTheDocument();
      expect(screen.queryByText("网络断开")).not.toBeInTheDocument();
    });
  });

  describe("Combined State Scenarios", () => {
    it("should display all slots when all are set", () => {
      useStatusBarStore.getState().setSaveStatus("saving");
      useStatusBarStore.getState().setDataSource("api");
      useStatusBarStore.getState().setWorkflowStep({ current: 2, total: 4 });
      useStatusBarStore.getState().setNetworkStatus("online");

      render(<StatusBar />);

      expect(screen.getByText("保存中...")).toBeInTheDocument();
      expect(screen.getByText("API")).toBeInTheDocument();
      expect(screen.getByText("2/4")).toBeInTheDocument();
      expect(screen.getByText("✓")).toBeInTheDocument();
    });

    it("should display only required slots when optional ones are null", () => {
      useStatusBarStore.getState().setSaveStatus("saved");
      useStatusBarStore.getState().setDataSource(null);
      useStatusBarStore.getState().setWorkflowStep(null);
      useStatusBarStore.getState().setNetworkStatus("online");

      render(<StatusBar />);

      expect(screen.getByText("已保存")).toBeInTheDocument();
      expect(screen.queryByText("数据:")).not.toBeInTheDocument();
      expect(screen.queryByText("步骤")).not.toBeInTheDocument();
      expect(screen.getByText("✓")).toBeInTheDocument();
    });
  });
});

describe("StatusBar Store", () => {
  beforeEach(() => {
    useStatusBarStore.getState().reset();
  });

  describe("Initial State", () => {
    it("should have correct initial save status", () => {
      expect(useStatusBarStore.getState().saveStatus).toBe("saved");
    });

    it("should have null initial data source", () => {
      expect(useStatusBarStore.getState().dataSource).toBeNull();
    });

    it("should have null initial workflow step", () => {
      expect(useStatusBarStore.getState().workflowStep).toBeNull();
    });

    it("should have online initial network status", () => {
      expect(useStatusBarStore.getState().networkStatus).toBe("online");
    });
  });

  describe("Actions", () => {
    it("should update save status", () => {
      useStatusBarStore.getState().setSaveStatus("error");
      expect(useStatusBarStore.getState().saveStatus).toBe("error");
    });

    it("should update data source", () => {
      useStatusBarStore.getState().setDataSource("db");
      expect(useStatusBarStore.getState().dataSource).toBe("db");
    });

    it("should clear data source", () => {
      useStatusBarStore.getState().setDataSource("db");
      useStatusBarStore.getState().setDataSource(null);
      expect(useStatusBarStore.getState().dataSource).toBeNull();
    });

    it("should update workflow step", () => {
      useStatusBarStore.getState().setWorkflowStep({ current: 3, total: 5 });
      expect(useStatusBarStore.getState().workflowStep).toEqual({ current: 3, total: 5 });
    });

    it("should clear workflow step", () => {
      useStatusBarStore.getState().setWorkflowStep({ current: 1, total: 4 });
      useStatusBarStore.getState().setWorkflowStep(null);
      expect(useStatusBarStore.getState().workflowStep).toBeNull();
    });

    it("should update network status", () => {
      useStatusBarStore.getState().setNetworkStatus("offline");
      expect(useStatusBarStore.getState().networkStatus).toBe("offline");
    });
  });

  describe("Selectors", () => {
    it("should export selectSaveStatus selector", async () => {
      const { selectSaveStatus } = await import("@/lib/stores/status-bar-store");
      useStatusBarStore.getState().setSaveStatus("saving");
      expect(selectSaveStatus(useStatusBarStore.getState())).toBe("saving");
    });

    it("should export selectDataSource selector", async () => {
      const { selectDataSource } = await import("@/lib/stores/status-bar-store");
      useStatusBarStore.getState().setDataSource("api");
      expect(selectDataSource(useStatusBarStore.getState())).toBe("api");
    });

    it("should export selectWorkflowStep selector", async () => {
      const { selectWorkflowStep } = await import("@/lib/stores/status-bar-store");
      useStatusBarStore.getState().setWorkflowStep({ current: 2, total: 4 });
      expect(selectWorkflowStep(useStatusBarStore.getState())).toEqual({ current: 2, total: 4 });
    });

    it("should export selectNetworkStatus selector", async () => {
      const { selectNetworkStatus } = await import("@/lib/stores/status-bar-store");
      useStatusBarStore.getState().setNetworkStatus("offline");
      expect(selectNetworkStatus(useStatusBarStore.getState())).toBe("offline");
    });
  });
});
