/**
 * Toast Notification System
 *
 * Unified toast API wrapping sonner library.
 * Provides 4 variants: success, warning, error, info
 * with consistent styling using Lucrum design tokens.
 *
 * Story 1.2: Toast 通知系统
 */

import { toast, type ExternalToast } from "sonner";

/**
 * Toast variant types
 */
export type ToastVariant = "success" | "warning" | "error" | "info";

/**
 * Toast options extending sonner's ExternalToast
 */
export interface ToastOptions extends Omit<ExternalToast, "duration"> {
  /** Custom duration in milliseconds. Default varies by variant. */
  duration?: number;
  /** Whether to show close button. Default: true */
  closeButton?: boolean;
}

/**
 * Default durations per variant (in milliseconds)
 * - success/info: 5000ms (auto-close)
 * - warning/error: Infinity (manual close required)
 */
const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 5000,
  info: 5000,
  warning: Infinity,
  error: Infinity,
};

/**
 * Show a success toast
 * @param message - Toast message
 * @param options - Optional toast configuration
 */
function success(message: string, options?: ToastOptions) {
  const { duration, closeButton, ...rest } = options ?? {};
  return toast.success(message, {
    ...rest,
    duration: duration ?? DEFAULT_DURATIONS.success,
    closeButton: closeButton ?? true,
  });
}

/**
 * Show a warning toast
 * @param message - Toast message
 * @param options - Optional toast configuration
 */
function warning(message: string, options?: ToastOptions) {
  const { duration, closeButton, ...rest } = options ?? {};
  return toast.warning(message, {
    ...rest,
    duration: duration ?? DEFAULT_DURATIONS.warning,
    closeButton: closeButton ?? true,
  });
}

/**
 * Show an error toast
 * @param message - Toast message
 * @param options - Optional toast configuration
 */
function error(message: string, options?: ToastOptions) {
  const { duration, closeButton, ...rest } = options ?? {};
  return toast.error(message, {
    ...rest,
    duration: duration ?? DEFAULT_DURATIONS.error,
    closeButton: closeButton ?? true,
  });
}

/**
 * Show an info toast
 * @param message - Toast message
 * @param options - Optional toast configuration
 */
function info(message: string, options?: ToastOptions) {
  const { duration, closeButton, ...rest } = options ?? {};
  return toast.info(message, {
    ...rest,
    duration: duration ?? DEFAULT_DURATIONS.info,
    closeButton: closeButton ?? true,
  });
}

/**
 * Promise toast configuration
 */
export interface PromiseToastMessages<T> {
  /** Message shown while promise is pending */
  loading: string;
  /** Message shown on promise resolution. Can be function receiving result. */
  success: string | ((data: T) => string);
  /** Message shown on promise rejection. Can be function receiving error. */
  error: string | ((error: unknown) => string);
}

/**
 * Show a promise toast that automatically transitions between states
 * @param promise - Promise to track
 * @param messages - Messages for loading, success, and error states
 * @param options - Optional toast configuration
 */
function promise<T>(
  promiseOrFn: Promise<T> | (() => Promise<T>),
  messages: PromiseToastMessages<T>,
  options?: ToastOptions
) {
  return toast.promise(promiseOrFn, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    ...options,
  });
}

/**
 * Dismiss a specific toast or all toasts
 * @param toastId - Optional toast ID to dismiss. If omitted, dismisses all.
 */
function dismiss(toastId?: string | number) {
  return toast.dismiss(toastId);
}

/**
 * Show a custom toast with full control
 * @param message - Toast message or React node
 * @param options - Toast configuration
 */
function custom(message: string | React.ReactNode, options?: ToastOptions) {
  return toast(message, {
    closeButton: options?.closeButton ?? true,
    ...options,
  });
}

/**
 * Toast API object for convenient usage
 *
 * @example
 * ```tsx
 * import { showToast, promiseToast } from '@/lib/toast';
 *
 * // Basic usage
 * showToast.success('保存成功');
 * showToast.error('操作失败，请重试');
 * showToast.warning('模拟数据仅供参考');
 * showToast.info('已复制到剪贴板');
 *
 * // Promise mode
 * promiseToast(
 *   runBacktest(),
 *   {
 *     loading: '正在回测...',
 *     success: '回测完成',
 *     error: '回测失败'
 *   }
 * );
 *
 * // Dismiss
 * showToast.dismiss(); // dismiss all
 * showToast.dismiss(toastId); // dismiss specific
 * ```
 */
export const showToast = {
  success,
  warning,
  error,
  info,
  custom,
  dismiss,
  promise,
};

/**
 * Convenience alias for promise toast
 */
export const promiseToast = promise;

export default showToast;
