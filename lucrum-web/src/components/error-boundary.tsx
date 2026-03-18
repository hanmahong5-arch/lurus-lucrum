"use client";

/**
 * Global Error Boundary Component
 * 全局错误边界组件
 *
 * A React class component that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI.
 *
 * Features:
 * - Catches render errors in child components
 * - Bilingual error messages (Chinese/English)
 * - Reset functionality to recover from errors
 * - Error logging callback for analytics
 * - Customizable fallback UI
 *
 * @module components/error-boundary
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Type Definitions / 类型定义
// =============================================================================

/**
 * Props for the ErrorBoundary component
 * ErrorBoundary 组件的属性
 */
interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;

  /** Optional custom fallback UI */
  fallback?: ReactNode;

  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /** Callback when reset is triggered */
  onReset?: () => void;

  /** Additional CSS classes */
  className?: string;

  /** Component name for error context (helps identify which boundary caught the error) */
  componentName?: string;
}

/**
 * State for the ErrorBoundary component
 * ErrorBoundary 组件的状态
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// =============================================================================
// Error Boundary Component / 错误边界组件
// =============================================================================

/**
 * ErrorBoundary - Catches JavaScript errors in child component tree
 * 错误边界 - 捕获子组件树中的JavaScript错误
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary onError={logError} componentName="AdvisorChat">
 *   <AdvisorChat />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught
   * 捕获错误时更新状态
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  /**
   * Log error information for debugging
   * 记录错误信息用于调试
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console with component context
    console.error(
      `[ErrorBoundary${this.props.componentName ? `:${this.props.componentName}` : ""}] Caught error:`,
      error
    );
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);

    // Update state with error info
    this.setState({ errorInfo });

    // Call external error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Reset error state to allow retry
   * 重置错误状态以允许重试
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, className, componentName } = this.props;

    // If error occurred, show fallback UI
    if (hasError) {
      // Custom fallback provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallbackUI
          error={error}
          errorInfo={errorInfo}
          onReset={this.handleReset}
          componentName={componentName}
          className={className}
        />
      );
    }

    // No error, render children normally
    return children;
  }
}

// =============================================================================
// Default Fallback UI / 默认降级UI
// =============================================================================

/**
 * Props for the fallback UI component
 */
interface ErrorFallbackUIProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  componentName?: string;
  className?: string;
}

/**
 * Default error fallback UI with bilingual messages
 * 默认错误降级UI，支持双语消息
 */
function ErrorFallbackUI({
  error,
  errorInfo,
  onReset,
  componentName,
  className,
}: ErrorFallbackUIProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  // Format error message for display
  const errorMessage = error?.message || "Unknown error occurred";
  const errorName = error?.name || "Error";

  return (
    <div
      className={cn(
        "min-h-[200px] flex flex-col items-center justify-center p-6",
        "bg-gradient-to-br from-loss/5 to-loss/10",
        "border border-loss/30 rounded-xl",
        className
      )}
    >
      {/* Error Icon */}
      <div className="w-16 h-16 rounded-full bg-loss/20 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-loss"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      {/* Error Title */}
      <h3 className="text-lg font-semibold text-loss mb-2">
        出现了一些问题
        <span className="text-sm font-normal text-loss/70 ml-2">
          / Something went wrong
        </span>
      </h3>

      {/* Error Description */}
      <p className="text-sm text-white/60 text-center max-w-md mb-4">
        {componentName && (
          <span className="text-white/40">
            [{componentName}]{" "}
          </span>
        )}
        {errorMessage.length > 200
          ? `${errorMessage.substring(0, 200)}...`
          : errorMessage}
      </p>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onReset}
          className={cn(
            "px-4 py-2 rounded-lg font-medium text-sm transition-all",
            "bg-accent hover:bg-accent/90 text-primary"
          )}
        >
          重试 / Retry
        </button>
        <button
          onClick={() => window.location.reload()}
          className={cn(
            "px-4 py-2 rounded-lg font-medium text-sm transition-all",
            "bg-white/10 hover:bg-white/20 text-white/80"
          )}
        >
          刷新页面 / Refresh
        </button>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={cn(
            "px-4 py-2 rounded-lg font-medium text-sm transition-all",
            "bg-transparent hover:bg-white/10 text-white/50 border border-white/20"
          )}
        >
          {showDetails ? "隐藏详情" : "显示详情"}
        </button>
      </div>

      {/* Error Details (collapsible) */}
      {showDetails && (
        <div className="w-full max-w-2xl mt-4 p-4 bg-primary/50 rounded-lg border border-border overflow-auto">
          <div className="text-xs font-mono text-white/60 space-y-2">
            <div>
              <span className="text-loss">{errorName}:</span> {errorMessage}
            </div>
            {errorInfo?.componentStack && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="text-white/40 mb-1">Component Stack:</div>
                <pre className="whitespace-pre-wrap text-white/50 text-[10px]">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
            {error?.stack && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="text-white/40 mb-1">Stack Trace:</div>
                <pre className="whitespace-pre-wrap text-white/50 text-[10px]">
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-white/30 mt-4">
        如果问题持续存在，请联系技术支持
        <span className="mx-1">|</span>
        If the problem persists, please contact support
      </p>
    </div>
  );
}

// =============================================================================
// Higher-Order Component Wrapper / 高阶组件包装器
// =============================================================================

/**
 * HOC to wrap a component with ErrorBoundary
 * 用ErrorBoundary包装组件的高阶组件
 *
 * Usage:
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, { componentName: "MyComponent" });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, "children">
): React.FC<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  const ComponentWithBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...options} componentName={options?.componentName ?? displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithBoundary;
}

// =============================================================================
// Exports / 导出
// =============================================================================

export default ErrorBoundary;
