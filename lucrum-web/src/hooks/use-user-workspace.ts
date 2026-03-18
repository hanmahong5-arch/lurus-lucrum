/**
 * User Workspace Initialization Hook
 * 用户工作空间初始化 Hook
 *
 * Automatically initializes the strategy workspace store with the current user's ID
 * when they are authenticated, ensuring data isolation between users.
 * 当用户已认证时，自动使用当前用户 ID 初始化策略工作空间 store，确保用户之间的数据隔离。
 */

'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  useStrategyWorkspaceStore,
  selectUserId,
  selectIsInitialized,
} from '@/lib/stores/strategy-workspace-store';

/**
 * Hook to automatically initialize user workspace on authentication
 * 自动在认证时初始化用户工作空间的 Hook
 *
 * @returns Object with initialization status and current user ID
 *
 * @example
 * ```typescript
 * function DashboardPage() {
 *   const { isReady, userId } = useUserWorkspace();
 *
 *   if (!isReady) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return <StrategyEditor />;
 * }
 * ```
 */
export function useUserWorkspace() {
  const { data: session, status } = useSession();
  const storeUserId = useStrategyWorkspaceStore(selectUserId);
  const isInitialized = useStrategyWorkspaceStore(selectIsInitialized);
  const { initializeUserSpace, clearUserSpace } = useStrategyWorkspaceStore();

  // Initialize workspace when user is authenticated
  // 当用户已认证时初始化工作空间
  useEffect(() => {
    if (status === 'loading') {
      // Still loading session, wait
      // 仍在加载会话，等待
      return;
    }

    if (status === 'authenticated' && session?.user?.id) {
      const sessionUserId = session.user.id;

      // Initialize if not yet initialized or if user changed
      // 如果尚未初始化或用户已更改，则初始化
      if (!isInitialized || storeUserId !== sessionUserId) {
        console.log('[useUserWorkspace] Initializing workspace for user:', sessionUserId);
        initializeUserSpace(sessionUserId);
      }
    } else if (status === 'unauthenticated') {
      // User logged out, clear workspace
      // 用户已登出，清除工作空间
      if (storeUserId !== null) {
        console.log('[useUserWorkspace] User logged out, clearing workspace');
        clearUserSpace();
      }
    }
  }, [status, session?.user?.id, storeUserId, isInitialized, initializeUserSpace, clearUserSpace]);

  return {
    /** Whether the workspace is ready for use / 工作空间是否已准备就绪 */
    isReady: status !== 'loading' && (status === 'unauthenticated' || isInitialized),

    /** Whether the user is authenticated / 用户是否已认证 */
    isAuthenticated: status === 'authenticated',

    /** Current user ID in the workspace / 工作空间中的当前用户 ID */
    userId: storeUserId,

    /** User session data / 用户会话数据 */
    user: session?.user || null,

    /** Session loading status / 会话加载状态 */
    status,
  };
}

/**
 * Hook to get current user info from session
 * 从会话获取当前用户信息的 Hook
 *
 * Lightweight alternative when you only need user info, not workspace initialization.
 * 当您只需要用户信息而不需要工作空间初始化时的轻量级替代方案。
 */
export function useCurrentUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user || null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  };
}

export default useUserWorkspace;
