/**
 * Thread Store - In-memory storage for conversation threads
 * 线程存储 - 内存中的会话线程存储
 *
 * This is a shared storage module for Agent Protocol threads.
 * In production, this should be replaced with Redis or PostgreSQL.
 * 这是 Agent Protocol 线程的共享存储模块。
 * 在生产环境中，应该替换为 Redis 或 PostgreSQL。
 */

import type { ThreadState } from "@/lib/agent/graphs/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Stored thread with additional metadata
 * 带有额外元数据的存储线程
 */
export interface StoredThread extends ThreadState {
  /** IDs of runs associated with this thread */
  runs: string[];
  /** Total message count in this thread */
  messageCount: number;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

/**
 * In-memory thread storage (use Redis/DB in production)
 * 内存线程存储（生产环境使用 Redis/数据库）
 */
const threadStore = new Map<string, StoredThread>();

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get a thread by ID
 * 根据 ID 获取线程
 */
export function getThread(threadId: string): StoredThread | undefined {
  return threadStore.get(threadId);
}

/**
 * Set/update a thread
 * 设置/更新线程
 */
export function setThread(threadId: string, thread: StoredThread): void {
  threadStore.set(threadId, thread);
}

/**
 * Delete a thread
 * 删除线程
 */
export function deleteThread(threadId: string): boolean {
  return threadStore.delete(threadId);
}

/**
 * Check if a thread exists
 * 检查线程是否存在
 */
export function hasThread(threadId: string): boolean {
  return threadStore.has(threadId);
}

/**
 * Get all threads as an array
 * 获取所有线程作为数组
 */
export function getAllThreads(): StoredThread[] {
  return Array.from(threadStore.values());
}

/**
 * Get the total number of threads
 * 获取线程总数
 */
export function getThreadCount(): number {
  return threadStore.size;
}

/**
 * Clear all threads
 * 清除所有线程
 */
export function clearAllThreads(): number {
  const count = threadStore.size;
  threadStore.clear();
  return count;
}

/**
 * Update thread's updatedAt timestamp
 * 更新线程的 updatedAt 时间戳
 */
export function touchThread(threadId: string): void {
  const thread = threadStore.get(threadId);
  if (thread) {
    thread.updatedAt = new Date();
    threadStore.set(threadId, thread);
  }
}

/**
 * Add a run ID to a thread
 * 向线程添加运行 ID
 */
export function addRunToThread(threadId: string, runId: string): void {
  const thread = threadStore.get(threadId);
  if (thread) {
    thread.runs.push(runId);
    thread.updatedAt = new Date();
    threadStore.set(threadId, thread);
  }
}

/**
 * Increment message count for a thread
 * 增加线程的消息计数
 */
export function incrementMessageCount(threadId: string, count: number = 1): void {
  const thread = threadStore.get(threadId);
  if (thread) {
    thread.messageCount += count;
    thread.updatedAt = new Date();
    threadStore.set(threadId, thread);
  }
}
