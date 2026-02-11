/**
 * Empty State Tests
 *
 * Tests for the EmptyState component (Story 1.4)
 * Validates:
 * - Component rendering with various props
 * - All 5 preset scenarios
 * - Action button callbacks
 * - Accessibility attributes
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileCode, BarChart3, Folder, MessageCircle, Globe, Star } from "lucide-react";
import { EmptyState } from "../empty-state";
import {
  emptyEditorPreset,
  noBacktestHistoryPreset,
  emptyStrategyListPreset,
  aiNoContextPreset,
  discoveryNoDataPreset,
  getPreset,
  allPresets,
} from "../empty-state-presets";

describe("EmptyState Component - Story 1.4", () => {
  describe("Basic Rendering (AC-1)", () => {
    it("should render with icon and title", () => {
      render(<EmptyState icon={FileCode} title="Test Title" />);

      expect(screen.getByText("Test Title")).toBeInTheDocument();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should render icon with correct size classes", () => {
      render(<EmptyState icon={Star} title="Test" />);

      const svg = document.querySelector("svg");
      expect(svg).toHaveClass("w-12", "h-12");
    });

    it("should render icon with muted color", () => {
      render(<EmptyState icon={Star} title="Test" />);

      const svg = document.querySelector("svg");
      expect(svg).toHaveClass("text-neutral-500");
    });

    it("should render title with correct styling", () => {
      render(<EmptyState icon={Star} title="My Title" />);

      const title = screen.getByText("My Title");
      expect(title).toHaveClass("text-sm", "text-neutral-400");
    });

    it("should have top padding for breathing space", () => {
      render(<EmptyState icon={Star} title="Test" />);

      const container = screen.getByRole("status");
      expect(container).toHaveClass("pt-8");
    });

    it("should have max width constraint", () => {
      render(<EmptyState icon={Star} title="Test" />);

      const container = screen.getByRole("status");
      expect(container).toHaveClass("max-w-sm");
    });

    it("should center content with flexbox", () => {
      render(<EmptyState icon={Star} title="Test" />);

      const container = screen.getByRole("status");
      expect(container).toHaveClass("flex", "flex-col", "items-center", "justify-center");
    });
  });

  describe("Description Rendering (AC-1)", () => {
    it("should render description when provided", () => {
      render(
        <EmptyState
          icon={Star}
          title="Title"
          description="This is a description"
        />
      );

      expect(screen.getByText("This is a description")).toBeInTheDocument();
    });

    it("should not render description when not provided", () => {
      render(<EmptyState icon={Star} title="Title" />);

      const paragraphs = document.querySelectorAll("p");
      expect(paragraphs.length).toBe(0);
    });

    it("should render description with correct styling", () => {
      render(
        <EmptyState icon={Star} title="Title" description="Description text" />
      );

      const description = screen.getByText("Description text");
      expect(description).toHaveClass("text-xs", "text-neutral-500");
    });
  });

  describe("Action Buttons (AC-2)", () => {
    it("should render primary action button", () => {
      const handleClick = vi.fn();

      render(
        <EmptyState
          icon={Star}
          title="Title"
          actions={[{ label: "Primary Action", onClick: handleClick, variant: "primary" }]}
        />
      );

      expect(screen.getByRole("button", { name: "Primary Action" })).toBeInTheDocument();
    });

    it("should render ghost action button", () => {
      const handleClick = vi.fn();

      render(
        <EmptyState
          icon={Star}
          title="Title"
          actions={[{ label: "Ghost Action", onClick: handleClick, variant: "ghost" }]}
        />
      );

      expect(screen.getByRole("button", { name: "Ghost Action" })).toBeInTheDocument();
    });

    it("should render multiple action buttons", () => {
      render(
        <EmptyState
          icon={Star}
          title="Title"
          actions={[
            { label: "First", onClick: vi.fn(), variant: "primary" },
            { label: "Second", onClick: vi.fn(), variant: "ghost" },
          ]}
        />
      );

      expect(screen.getByRole("button", { name: "First" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Second" })).toBeInTheDocument();
    });

    it("should call onClick when button is clicked", () => {
      const handleClick = vi.fn();

      render(
        <EmptyState
          icon={Star}
          title="Title"
          actions={[{ label: "Click Me", onClick: handleClick }]}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Click Me" }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should call correct onClick for each button", () => {
      const handleFirst = vi.fn();
      const handleSecond = vi.fn();

      render(
        <EmptyState
          icon={Star}
          title="Title"
          actions={[
            { label: "First", onClick: handleFirst },
            { label: "Second", onClick: handleSecond },
          ]}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "First" }));
      expect(handleFirst).toHaveBeenCalledTimes(1);
      expect(handleSecond).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Second" }));
      expect(handleSecond).toHaveBeenCalledTimes(1);
    });

    it("should default to primary variant when not specified", () => {
      render(
        <EmptyState
          icon={Star}
          title="Title"
          actions={[{ label: "Default", onClick: vi.fn() }]}
        />
      );

      const button = screen.getByRole("button", { name: "Default" });
      expect(button).toHaveClass("bg-primary");
    });

    it("should apply btn-tactile class to buttons", () => {
      render(
        <EmptyState
          icon={Star}
          title="Title"
          actions={[{ label: "Tactile", onClick: vi.fn() }]}
        />
      );

      const button = screen.getByRole("button", { name: "Tactile" });
      expect(button).toHaveClass("btn-tactile");
    });

    it("should not render actions section when no actions provided", () => {
      render(<EmptyState icon={Star} title="Title" />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("should not render actions section when empty array provided", () => {
      render(<EmptyState icon={Star} title="Title" actions={[]} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility (AC-6)", () => {
    it("should have role='status'", () => {
      render(<EmptyState icon={Star} title="Test" />);

      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should have aria-label with title", () => {
      render(<EmptyState icon={Star} title="My Status Title" />);

      const container = screen.getByRole("status");
      expect(container).toHaveAttribute("aria-label", "My Status Title");
    });

    it("should have aria-hidden on icon", () => {
      render(<EmptyState icon={Star} title="Test" />);

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("should have accessible buttons", () => {
      render(
        <EmptyState
          icon={Star}
          title="Test"
          actions={[{ label: "Accessible Button", onClick: vi.fn() }]}
        />
      );

      const button = screen.getByRole("button", { name: "Accessible Button" });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("should apply custom className", () => {
      render(
        <EmptyState icon={Star} title="Test" className="custom-class" />
      );

      const container = screen.getByRole("status");
      expect(container).toHaveClass("custom-class");
    });

    it("should merge custom className with default classes", () => {
      render(
        <EmptyState icon={Star} title="Test" className="my-custom" />
      );

      const container = screen.getByRole("status");
      expect(container).toHaveClass("flex", "my-custom");
    });
  });
});

describe("EmptyState Presets - Story 1.4 (AC-4)", () => {
  describe("emptyEditorPreset", () => {
    it("should have FileCode icon", () => {
      expect(emptyEditorPreset.icon).toBe(FileCode);
    });

    it("should have correct title", () => {
      expect(emptyEditorPreset.title).toBe("开始创建你的第一个策略");
    });

    it("should have description", () => {
      expect(emptyEditorPreset.description).toBeDefined();
    });

    it("should have two actions: 新建 (primary) and 浏览模板 (ghost)", () => {
      expect(emptyEditorPreset.actions).toHaveLength(2);
      expect(emptyEditorPreset.actions[0]).toEqual({ label: "新建", variant: "primary" });
      expect(emptyEditorPreset.actions[1]).toEqual({ label: "浏览模板", variant: "ghost" });
    });
  });

  describe("noBacktestHistoryPreset", () => {
    it("should have BarChart3 icon", () => {
      expect(noBacktestHistoryPreset.icon).toBe(BarChart3);
    });

    it("should have correct title", () => {
      expect(noBacktestHistoryPreset.title).toBe("还没有回测记录");
    });

    it("should have one action: 运行第一次回测 (primary)", () => {
      expect(noBacktestHistoryPreset.actions).toHaveLength(1);
      expect(noBacktestHistoryPreset.actions[0]).toEqual({
        label: "运行第一次回测",
        variant: "primary",
      });
    });
  });

  describe("emptyStrategyListPreset", () => {
    it("should have Folder icon", () => {
      expect(emptyStrategyListPreset.icon).toBe(Folder);
    });

    it("should have correct title", () => {
      expect(emptyStrategyListPreset.title).toBe("还没有保存的策略");
    });

    it("should have two actions: 新建 (primary) and 导入 (ghost)", () => {
      expect(emptyStrategyListPreset.actions).toHaveLength(2);
      expect(emptyStrategyListPreset.actions[0]).toEqual({ label: "新建", variant: "primary" });
      expect(emptyStrategyListPreset.actions[1]).toEqual({ label: "导入", variant: "ghost" });
    });
  });

  describe("aiNoContextPreset", () => {
    it("should have MessageCircle icon", () => {
      expect(aiNoContextPreset.icon).toBe(MessageCircle);
    });

    it("should have correct title", () => {
      expect(aiNoContextPreset.title).toBe("先回测，AI 分析更精准");
    });

    it("should have two actions: 去回测 (primary) and 直接提问 (ghost)", () => {
      expect(aiNoContextPreset.actions).toHaveLength(2);
      expect(aiNoContextPreset.actions[0]).toEqual({ label: "去回测", variant: "primary" });
      expect(aiNoContextPreset.actions[1]).toEqual({ label: "直接提问", variant: "ghost" });
    });
  });

  describe("discoveryNoDataPreset", () => {
    it("should have Globe icon", () => {
      expect(discoveryNoDataPreset.icon).toBe(Globe);
    });

    it("should have correct title", () => {
      expect(discoveryNoDataPreset.title).toBe("暂时无法获取最新策略");
    });

    it("should have two actions: 显示缓存 (primary) and 刷新 (ghost)", () => {
      expect(discoveryNoDataPreset.actions).toHaveLength(2);
      expect(discoveryNoDataPreset.actions[0]).toEqual({ label: "显示缓存", variant: "primary" });
      expect(discoveryNoDataPreset.actions[1]).toEqual({ label: "刷新", variant: "ghost" });
    });
  });

  describe("getPreset helper", () => {
    it("should return emptyEditor preset", () => {
      expect(getPreset("emptyEditor")).toBe(emptyEditorPreset);
    });

    it("should return noBacktestHistory preset", () => {
      expect(getPreset("noBacktestHistory")).toBe(noBacktestHistoryPreset);
    });

    it("should return emptyStrategyList preset", () => {
      expect(getPreset("emptyStrategyList")).toBe(emptyStrategyListPreset);
    });

    it("should return aiNoContext preset", () => {
      expect(getPreset("aiNoContext")).toBe(aiNoContextPreset);
    });

    it("should return discoveryNoData preset", () => {
      expect(getPreset("discoveryNoData")).toBe(discoveryNoDataPreset);
    });
  });

  describe("allPresets object", () => {
    it("should contain all 5 presets", () => {
      expect(Object.keys(allPresets)).toHaveLength(5);
    });

    it("should have correct keys", () => {
      expect(allPresets).toHaveProperty("emptyEditor");
      expect(allPresets).toHaveProperty("noBacktestHistory");
      expect(allPresets).toHaveProperty("emptyStrategyList");
      expect(allPresets).toHaveProperty("aiNoContext");
      expect(allPresets).toHaveProperty("discoveryNoData");
    });
  });
});

describe("EmptyState with Presets Integration", () => {
  it("should render emptyEditorPreset correctly", () => {
    const handleNew = vi.fn();
    const handleBrowse = vi.fn();

    render(
      <EmptyState
        icon={emptyEditorPreset.icon}
        title={emptyEditorPreset.title}
        description={emptyEditorPreset.description}
        actions={emptyEditorPreset.actions.map((action, index) => ({
          ...action,
          onClick: index === 0 ? handleNew : handleBrowse,
        }))}
      />
    );

    expect(screen.getByText(emptyEditorPreset.title)).toBeInTheDocument();
    expect(screen.getByText(emptyEditorPreset.description!)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "浏览模板" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "新建" }));
    expect(handleNew).toHaveBeenCalled();
  });

  it("should render noBacktestHistoryPreset correctly", () => {
    const handleBacktest = vi.fn();

    render(
      <EmptyState
        icon={noBacktestHistoryPreset.icon}
        title={noBacktestHistoryPreset.title}
        description={noBacktestHistoryPreset.description}
        actions={noBacktestHistoryPreset.actions.map((action) => ({
          ...action,
          onClick: handleBacktest,
        }))}
      />
    );

    expect(screen.getByText(noBacktestHistoryPreset.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "运行第一次回测" })).toBeInTheDocument();
  });
});
