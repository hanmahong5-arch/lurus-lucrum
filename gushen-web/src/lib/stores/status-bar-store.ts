/**
 * Status Bar Store
 * 底部状态栏状态存储
 *
 * Zustand store for managing global status bar state.
 * Provides save status, data source, workflow step, and network status.
 *
 * Story 1.3: 底部状态栏
 */

import { create } from "zustand";
import { useEffect } from "react";

// =============================================================================
// Types / 类型
// =============================================================================

/**
 * Save status types
 * - saved: Changes saved successfully (绿色)
 * - saving: Save in progress (蓝色)
 * - unsaved: Unsaved changes (灰色)
 * - error: Save failed (红色)
 */
export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

/**
 * Data source types
 * - db: Real database data (蓝色)
 * - api: Real-time API data (黄色)
 * - simulated: Simulated data (灰色)
 */
export type DataSource = "db" | "api" | "simulated";

/**
 * Network status types
 */
export type NetworkStatus = "online" | "offline";

/**
 * Workflow step information
 */
export interface WorkflowStep {
  current: number;
  total: number;
}

/**
 * Status bar state
 */
export interface StatusBarState {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Current data source (null when not applicable) */
  dataSource: DataSource | null;
  /** Current workflow step (null when not in workflow) */
  workflowStep: WorkflowStep | null;
  /** Current network status */
  networkStatus: NetworkStatus;
}

/**
 * Status bar actions
 */
export interface StatusBarActions {
  /** Update save status */
  setSaveStatus: (status: SaveStatus) => void;
  /** Update data source */
  setDataSource: (source: DataSource | null) => void;
  /** Update workflow step */
  setWorkflowStep: (step: WorkflowStep | null) => void;
  /** Update network status */
  setNetworkStatus: (status: NetworkStatus) => void;
  /** Reset to initial state */
  reset: () => void;
}

export type StatusBarStore = StatusBarState & StatusBarActions;

// =============================================================================
// Initial State / 初始状态
// =============================================================================

const INITIAL_STATE: StatusBarState = {
  saveStatus: "saved",
  dataSource: null,
  workflowStep: null,
  networkStatus: "online",
};

// =============================================================================
// Store / 存储
// =============================================================================

/**
 * Status Bar Store
 *
 * @example
 * ```tsx
 * import { useStatusBarStore } from '@/lib/stores/status-bar-store';
 *
 * // In component
 * const { saveStatus, setSaveStatus } = useStatusBarStore();
 *
 * // Update save status
 * setSaveStatus('saving');
 * await saveData();
 * setSaveStatus('saved');
 *
 * // Update data source
 * const { setDataSource } = useStatusBarStore.getState();
 * setDataSource('db');
 * ```
 */
export const useStatusBarStore = create<StatusBarStore>((set) => ({
  // Initial state
  ...INITIAL_STATE,

  // Actions
  setSaveStatus: (status) => set({ saveStatus: status }),

  setDataSource: (source) => set({ dataSource: source }),

  setWorkflowStep: (step) => set({ workflowStep: step }),

  setNetworkStatus: (status) => set({ networkStatus: status }),

  reset: () => set(INITIAL_STATE),
}));

// =============================================================================
// Selectors / 选择器
// =============================================================================

/**
 * Selector for save status
 */
export const selectSaveStatus = (state: StatusBarStore) => state.saveStatus;

/**
 * Selector for data source
 */
export const selectDataSource = (state: StatusBarStore) => state.dataSource;

/**
 * Selector for workflow step
 */
export const selectWorkflowStep = (state: StatusBarStore) => state.workflowStep;

/**
 * Selector for network status
 */
export const selectNetworkStatus = (state: StatusBarStore) =>
  state.networkStatus;

// =============================================================================
// Utility Hooks / 工具 Hooks
// =============================================================================

/**
 * Hook to listen for network status changes
 * Automatically updates the store when network status changes
 *
 * @example
 * ```tsx
 * // In a top-level component (e.g., layout)
 * import { useNetworkStatusListener } from '@/lib/stores/status-bar-store';
 *
 * function Layout({ children }) {
 *   useNetworkStatusListener();
 *   return <>{children}</>;
 * }
 * ```
 */
export function useNetworkStatusListener() {
  const setNetworkStatus = useStatusBarStore((state) => state.setNetworkStatus);

  useEffect(() => {
    // Skip on server-side
    if (typeof window === "undefined") {
      return;
    }

    // Update status based on navigator.onLine
    const updateStatus = () => {
      setNetworkStatus(navigator.onLine ? "online" : "offline");
    };

    // Set initial status
    updateStatus();

    // Listen for changes
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, [setNetworkStatus]);
}

export default useStatusBarStore;
