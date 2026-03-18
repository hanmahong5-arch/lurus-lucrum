/**
 * Tests for backtest error handling system
 * 回测错误处理系统测试
 */
import { describe, it, expect } from "vitest";
import {
  BacktestError,
  BacktestErrorCode,
  ERROR_MESSAGES,
  createBacktestError,
  isRecoverableError,
  getErrorSeverity,
  formatError,
  formatErrorWithSuggestion,
  withErrorHandling,
  assertBacktest,
  isErrorInfo,
} from "../core/errors";

// =============================================================================
// BacktestError class
// =============================================================================

describe("BacktestError", () => {
  it("should construct with code and set name, message, errorInfo", () => {
    const err = new BacktestError(BacktestErrorCode.INVALID_REQUEST);
    expect(err.name).toBe("BacktestError");
    expect(err.code).toBe(BacktestErrorCode.INVALID_REQUEST);
    expect(err.message).toBe(ERROR_MESSAGES[BacktestErrorCode.INVALID_REQUEST]!.zh);
    expect(err.errorInfo.code).toBe(BacktestErrorCode.INVALID_REQUEST);
    expect(err).toBeInstanceOf(Error);
  });

  it("should pass details through to errorInfo", () => {
    const details = { field: "capital", value: -1 };
    const err = new BacktestError(BacktestErrorCode.INVALID_CAPITAL, details);
    expect(err.errorInfo.details).toEqual(details);
  });

  it("toErrorInfo() should return the same errorInfo", () => {
    const err = new BacktestError(BacktestErrorCode.DATA_FETCH_FAILED);
    expect(err.toErrorInfo()).toBe(err.errorInfo);
  });

  it("isRecoverable() should delegate to isRecoverableError", () => {
    const recoverable = new BacktestError(BacktestErrorCode.NETWORK_ERROR);
    expect(recoverable.isRecoverable()).toBe(true);

    const nonRecoverable = new BacktestError(BacktestErrorCode.INTERNAL_ERROR);
    expect(nonRecoverable.isRecoverable()).toBe(false);
  });

  it("getSeverity() should delegate to getErrorSeverity", () => {
    const info = new BacktestError(BacktestErrorCode.NO_TRADES);
    expect(info.getSeverity()).toBe("info");

    const warning = new BacktestError(BacktestErrorCode.DATA_QUALITY_ISSUE);
    expect(warning.getSeverity()).toBe("warning");

    const error = new BacktestError(BacktestErrorCode.INTERNAL_ERROR);
    expect(error.getSeverity()).toBe("error");
  });
});

// =============================================================================
// isRecoverableError
// =============================================================================

describe("isRecoverableError", () => {
  it("should return true for validation errors (BT1xx)", () => {
    expect(isRecoverableError(BacktestErrorCode.INVALID_REQUEST)).toBe(true);
    expect(isRecoverableError(BacktestErrorCode.INVALID_CAPITAL)).toBe(true);
  });

  it("should return true for data errors (BT2xx) except SYMBOL_DELISTED", () => {
    expect(isRecoverableError(BacktestErrorCode.DATA_FETCH_FAILED)).toBe(true);
    expect(isRecoverableError(BacktestErrorCode.SYMBOL_DELISTED)).toBe(false);
  });

  it("should return false for system errors (BT9xx)", () => {
    expect(isRecoverableError(BacktestErrorCode.INTERNAL_ERROR)).toBe(false);
    expect(isRecoverableError(BacktestErrorCode.UNKNOWN_ERROR)).toBe(false);
    expect(isRecoverableError(BacktestErrorCode.NOT_IMPLEMENTED)).toBe(false);
  });
});

// =============================================================================
// getErrorSeverity
// =============================================================================

describe("getErrorSeverity", () => {
  it("should return 'info' for info-level codes", () => {
    expect(getErrorSeverity(BacktestErrorCode.NO_TRADES)).toBe("info");
    expect(getErrorSeverity(BacktestErrorCode.JOB_CANCELLED)).toBe("info");
    expect(getErrorSeverity(BacktestErrorCode.NOT_IMPLEMENTED)).toBe("info");
  });

  it("should return 'warning' for warning-level codes", () => {
    expect(getErrorSeverity(BacktestErrorCode.DATA_QUALITY_ISSUE)).toBe("warning");
    expect(getErrorSeverity(BacktestErrorCode.INSUFFICIENT_DATA)).toBe("warning");
    expect(getErrorSeverity(BacktestErrorCode.ENGINE_BUSY)).toBe("warning");
    expect(getErrorSeverity(BacktestErrorCode.API_RATE_LIMITED)).toBe("warning");
  });

  it("should return 'error' for all other codes", () => {
    expect(getErrorSeverity(BacktestErrorCode.INTERNAL_ERROR)).toBe("error");
    expect(getErrorSeverity(BacktestErrorCode.INVALID_REQUEST)).toBe("error");
    expect(getErrorSeverity(BacktestErrorCode.NETWORK_ERROR)).toBe("error");
  });
});

// =============================================================================
// formatErrorWithSuggestion
// =============================================================================

describe("formatErrorWithSuggestion", () => {
  it("should format in zh locale with suggestion", () => {
    const info = createBacktestError(BacktestErrorCode.INVALID_REQUEST);
    const result = formatErrorWithSuggestion(info, "zh");
    expect(result).toContain("[BT100]");
    expect(result).toContain("请求参数无效");
    expect(result).toContain("建议: ");
    expect(result).toContain(ERROR_MESSAGES[BacktestErrorCode.INVALID_REQUEST]!.suggestion);
  });

  it("should format in en locale with suggestion", () => {
    const info = createBacktestError(BacktestErrorCode.INVALID_REQUEST);
    const result = formatErrorWithSuggestion(info, "en");
    expect(result).toContain("[BT100]");
    expect(result).toContain("Invalid request parameters");
    expect(result).toContain("Suggestion: ");
  });

  it("should omit suggestion line when suggestedAction is absent", () => {
    const info = createBacktestError(BacktestErrorCode.INVALID_REQUEST);
    info.suggestedAction = undefined;
    const result = formatErrorWithSuggestion(info);
    expect(result).not.toContain("建议");
    expect(result).toBe(formatError(info, "zh"));
  });
});

// =============================================================================
// withErrorHandling
// =============================================================================

describe("withErrorHandling", () => {
  it("should return success with data on resolved promise", async () => {
    const result = await withErrorHandling(async () => 42);
    expect(result).toEqual({ success: true, data: 42 });
  });

  it("should return structured error for BacktestError", async () => {
    const result = await withErrorHandling(async () => {
      throw new BacktestError(BacktestErrorCode.ENGINE_TIMEOUT);
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(BacktestErrorCode.ENGINE_TIMEOUT);
    }
  });

  it("should wrap regular Error with default error code", async () => {
    const result = await withErrorHandling(async () => {
      throw new Error("something broke");
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(BacktestErrorCode.UNKNOWN_ERROR);
      expect(result.error.details).toBe("something broke");
    }
  });

  it("should handle non-Error thrown values", async () => {
    const result = await withErrorHandling(async () => {
      throw "string error";
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.details).toBe("string error");
    }
  });
});

// =============================================================================
// assertBacktest & isErrorInfo
// =============================================================================

describe("assertBacktest", () => {
  it("should not throw when condition is true", () => {
    expect(() => assertBacktest(true, BacktestErrorCode.INVALID_REQUEST)).not.toThrow();
  });

  it("should throw BacktestError when condition is false", () => {
    expect(() => assertBacktest(false, BacktestErrorCode.INVALID_CAPITAL, "too low")).toThrow(
      BacktestError,
    );
  });
});

describe("isErrorInfo", () => {
  it("should return true for valid ErrorInfo objects", () => {
    const info = createBacktestError(BacktestErrorCode.INVALID_REQUEST);
    expect(isErrorInfo(info)).toBe(true);
  });

  it("should return false for non-ErrorInfo values", () => {
    expect(isErrorInfo(null)).toBe(false);
    expect(isErrorInfo("string")).toBe(false);
    expect(isErrorInfo({ code: "BT100" })).toBe(false);
    expect(isErrorInfo({ code: "BT100", message: "x" })).toBe(false);
  });
});
