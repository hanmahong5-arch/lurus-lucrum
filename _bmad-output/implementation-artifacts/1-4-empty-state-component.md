# Story 1.4: 空状态组件

Status: done

## Story

As a 用户,
I want 当页面或面板没有数据时看到引导和建议操作,
So that 我不会面对空白页面不知所措，始终有明确的下一步。

## Acceptance Criteria

### AC-1: 基础布局与样式
**Given** 页面或面板没有可展示的数据
**When** EmptyState 组件渲染
**Then** 显示:
- Lucide React 图标 (48px, `text-muted`)
- 标题文字 (Body 14px, `text-muted`, 居中)
- 可选描述文字 (Body 12px, `text-neutral-500`, 居中)
- 上方留 `space-2xl` (32px) 呼吸空间
- 不使用插画，仅使用 Lucide 图标

### AC-2: 操作按钮
**Given** EmptyState 需要操作按钮
**When** 组件渲染
**Then** 支持 1-2 个按钮:
- 主按钮: `btn-tactile` + `bg-primary` 样式
- 次按钮 (可选): ghost variant
- 按钮水平排列，间距 gap-2

### AC-3: 组件 Props 接口
**Given** EmptyState 需要灵活配置
**When** 开发者使用组件
**Then** 支持以下 Props:
- `icon: LucideIcon` - 图标组件
- `title: string` - 标题文字
- `description?: string` - 可选描述
- `actions?: Array<{label: string, onClick: () => void, variant?: 'primary' | 'ghost'}>` - 操作按钮

### AC-4: 预设场景配置
**Given** 常见空状态场景需要快速使用
**When** 开发者导入预设
**Then** 提供 5 种场景配置导出:
1. `emptyEditorPreset`: FileCode + "开始创建你的第一个策略" + [新建][浏览模板]
2. `noBacktestHistoryPreset`: BarChart3 + "还没有回测记录" + [运行第一次回测]
3. `emptyStrategyListPreset`: Folder + "还没有保存的策略" + [新建][导入]
4. `aiNoContextPreset`: MessageCircle + "先回测，AI 分析更精准" + [去回测][直接提问]
5. `discoveryNoDataPreset`: Globe + "暂时无法获取最新策略" + [显示缓存][刷新]

### AC-5: 响应式布局
**Given** 用户在不同设备
**When** EmptyState 渲染
**Then** 桌面端和移动端均正常显示:
- 使用 flexbox 垂直居中
- 内容区域最大宽度限制 (max-w-sm)
- 移动端适当缩小图标和间距

### AC-6: 无障碍支持
**Given** 屏幕阅读器用户
**When** EmptyState 渲染
**Then**:
- 组件使用 `role="status"`
- 图标有 `aria-hidden="true"`
- 标题和描述使用语义化文字
- 按钮有明确的 accessible name

### AC-7: 组件测试覆盖
**Given** EmptyState 需要质量保障
**When** 运行测试套件
**Then** 测试覆盖:
- 默认渲染 (icon + title)
- 带描述渲染
- 各预设场景正确配置
- 操作按钮点击回调
- 无障碍属性

## Tasks / Subtasks

- [x] Task 1: 创建 EmptyState 基础组件 (AC: #1, #2, #3)
  - [x] 1.1 创建 `src/components/feedback/empty-state.tsx`
  - [x] 1.2 实现图标渲染 (48px, text-muted)
  - [x] 1.3 实现标题和描述渲染
  - [x] 1.4 实现操作按钮 (primary + ghost variants)
  - [x] 1.5 定义 Props 类型接口

- [x] Task 2: 创建预设场景配置 (AC: #4)
  - [x] 2.1 创建 `src/components/feedback/empty-state-presets.ts`
  - [x] 2.2 实现 emptyEditorPreset
  - [x] 2.3 实现 noBacktestHistoryPreset
  - [x] 2.4 实现 emptyStrategyListPreset
  - [x] 2.5 实现 aiNoContextPreset
  - [x] 2.6 实现 discoveryNoDataPreset

- [x] Task 3: 样式与响应式 (AC: #1, #5)
  - [x] 3.1 应用 pt-8 (32px) 上边距
  - [x] 3.2 实现 flexbox 垂直居中 (flex flex-col items-center justify-center)
  - [x] 3.3 设置内容区域 max-w-sm mx-auto
  - [x] 3.4 移动端响应式适配 (内容居中显示)

- [x] Task 4: 无障碍实现 (AC: #6)
  - [x] 4.1 添加 role="status"
  - [x] 4.2 添加图标 aria-hidden="true"
  - [x] 4.3 按钮使用 label 作为 accessible name

- [x] Task 5: 编写单元测试 (AC: #7)
  - [x] 5.1 测试默认渲染
  - [x] 5.2 测试带描述渲染
  - [x] 5.3 测试各预设场景
  - [x] 5.4 测试按钮点击回调
  - [x] 5.5 测试无障碍属性

## Dev Notes

### 架构模式遵循

- **组件位置**: `src/components/feedback/empty-state.tsx`
- **预设位置**: `src/components/feedback/empty-state-presets.ts`
- **设计令牌**: 使用 Story 1.1 实现的 CSS 变量和 Tailwind 类
- **按钮样式**: 使用 `btn-tactile` utility class

### EmptyState 布局参考

```
        ┌─────────────────────┐
        │                     │
        │    [Icon 48px]      │
        │                     │
        │   Title (14px)      │
        │  Description (12px) │
        │                     │
        │  [Primary] [Ghost]  │
        │                     │
        └─────────────────────┘
```

### Props 接口设计

```typescript
import type { LucideIcon } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
}
```

### 预设配置结构

```typescript
interface EmptyStatePreset {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions: Array<{
    label: string;
    variant: 'primary' | 'ghost';
    // onClick will be provided by consumer
  }>;
}

// Usage example:
// <EmptyState {...emptyEditorPreset} actions={[
//   { ...emptyEditorPreset.actions[0], onClick: handleNew },
//   { ...emptyEditorPreset.actions[1], onClick: handleBrowse },
// ]} />
```

### 关键技术约束

1. **图标大小**: 48px (w-12 h-12)
2. **颜色**: text-muted (neutral-500)
3. **上边距**: 32px (pt-8 或 space-y-8)
4. **内容宽度**: max-w-sm (384px)
5. **居中**: flex flex-col items-center justify-center

### Lucide 图标映射

| 场景 | 图标 |
|------|------|
| 空编辑器 | `FileCode` |
| 无回测历史 | `BarChart3` |
| 空策略列表 | `Folder` |
| AI 无上下文 | `MessageCircle` |
| 发现无数据 | `Globe` |

### 相关现有代码

| 文件 | 职责 | 修改类型 |
|------|------|---------|
| `lucrum-web/src/components/feedback/` | 反馈组件目录 | 新增 empty-state.tsx |
| `lucrum-web/tailwind.config.ts` | 设计令牌 | 已有 btn-tactile |

### Previous Story Intelligence

- Story 1.1: 设计令牌已实现，可直接使用 `text-muted`, `btn-tactile` 等
- Story 1.2: Toast 系统在 feedback 目录，EmptyState 也放在此目录
- Story 1.3: StatusBar 使用了 role="status"，EmptyState 同样使用

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] - Story 定义
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#EmptyState] - 组件规范
- [Source: lucrum-web/tailwind.config.ts] - 设计令牌配置

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without blocking issues.

### Completion Notes List

- Created EmptyState component at `src/components/feedback/empty-state.tsx`
- Icon rendering: 48px (w-12 h-12), text-neutral-500 color, aria-hidden
- Title: text-sm text-neutral-400, description: text-xs text-neutral-500
- Action buttons: primary (bg-primary + btn-tactile) and ghost variants
- Created 5 preset scenarios in `empty-state-presets.ts`:
  - emptyEditorPreset (FileCode)
  - noBacktestHistoryPreset (BarChart3)
  - emptyStrategyListPreset (Folder)
  - aiNoContextPreset (MessageCircle)
  - discoveryNoDataPreset (Globe)
- Layout: pt-8 breathing space, max-w-sm, flexbox centered
- Accessibility: role="status", aria-label, aria-hidden on icon
- All 50 unit tests pass, covering all ACs
- TypeScript strict mode compliance verified

### File List

- lucrum-web/src/components/feedback/empty-state.tsx (new - EmptyState component)
- lucrum-web/src/components/feedback/empty-state-presets.ts (new - 5 preset configurations)
- lucrum-web/src/components/feedback/__tests__/empty-state.test.tsx (new - 50 tests)

### Review Follow-ups

- [ ] [MEDIUM-1] `git add` all new files: empty-state.tsx, empty-state-presets.ts, __tests__/
- [ ] [MEDIUM-2] Integrate EmptyState into at least one actual page (e.g. editor empty, backtest history)

## Senior Developer Review (AI)

**Reviewer:** Anita | **Date:** 2026-02-11 | **Verdict:** Approved (no code changes needed)

**Issues Found:** 0 HIGH, 2 MEDIUM, 1 LOW

**No code fixes required.** Cleanest story in Epic 1. Code structure, test quality, and design patterns are all solid.

**Remaining action items:** MEDIUM-1 (git add), MEDIUM-2 (integrate into pages)

**Test verification:** `bun run test -- --run empty-state.test.tsx` → 50 passed, 0 failed

## Change Log

- 2026-02-05: Story 1.4 implemented - EmptyState component with 5 presets, accessibility, and 50 tests
- 2026-02-11: Code review — Approved, no code changes. 0 HIGH issues.

