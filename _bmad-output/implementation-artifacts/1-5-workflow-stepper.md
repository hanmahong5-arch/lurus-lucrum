# Story 1.5: 工作流步骤导航

Status: done

## Story

As a 用户,
I want 始终看到当前在工作流的哪一步,
So that 我清楚地知道整个流程进度和下一步该做什么。

## Acceptance Criteria

### AC-1: 步骤显示与状态
**Given** 用户在策略工作流或回测流程中
**When** WorkflowStepper 组件渲染
**Then** 显示 5 个步骤:
- ⓪ 起点 → ① 输入 → ② 生成 → ③ 回测 → ④ 验证
- 每步显示序号和标签

### AC-2: 步骤状态样式
**Given** WorkflowStepper 渲染
**When** 各步骤有不同状态
**Then** 显示对应样式:
- completed: ✓ 图标 + `step-done` 绿色
- current: 数字 + `step-active` 蓝色高亮
- pending: 数字 + `step-pending` 灰色
- error: ✕ 图标 + `status-block` 红色

### AC-3: 步骤连线
**Given** 步骤间需要视觉连接
**When** WorkflowStepper 渲染
**Then** 步骤间显示连线:
- 已完成段: 实线 (`step-done` 绿色)
- 未完成段: 虚线 (`step-pending` 灰色)

### AC-4: 步骤交互
**Given** 用户想跳转到已完成的步骤
**When** 点击步骤
**Then**:
- completed 步骤: 可点击，触发 `onStepClick` 回调
- current 步骤: 可点击，触发回调
- pending 步骤: 不可点击 (`cursor-not-allowed`)
- error 步骤: 可点击，触发回调

### AC-5: 响应式布局
**Given** 不同屏幕尺寸
**When** WorkflowStepper 渲染
**Then**:
- 桌面端 (≥ 768px): 水平布局
- 移动端 (< 768px): 纵向布局

### AC-6: 过渡动画
**Given** 步骤状态切换
**When** 状态变化
**Then**:
- 使用 300ms ease-in-out 过渡
- `prefers-reduced-motion` 下禁用过渡动画

### AC-7: 无障碍支持
**Given** 屏幕阅读器用户
**When** WorkflowStepper 渲染
**Then**:
- 使用 `role="navigation"`
- 添加 `aria-label="工作流步骤"`
- 当前步骤使用 `aria-current="step"`
- 不可点击步骤有 `aria-disabled="true"`

### AC-8: 组件 Props 接口
**Given** WorkflowStepper 需要灵活配置
**When** 开发者使用组件
**Then** 支持以下 Props:
- `steps: Array<{label: string, status: StepStatus}>`
- `currentStep: number`
- `onStepClick?: (index: number) => void`
- `className?: string`

### AC-9: 组件测试覆盖
**Given** WorkflowStepper 需要质量保障
**When** 运行测试套件
**Then** 测试覆盖:
- 各状态渲染 (completed/current/pending/error)
- 点击跳转回调
- aria 属性
- 响应式布局样式类

## Tasks / Subtasks

- [x] Task 1: 创建 WorkflowStepper 基础组件 (AC: #1, #2, #8)
  - [x] 1.1 创建 `src/components/workflow/workflow-stepper.tsx`
  - [x] 1.2 定义 StepStatus 类型 (completed/current/pending/error)
  - [x] 1.3 定义 Props 接口
  - [x] 1.4 实现步骤渲染逻辑

- [x] Task 2: 实现步骤状态样式 (AC: #2)
  - [x] 2.1 实现 completed 状态 (Check 图标 + step-done 绿色)
  - [x] 2.2 实现 current 状态 (数字 + step-active 蓝色 + ring)
  - [x] 2.3 实现 pending 状态 (数字 + step-pending 灰色)
  - [x] 2.4 实现 error 状态 (X 图标 + status-block 红色)

- [x] Task 3: 实现步骤连线 (AC: #3)
  - [x] 3.1 实现已完成段实线 (bg-step-done)
  - [x] 3.2 实现未完成段虚线 (border-dashed)
  - [x] 3.3 处理最后一步不显示连线

- [x] Task 4: 实现交互逻辑 (AC: #4)
  - [x] 4.1 实现 completed/current/error 步骤可点击
  - [x] 4.2 实现 pending 步骤禁用 (aria-disabled)
  - [x] 4.3 添加 cursor-pointer/cursor-not-allowed
  - [x] 4.4 支持 Enter/Space 键盘导航

- [x] Task 5: 实现响应式布局 (AC: #5)
  - [x] 5.1 桌面端水平布局 (md:flex-row)
  - [x] 5.2 移动端纵向布局 (flex-col)
  - [x] 5.3 使用 Tailwind md 断点

- [x] Task 6: 实现过渡动画 (AC: #6)
  - [x] 6.1 添加 duration-300 ease-in-out 过渡
  - [x] 6.2 motion-reduce:transition-none

- [x] Task 7: 无障碍实现 (AC: #7)
  - [x] 7.1 添加 role="navigation"
  - [x] 7.2 添加 aria-label="工作流步骤"
  - [x] 7.3 添加 aria-current="step" on current
  - [x] 7.4 添加 aria-disabled="true" on pending
  - [x] 7.5 tabIndex 0/-1 for keyboard focus

- [x] Task 8: 编写单元测试 (AC: #9)
  - [x] 8.1 测试各状态渲染 (45 tests)
  - [x] 8.2 测试点击回调
  - [x] 8.3 测试 aria 属性
  - [x] 8.4 测试响应式样式类
  - [x] 8.5 测试 createStepsFromCurrentIndex helper

## Dev Notes

### 架构模式遵循

- **组件位置**: `src/components/workflow/workflow-stepper.tsx`
- **设计令牌**: 使用 Story 1.1 实现的 CSS 变量
  - completed: `step-done` (#22c55e 绿色)
  - current: `step-active` (#3b82f6 蓝色)
  - pending: `step-pending` (#64748b 灰色, Story 1.1 review 修正)
  - error: `status-block` (#ef4444 红色)

### WorkflowStepper 布局参考

**桌面端 (水平)**:
```
⓪ 起点  ──▶  ① 输入  ──▶  ② 生成  ──▶  ③ 回测  ──▶  ④ 验证
  ✓           ✓          [当前]       ○           ○
```

**移动端 (纵向)**:
```
✓ 起点
│
✓ 输入
│
● 生成 ← 当前
┊
○ 回测
┊
○ 验证
```

### Props 接口设计

```typescript
type StepStatus = 'completed' | 'current' | 'pending' | 'error';

interface WorkflowStep {
  label: string;
  status: StepStatus;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}
```

### 默认步骤配置

```typescript
const DEFAULT_STEPS = [
  { label: '起点', status: 'completed' },
  { label: '输入', status: 'completed' },
  { label: '生成', status: 'current' },
  { label: '回测', status: 'pending' },
  { label: '验证', status: 'pending' },
];
```

### 关键技术约束

1. **响应式断点**: md (768px)
2. **过渡时长**: 300ms (normal)
3. **过渡函数**: ease-in-out
4. **连线样式**: border-dashed / border-solid
5. **禁用样式**: cursor-not-allowed, opacity-50

### 状态图标映射

| 状态 | 图标 | Lucide |
|------|------|--------|
| completed | ✓ | `Check` |
| current | 数字 | - |
| pending | 数字 | - |
| error | ✕ | `X` |

### 相关现有代码

| 文件 | 职责 | 修改类型 |
|------|------|---------|
| `gushen-web/src/components/workflow/` | 工作流组件目录 | 新增 |
| `gushen-web/tailwind.config.ts` | 设计令牌 | 已有 step-* 颜色 |

### Previous Story Intelligence

- Story 1.1: 设计令牌已实现，step-done/step-active/step-pending 颜色可用
- Story 1.3: StatusBar 使用了 workflow step 概念，可参考状态设计
- Story 1.4: EmptyState 使用了 role="status"，Stepper 使用 role="navigation"

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] - Story 定义
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#WorkflowStepper] - 组件规范
- [Source: gushen-web/tailwind.config.ts] - 设计令牌配置

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without blocking issues.

### Completion Notes List

- Created WorkflowStepper component at `src/components/workflow/workflow-stepper.tsx`
- 4 step statuses: completed (Check icon + green), current (number + blue ring), pending (number + gray), error (X icon + red)
- Step connectors: solid for completed, dashed for pending
- Click interaction: completed/current/error steps clickable, pending disabled
- Keyboard navigation: Enter/Space support, tabIndex management
- Responsive: flex-col on mobile, md:flex-row on desktop
- Transitions: 300ms ease-in-out, motion-reduce:transition-none
- Accessibility: role="navigation", aria-label, aria-current="step", aria-disabled
- Helper: createStepsFromCurrentIndex for easy step generation
- Default steps: 起点 → 输入 → 生成 → 回测 → 验证
- All 45 unit tests pass
- TypeScript strict mode compliance verified

### File List

- gushen-web/src/components/workflow/workflow-stepper.tsx (new - WorkflowStepper component)
- gushen-web/src/components/workflow/__tests__/workflow-stepper.test.tsx (new - 45 tests)

## Change Log

- 2026-02-05: Story 1.5 implemented - WorkflowStepper with 5 steps, 4 statuses, responsive layout, accessibility, and 45 tests
- 2026-02-05: Code review fix - Removed unused isVertical prop, simplified responsive logic via CSS flex classes, connector hidden on mobile
- 2026-02-11: Code review — Approved, no code changes. 0 HIGH issues. Updated stale step-pending color reference in Dev Notes.

### Review Follow-ups

- [ ] [MEDIUM-1] `git add` all new files: workflow-stepper.tsx, __tests__/
- [ ] [MEDIUM-2] Integrate WorkflowStepper into strategy workflow page

## Senior Developer Review (AI)

**Reviewer:** Anita | **Date:** 2026-02-11 | **Verdict:** Approved (no code changes needed)

**Issues Found:** 0 HIGH, 2 MEDIUM, 4 LOW

**No code fixes required.** Clean component architecture with good separation of concerns. All 45 tests pass.

**Remaining action items:** MEDIUM-1 (git add), MEDIUM-2 (integrate into workflow page)

**Test verification:** `bun run test -- --run workflow-stepper.test.tsx` → 45 passed, 0 failed

