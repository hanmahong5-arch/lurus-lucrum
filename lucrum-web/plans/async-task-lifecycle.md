# Async Task Lifecycle Management — Implementation Plan

## Problem
Users lose async task results when navigating away. 6/8 async operations have no persistence or cross-page notification.

## Architecture

```
DashboardHeader
  └── TaskNotificationBell ← badge count, click to open drawer
        └── TaskDrawer (Sheet) ← list all tasks, click to view result

task-registry-store.ts (Zustand + persist)
  └── tasks: Map<id, TaskEntry>
  └── addTask / updateTask / completeTask / removeTask

useAsyncTask(config) hook
  └── wraps SSE/fetch, auto-registers to store
  └── on progress → updateTask
  └── on complete → completeTask + persist result
  └── on nav-away → task stays in store (not lost)
```

## Step-by-Step

### Step 1: Task Registry Store
File: `src/lib/stores/task-registry-store.ts`

```ts
type TaskType = 'backtest' | 'batch-backtest' | 'scan' | 'agent' | 'generate' | 'advisor';
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface TaskEntry {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;           // e.g. "扫描 — 半导体板块"
  progress?: number;        // 0-100
  progressText?: string;    // e.g. "12/20 完成"
  result?: unknown;         // type-specific result payload
  error?: string;
  createdAt: number;
  completedAt?: number;
  read: boolean;            // user has seen the result
}
```

- Zustand with `persist` middleware (localStorage key: `lucrum-task-registry`)
- Max 50 tasks retained (FIFO eviction of read+completed tasks older than 24h)
- Selectors: `selectRunningTasks`, `selectUnreadCount`, `selectTasksByType`

### Step 2: useAsyncTask Hook
File: `src/hooks/use-async-task.ts`

Unified hook that:
- Creates a task entry on start
- Updates progress during SSE streaming
- Saves result on completion
- Does NOT abort SSE on unmount — keeps reader alive via store ref
- Returns `{ taskId, status, progress, result, cancel }`

Key design: SSE reader reference stored in a module-level Map (not React state),
so component unmount doesn't kill the stream. On re-mount, hook reconnects to
existing task via taskId.

### Step 3: TaskNotificationBell Component
File: `src/components/task/task-notification-bell.tsx`

- Bell icon in DashboardHeader (between LocaleSwitcher and QuotaBar)
- Badge shows unread completed count
- Click opens TaskDrawer (Sheet from right)
- Pulse animation when new task completes

### Step 4: TaskDrawer Component
File: `src/components/task/task-drawer.tsx`

- Sheet (Radix) sliding from right
- Tabs: "进行中" / "已完成"
- Each task row: icon + title + status badge + progress bar + timestamp
- Click on completed task → expand inline to show result summary
- "查看详情" link navigates to the source page with result pre-loaded
- "清除已读" button

### Step 5: Integration — Patch Existing SSE Consumers

| Consumer | File | Change |
|----------|------|--------|
| AI Backtest Agent | `BacktestAgentPanel.tsx` | Wrap SSE call with `useAsyncTask({type:'agent'})` |
| Scanner Agent | `ScannerPanel.tsx` | Wrap SSE call with `useAsyncTask({type:'scan'})` |
| Custom Agent | `custom-agent-run-panel.tsx` | Wrap SSE call with `useAsyncTask({type:'agent'})` |
| Batch Backtest | `use-batch-backtest.ts` | Wrap SSE call with `useAsyncTask({type:'batch-backtest'})` |
| AI Strategy Gen | `ai-strategy-assistant.tsx` | Wrap fetch with `useAsyncTask({type:'generate'})` |
| Single Backtest | `backtest-panel.tsx` | Register to store on start (already has history persistence) |

### Step 6: DashboardHeader Integration
File: `src/components/dashboard/dashboard-header.tsx`

- Import and render `TaskNotificationBell` next to LocaleSwitcher
- No other header changes needed

## Implementation Order

1. task-registry-store.ts (foundation)
2. use-async-task.ts (hook)
3. task-notification-bell.tsx + task-drawer.tsx (UI)
4. dashboard-header.tsx integration
5. Patch 6 consumers one by one
6. Build verification

## Non-Goals (This Phase)
- Server-side task queue (Redis) — future enhancement
- DB persistence of task results — localStorage is sufficient for now
- WebSocket push notifications — polling store is enough
- Resume interrupted SSE streams — tasks restart, but results of completed tasks are preserved
