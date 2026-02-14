/**
 * useOnboardingImport Hook Tests
 * Story 3.4: Tiered Onboarding Import
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnboardingImport } from "../use-onboarding-import";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock toast
const mockSuccess = vi.fn();
const mockInfo = vi.fn();
const mockError = vi.fn();
vi.mock("@/lib/toast", () => ({
  showToast: {
    success: (...args: unknown[]) => mockSuccess(...args),
    info: (...args: unknown[]) => mockInfo(...args),
    error: (...args: unknown[]) => mockError(...args),
  },
}));

// Mock workspace store
const mockUpdateGeneratedCode = vi.fn();
const mockUpdateStrategyInput = vi.fn();
const mockSaveDraft = vi.fn();
const mockSetBacktestResult = vi.fn();
vi.mock("@/lib/stores/strategy-workspace-store", () => ({
  useStrategyWorkspaceStore: Object.assign(
    () => ({}),
    {
      getState: () => ({
        updateGeneratedCode: mockUpdateGeneratedCode,
        updateStrategyInput: mockUpdateStrategyInput,
        saveDraft: mockSaveDraft,
        setBacktestResult: mockSetBacktestResult,
      }),
    }
  ),
}));

// Mock builtin templates
vi.mock("@/lib/strategy-templates/builtin-templates", () => ({
  getBuiltinTemplateById: (id: string) => {
    const templates: Record<string, { code: string; prompt: string }> = {
      "builtin-dual-ma": {
        code: "class DualMa: pass",
        prompt: "Dual MA strategy prompt",
      },
      "builtin-kdj": {
        code: "class KDJ: pass",
        prompt: "KDJ strategy prompt",
      },
      "builtin-multi-factor": {
        code: "class MultiFactor: pass",
        prompt: "Multi-factor strategy prompt",
      },
    };
    return templates[id] ?? null;
  },
  BUILTIN_TEMPLATES: [],
  DIFFICULTY_CONFIG: {},
}));

// Mock backtest modules
vi.mock("@/lib/backtest", () => ({
  runBacktest: vi.fn().mockResolvedValue({
    totalReturn: 0.15,
    maxDrawdown: 0.08,
    totalTrades: 10,
    sharpeRatio: 1.2,
  }),
  generateBacktestData: vi.fn().mockReturnValue([
    { open: 100, high: 105, low: 98, close: 103, volume: 1000 },
  ]),
}));

vi.mock("@/lib/backtest/score", () => ({
  calculateScore: vi.fn().mockReturnValue({ grade: "B", score: 72 }),
}));

describe("useOnboardingImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all expected functions and state", () => {
    const { result } = renderHook(() => useOnboardingImport());
    expect(typeof result.current.fillAndRunSimple).toBe("function");
    expect(typeof result.current.fillIntermediate).toBe("function");
    expect(typeof result.current.fillAdvanced).toBe("function");
    expect(typeof result.current.importToEditor).toBe("function");
    expect(typeof result.current.importToWorkflow).toBe("function");
    expect(result.current.isAutoRunning).toBe(false);
    expect(result.current.autoRunError).toBeNull();
  });

  it("importToEditor fills workspace and navigates to dashboard", () => {
    const { result } = renderHook(() => useOnboardingImport());

    act(() => {
      result.current.importToEditor("class Test: pass", "Test strategy");
    });

    expect(mockUpdateGeneratedCode).toHaveBeenCalledWith("class Test: pass");
    expect(mockUpdateStrategyInput).toHaveBeenCalledWith("Test strategy");
    expect(mockSuccess).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("importToWorkflow fills workspace and navigates to dashboard", () => {
    const { result } = renderHook(() => useOnboardingImport());

    act(() => {
      result.current.importToWorkflow("class Test: pass", "Test strategy");
    });

    expect(mockUpdateGeneratedCode).toHaveBeenCalledWith("class Test: pass");
    expect(mockUpdateStrategyInput).toHaveBeenCalledWith("Test strategy");
    expect(mockSuccess).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("importToEditor does nothing with empty code", () => {
    const { result } = renderHook(() => useOnboardingImport());

    act(() => {
      result.current.importToEditor("", "description");
    });

    expect(mockUpdateGeneratedCode).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("fillIntermediate fills KDJ template and shows toast", () => {
    const { result } = renderHook(() => useOnboardingImport());

    act(() => {
      result.current.fillIntermediate();
    });

    expect(mockUpdateGeneratedCode).toHaveBeenCalledWith("class KDJ: pass");
    expect(mockUpdateStrategyInput).toHaveBeenCalledWith("KDJ strategy prompt");
    expect(mockInfo).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("fillAdvanced fills Multi-Factor template and navigates to validation", () => {
    const { result } = renderHook(() => useOnboardingImport());

    act(() => {
      result.current.fillAdvanced();
    });

    expect(mockUpdateGeneratedCode).toHaveBeenCalledWith("class MultiFactor: pass");
    expect(mockInfo).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/strategy-validation");
  });

  it("fillAndRunSimple fills workspace and runs backtest", async () => {
    const { result } = renderHook(() => useOnboardingImport());

    await act(async () => {
      await result.current.fillAndRunSimple();
    });

    expect(mockUpdateGeneratedCode).toHaveBeenCalledWith("class DualMa: pass");
    expect(mockUpdateStrategyInput).toHaveBeenCalledWith("Dual MA strategy prompt");
    expect(mockSetBacktestResult).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalled();
    expect(result.current.isAutoRunning).toBe(false);
    expect(result.current.autoRunError).toBeNull();
  });
});
