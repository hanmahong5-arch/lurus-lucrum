/**
 * useAsyncTask — Unified hook for registering async operations in the Task Registry.
 *
 * Usage:
 *   const { taskId, registerTask, updateProgress, complete, fail } = useAsyncTask();
 *
 *   // On task start:
 *   const id = registerTask({ type: 'scan', title: '扫描 — 半导体板块' });
 *
 *   // During SSE streaming:
 *   updateProgress(50, '10/20 完成');
 *
 *   // On completion:
 *   complete(resultData);
 *
 * The task entry persists in the global store across page navigation.
 * Components can check for an existing running task on mount and display
 * its last known progress instead of starting fresh.
 */

'use client';

import { useCallback, useRef } from 'react';
import {
  useTaskRegistryStore,
  type TaskType,
} from '@/lib/stores/task-registry-store';

let taskCounter = 0;

function generateTaskId(type: TaskType): string {
  taskCounter += 1;
  return `${type}-${Date.now()}-${taskCounter}`;
}

interface RegisterOptions {
  type: TaskType;
  title: string;
  id?: string;
}

export function useAsyncTask() {
  const taskIdRef = useRef<string | null>(null);
  const { addTask, updateTask, completeTask, failTask, cancelTask } =
    useTaskRegistryStore();

  const registerTask = useCallback(
    (opts: RegisterOptions): string => {
      const id = opts.id ?? generateTaskId(opts.type);
      taskIdRef.current = id;
      addTask({
        id,
        type: opts.type,
        title: opts.title,
        progress: 0,
      });
      return id;
    },
    [addTask]
  );

  const updateProgress = useCallback(
    (progress: number, progressText?: string) => {
      const id = taskIdRef.current;
      if (!id) return;
      updateTask(id, { progress, progressText, status: 'running' });
    },
    [updateTask]
  );

  const complete = useCallback(
    (result: unknown) => {
      const id = taskIdRef.current;
      if (!id) return;
      completeTask(id, result);
    },
    [completeTask]
  );

  const fail = useCallback(
    (error: string) => {
      const id = taskIdRef.current;
      if (!id) return;
      failTask(id, error);
    },
    [failTask]
  );

  const cancel = useCallback(() => {
    const id = taskIdRef.current;
    if (!id) return;
    cancelTask(id);
  }, [cancelTask]);

  return {
    taskIdRef,
    registerTask,
    updateProgress,
    complete,
    fail,
    cancel,
  };
}
