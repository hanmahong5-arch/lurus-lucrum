/**
 * Unified error type system for Lucrum Web.
 *
 * Every catch block should produce an AppError with:
 * - A user-facing Chinese title + description
 * - A severity level (error / warning / info)
 * - Zero or more actionable recovery actions
 */

// --- Severity ---
export type ErrorSeverity = 'error' | 'warning' | 'info';

// --- Recovery Action Types ---
export interface RecoveryAction {
  type: 'retry' | 'navigate' | 'custom' | 'dismiss';
  label: string;
  /** Only for type=navigate */
  href?: string;
  /** Callback for type=retry or type=custom */
  onClick?: () => void;
}

// --- Core AppError ---
export interface AppError {
  /** Machine-readable error code (e.g. "BACKTEST_NO_DATA", "BT201") */
  code: string;
  /** User-facing title in Chinese */
  title: string;
  /** User-facing description in Chinese */
  description: string;
  /** Severity determines visual treatment */
  severity: ErrorSeverity;
  /** Ordered list of actions the user can take */
  recoveryActions: RecoveryAction[];
  /** Optional raw error message for console logging */
  raw?: string;
}

// --- API Error Envelope ---
/** Shape returned by API routes in the `error` field of JSON responses. */
export interface ApiErrorPayload {
  code: string;
  title: string;
  description: string;
  severity: ErrorSeverity;
  recoveryActions: RecoveryAction[];
}

// --- Helpers ---

/**
 * Create an AppError from a caught exception.
 * Falls back to a generic message if the error is not already an AppError.
 */
export function toAppError(err: unknown, fallbackCode = 'UNKNOWN'): AppError {
  if (isAppError(err)) return err;

  if (isApiErrorPayload(err)) {
    return {
      code: err.code,
      title: err.title,
      description: err.description,
      severity: err.severity,
      recoveryActions: err.recoveryActions ?? [],
      raw: JSON.stringify(err),
    };
  }

  if (err instanceof Error) {
    return {
      code: fallbackCode,
      title: '操作失败',
      description: err.message || '发生未知错误，请稍后重试',
      severity: 'error',
      recoveryActions: [{ type: 'retry', label: '重试' }],
      raw: err.stack ?? err.message,
    };
  }

  return {
    code: fallbackCode,
    title: '操作失败',
    description: typeof err === 'string' ? err : '发生未知错误，请稍后重试',
    severity: 'error',
    recoveryActions: [{ type: 'retry', label: '重试' }],
    raw: String(err),
  };
}

/**
 * Parse the JSON body of a failed API response into an AppError.
 * Handles both new structured format and legacy { error: string } format.
 */
export async function parseApiError(
  response: Response,
  fallbackCode = 'API_ERROR',
): Promise<AppError> {
  try {
    const body = await response.json();

    // New structured format: { error: { code, title, description, ... } }
    if (body.error && typeof body.error === 'object' && body.error.code) {
      const e = body.error as ApiErrorPayload;
      return {
        code: e.code,
        title: e.title,
        description: e.description,
        severity: e.severity ?? 'error',
        recoveryActions: e.recoveryActions ?? [],
        raw: JSON.stringify(body),
      };
    }

    // Unified backtest format: { error: { code, message, messageEn, ... } }
    if (body.error && typeof body.error === 'object' && body.error.message) {
      const e = body.error as {
        code?: string;
        message?: string;
        suggestedAction?: string;
        recoverable?: boolean;
      };
      return {
        code: e.code ?? fallbackCode,
        title: '操作失败',
        description: e.message ?? '未知错误',
        severity: 'error',
        recoveryActions: e.suggestedAction
          ? [{ type: 'custom', label: e.suggestedAction }]
          : [{ type: 'retry', label: '重试' }],
        raw: JSON.stringify(body),
      };
    }

    // Legacy format: { error: "string message" }
    if (typeof body.error === 'string') {
      return {
        code: body.code ?? fallbackCode,
        title: '操作失败',
        description: body.error,
        severity: 'error',
        recoveryActions: [{ type: 'retry', label: '重试' }],
        raw: JSON.stringify(body),
      };
    }

    if (typeof body.message === 'string') {
      return {
        code: fallbackCode,
        title: '操作失败',
        description: body.message,
        severity: 'error',
        recoveryActions: [{ type: 'retry', label: '重试' }],
        raw: JSON.stringify(body),
      };
    }

    return fallbackAppError(fallbackCode, response.status);
  } catch {
    return fallbackAppError(fallbackCode, response.status);
  }
}

function fallbackAppError(code: string, status: number): AppError {
  return {
    code,
    title: '请求失败',
    description: `服务返回错误 (HTTP ${status})，请稍后重试`,
    severity: 'error',
    recoveryActions: [{ type: 'retry', label: '重试' }],
  };
}

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'title' in err &&
    'description' in err &&
    'severity' in err
  );
}

function isApiErrorPayload(err: unknown): err is ApiErrorPayload {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'title' in err &&
    'description' in err
  );
}
