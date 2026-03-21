/**
 * ScoreCard Component Tests
 *
 * Tests:
 * - 5 grade levels (S/A/B/C/D) render correctly
 * - 3 variants (full/compact/mini) layout
 * - Loading skeleton display
 * - Error state display
 * - Aria-label correctness
 * - Help tooltip interaction
 * - Action button callbacks (full variant)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import Decimal from "decimal.js";
import {
  ScoreCard,
  GRADE_ICONS,
  GRADE_COLOR_CLASS,
  GRADE_DESCRIPTIONS,
  generateAriaLabel,
} from "../score-card";
import type { StrategyScore, ScoreGrade } from "@/lib/backtest/score";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockScore(overrides?: Partial<StrategyScore>): StrategyScore {
  return {
    grade: "A",
    score: 78,
    description: "优秀",
    coreMetrics: {
      totalReturn: new Decimal(23.5),
      annualizedReturn: new Decimal(18),
      maxDrawdown: new Decimal(8.3),
      sharpeRatio: new Decimal(1.45),
    },
    breakdown: {
      profitability: 85,
      risk: 72,
      stability: 80,
      efficiency: 65,
    },
    ...overrides,
  };
}

function createScoreForGrade(grade: ScoreGrade): StrategyScore {
  const gradeConfigs: Record<
    ScoreGrade,
    { score: number; description: string }
  > = {
    S: { score: 92, description: "卓越" },
    A: { score: 78, description: "优秀" },
    B: { score: 65, description: "良好" },
    C: { score: 45, description: "一般" },
    D: { score: 25, description: "需改进" },
  };
  const config = gradeConfigs[grade];
  return createMockScore({
    grade,
    score: config.score,
    description: config.description,
  });
}

// =============================================================================
// GRADE RENDERING TESTS
// =============================================================================

describe("ScoreCard", () => {
  describe("grade rendering (5 grades)", () => {
    const grades: ScoreGrade[] = ["S", "A", "B", "C", "D"];

    grades.forEach((grade) => {
      it(`renders grade ${grade} correctly`, () => {
        const score = createScoreForGrade(grade);
        render(<ScoreCard score={score} variant="full" />);

        // Grade letter is visible
        expect(screen.getByText(grade)).toBeInTheDocument();
        // Description is visible
        expect(
          screen.getByText(GRADE_DESCRIPTIONS[grade])
        ).toBeInTheDocument();
        // Icon is visible (aria-hidden)
        expect(screen.getByText(GRADE_ICONS[grade])).toBeInTheDocument();
      });

      it(`applies correct color class for grade ${grade}`, () => {
        const score = createScoreForGrade(grade);
        render(<ScoreCard score={score} variant="full" />);

        // The grade letter element should have the correct color class
        const gradeLetter = screen.getByText(grade);
        const colorClass = GRADE_COLOR_CLASS[grade];
        expect(gradeLetter.closest("div")).toHaveClass(colorClass);
      });
    });
  });

  // ===========================================================================
  // VARIANT TESTS
  // ===========================================================================

  describe("variant: full", () => {
    it("renders grade, metrics, benchmark, and action buttons", () => {
      const onExpand = vi.fn();
      const onAskAI = vi.fn();
      const onExport = vi.fn();
      const score = createMockScore();

      render(
        <ScoreCard
          score={score}
          variant="full"
          excessReturn={0.05}
          onExpandDetails={onExpand}
          onAskAI={onAskAI}
          onExport={onExport}
        />
      );

      // Grade area
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("优秀")).toBeInTheDocument();

      // Score
      expect(screen.getByText("综合评分 78/100")).toBeInTheDocument();

      // Metrics labels
      expect(screen.getByText("总收益率")).toBeInTheDocument();
      expect(screen.getByText("最大回撤")).toBeInTheDocument();

      // Benchmark
      expect(screen.getByText("vs 沪深300")).toBeInTheDocument();

      // Action buttons
      expect(screen.getByText("展开详情")).toBeInTheDocument();
      expect(screen.getByText("问AI")).toBeInTheDocument();
      expect(screen.getByText("导出")).toBeInTheDocument();
    });

    it("renders help tooltip trigger", () => {
      const score = createMockScore();
      render(<ScoreCard score={score} variant="full" />);

      expect(screen.getByLabelText("评分说明")).toBeInTheDocument();
    });

    it("shows excess return with up arrow when positive", () => {
      const score = createMockScore();
      render(
        <ScoreCard score={score} variant="full" excessReturn={0.05} />
      );

      expect(screen.getByText("▲")).toBeInTheDocument();
      expect(screen.getByText(/\+5\.00%/)).toBeInTheDocument();
    });

    it("shows excess return with down arrow when negative", () => {
      const score = createMockScore();
      render(
        <ScoreCard score={score} variant="full" excessReturn={-0.03} />
      );

      expect(screen.getByText("▼")).toBeInTheDocument();
      expect(screen.getByText(/-3\.00%/)).toBeInTheDocument();
    });

    it("hides action buttons when callbacks not provided", () => {
      const score = createMockScore();
      render(<ScoreCard score={score} variant="full" />);

      expect(screen.queryByText("展开详情")).not.toBeInTheDocument();
      expect(screen.queryByText("问AI")).not.toBeInTheDocument();
      expect(screen.queryByText("导出")).not.toBeInTheDocument();
    });
  });

  describe("variant: compact", () => {
    it("renders grade and core metrics without action buttons", () => {
      const score = createMockScore();
      render(<ScoreCard score={score} variant="compact" />);

      expect(screen.getByTestId("score-card-compact")).toBeInTheDocument();
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("总收益率")).toBeInTheDocument();
      expect(screen.getByText("最大回撤")).toBeInTheDocument();

      // No action buttons in compact
      expect(screen.queryByText("展开详情")).not.toBeInTheDocument();
      expect(screen.queryByText("问AI")).not.toBeInTheDocument();
    });
  });

  describe("variant: mini", () => {
    it("renders inline grade letter and description only", () => {
      const score = createMockScore();
      render(<ScoreCard score={score} variant="mini" />);

      const container = screen.getByTestId("score-card-mini");
      expect(container).toBeInTheDocument();

      // Should be inline-flex
      expect(container).toHaveClass("inline-flex");

      // Grade and description
      expect(within(container).getByText("A")).toBeInTheDocument();
      expect(within(container).getByText("优秀")).toBeInTheDocument();

      // No metrics
      expect(screen.queryByText("总收益率")).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // STATE TESTS
  // ===========================================================================

  describe("loading state", () => {
    it("renders skeleton for full variant", () => {
      render(<ScoreCard score={null} state="loading" variant="full" />);
      expect(screen.getByTestId("score-card-loading")).toBeInTheDocument();
      expect(screen.getByLabelText("评分加载中")).toBeInTheDocument();
    });

    it("renders skeleton for compact variant", () => {
      render(<ScoreCard score={null} state="loading" variant="compact" />);
      expect(screen.getByTestId("score-card-loading")).toBeInTheDocument();
    });

    it("renders skeleton for mini variant", () => {
      render(<ScoreCard score={null} state="loading" variant="mini" />);
      expect(screen.getByTestId("score-card-loading")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error message", () => {
      render(
        <ScoreCard
          score={null}
          state="error"
          errorMessage="网络连接失败"
        />
      );

      expect(screen.getByTestId("score-card-error")).toBeInTheDocument();
      expect(screen.getByText("网络连接失败")).toBeInTheDocument();
    });

    it("renders default error message when none provided", () => {
      render(<ScoreCard score={null} state="error" />);
      expect(screen.getByText("评分计算失败")).toBeInTheDocument();
    });

    it("renders retry button when onRetry provided", () => {
      const onRetry = vi.fn();
      render(<ScoreCard score={null} state="error" onRetry={onRetry} />);

      const retryBtn = screen.getByText("重试");
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("hides retry button when onRetry not provided", () => {
      render(<ScoreCard score={null} state="error" />);
      expect(screen.queryByText("重试")).not.toBeInTheDocument();
    });

    it("has alert role for accessibility", () => {
      render(<ScoreCard score={null} state="error" />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ARIA LABEL TESTS
  // ===========================================================================

  describe("aria-label", () => {
    it("generates correct aria-label for positive returns", () => {
      const score = createMockScore();
      const label = generateAriaLabel(score);

      expect(label).toBe(
        "策略评分 A 优秀，总收益率 上涨 23.5%，最大回撤 下跌 8.3%"
      );
    });

    it("generates correct aria-label for negative returns", () => {
      const score = createMockScore({
        grade: "D",
        coreMetrics: {
          totalReturn: new Decimal(-15),
          annualizedReturn: new Decimal(-12),
          maxDrawdown: new Decimal(35),
          sharpeRatio: new Decimal(-0.5),
        },
      });
      const label = generateAriaLabel(score);

      expect(label).toBe(
        "策略评分 D 需改进，总收益率 下跌 15.0%，最大回撤 下跌 35.0%"
      );
    });

    it("is applied to full variant card", () => {
      const score = createMockScore();
      render(<ScoreCard score={score} variant="full" />);

      const card = screen.getByTestId("score-card-full");
      expect(card).toHaveAttribute(
        "aria-label",
        expect.stringContaining("策略评分 A 优秀")
      );
    });

    it("is applied to compact variant card", () => {
      const score = createMockScore();
      render(<ScoreCard score={score} variant="compact" />);

      const card = screen.getByTestId("score-card-compact");
      expect(card).toHaveAttribute(
        "aria-label",
        expect.stringContaining("策略评分 A 优秀")
      );
    });

    it("is applied to mini variant", () => {
      const score = createMockScore();
      render(<ScoreCard score={score} variant="mini" />);

      const card = screen.getByTestId("score-card-mini");
      expect(card).toHaveAttribute(
        "aria-label",
        expect.stringContaining("策略评分 A 优秀")
      );
    });
  });

  // ===========================================================================
  // ACTION BUTTON CALLBACK TESTS
  // ===========================================================================

  describe("action button callbacks (full variant)", () => {
    it("calls onExpandDetails when expand button clicked", () => {
      const onExpand = vi.fn();
      const score = createMockScore();
      render(
        <ScoreCard score={score} variant="full" onExpandDetails={onExpand} />
      );

      fireEvent.click(screen.getByTestId("score-card-expand"));
      expect(onExpand).toHaveBeenCalledOnce();
    });

    it("calls onAskAI when ask AI button clicked", () => {
      const onAskAI = vi.fn();
      const score = createMockScore();
      render(
        <ScoreCard score={score} variant="full" onAskAI={onAskAI} />
      );

      fireEvent.click(screen.getByTestId("score-card-ask-ai"));
      expect(onAskAI).toHaveBeenCalledOnce();
    });

    it("calls onExport when export button clicked", () => {
      const onExport = vi.fn();
      const score = createMockScore();
      render(
        <ScoreCard score={score} variant="full" onExport={onExport} />
      );

      fireEvent.click(screen.getByTestId("score-card-export"));
      expect(onExport).toHaveBeenCalledOnce();
    });
  });

  // ===========================================================================
  // COMPARISON MODE TESTS (AC-5)
  // ===========================================================================

  describe("comparison mode (AC-5)", () => {
    it("renders side-by-side comparison with both scores", () => {
      const currentScore = createScoreForGrade("A");
      const prevScore = createScoreForGrade("B");

      render(
        <ScoreCard
          score={currentScore}
          previousScore={prevScore}
          state="comparison"
        />
      );

      const container = screen.getByTestId("score-card-comparison");
      expect(container).toBeInTheDocument();

      // Both grades visible
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("B")).toBeInTheDocument();

      // Labels present
      expect(screen.getByText("旧版本")).toBeInTheDocument();
      expect(screen.getByText("新版本")).toBeInTheDocument();
    });

    it("has aria-label for accessibility", () => {
      const score = createMockScore();
      render(
        <ScoreCard score={score} state="comparison" />
      );

      expect(screen.getByLabelText("策略评分对比")).toBeInTheDocument();
    });

    it("shows '无数据' when previousScore is null", () => {
      const score = createMockScore();
      render(
        <ScoreCard score={score} previousScore={null} state="comparison" />
      );

      expect(screen.getByText("无数据")).toBeInTheDocument();
    });

    it("returns null when score is null in comparison mode", () => {
      const { container } = render(
        <ScoreCard score={null} state="comparison" />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders core metrics for both scores", () => {
      const currentScore = createMockScore({ grade: "S", score: 95 });
      const prevScore = createMockScore({ grade: "C", score: 45 });

      render(
        <ScoreCard
          score={currentScore}
          previousScore={prevScore}
          state="comparison"
        />
      );

      // Both should have metrics displayed (总收益率 appears twice)
      const returnLabels = screen.getAllByText("总收益率");
      expect(returnLabels.length).toBe(2);
    });
  });

  // ===========================================================================
  // NULL SCORE TESTS
  // ===========================================================================

  describe("null score handling", () => {
    it("returns null when score is null and state is default", () => {
      const { container } = render(<ScoreCard score={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  // ===========================================================================
  // CONSTANTS TESTS
  // ===========================================================================

  describe("constants", () => {
    it("GRADE_ICONS covers all grades", () => {
      const grades: ScoreGrade[] = ["S", "A", "B", "C", "D"];
      grades.forEach((g) => {
        expect(GRADE_ICONS[g]).toBeDefined();
        expect(GRADE_ICONS[g].length).toBeGreaterThan(0);
      });
    });

    it("GRADE_COLOR_CLASS covers all grades", () => {
      const grades: ScoreGrade[] = ["S", "A", "B", "C", "D"];
      grades.forEach((g) => {
        expect(GRADE_COLOR_CLASS[g]).toBeDefined();
        expect(GRADE_COLOR_CLASS[g]).toMatch(/^text-score-/);
      });
    });

    it("GRADE_DESCRIPTIONS covers all grades", () => {
      const grades: ScoreGrade[] = ["S", "A", "B", "C", "D"];
      expect(GRADE_DESCRIPTIONS.S).toBe("卓越");
      expect(GRADE_DESCRIPTIONS.A).toBe("优秀");
      expect(GRADE_DESCRIPTIONS.B).toBe("良好");
      expect(GRADE_DESCRIPTIONS.C).toBe("一般");
      expect(GRADE_DESCRIPTIONS.D).toBe("需改进");
    });
  });
});
