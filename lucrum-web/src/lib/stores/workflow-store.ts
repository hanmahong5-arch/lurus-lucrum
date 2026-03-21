/**
 * Workflow Store
 * 工作流状态存储
 *
 * Zustand store for managing workflow session state in the frontend.
 * Provides optimistic updates and syncs with the backend API.
 *
 * 用于在前端管理工作流会话状态的Zustand存储
 * 提供乐观更新并与后端API同步
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  WorkflowType,
  WorkflowSession,
  WorkflowStepDefinition,
  StepData,
  SessionResponse,
  StepResultResponse,
} from '@/lib/workflow';

// =============================================================================
// Types / 类型
// =============================================================================

export type WorkflowStoreStatus = 'idle' | 'loading' | 'executing' | 'error';

export interface WorkflowState {
  /** Current active session / 当前活动会话 */
  session: WorkflowSession | null;
  /** Current step definition / 当前步骤定义 */
  currentStepDef: WorkflowStepDefinition | null;
  /** Active sessions for user / 用户的活动会话 */
  activeSessions: SessionResponse[];
  /** Store status / 存储状态 */
  status: WorkflowStoreStatus;
  /** Error message / 错误信息 */
  error: string | null;
  /** Is step result from cache / 步骤结果是否来自缓存 */
  lastStepCached: boolean;
  /** User ID / 用户ID */
  userId: string | null;
}

export interface WorkflowActions {
  // Session management / 会话管理
  createSession: (type: WorkflowType, title?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  loadActiveSessions: () => Promise<void>;
  cancelSession: () => Promise<void>;
  clearSession: () => void;

  // Step execution / 步骤执行
  executeStep: (inputData: Record<string, unknown>, skipCache?: boolean) => Promise<StepResultResponse | null>;
  goToStep: (stepNumber: number) => Promise<void>;
  goBack: () => Promise<void>;
  goNext: () => Promise<void>;

  // State management / 状态管理
  setUserId: (userId: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export type WorkflowStore = WorkflowState & WorkflowActions;

// =============================================================================
// Initial State / 初始状态
// =============================================================================

const INITIAL_STATE: WorkflowState = {
  session: null,
  currentStepDef: null,
  activeSessions: [],
  status: 'idle',
  error: null,
  lastStepCached: false,
  userId: null,
};

// =============================================================================
// Store Implementation / 存储实现
// =============================================================================

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    immer((set, get) => ({
      ...INITIAL_STATE,

      // -------------------------------------------------------------------------
      // Session Management / 会话管理
      // -------------------------------------------------------------------------

      createSession: async (type: WorkflowType, title?: string) => {
        set((state) => {
          state.status = 'loading';
          state.error = null;
        });

        try {
          const response = await fetch('/api/workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workflowType: type, title }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create session');
          }

          const data: SessionResponse = await response.json();

          set((state) => {
            state.session = data.session;
            state.currentStepDef = data.currentStepDef;
            state.status = 'idle';
          });
        } catch (error) {
          set((state) => {
            state.status = 'error';
            state.error = error instanceof Error ? error.message : 'Failed to create session';
          });
        }
      },

      loadSession: async (sessionId: string) => {
        set((state) => {
          state.status = 'loading';
          state.error = null;
        });

        try {
          const response = await fetch(`/api/workflow/${sessionId}`);

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load session');
          }

          const data: SessionResponse = await response.json();

          set((state) => {
            state.session = data.session;
            state.currentStepDef = data.currentStepDef;
            state.status = 'idle';
          });
        } catch (error) {
          set((state) => {
            state.status = 'error';
            state.error = error instanceof Error ? error.message : 'Failed to load session';
          });
        }
      },

      loadActiveSessions: async () => {
        try {
          const response = await fetch('/api/workflow');

          if (!response.ok) {
            return;
          }

          const data = await response.json();

          set((state) => {
            state.activeSessions = data.sessions ?? [];
          });
        } catch {
          // Silently fail
        }
      },

      cancelSession: async () => {
        const { session } = get();
        if (!session) return;

        try {
          const response = await fetch(`/api/workflow/${session.id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            set((state) => {
              state.session = null;
              state.currentStepDef = null;
              state.status = 'idle';
            });
          }
        } catch {
          // Handle error silently
        }
      },

      clearSession: () => {
        set((state) => {
          state.session = null;
          state.currentStepDef = null;
          state.status = 'idle';
          state.error = null;
          state.lastStepCached = false;
        });
      },

      // -------------------------------------------------------------------------
      // Step Execution / 步骤执行
      // -------------------------------------------------------------------------

      executeStep: async (inputData: Record<string, unknown>, skipCache = false) => {
        const { session } = get();
        if (!session) return null;

        set((state) => {
          state.status = 'executing';
          state.error = null;
        });

        try {
          const response = await fetch(
            `/api/workflow/${session.id}/step/${session.currentStep}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inputData, skipCache }),
            }
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to execute step');
          }

          const result: StepResultResponse = await response.json();

          if (result.success) {
            // Reload session to get updated state
            await get().loadSession(session.id);

            set((state) => {
              state.lastStepCached = result.cached;
            });
          } else {
            set((state) => {
              state.status = 'error';
              state.error = result.error ?? 'Step execution failed';
            });
          }

          return result;
        } catch (error) {
          set((state) => {
            state.status = 'error';
            state.error = error instanceof Error ? error.message : 'Failed to execute step';
          });
          return null;
        }
      },

      goToStep: async (stepNumber: number) => {
        const { session } = get();
        if (!session) return;

        set((state) => {
          state.status = 'loading';
        });

        try {
          const response = await fetch(`/api/workflow/${session.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepNumber }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to navigate');
          }

          const data: SessionResponse = await response.json();

          set((state) => {
            state.session = data.session;
            state.currentStepDef = data.currentStepDef;
            state.status = 'idle';
          });
        } catch (error) {
          set((state) => {
            state.status = 'error';
            state.error = error instanceof Error ? error.message : 'Failed to navigate';
          });
        }
      },

      goBack: async () => {
        const { session } = get();
        if (!session || session.currentStep <= 0) return;
        await get().goToStep(session.currentStep - 1);
      },

      goNext: async () => {
        const { session } = get();
        if (!session || session.currentStep >= session.totalSteps - 1) return;
        await get().goToStep(session.currentStep + 1);
      },

      // -------------------------------------------------------------------------
      // State Management / 状态管理
      // -------------------------------------------------------------------------

      setUserId: (userId: string | null) => {
        set((state) => {
          state.userId = userId;
        });
      },

      setError: (error: string | null) => {
        set((state) => {
          state.error = error;
          state.status = error ? 'error' : 'idle';
        });
      },

      reset: () => {
        set(INITIAL_STATE);
      },
    })),
    {
      name: 'lucrum-workflow-store',
      skipHydration: true,
      partialize: (state) => ({
        userId: state.userId,
        // Persist session reference so it can be reloaded on navigation return
        session: state.session,
        currentStepDef: state.currentStepDef,
        activeSessions: state.activeSessions,
        lastStepCached: state.lastStepCached,
        // Exclude transient: status, error
      }),
    }
  )
);

// =============================================================================
// Selectors / 选择器
// =============================================================================

export const selectSession = (state: WorkflowStore) => state.session;
export const selectCurrentStep = (state: WorkflowStore) =>
  state.session?.currentStep ?? 0;
export const selectTotalSteps = (state: WorkflowStore) =>
  state.session?.totalSteps ?? 0;
export const selectProgress = (state: WorkflowStore) => {
  const current = state.session?.currentStep ?? 0;
  const total = state.session?.totalSteps ?? 1;
  return Math.round((current / total) * 100);
};
export const selectIsLoading = (state: WorkflowStore) =>
  state.status === 'loading';
export const selectIsExecuting = (state: WorkflowStore) =>
  state.status === 'executing';
export const selectError = (state: WorkflowStore) => state.error;
export const selectCanGoBack = (state: WorkflowStore) =>
  (state.session?.currentStep ?? 0) > 0;
export const selectCanGoForward = (state: WorkflowStore) => {
  if (!state.session) return false;
  return state.session.currentStep < state.session.totalSteps - 1;
};
export const selectStepData = (stepNumber: number) => (state: WorkflowStore) =>
  state.session?.stepData?.[stepNumber];

// =============================================================================
// Hooks / 钩子
// =============================================================================

/**
 * Hook to get workflow progress info
 * 获取工作流进度信息的钩子
 */
export function useWorkflowProgress() {
  return useWorkflowStore((state) => ({
    current: state.session?.currentStep ?? 0,
    total: state.session?.totalSteps ?? 0,
    percentage: selectProgress(state),
    isComplete: state.session?.status === 'completed',
  }));
}

/**
 * Hook to check if user can navigate
 * 检查用户是否可以导航的钩子
 */
export function useWorkflowNavigation() {
  return useWorkflowStore((state) => ({
    canGoBack: selectCanGoBack(state),
    canGoForward: selectCanGoForward(state),
    goBack: state.goBack,
    goNext: state.goNext,
    goToStep: state.goToStep,
  }));
}
