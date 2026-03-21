'use client';

/**
 * EnhancedErrorBoundary — catches React render errors and shows a full-page
 * recovery UI instead of a white screen.
 *
 * Improvements over the base ErrorBoundary:
 *  - Converts the caught error into an AppError for consistent display
 *  - Shows ErrorRecoveryPage with actionable recovery steps
 *  - Attempts to save Zustand workspace state to localStorage before rendering
 *    the fallback (prevents data loss)
 *  - Provides "刷新页面" as the primary action, "返回首页" as secondary
 *  - Logs structured error info to console
 *
 * @module components/providers/enhanced-error-boundary
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import type { AppError } from '@/lib/errors/error-types';
import { ErrorRecoveryPage } from '@/components/ui/error-recovery-page';

// =============================================================================
// Types
// =============================================================================

interface EnhancedErrorBoundaryProps {
  children: ReactNode;
  /** Fallback component name shown in console logs. */
  componentName?: string;
  /** Called when an error is caught (for external logging / analytics). */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface EnhancedErrorBoundaryState {
  appError: AppError | null;
}

// =============================================================================
// Workspace preservation key
// =============================================================================

const WORKSPACE_BACKUP_KEY = 'lucrum-workspace-crash-backup';

// =============================================================================
// Component
// =============================================================================

export class EnhancedErrorBoundary extends Component<
  EnhancedErrorBoundaryProps,
  EnhancedErrorBoundaryState
> {
  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    this.state = { appError: null };
  }

  static getDerivedStateFromError(error: Error): Partial<EnhancedErrorBoundaryState> {
    const appError: AppError = {
      code: 'RENDER_CRASH',
      title: '页面渲染失败',
      description:
        '页面遇到了无法恢复的错误。您的工作数据已自动保存。请刷新页面重试。',
      severity: 'error',
      recoveryActions: [
        { type: 'retry', label: '刷新页面' },
        { type: 'navigate', label: '返回首页', href: '/' },
      ],
      raw: error.stack ?? error.message,
    };
    return { appError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const tag = this.props.componentName
      ? `[EnhancedErrorBoundary:${this.props.componentName}]`
      : '[EnhancedErrorBoundary]';

    console.error(`${tag} Render crash:`, error);
    console.error(`${tag} Component stack:`, errorInfo.componentStack);

    // Attempt to save workspace state before the tree is replaced
    this.preserveWorkspace();

    // External callback for analytics / error tracking
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Try to snapshot the Zustand strategy-workspace-store into localStorage
   * so the user does not lose unsaved work after a crash.
   */
  private preserveWorkspace(): void {
    try {
      // The workspace store is persisted under this key by Zustand persist middleware
      const workspaceKey = 'strategy-workspace-storage';
      const raw = typeof window !== 'undefined'
        ? localStorage.getItem(workspaceKey)
        : null;
      if (raw) {
        localStorage.setItem(WORKSPACE_BACKUP_KEY, raw);
      }
    } catch {
      // localStorage unavailable — cannot preserve. This is best-effort.
    }
  }

  private handleAction = (action: { type: string; href?: string }) => {
    if (action.type === 'retry') {
      window.location.reload();
      return;
    }
    if (action.type === 'navigate' && action.href) {
      window.location.href = action.href;
    }
  };

  render(): ReactNode {
    const { appError } = this.state;

    if (appError) {
      return (
        <ErrorRecoveryPage
          error={appError}
          onAction={this.handleAction}
        />
      );
    }

    return this.props.children;
  }
}

export default EnhancedErrorBoundary;
