# Story 2.6: 三阶段回测进度 (ThreeStageProgress)

Status: done

## Story

As a 用户,
I want 回测执行时看到分阶段的进度而非单一进度条,
So that 我知道系统在做什么、大概还要等多久。

## Acceptance Criteria

### AC-1: 三阶段进度渲染
**Given** 用户点击"运行回测"
**When** 回测开始执行
**Then** 显示 ThreeStageProgress 组件，包含 3 个阶段:
- 1 数据加载 (fetching_data)
- 2 信号计算 (running_backtest)
- 3 指标统计 (calculating_stats)

### AC-2: 阶段状态指示
**Given** 每个阶段
**When** 状态变化
**Then** 使用四态展示:
- waiting (灰色, step-pending): 未开始
- in-progress (蓝色动画, step-active): 当前阶段，显示百分比
- completed (绿色 checkmark, step-done): 已完成
- error (红色 X, status-block): 失败，显示错误描述

### AC-3: 百分比进度
**Given** 当前阶段状态为 in-progress
**When** 百分比更新
**Then** 进度条平滑填充，百分比使用 Data MD (14px, font-mono)

### AC-4: 样式规范
**Given** ThreeStageProgress 组件
**When** 渲染
**Then**
- 进度条使用 primary (#3b82f6) 填充色
- 底色使用 bg-surface-elevated
- 基于 Radix UI Progress x 3 + 自定义容器

### AC-5: 完成与失败状态
**Given** 回测执行
**When** 完成时 -> 短暂 (500ms) 显示全部 checkmark 后通过 onComplete 回调通知父组件
**When** 失败时 -> 失败阶段显示红色 X + 错误描述

### AC-6: 减弱动画支持
**Given** 用户系统设置 prefers-reduced-motion
**When** 组件渲染
**Then** 进度条无过渡动画，直接更新宽度

### AC-7: 无障碍
**Given** 屏幕阅读器用户
**When** 使用组件
**Then** 每个进度条有 aria-label 和 aria-valuenow
**And** 状态变化通过 aria-live="polite" 通知

### AC-8: 组件测试
**Given** ThreeStageProgress 组件
**When** 运行测试
**Then** 覆盖:
- 三阶段状态流转 (waiting -> in-progress -> completed)
- 百分比更新
- 完成状态 (all checkmark)
- 失败状态 (error display)
- 减弱动画 (prefers-reduced-motion)
- aria 属性

## Technical Design

### Component Location
`src/components/feedback/three-stage-progress.tsx`

### Types (mapped from BacktestProgress.phase)
```typescript
type StageStatus = "waiting" | "in-progress" | "completed" | "error";

interface StageInfo {
  id: string;
  label: string;
  status: StageStatus;
  progress: number; // 0-100
  errorMessage?: string;
}

interface ThreeStageProgressProps {
  stages: StageInfo[];
  onComplete?: () => void;
  className?: string;
}
```

### Mapping from BacktestProgress
| BacktestProgress.phase | Stage |
|------------------------|-------|
| init / fetching_data   | Stage 1: data loading |
| running_backtest       | Stage 2: signal calculation |
| calculating_stats / generating_report | Stage 3: metrics calculation |

### File Changes
1. NEW: `src/components/feedback/three-stage-progress.tsx` - Main component
2. NEW: `src/components/feedback/__tests__/three-stage-progress.test.tsx` - Unit tests
3. EDIT: `src/components/backtest/index.ts` - Add export (if integrated)

### Dependencies
- `@radix-ui/react-progress` (already installed)
- `lucide-react` (for Check/X icons, already installed)
- Design tokens: step-active, step-done, step-pending, status-block, bg-surface-elevated

## Test Plan

1. Rendering: 3 stages display with correct labels
2. Status flow: waiting -> in-progress -> completed for each stage
3. Progress: percentage display updates correctly
4. Completion: onComplete callback fires after 500ms delay
5. Error: failed stage shows red X and error message
6. Accessibility: aria-label, aria-valuenow, aria-live
7. Reduced motion: no transition animations

## Definition of Done

- [x] Component implemented with all AC covered
- [x] Unit tests written and passing
- [x] TypeScript strict mode passes
- [x] Lint passes
- [x] Design tokens used (no hardcoded colors)
- [x] Accessible (ARIA attributes)
- [x] Reduced motion supported
