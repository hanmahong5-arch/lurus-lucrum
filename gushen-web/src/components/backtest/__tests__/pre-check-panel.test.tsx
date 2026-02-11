/**
 * PreCheckPanel Component Tests
 *
 * Tests:
 * - All-pass / partial-pass / all-fail rendering
 * - Three-state light colors (ready/warn/block)
 * - Click-to-focus callbacks
 * - Button linkage (enabled/disabled)
 * - Real-time status updates
 * - Aria attributes (aria-live, aria-label)
 * - usePreCheckConditions hook logic
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PreCheckPanel,
  usePreCheckConditions,
  type PreCheckItem,
  type CheckStatus,
} from "../pre-check-panel";
import { renderHook } from "@testing-library/react";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const ALL_PASS_INPUT = {
  strategyCode: 'class MyStrategy(CtaTemplate):\n  pass',
  symbol: "600519",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  initialCapital: 100000,
};

const ALL_FAIL_INPUT = {
  strategyCode: "",
  symbol: "",
  startDate: "",
  endDate: "",
  initialCapital: 0,
};

const PARTIAL_INPUT = {
  strategyCode: 'class MyStrategy(CtaTemplate):\n  pass',
  symbol: "600519",
  startDate: "",
  endDate: "",
  initialCapital: 100000,
};

// =============================================================================
// usePreCheckConditions HOOK TESTS
// =============================================================================

describe("usePreCheckConditions", () => {
  it("returns all-ready when all conditions are met", () => {
    const { result } = renderHook(() => usePreCheckConditions(ALL_PASS_INPUT));
    const items = result.current;

    expect(items).toHaveLength(4);
    items.forEach((item) => {
      expect(item.status).toBe("ready");
    });
  });

  it("returns all-block when all conditions fail", () => {
    const { result } = renderHook(() => usePreCheckConditions(ALL_FAIL_INPUT));
    const items = result.current;

    expect(items).toHaveLength(4);
    items.forEach((item) => {
      expect(item.status).toBe("block");
    });
  });

  it("returns mixed statuses for partial input", () => {
    const { result } = renderHook(() => usePreCheckConditions(PARTIAL_INPUT));
    const items = result.current;

    // Strategy code: ready
    expect(items.find((i) => i.id === "strategy")?.status).toBe("ready");
    // Symbol: ready
    expect(items.find((i) => i.id === "target")?.status).toBe("ready");
    // Date range: block (both empty)
    expect(items.find((i) => i.id === "dateRange")?.status).toBe("block");
    // Capital: ready
    expect(items.find((i) => i.id === "capital")?.status).toBe("ready");
  });

  it("returns warn status for low capital (< 10000)", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({ ...ALL_PASS_INPUT, initialCapital: 5000 }),
    );
    const capitalItem = result.current.find((i) => i.id === "capital");
    expect(capitalItem?.status).toBe("warn");
  });

  it("returns warn status for short date range (< 30 days)", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({
        ...ALL_PASS_INPUT,
        startDate: "2024-01-01",
        endDate: "2024-01-20",
      }),
    );
    const dateItem = result.current.find((i) => i.id === "dateRange");
    expect(dateItem?.status).toBe("warn");
  });

  it("returns block when only startDate is missing", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({ ...ALL_PASS_INPUT, startDate: "" }),
    );
    const dateItem = result.current.find((i) => i.id === "dateRange");
    expect(dateItem?.status).toBe("block");
  });

  it("returns block when initialCapital is negative", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({ ...ALL_PASS_INPUT, initialCapital: -1000 }),
    );
    const capitalItem = result.current.find((i) => i.id === "capital");
    expect(capitalItem?.status).toBe("block");
  });

  it("each item has a focusField property", () => {
    const { result } = renderHook(() => usePreCheckConditions(ALL_PASS_INPUT));
    const fields = result.current.map((i) => i.focusField);
    expect(fields).toEqual(["strategy", "target", "dateRange", "capital"]);
  });

  // Boundary value tests (M1, M2 review fixes)
  it("returns ready when initialCapital equals threshold (10000)", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({ ...ALL_PASS_INPUT, initialCapital: 10000 }),
    );
    const capitalItem = result.current.find((i) => i.id === "capital");
    expect(capitalItem?.status).toBe("ready");
  });

  it("returns block when startDate equals endDate (0 days)", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({
        ...ALL_PASS_INPUT,
        startDate: "2024-06-15",
        endDate: "2024-06-15",
      }),
    );
    const dateItem = result.current.find((i) => i.id === "dateRange");
    expect(dateItem?.status).toBe("block");
  });

  it("returns block when endDate is before startDate (negative range)", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({
        ...ALL_PASS_INPUT,
        startDate: "2024-06-15",
        endDate: "2024-01-01",
      }),
    );
    const dateItem = result.current.find((i) => i.id === "dateRange");
    expect(dateItem?.status).toBe("block");
  });

  it("returns warn when date range is exactly 1 day", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({
        ...ALL_PASS_INPUT,
        startDate: "2024-06-15",
        endDate: "2024-06-16",
      }),
    );
    const dateItem = result.current.find((i) => i.id === "dateRange");
    expect(dateItem?.status).toBe("warn");
  });

  it("returns ready when date range is exactly 30 days", () => {
    const { result } = renderHook(() =>
      usePreCheckConditions({
        ...ALL_PASS_INPUT,
        startDate: "2024-06-01",
        endDate: "2024-07-01",
      }),
    );
    const dateItem = result.current.find((i) => i.id === "dateRange");
    expect(dateItem?.status).toBe("ready");
  });
});

// =============================================================================
// PreCheckPanel COMPONENT TESTS
// =============================================================================

describe("PreCheckPanel", () => {
  const allReadyItems: PreCheckItem[] = [
    { id: "strategy", label: "策略代码有效", status: "ready", focusField: "strategy" },
    { id: "target", label: "已选择回测标的", status: "ready", detail: "600519", focusField: "target" },
    { id: "dateRange", label: "已设置日期范围", status: "ready", focusField: "dateRange" },
    { id: "capital", label: "初始资金已配置", status: "ready", focusField: "capital" },
  ];

  const mixedItems: PreCheckItem[] = [
    { id: "strategy", label: "策略代码有效", status: "ready", focusField: "strategy" },
    { id: "target", label: "已选择回测标的", status: "block", focusField: "target" },
    { id: "dateRange", label: "已设置日期范围", status: "warn", focusField: "dateRange" },
    { id: "capital", label: "初始资金已配置", status: "ready", focusField: "capital" },
  ];

  const allBlockItems: PreCheckItem[] = [
    { id: "strategy", label: "策略代码有效", status: "block", focusField: "strategy" },
    { id: "target", label: "已选择回测标的", status: "block", focusField: "target" },
    { id: "dateRange", label: "已设置日期范围", status: "block", focusField: "dateRange" },
    { id: "capital", label: "初始资金已配置", status: "block", focusField: "capital" },
  ];

  describe("rendering", () => {
    it("renders all 4 check items", () => {
      render(<PreCheckPanel items={allReadyItems} />);
      expect(screen.getByText("策略代码有效")).toBeInTheDocument();
      expect(screen.getByText("已选择回测标的")).toBeInTheDocument();
      expect(screen.getByText("已设置日期范围")).toBeInTheDocument();
      expect(screen.getByText("初始资金已配置")).toBeInTheDocument();
    });

    it("renders panel title", () => {
      render(<PreCheckPanel items={allReadyItems} />);
      expect(screen.getByText("执行前检查")).toBeInTheDocument();
    });
  });

  describe("three-state lights", () => {
    it("renders green indicators for ready status", () => {
      const { container } = render(<PreCheckPanel items={allReadyItems} />);
      const lights = container.querySelectorAll("[data-status='ready']");
      expect(lights.length).toBe(4);
    });

    it("renders red indicators for block status", () => {
      const { container } = render(<PreCheckPanel items={allBlockItems} />);
      const lights = container.querySelectorAll("[data-status='block']");
      expect(lights.length).toBe(4);
    });

    it("renders mixed indicators correctly", () => {
      const { container } = render(<PreCheckPanel items={mixedItems} />);
      expect(container.querySelectorAll("[data-status='ready']").length).toBe(2);
      expect(container.querySelectorAll("[data-status='block']").length).toBe(1);
      expect(container.querySelectorAll("[data-status='warn']").length).toBe(1);
    });
  });

  describe("click-to-focus", () => {
    it("calls onFocusField with correct field when clicking a block item", () => {
      const onFocusField = vi.fn();
      render(<PreCheckPanel items={mixedItems} onFocusField={onFocusField} />);

      // Click the "已选择回测标的" item which is in block status
      fireEvent.click(screen.getByText("已选择回测标的"));
      expect(onFocusField).toHaveBeenCalledWith("target");
    });

    it("calls onFocusField when clicking a warn item", () => {
      const onFocusField = vi.fn();
      render(<PreCheckPanel items={mixedItems} onFocusField={onFocusField} />);

      fireEvent.click(screen.getByText("已设置日期范围"));
      expect(onFocusField).toHaveBeenCalledWith("dateRange");
    });

    it("does not call onFocusField when clicking a ready item", () => {
      const onFocusField = vi.fn();
      render(<PreCheckPanel items={allReadyItems} onFocusField={onFocusField} />);

      fireEvent.click(screen.getByText("策略代码有效"));
      expect(onFocusField).not.toHaveBeenCalled();
    });
  });

  describe("allReady computation", () => {
    it("reports allReady=true when all items are ready", () => {
      const { container } = render(<PreCheckPanel items={allReadyItems} />);
      expect(container.querySelector("[data-all-ready='true']")).toBeInTheDocument();
    });

    it("reports allReady=false when any item is block", () => {
      const { container } = render(<PreCheckPanel items={mixedItems} />);
      expect(container.querySelector("[data-all-ready='false']")).toBeInTheDocument();
    });
  });

  describe("hasBlocker computation", () => {
    it("reports hasBlocker=true when any item is block", () => {
      const { container } = render(<PreCheckPanel items={mixedItems} />);
      expect(container.querySelector("[data-has-blocker='true']")).toBeInTheDocument();
    });

    it("reports hasBlocker=false when no items are block (warn is not a blocker)", () => {
      const warnOnlyItems: PreCheckItem[] = allReadyItems.map((item, i) =>
        i === 0 ? { ...item, status: "warn" as CheckStatus } : item,
      );
      const { container } = render(<PreCheckPanel items={warnOnlyItems} />);
      expect(container.querySelector("[data-has-blocker='false']")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has aria-live=polite on the checklist container", () => {
      render(<PreCheckPanel items={allReadyItems} />);
      const checklist = screen.getByRole("list");
      expect(checklist).toHaveAttribute("aria-live", "polite");
    });

    it("each item has descriptive aria-label", () => {
      render(<PreCheckPanel items={allReadyItems} />);
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveAttribute(
        "aria-label",
        expect.stringContaining("策略代码有效"),
      );
      expect(items[0]).toHaveAttribute(
        "aria-label",
        expect.stringContaining("就绪"),
      );
    });

    it("block items have aria-label with blocked status description", () => {
      render(<PreCheckPanel items={allBlockItems} />);
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveAttribute(
        "aria-label",
        expect.stringContaining("未完成"),
      );
    });
  });

  describe("detail text", () => {
    it("renders detail text when provided", () => {
      const items: PreCheckItem[] = [
        { id: "target", label: "已选择回测标的", status: "ready", detail: "600519 贵州茅台", focusField: "target" },
      ];
      render(<PreCheckPanel items={items} />);
      expect(screen.getByText("600519 贵州茅台")).toBeInTheDocument();
    });
  });
});
