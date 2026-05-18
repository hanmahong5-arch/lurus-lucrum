/**
 * Strategy Workspace Store
 * 策略编辑工作区状态管理
 *
 * Features:
 * - Auto-save drafts every 3 seconds
 * - Cross-page state persistence
 * - Undo/Redo support (via temporal middleware)
 * - Multi-tab synchronization (via localStorage events)
 * - User-scoped data isolation (data separated by userId)
 *
 * This store ensures zero data loss when navigating between pages.
 * Each user's data is stored separately using userId-prefixed keys.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { getUserScopedKey } from '@/lib/auth/user-scoped-key';

// ============================================================================
// Types
// ============================================================================

export type AutoSaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface StrategyParameter {
  name: string;
  displayName: string;
  type: 'number' | 'boolean' | 'string' | 'list';
  value: number | boolean | string | number[];
  defaultValue?: number | boolean | string | number[];
  description?: string;
  category?: 'indicator' | 'signal' | 'risk' | 'position' | 'general';
  range?: { min?: number; max?: number };
  unit?: string;
  step?: number;
}

/**
 * Persistable backtest summary — keeps the workspace shape small. The full
 * BacktestResult can be ~MBs once trades are inlined; we save only the metric
 * snapshot + the history row id so the dashboard can rehydrate the full result
 * from /api/history/backtests/[id] on demand.
 */
export interface BacktestSummary {
  historyId?: number;
  totalReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  symbol?: string;
  completedAt: Date;
}

export interface InflightTask {
  kind: 'generate' | 'backtest';
  startedAt: Date;
  label: string;
}

export type WorkspaceViewMode = 'edit' | 'running' | 'results';

export interface StrategyWorkspace {
  // Core editing state
  strategyInput: string;
  generatedCode: string;
  parameters: StrategyParameter[];
  modifiedParams: Set<string>;

  // Metadata
  lastModified: Date;
  autoSaveStatus: AutoSaveStatus;
  lastSavedAt?: Date;

  // Name (persisted; locked once the user edits manually)
  strategyName: string;
  nameLockedByUser: boolean;

  // Generation state
  isGenerating: boolean;
  generationError: string | null;
  /** Cache hit metadata from the most recent generate call. */
  genCacheInfo?: { fromCache: boolean; savedTokens: number };

  // Backtest state
  isBacktesting: boolean;
  lastBacktestResult?: unknown;
  /** Compact serializable snapshot of the most recent backtest. */
  latestBacktestSummary?: BacktestSummary;

  // View state — surfaces persist across navigation
  viewMode: WorkspaceViewMode;
  focusedLine?: number;
  lastError?: { code: string; title: string; description: string };

  // Track in-flight work so we can show a resume banner after navigation.
  // Only the metadata is persisted; the actual promise stays in memory and
  // is cleared on unmount.
  inflightTask?: InflightTask;
}

export interface Draft {
  id: string;
  workspace: StrategyWorkspace;
  timestamp: Date;
  label?: string;
}

interface WorkspaceState {
  // User identification for data isolation
  // 用于数据隔离的用户标识
  userId: string | null;
  isInitialized: boolean;

  // Current workspace
  current: StrategyWorkspace;

  // Drafts (auto-saved versions)
  drafts: Draft[];
  maxDrafts: number;

  // Settings
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // seconds
}

interface WorkspaceActions {
  // User management - for data isolation
  // 用户管理 - 用于数据隔离
  initializeUserSpace: (userId: string) => void;
  clearUserSpace: () => void;
  getCurrentUserId: () => string | null;

  // Workspace updates
  updateStrategyInput: (input: string) => void;
  updateGeneratedCode: (code: string) => void;
  updateParameters: (params: StrategyParameter[]) => void;
  updateModifiedParams: (params: Set<string>) => void;

  // Strategy name management
  /**
   * Set the strategy name. `source: "auto"` only sets when the user hasn't
   * manually edited; `source: "user"` always sets and locks future auto names.
   */
  setStrategyName: (name: string, source?: 'auto' | 'user') => void;
  resetNameLock: () => void;

  // Generation state
  setGenerating: (isGenerating: boolean) => void;
  setGenerationError: (error: string | null) => void;
  setGenCacheInfo: (info: { fromCache: boolean; savedTokens: number } | undefined) => void;

  // Backtest state
  setBacktesting: (isBacktesting: boolean) => void;
  setBacktestResult: (result: unknown) => void;
  setLatestBacktestSummary: (summary: BacktestSummary | undefined) => void;

  // View state
  setViewMode: (mode: WorkspaceViewMode) => void;
  setFocusedLine: (line: number | undefined) => void;
  setLastError: (err: { code: string; title: string; description: string } | undefined) => void;

  // Inflight task tracking
  beginInflightTask: (task: InflightTask) => void;
  clearInflightTask: () => void;

  // Auto-save
  saveDraft: () => void;
  loadDraft: (draftId: string) => void;
  deleteDraft: (draftId: string) => void;
  clearAllDrafts: () => void;

  // Status
  markAsUnsaved: () => void;
  markAsSaved: () => void;
  markAsSaving: () => void;
  markAsSaveError: () => void;

  // Reset
  resetWorkspace: () => void;

  // Utility
  hasUnsavedChanges: () => boolean;
  getLastSavedTime: () => Date | undefined;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_WORKSPACE: StrategyWorkspace = {
  strategyInput: '',
  generatedCode: '',
  parameters: [],
  modifiedParams: new Set(),
  lastModified: new Date(),
  autoSaveStatus: 'saved',
  strategyName: '',
  nameLockedByUser: false,
  isGenerating: false,
  generationError: null,
  isBacktesting: false,
  viewMode: 'edit',
};

const INITIAL_STATE: WorkspaceState = {
  userId: null,
  isInitialized: false,
  current: INITIAL_WORKSPACE,
  drafts: [],
  maxDrafts: 10,
  autoSaveEnabled: true,
  autoSaveInterval: 3,
};

// Storage key prefix for user-scoped data
// 用户范围数据的存储键前缀
const STORAGE_KEY_BASE = 'strategy-workspace';

/**
 * Get user-scoped storage key
 * 获取用户范围的存储键
 */
function getStorageKey(userId: string | null): string {
  if (!userId) {
    return `lucrum:anonymous:${STORAGE_KEY_BASE}`;
  }
  return getUserScopedKey(STORAGE_KEY_BASE, userId);
}

/**
 * Load user's workspace data from localStorage
 * 从 localStorage 加载用户的工作区数据
 */
function loadUserWorkspaceData(userId: string): Partial<WorkspaceState> | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = getStorageKey(userId);
    const data = localStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return parsed.state || null;
  } catch (error) {
    console.error('[WorkspaceStore] Failed to load user data:', error);
    return null;
  }
}

/**
 * Clear anonymous workspace data after user logs in
 * 用户登录后清除匿名工作区数据
 */
function clearAnonymousData(): void {
  if (typeof window === 'undefined') return;

  try {
    const anonymousKey = getStorageKey(null);
    localStorage.removeItem(anonymousKey);
  } catch (error) {
    console.error('[WorkspaceStore] Failed to clear anonymous data:', error);
  }
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useStrategyWorkspaceStore = create<WorkspaceStore>()(
  persist(
    immer((set, get) => ({
      ...INITIAL_STATE,

      // ----------------------------------------------------------------------
      // User Management - for data isolation
      // 用户管理 - 用于数据隔离
      // ----------------------------------------------------------------------

      initializeUserSpace: (userId: string) => {
        const currentUserId = get().userId;

        // Skip if already initialized for the same user
        // 如果已为同一用户初始化，则跳过
        if (currentUserId === userId && get().isInitialized) {
          console.log('[WorkspaceStore] Already initialized for user:', userId);
          return;
        }

        console.log('[WorkspaceStore] Initializing user space:', userId);

        // Load user's saved data from localStorage
        // 从 localStorage 加载用户保存的数据
        const userData = loadUserWorkspaceData(userId);

        if (userData) {
          console.log('[WorkspaceStore] Loaded user data from storage');

          // Restore user's workspace
          // 恢复用户的工作区
          set((state) => {
            state.userId = userId;
            state.isInitialized = true;

            if (userData.current) {
              state.current = {
                ...INITIAL_WORKSPACE,
                ...userData.current,
                // Restore Date objects
                lastModified: new Date(userData.current.lastModified || Date.now()),
                lastSavedAt: userData.current.lastSavedAt
                  ? new Date(userData.current.lastSavedAt)
                  : undefined,
                // Restore Set from Array
                modifiedParams: new Set(
                  Array.isArray(userData.current.modifiedParams)
                    ? userData.current.modifiedParams as unknown as string[]
                    : []
                ),
                // Drop stale inflight task on user-space init (prior session).
                inflightTask: undefined,
              };
            }

            if (userData.drafts) {
              state.drafts = userData.drafts.map((d: any) => ({
                ...d,
                timestamp: new Date(d.timestamp),
                workspace: {
                  ...d.workspace,
                  lastModified: new Date(d.workspace.lastModified),
                  modifiedParams: new Set(
                    Array.isArray(d.workspace.modifiedParams)
                      ? d.workspace.modifiedParams as unknown as string[]
                      : []
                  ),
                },
              }));
            }

            state.autoSaveEnabled = userData.autoSaveEnabled ?? true;
            state.autoSaveInterval = userData.autoSaveInterval ?? 3;
          });
        } else {
          // No saved data, initialize fresh workspace for user
          // 无保存的数据，为用户初始化新的工作区
          console.log('[WorkspaceStore] No saved data, initializing fresh workspace');
          set((state) => {
            state.userId = userId;
            state.isInitialized = true;
            state.current = { ...INITIAL_WORKSPACE };
            state.drafts = [];
          });
        }

        // Clear anonymous data after login
        // 登录后清除匿名数据
        clearAnonymousData();
      },

      clearUserSpace: () => {
        console.log('[WorkspaceStore] Clearing user space');
        set((state) => {
          state.userId = null;
          state.isInitialized = false;
          state.current = { ...INITIAL_WORKSPACE };
          state.drafts = [];
        });
      },

      getCurrentUserId: () => {
        return get().userId;
      },

      // ----------------------------------------------------------------------
      // Workspace Updates
      // ----------------------------------------------------------------------

      updateStrategyInput: (input) => {
        set((state) => {
          state.current.strategyInput = input;
          state.current.lastModified = new Date();
          state.current.autoSaveStatus = 'unsaved';
        });
      },

      updateGeneratedCode: (code) => {
        set((state) => {
          state.current.generatedCode = code;
          state.current.lastModified = new Date();
          state.current.autoSaveStatus = 'unsaved';
        });
      },

      updateParameters: (params) => {
        set((state) => {
          state.current.parameters = params;
          state.current.lastModified = new Date();
          state.current.autoSaveStatus = 'unsaved';
        });
      },

      updateModifiedParams: (params) => {
        set((state) => {
          state.current.modifiedParams = params;
          state.current.lastModified = new Date();
          state.current.autoSaveStatus = 'unsaved';
        });
      },

      // ----------------------------------------------------------------------
      // Generation State
      // ----------------------------------------------------------------------

      setGenerating: (isGenerating) => {
        set((state) => {
          state.current.isGenerating = isGenerating;
        });
      },

      setGenerationError: (error) => {
        set((state) => {
          state.current.generationError = error;
        });
      },

      setGenCacheInfo: (info) => {
        set((state) => {
          state.current.genCacheInfo = info;
        });
      },

      // ----------------------------------------------------------------------
      // Strategy Name
      // ----------------------------------------------------------------------

      setStrategyName: (name, source = 'auto') => {
        set((state) => {
          if (source === 'user') {
            state.current.strategyName = name;
            state.current.nameLockedByUser = true;
          } else if (!state.current.nameLockedByUser) {
            state.current.strategyName = name;
          }
        });
      },

      resetNameLock: () => {
        set((state) => {
          state.current.nameLockedByUser = false;
        });
      },

      // ----------------------------------------------------------------------
      // View / Misc
      // ----------------------------------------------------------------------

      setLatestBacktestSummary: (summary) => {
        set((state) => {
          state.current.latestBacktestSummary = summary;
        });
      },

      setViewMode: (mode) => {
        set((state) => {
          state.current.viewMode = mode;
        });
      },

      setFocusedLine: (line) => {
        set((state) => {
          state.current.focusedLine = line;
        });
      },

      setLastError: (err) => {
        set((state) => {
          state.current.lastError = err;
        });
      },

      beginInflightTask: (task) => {
        set((state) => {
          state.current.inflightTask = task;
        });
      },

      clearInflightTask: () => {
        set((state) => {
          state.current.inflightTask = undefined;
        });
      },

      // ----------------------------------------------------------------------
      // Backtest State
      // ----------------------------------------------------------------------

      setBacktesting: (isBacktesting) => {
        set((state) => {
          state.current.isBacktesting = isBacktesting;
        });
      },

      setBacktestResult: (result) => {
        set((state) => {
          state.current.lastBacktestResult = result;
        });
      },

      // ----------------------------------------------------------------------
      // Auto-save
      // ----------------------------------------------------------------------

      saveDraft: () => {
        const state = get();
        const draft: Draft = {
          id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          workspace: { ...state.current },
          timestamp: new Date(),
        };

        set((s) => {
          // Add new draft
          s.drafts.unshift(draft);

          // Trim to max
          if (s.drafts.length > s.maxDrafts) {
            s.drafts = s.drafts.slice(0, s.maxDrafts);
          }

          // Update status
          s.current.autoSaveStatus = 'saved';
          s.current.lastSavedAt = new Date();
        });
      },

      loadDraft: (draftId) => {
        const state = get();
        const draft = state.drafts.find((d) => d.id === draftId);

        if (draft) {
          set((s) => {
            s.current = { ...draft.workspace };
          });
        }
      },

      deleteDraft: (draftId) => {
        set((state) => {
          state.drafts = state.drafts.filter((d) => d.id !== draftId);
        });
      },

      clearAllDrafts: () => {
        set((state) => {
          state.drafts = [];
        });
      },

      // ----------------------------------------------------------------------
      // Status Management
      // ----------------------------------------------------------------------

      markAsUnsaved: () => {
        set((state) => {
          state.current.autoSaveStatus = 'unsaved';
        });
      },

      markAsSaved: () => {
        set((state) => {
          state.current.autoSaveStatus = 'saved';
          state.current.lastSavedAt = new Date();
        });
      },

      markAsSaving: () => {
        set((state) => {
          state.current.autoSaveStatus = 'saving';
        });
      },

      markAsSaveError: () => {
        set((state) => {
          state.current.autoSaveStatus = 'error';
        });
      },

      // ----------------------------------------------------------------------
      // Reset
      // ----------------------------------------------------------------------

      resetWorkspace: () => {
        set((state) => {
          state.current = { ...INITIAL_WORKSPACE };
        });
      },

      // ----------------------------------------------------------------------
      // Utility
      // ----------------------------------------------------------------------

      hasUnsavedChanges: () => {
        return get().current.autoSaveStatus === 'unsaved';
      },

      getLastSavedTime: () => {
        return get().current.lastSavedAt;
      },
    })),
    {
      name: 'lucrum-strategy-workspace',
      skipHydration: true,
      // Custom storage that handles user-scoped keys
      // 自定义存储，处理用户范围的键
      storage: {
        getItem: (name: string) => {
          if (typeof window === 'undefined') return null;

          // Try to get state to determine userId
          // 尝试获取状态以确定 userId
          const state = useStrategyWorkspaceStore.getState?.();
          const userId = state?.userId;
          const key = getStorageKey(userId);

          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name: string, value: unknown) => {
          if (typeof window === 'undefined') return;

          // Get current userId from state
          // 从状态获取当前用户ID
          const state = useStrategyWorkspaceStore.getState?.();
          const userId = state?.userId;
          const key = getStorageKey(userId);

          localStorage.setItem(key, JSON.stringify(value));
        },
        removeItem: (name: string) => {
          if (typeof window === 'undefined') return;

          // Get current userId from state
          // 从状态获取当前用户ID
          const state = useStrategyWorkspaceStore.getState?.();
          const userId = state?.userId;
          const key = getStorageKey(userId);

          localStorage.removeItem(key);
        },
      },
      partialize: (state) => ({
        userId: state.userId,
        isInitialized: state.isInitialized,
        current: {
          ...state.current,
          // Convert Set to Array for serialization
          modifiedParams: Array.from(state.current.modifiedParams),
        },
        drafts: state.drafts.slice(0, 5), // Only persist last 5 drafts
        autoSaveEnabled: state.autoSaveEnabled,
        autoSaveInterval: state.autoSaveInterval,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Backwards-compatible defaults for fields added after the initial
          // schema — older localStorage payloads won't have them.
          state.current.strategyName = state.current.strategyName ?? '';
          state.current.nameLockedByUser = state.current.nameLockedByUser ?? false;
          state.current.viewMode = state.current.viewMode ?? 'edit';

          // Restore Set from Array
          if (Array.isArray(state.current.modifiedParams)) {
            state.current.modifiedParams = new Set(
              state.current.modifiedParams as unknown as string[]
            );
          }

          // Restore Date objects
          state.current.lastModified = new Date(state.current.lastModified);
          if (state.current.lastSavedAt) {
            state.current.lastSavedAt = new Date(state.current.lastSavedAt);
          }
          if (state.current.latestBacktestSummary?.completedAt) {
            state.current.latestBacktestSummary.completedAt = new Date(
              state.current.latestBacktestSummary.completedAt
            );
          }

          // Inflight task expiry: anything older than 10 minutes is stale —
          // the originating fetch promise died with the previous mount.
          if (state.current.inflightTask) {
            const started = new Date(state.current.inflightTask.startedAt);
            state.current.inflightTask.startedAt = started;
            const ageMs = Date.now() - started.getTime();
            if (ageMs > 10 * 60 * 1000) {
              state.current.inflightTask = undefined;
            }
          }

          // Restore drafts Date objects and Sets
          state.drafts = state.drafts.map((d) => ({
            ...d,
            timestamp: new Date(d.timestamp),
            workspace: {
              ...d.workspace,
              lastModified: new Date(d.workspace.lastModified),
              modifiedParams: new Set(
                d.workspace.modifiedParams as unknown as string[]
              ),
            },
          }));
        }
      },
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectWorkspace = (state: WorkspaceStore) => state.current;
export const selectAutoSaveStatus = (state: WorkspaceStore) =>
  state.current.autoSaveStatus;
export const selectHasUnsavedChanges = (state: WorkspaceStore) =>
  state.current.autoSaveStatus === 'unsaved';
export const selectDrafts = (state: WorkspaceStore) => state.drafts;
export const selectStrategyInput = (state: WorkspaceStore) =>
  state.current.strategyInput;
export const selectGeneratedCode = (state: WorkspaceStore) =>
  state.current.generatedCode;
export const selectIsGenerating = (state: WorkspaceStore) =>
  state.current.isGenerating;
export const selectIsBacktesting = (state: WorkspaceStore) =>
  state.current.isBacktesting;
export const selectUserId = (state: WorkspaceStore) => state.userId;
export const selectIsInitialized = (state: WorkspaceStore) => state.isInitialized;
export const selectStrategyName = (state: WorkspaceStore) => state.current.strategyName;
export const selectNameLockedByUser = (state: WorkspaceStore) => state.current.nameLockedByUser;
export const selectViewMode = (state: WorkspaceStore) => state.current.viewMode;
export const selectFocusedLine = (state: WorkspaceStore) => state.current.focusedLine;
export const selectGenCacheInfo = (state: WorkspaceStore) => state.current.genCacheInfo;
export const selectLastError = (state: WorkspaceStore) => state.current.lastError;
export const selectInflightTask = (state: WorkspaceStore) => state.current.inflightTask;
export const selectLatestBacktestSummary = (state: WorkspaceStore) =>
  state.current.latestBacktestSummary;

// ============================================================================
// Multi-tab Synchronization
// ============================================================================

// Listen to storage events for cross-tab sync
// 监听存储事件以实现跨标签同步
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    // Get current userId to check if this is our data
    // 获取当前用户ID以检查这是否是我们的数据
    const currentState = useStrategyWorkspaceStore.getState();
    const currentUserId = currentState.userId;
    const expectedKey = getStorageKey(currentUserId);

    // Only sync if the key matches our user's data
    // 仅当键匹配我们用户的数据时才同步
    if (e.key === expectedKey && e.newValue) {
      try {
        const newState = JSON.parse(e.newValue);
        const newTimestamp = new Date(newState.state?.current?.lastModified);
        const currentTimestamp = currentState.current.lastModified;

        if (newTimestamp > currentTimestamp) {
          // Another tab has newer data, sync it
          // 另一个标签有更新的数据，同步它
          console.log('[WorkspaceStore] Syncing from another tab for user:', currentUserId);
          useStrategyWorkspaceStore.setState(newState.state);
        }
      } catch (error) {
        console.error('[WorkspaceStore] Failed to sync from storage event:', error);
      }
    }
  });
}
