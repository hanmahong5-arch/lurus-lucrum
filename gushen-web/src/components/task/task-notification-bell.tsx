'use client';

/**
 * Task Notification Bell
 *
 * Displays a bell icon in the dashboard header with a badge showing
 * unread completed task count. Click opens a dropdown listing all tasks.
 */

import { useState } from 'react';
import { Bell } from 'lucide-react';
import {
  useTaskRegistryStore,
  selectRunningTasks,
  selectCompletedTasks,
  selectUnreadCount,
  selectRunningCount,
  type TaskEntry,
  type TaskStatus,
} from '@/lib/stores/task-registry-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// Status helpers
// ============================================================================

const STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string }> = {
  pending: { label: '等待中', dot: 'bg-white/30' },
  running: { label: '进行中', dot: 'bg-accent animate-pulse' },
  completed: { label: '已完成', dot: 'bg-profit' },
  failed: { label: '失败', dot: 'bg-loss' },
  cancelled: { label: '已取消', dot: 'bg-white/30' },
};

const TYPE_LABELS: Record<string, string> = {
  backtest: '回测',
  'batch-backtest': '批量回测',
  scan: '扫描',
  agent: 'Agent',
  generate: '策略生成',
  advisor: '顾问对话',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(start: number, end?: number): string {
  const ms = (end ?? Date.now()) - start;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m${secs}s`;
}

// ============================================================================
// Task Row
// ============================================================================

function TaskRow({ task, onMarkRead }: { task: TaskEntry; onMarkRead: (id: string) => void }) {
  const cfg = STATUS_CONFIG[task.status];
  const isFinished = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';

  return (
    <button
      className={`w-full text-left px-3 py-2.5 hover:bg-white/5 transition rounded-md ${
        !task.read && isFinished ? 'bg-accent/5' : ''
      }`}
      onClick={() => {
        if (!task.read && isFinished) onMarkRead(task.id);
      }}
    >
      <div className="flex items-center gap-2">
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

        {/* Title + type */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${!task.read && isFinished ? 'text-white font-medium' : 'text-white/70'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-white/40">{TYPE_LABELS[task.type] ?? task.type}</span>
            <span className="text-[10px] text-white/30">{formatTime(task.createdAt)}</span>
            {isFinished && (
              <span className="text-[10px] text-white/30">
                {formatDuration(task.createdAt, task.completedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Progress or status */}
        <div className="shrink-0 text-right">
          {task.status === 'running' && task.progress != null ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-accent font-mono tabular-nums">{task.progress}%</span>
              {task.progressText && (
                <span className="text-[10px] text-white/40">{task.progressText}</span>
              )}
            </div>
          ) : (
            <span className={`text-[10px] ${task.status === 'failed' ? 'text-loss' : 'text-white/40'}`}>
              {cfg.label}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar for running tasks */}
      {task.status === 'running' && task.progress != null && (
        <div className="mt-1.5 w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${Math.min(100, task.progress)}%` }}
          />
        </div>
      )}

      {/* Error message */}
      {task.status === 'failed' && task.error && (
        <p className="mt-1 text-[10px] text-loss/70 truncate">{task.error}</p>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskNotificationBell() {
  const runningTasks = useTaskRegistryStore(selectRunningTasks);
  const completedTasks = useTaskRegistryStore(selectCompletedTasks);
  const unreadCount = useTaskRegistryStore(selectUnreadCount);
  const runningCount = useTaskRegistryStore(selectRunningCount);
  const { markRead, markAllRead, clearCompleted } = useTaskRegistryStore();

  const [tab, setTab] = useState<'running' | 'completed'>('running');

  const hasTasks = runningTasks.length > 0 || completedTasks.length > 0;
  const badgeCount = unreadCount + runningCount;

  const displayTasks = tab === 'running' ? runningTasks : completedTasks;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-1.5 rounded-md text-white/50 hover:text-white/80 hover:bg-white/5 transition"
          aria-label={`任务通知${badgeCount > 0 ? `，${badgeCount} 条未读` : ''}`}
        >
          <Bell className="w-4 h-4" />

          {/* Badge */}
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-600 leading-none">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}

          {/* Running pulse ring */}
          {runningCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent/30 animate-ping" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-[480px] p-0">
        {/* Header with tabs */}
        <div className="flex items-center border-b border-border">
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium transition ${
              tab === 'running'
                ? 'text-accent border-b-2 border-accent'
                : 'text-white/50 hover:text-white/70'
            }`}
            onClick={() => setTab('running')}
          >
            进行中{runningTasks.length > 0 && ` (${runningTasks.length})`}
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium transition ${
              tab === 'completed'
                ? 'text-accent border-b-2 border-accent'
                : 'text-white/50 hover:text-white/70'
            }`}
            onClick={() => setTab('completed')}
          >
            已完成{unreadCount > 0 && ` (${unreadCount})`}
          </button>
        </div>

        {/* Task list */}
        <div className="overflow-y-auto max-h-[380px] p-1">
          {displayTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/30">
              {tab === 'running' ? '没有进行中的任务' : '没有已完成的任务'}
            </div>
          ) : (
            displayTasks.map((task) => (
              <TaskRow key={task.id} task={task} onMarkRead={markRead} />
            ))
          )}
        </div>

        {/* Footer actions */}
        {hasTasks && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-3 py-1.5">
              {tab === 'completed' && unreadCount > 0 && (
                <button
                  className="text-[10px] text-white/40 hover:text-white/60 transition"
                  onClick={markAllRead}
                >
                  全部已读
                </button>
              )}
              {tab === 'completed' && completedTasks.length > 0 && (
                <button
                  className="text-[10px] text-white/40 hover:text-white/60 transition ml-auto"
                  onClick={clearCompleted}
                >
                  清除记录
                </button>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
