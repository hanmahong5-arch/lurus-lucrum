# Story 1.3: 底部状态栏

Status: done

## Story

As a 用户,
I want 屏幕底部始终显示当前系统状态,
So that 我无需切换页面就能知道保存状态、数据来源、工作流步骤和网络连接。

## Acceptance Criteria

### AC-1: 状态栏布局与样式
**Given** 用户在桌面端 (≥ 768px) 使用平台
**When** 页面加载完成
**Then** 屏幕底部固定显示 StatusBar:
- 使用 `bg-surface` + `border-t` 样式
- 高度 28px
- 各 Slot 使用 flexbox 水平排列，分隔符为竖线

### AC-2: 保存状态 Slot (save-status)
**Given** StatusBar 渲染
**When** 保存状态变化
**Then** 显示对应状态:
- "● 已保存" - 绿色状态灯 (`--gushen-color-status-ready`)
- "● 保存中..." - 蓝色状态灯 (`--gushen-color-primary`)
- "● 未保存" - 灰色状态灯 (`--gushen-color-step-pending`)
- "● 保存失败" - 红色状态灯 (`--gushen-color-status-block`)

### AC-3: 数据来源 Slot (data-source)
**Given** StatusBar 渲染
**When** 数据来源确定
**Then** 显示:
- "DB" - 真实数据库数据 (`text-source-db`)
- "API" - 实时 API 数据 (`text-source-api`)
- "模拟" - 模拟数据 (`text-source-sim`)

### AC-4: 工作流步骤 Slot (workflow-step)
**Given** 用户在工作流中
**When** StatusBar 渲染
**Then** 显示 "步骤 N/4" (N = 当前步骤)
**And** 不在工作流中时隐藏此 Slot

### AC-5: 网络状态 Slot (network)
**Given** StatusBar 渲染
**When** 网络状态变化
**Then** 显示:
- "✓" - 网络正常 (绿色)
- "✕ 网络断开" - 网络断开 (红色)

### AC-6: 无障碍支持
**Given** 屏幕阅读器用户
**When** 状态变化
**Then** StatusBar 使用 `role="status"` + `aria-live="polite"`
**And** 各状态有描述性文字

### AC-7: 响应式隐藏
**Given** 用户在移动端 (< 768px)
**When** 页面渲染
**Then** StatusBar 隐藏
**And** 状态通过 Toast 替代反馈

### AC-8: Zustand Store 集成
**Given** StatusBar 需要外部状态
**When** 状态更新
**Then** StatusBar 通过 Zustand store 获取状态数据
**And** 支持外部更新各 Slot 状态

### AC-9: 组件测试覆盖
**Given** StatusBar 需要质量保障
**When** 运行测试套件
**Then** 测试覆盖:
- 各状态变体渲染
- Slot 更新响应
- 响应式隐藏
- Zustand store 集成

## Tasks / Subtasks

- [x] Task 1: 创建 StatusBar Zustand Store (AC: #8)
  - [x] 1.1 创建 `src/lib/stores/status-bar-store.ts`
  - [x] 1.2 定义状态类型 (SaveStatus, DataSource, NetworkStatus)
  - [x] 1.3 实现 actions (setSaveStatus, setDataSource, setWorkflowStep, setNetworkStatus)

- [x] Task 2: 创建 StatusBar 组件 (AC: #1, #2, #3, #4, #5)
  - [x] 2.1 创建 `src/components/layout/status-bar.tsx`
  - [x] 2.2 实现 save-status slot 及四种状态
  - [x] 2.3 实现 data-source slot 及三种来源
  - [x] 2.4 实现 workflow-step slot
  - [x] 2.5 实现 network slot
  - [x] 2.6 添加竖线分隔符样式

- [x] Task 3: 样式与响应式 (AC: #1, #7)
  - [x] 3.1 应用 bg-surface + border-t 样式
  - [x] 3.2 设置高度 28px (h-7)
  - [x] 3.3 实现 flexbox 水平布局
  - [x] 3.4 在 < 768px 时隐藏 StatusBar (hidden md:flex)

- [x] Task 4: 无障碍实现 (AC: #6)
  - [x] 4.1 添加 role="status"
  - [x] 4.2 添加 aria-live="polite"
  - [x] 4.3 添加描述性 aria-label 文字

- [x] Task 5: 编写单元测试 (AC: #9)
  - [x] 5.1 测试各状态变体渲染
  - [x] 5.2 测试 Zustand store 集成
  - [x] 5.3 测试响应式隐藏样式类

## Dev Notes

### 架构模式遵循

- **组件位置**: `src/components/layout/status-bar.tsx`
- **Store 位置**: `src/lib/stores/status-bar-store.ts`
- **设计令牌**: 使用 Story 1.1 实现的 CSS 变量
  - 已保存: `rgb(var(--gushen-color-status-ready))` (绿色)
  - 保存中: `--primary` (蓝色)
  - 未保存: `rgb(var(--gushen-color-step-pending))` (灰色)
  - 保存失败: `rgb(var(--gushen-color-status-block))` (红色)
  - DB: `text-source-db` (蓝色)
  - API: `text-source-api` (黄色)
  - 模拟: `text-source-sim` (灰色)

### StatusBar 布局参考

```
┌─────────────────────────────────────────────────┐
│ ● 已保存  │  数据: DB  │  步骤 2/4  │  网络: ✓  │
└─────────────────────────────────────────────────┘
```

### Store 接口设计

```typescript
interface StatusBarState {
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  dataSource: 'db' | 'api' | 'simulated' | null;
  workflowStep: { current: number; total: number } | null;
  networkStatus: 'online' | 'offline';
}

interface StatusBarActions {
  setSaveStatus: (status: SaveStatus) => void;
  setDataSource: (source: DataSource | null) => void;
  setWorkflowStep: (step: WorkflowStep | null) => void;
  setNetworkStatus: (status: NetworkStatus) => void;
}
```

### 关键技术约束

1. **固定定位**: `fixed bottom-0 left-0 right-0`
2. **z-index**: Level 0 (常规内容层，不需要高 z-index)
3. **高度**: 28px
4. **响应式**: `hidden md:flex` (< 768px 隐藏)
5. **分隔符**: 竖线 `|` 或 `border-r`

### 相关现有代码

| 文件 | 职责 | 修改类型 |
|------|------|---------|
| `lucrum-web/src/lib/stores/` | Zustand stores 目录 | 新增 status-bar-store.ts |
| `lucrum-web/src/components/layout/` | 布局组件目录 | 新增 status-bar.tsx |
| `lucrum-web/tailwind.config.ts` | 设计令牌 | 已有需要的颜色 |

### Previous Story Intelligence

- Story 1.1: 设计令牌已实现，可直接使用 `--gushen-color-*` 变量和 Tailwind 类
- Story 1.2: Toast 系统已实现，移动端可使用 `showToast` 替代 StatusBar 反馈

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] - Story 定义
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#StatusBar] - 组件规范
- [Source: lucrum-web/tailwind.config.ts] - 设计令牌配置
- [Source: lucrum-web/src/lib/stores/] - Zustand store 模式参考

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without blocking issues.

### Completion Notes List

- Created Zustand store at `src/lib/stores/status-bar-store.ts` with full type safety
- Implemented StatusBar component with 4 slots: save-status, data-source, workflow-step, network
- Save status: 4 variants (saved/saving/unsaved/error) with semantic color indicators
- Data source: 3 variants (db/api/simulated) with conditional rendering
- Workflow step: Shows "步骤 N/M" format with tabular-nums for alignment
- Network status: Online (✓) / Offline (✕ 网络断开) with appropriate colors
- Responsive: `hidden md:flex` hides bar on mobile (<768px)
- Accessibility: role="status", aria-live="polite", aria-label on all slots
- All 53 unit tests pass, covering all ACs
- TypeScript strict mode compliance verified

### File List

- lucrum-web/src/lib/stores/status-bar-store.ts (new - Zustand store)
- lucrum-web/src/components/layout/status-bar.tsx (new - StatusBar component)
- lucrum-web/src/components/layout/__tests__/status-bar.test.tsx (new - 53 tests)

## Change Log

- 2026-02-05: Story 1.3 implemented - StatusBar component with Zustand store, 4 slots, accessibility, and 53 tests
- 2026-02-05: Code review fix - useNetworkStatusListener now uses useEffect to properly handle side effects (was violating React hooks rules)
- 2026-02-06: Code review fix - StatusBar was not integrated into layout.tsx; added import and `<StatusBar />` to root layout, added useNetworkStatusListener() call inside StatusBar component
- 2026-02-10: Code review #3 — Fixed 3 offline test failures: tests now mock `navigator.onLine` to false before rendering (useNetworkStatusListener reads browser's onLine, overriding manually-set store state in jsdom). All 53 tests pass.

### Review Follow-ups

- [ ] [MEDIUM-1] `git add` all new files: status-bar-store.ts, layout/, layout/__tests__/
- [ ] [MEDIUM-2] Integrate `useStatusBarStore` actions into actual workflows (e.g. setSaveStatus in auto-save, setDataSource in backtest)

## Senior Developer Review (AI)

**Reviewer:** Anita | **Date:** 2026-02-11 | **Verdict:** Approved with fixes applied

**Issues Found:** 1 HIGH, 2 MEDIUM, 0 LOW

**Fixed in this review:**
- [HIGH-1] Added `md:pb-7` to `<body>` in layout.tsx — prevents fixed StatusBar from hiding page bottom content
- [Story 1.1 regression] Fixed TypeScript strict mode error in WCAG contrast helper (noUncheckedIndexedAccess)

**Remaining action items:** MEDIUM-1 (git add), MEDIUM-2 (integrate store into business logic)

**Test verification:** `bun run test -- --run status-bar.test.tsx` → 53 passed, 0 failed
**TypeScript:** `bun run typecheck` → No errors

