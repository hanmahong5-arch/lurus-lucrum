/**
 * Task Registry Store
 *
 * Global registry for all async tasks (backtests, scans, agent runs, etc.).
 * Persists to localStorage so tasks survive page navigation and refresh.
 *
 * Key design decisions:
 * - Max 50 tasks retained; old read+completed tasks evicted automatically
 * - Results stored inline (capped at reasonable size per task type)
 * - "read" flag tracks whether user has seen a completed result
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

export type TaskType =
  | 'backtest'
  | 'batch-backtest'
  | 'scan'
  | 'agent'
  | 'generate'
  | 'advisor';

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskEntry {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  progress?: number;
  progressText?: string;
  result?: unknown;
  error?: string;
  createdAt: number;
  completedAt?: number;
  read: boolean;
}

interface TaskRegistryState {
  tasks: TaskEntry[];

  // Actions
  addTask: (task: Omit<TaskEntry, 'createdAt' | 'read' | 'status'> & { status?: TaskStatus }) => void;
  updateTask: (id: string, patch: Partial<Pick<TaskEntry, 'status' | 'progress' | 'progressText' | 'title'>>) => void;
  completeTask: (id: string, result: unknown) => void;
  failTask: (id: string, error: string) => void;
  cancelTask: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_TASKS = 50;
const STORAGE_KEY = 'lucrum-task-registry';
// Tasks older than 24h that are read+completed get evicted
const EVICTION_AGE_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Helpers
// ============================================================================

function evictOldTasks(tasks: TaskEntry[]): TaskEntry[] {
  if (tasks.length <= MAX_TASKS) return tasks;

  const now = Date.now();
  // First pass: remove old read+completed tasks
  const filtered = tasks.filter((t) => {
    if (t.read && (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')) {
      return now - t.createdAt < EVICTION_AGE_MS;
    }
    return true;
  });

  // If still over limit, drop oldest completed tasks
  if (filtered.length > MAX_TASKS) {
    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    return sorted.slice(0, MAX_TASKS);
  }

  return filtered;
}

// ============================================================================
// Store
// ============================================================================

export const useTaskRegistryStore = create<TaskRegistryState>()(
  persist(
    immer((set) => ({
      tasks: [],

      addTask: (task) =>
        set((state) => {
          const entry: TaskEntry = {
            ...task,
            status: task.status ?? 'running',
            createdAt: Date.now(),
            read: false,
          };
          state.tasks.unshift(entry);
          state.tasks = evictOldTasks(state.tasks);
        }),

      updateTask: (id, patch) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id);
          if (!task) return;
          Object.assign(task, patch);
        }),

      completeTask: (id, result) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id);
          if (!task) return;
          task.status = 'completed';
          task.result = result;
          task.completedAt = Date.now();
          task.progress = 100;
        }),

      failTask: (id, error) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id);
          if (!task) return;
          task.status = 'failed';
          task.error = error;
          task.completedAt = Date.now();
        }),

      cancelTask: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id);
          if (!task) return;
          task.status = 'cancelled';
          task.completedAt = Date.now();
        }),

      markRead: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id);
          if (task) task.read = true;
        }),

      markAllRead: () =>
        set((state) => {
          for (const task of state.tasks) {
            if (task.status === 'completed' || task.status === 'failed') {
              task.read = true;
            }
          }
        }),

      removeTask: (id) =>
        set((state) => {
          state.tasks = state.tasks.filter((t) => t.id !== id);
        }),

      clearCompleted: () =>
        set((state) => {
          state.tasks = state.tasks.filter(
            (t) => t.status === 'pending' || t.status === 'running'
          );
        }),
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Only persist task list, not functions
      partialize: (state) => ({ tasks: state.tasks }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectAllTasks = (state: TaskRegistryState) => state.tasks;

export const selectRunningTasks = (state: TaskRegistryState) =>
  state.tasks.filter((t) => t.status === 'running' || t.status === 'pending');

export const selectCompletedTasks = (state: TaskRegistryState) =>
  state.tasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');

export const selectUnreadCount = (state: TaskRegistryState) =>
  state.tasks.filter((t) => !t.read && (t.status === 'completed' || t.status === 'failed')).length;

export const selectTaskById = (id: string) => (state: TaskRegistryState) =>
  state.tasks.find((t) => t.id === id);

export const selectRunningCount = (state: TaskRegistryState) =>
  state.tasks.filter((t) => t.status === 'running').length;
