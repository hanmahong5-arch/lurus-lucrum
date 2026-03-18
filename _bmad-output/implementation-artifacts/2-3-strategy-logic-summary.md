# Story 2.3: 策略逻辑摘要组件 (StrategyLogicSummary)

Status: done

## Story

As a 用户,
I want 看到 AI 生成策略的白话逻辑摘要而非代码,
So that 我不懂编程也能理解策略的买卖条件和仓位控制。

## Acceptance Criteria

### AC-1: 核心渲染 — 白话条件列表
**Given** AI 生成策略代码后
**When** 策略编辑页渲染 `<StrategyLogicSummary />`
**Then** 显示:
- 标题行: "策略逻辑摘要" + 置信度 Badge (高=绿 / 中=黄 / 低=红)
- 分隔线
- 结构化条件列表:
  - 买入条件: 白话描述 (例: "KDJ 在 20 以下金叉时")
  - 卖出条件: 白话描述
  - 仓位控制: 白话描述
- 分隔线
- 参数摘要: 关键参数名=值 (内联展示)
- 折叠区域: [查看生成代码] → 展开显示 Python 语法高亮代码

### AC-2: 代码折叠/展开
**Given** StrategyLogicSummary 渲染完成
**When** 用户交互
**Then** 代码默认折叠 (Collapsible)
**And** 点击 [查看生成代码] 展开代码区域
**And** 再次点击收起
**And** 使用 Radix UI Collapsible 组件

### AC-3: Props 接口
**Given** 组件使用
**When** 传入 props
**Then** 接受:
```typescript
interface StrategyLogicSummaryProps {
  conditions: {
    buy: string;   // 买入条件白话描述
    sell: string;  // 卖出条件白话描述
    position: string; // 仓位控制白话描述
  };
  confidence: 'high' | 'medium' | 'low';
  params: Record<string, string>; // 关键参数名=值
  code: string;  // Python 策略代码
  className?: string;
}
```

### AC-4: 三种状态
**Given** StrategyLogicSummary 组件
**When** 不同场景
**Then** 支持:
- `default`: 正常展示白话摘要
- `loading`: ai-pulse 动画 (紫色脉冲，表示 AI 正在解析)
- `error`: 错误提示 + 回退显示代码

### AC-5: 无障碍
**Given** 屏幕阅读器用户
**When** 使用 StrategyLogicSummary
**Then** 条件列表使用 `role="list"` + `role="listitem"`
**And** 置信度 Badge 有 `aria-label` (如 "置信度: 高")
**And** 折叠按钮有 `aria-expanded` 属性

### AC-6: 组件测试
**Given** StrategyLogicSummary 组件
**When** 运行测试
**Then** 覆盖:
- 默认渲染: 标题、条件列表、参数摘要
- 代码折叠/展开交互
- 3 种置信度 Badge 颜色正确
- loading 状态 (ai-pulse 动画)
- error 状态回退
- aria 属性正确性

## Tasks / Subtasks

- [x] Task 1: 创建组件和类型定义 (AC: #3)
  - [x] 1.1 创建 `src/components/strategy-editor/strategy-logic-summary.tsx`
  - [x] 1.2 定义 `StrategyLogicSummaryProps` 接口
  - [x] 1.3 定义置信度颜色映射常量

- [x] Task 2: 实现核心 UI (AC: #1, #2, #5)
  - [x] 2.1 标题行: 标题文字 + 置信度 Badge
  - [x] 2.2 条件列表: 买入/卖出/仓位 三个结构化条目 (role="list")
  - [x] 2.3 参数摘要: 内联 key=value 展示
  - [x] 2.4 代码折叠区: Radix Collapsible + CodePreview 复用
  - [x] 2.5 aria 属性: role="list", aria-label, aria-expanded

- [x] Task 3: 实现状态管理 (AC: #4)
  - [x] 3.1 loading 状态: ai-pulse 动画 skeleton
  - [x] 3.2 error 状态: 错误信息 + 代码回退显示
  - [x] 3.3 default → loaded 过渡

- [x] Task 4: 添加 ai-pulse CSS 动画 (AC: #4)
  - [x] 4.1 ai-pulse keyframes 已存在于 tailwind.config.ts (line 276-285)
  - [x] 4.2 animate-ai-pulse 已注册于 tailwind.config.ts (line 237)

- [x] Task 5: 集成到 dashboard/page.tsx (AC: #1)
  - [x] 5.1 extractLogicSummary() 从用户输入提取 conditions (MVP 方案 B)
  - [x] 5.2 在中间列 CodePreview 上方插入 StrategyLogicSummary
  - [x] 5.3 策略代码生成后自动显示摘要，生成中显示 loading 状态

- [x] Task 6: 编写组件测试 (AC: #6)
  - [x] 6.1 创建 `src/components/strategy-editor/__tests__/strategy-logic-summary.test.tsx`
  - [x] 6.2 测试默认渲染 (标题、条件、参数) — 5 tests
  - [x] 6.3 测试折叠/展开代码 — 3 tests
  - [x] 6.4 测试 3 种置信度 Badge — 6 tests
  - [x] 6.5 测试 loading 状态 — 4 tests
  - [x] 6.6 测试 error 状态 — 4 tests
  - [x] 6.7 测试 aria 属性 — 5 tests + 1 className test

## Dev Notes

### 组件位置与命名

- **文件**: `src/components/strategy-editor/strategy-logic-summary.tsx`
- **导出**: `StrategyLogicSummary` (PascalCase)
- **测试**: `src/components/strategy-editor/__tests__/strategy-logic-summary.test.tsx`
- 放在 `strategy-editor/` 因为它是策略编辑流程的一部分，且在 J1 生成后、J5 Step 2 场景使用。
- 如果后续在 J6 策略详情预览和 J2 多股验证中也需要复用，可考虑迁移到 `backtest/` 目录。但当前 MVP 先在 `strategy-editor/` 实现。

### 置信度颜色映射

```typescript
const CONFIDENCE_CONFIG = {
  high: {
    label: '高',
    variant: 'success' as const,  // bg-profit/20 text-profit (绿色)
    ariaLabel: '置信度: 高',
  },
  medium: {
    label: '中',
    variant: 'warning' as const,  // bg-warning/20 text-warning (黄色)
    ariaLabel: '置信度: 中',
  },
  low: {
    label: '低',
    variant: 'danger' as const,   // bg-loss/20 text-loss (红色)
    ariaLabel: '置信度: 低',
  },
} as const;
```

使用 `@/components/ui/badge` 的现有 variants: `success`, `warning`, `danger`。无需创建新 variant。

### 依赖的现有模块

| 模块 | 路径 | 用途 |
|------|------|------|
| Badge | `@/components/ui/badge` | 置信度 Badge (success/warning/danger variants) |
| Collapsible | `@/components/ui/collapsible` | 代码折叠/展开 (Radix UI) |
| Card | `@/components/ui/card` | 外部容器 |
| CodePreview | `./code-preview` | Python 代码语法高亮 (折叠区内复用) |
| cn | `@/lib/utils` | className 合并 |

### AI 视觉语言设计令牌

AI 相关 CSS 变量已在 `globals.css` 定义:
```css
--gushen-color-ai: 167 139 250;    /* #a78bfa 紫色 */
--gushen-bg-ai: 167 139 250;       /* 用于 bg-ai/10 */
--gushen-border-ai: 167 139 250;   /* 用于 border-ai/20 */
```

Tailwind 类可用: `text-ai`, `bg-ai/10`, `border-ai/20`。

Loading 状态使用紫色 ai-pulse 动画，表示 AI 正在处理。

### ai-pulse 动画定义

需要在 `globals.css` 添加:
```css
@keyframes ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

在 `tailwind.config.ts` 的 `animation` 中注册:
```typescript
'ai-pulse': 'ai-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
```

### 条件列表 UI 结构

```
买入条件:  🟢 KDJ 在 20 以下金叉时
卖出条件:  🔴 KDJ 在 80 以上死叉时
仓位控制:  ⚖️ 每次买入 50% 资金
```

- 买入条件前缀使用 `text-profit` (绿色)
- 卖出条件前缀使用 `text-loss` (红色)
- 仓位控制前缀使用 `text-muted-foreground` (中性色)
- 每项使用 `role="listitem"`

### 参数摘要展示

```
参数: KDJ周期=9 · 平滑=3 · 仓位=50%
```

- 使用 `font-mono text-xs text-muted-foreground` 样式
- 参数间用 `·` (middle dot) 分隔
- 键名正常字重，值使用 `font-semibold`

### CodePreview 复用

折叠区域内复用 `code-preview.tsx` 组件展示 Python 代码:
```typescript
import { CodePreview } from "./code-preview";

// 在 CollapsibleContent 中
<CollapsibleContent>
  <CodePreview code={code} language="python" />
</CollapsibleContent>
```

查看 `code-preview.tsx` 的 Props 确认是否需要传递 `language` 或使用默认参数。如果 CodePreview 不支持独立使用，可直接用 `<pre><code>` + 基本样式替代。

### 集成方案

**方案 A (推荐): 策略生成时集成**

在策略编辑页 (dashboard/page.tsx 或 strategy-editor 区域)，AI 生成代码后立即显示 StrategyLogicSummary。数据来源:

1. AI 生成策略时，让 AI 同时返回 conditions + confidence:
   ```typescript
   // API 响应扩展
   interface StrategyGenerationResponse {
     code: string;
     parameters: Record<string, unknown>;
     // 新增:
     logicSummary?: {
       conditions: { buy: string; sell: string; position: string };
       confidence: 'high' | 'medium' | 'low';
     };
   }
   ```

2. 如果 AI 不返回 logicSummary，前端可从策略描述文本中提取条件 (降级方案)。

**方案 B: 纯前端解析**

从用户输入的自然语言描述中提取买卖条件。这不需要后端改动，但置信度会固定为 'medium'。

**建议**: 先用方案 B 实现 MVP (纯前端，从用户输入提取)，后续 Story 再集成 AI 返回的结构化数据。

### 集成位置

StrategyLogicSummary 插入在策略生成结果区域:
- **策略编辑页 (dashboard/page.tsx)**: AI 生成代码后，在代码预览上方显示
- **不在 backtest-panel.tsx 中**: 因为这是策略理解组件，不是回测结果组件

具体位置取决于 dashboard/page.tsx 的代码结构。检查策略生成后的 UI 区域来确定插入点。

### Story 2.1/2.2 实现参考 (前序 Story 智能)

**Story 2.1 (ScoreCalculator)**:
- 模块位置: `src/lib/backtest/score/`
- 52 个测试通过
- 类型: `StrategyScore` (grade, score, description, coreMetrics, breakdown)
- 与本 Story 无直接依赖，但评分卡和逻辑摘要在结果页会并排显示

**Story 2.2 (ScoreCard)**:
- 组件位置: `src/components/backtest/score-card.tsx`
- 37 个测试通过
- 集成在 backtest-panel.tsx
- 模式参考: Props 接口设计、variant 模式、状态管理、aria-label 生成
- **编码模式**: 等级映射常量 (GRADE_ICONS, GRADE_COLOR_CLASS 等) → 本 Story 用同样模式定义 CONFIDENCE_CONFIG

**ScoreCard 代码模式** (可参照):
```typescript
// 常量定义模式
const GRADE_COLOR_CLASS: Record<ScoreGrade, string> = { ... };

// Props 接口模式
interface ScoreCardProps {
  score: StrategyScore | null;
  variant?: 'full' | 'compact' | 'mini';
  state?: 'default' | 'loading' | 'error';
  errorMessage?: string;
  className?: string;
}
```

### Git Intelligence

最近 commits 显示:
- `9044019` test: backtest engine tests (680 tests, 85%+ coverage)
- `46de32d` feat: workflow system, strategy crawler, caching
- `8deba0c` test: strategy validation component tests

模式: 功能先实现、测试后补。组件测试使用 Vitest + @testing-library/react。

### 禁止事项

- 禁止在 `ui/` 目录创建此组件 (含业务逻辑)
- 禁止引入新的状态管理库
- 禁止使用 `any` 类型 (用 `unknown` + type narrowing)
- 禁止硬编码颜色值 (使用 Tailwind 类 + 设计令牌)
- 禁止跳过 aria 属性 (无障碍是硬要求)
- 禁止 `console.log` (使用 ErrorBoundary)

### Project Structure Notes

- 本组件在 `src/components/strategy-editor/` 目录，符合架构规范 §8.2 "按功能域组织组件"
- 测试在 `__tests__/` 子目录，符合规范
- 类型在组件文件内定义 (因为只在此模块内使用)，若后续跨模块使用则迁移到 `lib/types/`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — Story 定义和验收标准
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#StrategyLogicSummary] — 组件视觉规格 (线框图、states、props)
- [Source: _bmad-output/planning-artifacts/architecture.md#§8.2] — TypeScript 目录结构规范
- [Source: _bmad-output/planning-artifacts/architecture.md#§8.1] — 命名约定 (kebab-case 文件, PascalCase 导出)
- [Source: _bmad-output/planning-artifacts/prd.md#Journey 1] — 策略创建流程上下文
- [Source: _bmad-output/implementation-artifacts/2-1-score-calculator.md] — 前序 Story 实现 (评分算法)
- [Source: _bmad-output/implementation-artifacts/2-2-score-card-component.md] — 前序 Story 实现 (评分卡组件，模式参考)
- [Source: lucrum-web/src/components/strategy-editor/code-preview.tsx] — 代码预览组件 (折叠区复用)
- [Source: lucrum-web/src/components/ui/collapsible.tsx] — Radix Collapsible 组件
- [Source: lucrum-web/src/components/ui/badge.tsx] — Badge 组件 (success/warning/danger variants)
- [Source: lucrum-web/src/app/globals.css#L79-82] — AI 视觉语言 CSS 变量
- [Source: lucrum-web/tailwind.config.ts] — Tailwind 自定义配置

## Dev Agent Record

### Agent Model Used

Opus 4.6

### Debug Log References

- JSX attribute strings (e.g. `aria-label="..."`) do NOT parse `\u` escapes; must use `{"\u..."}` expression syntax instead.

### Completion Notes List

- Task 4 (ai-pulse animation) was already implemented in tailwind.config.ts from a previous story. No CSS changes needed.
- Task 5 used MVP approach B (frontend parsing from user input) as recommended in Dev Notes. Confidence is fixed at "medium" until backend returns structured logicSummary.
- 28/28 component tests pass. 4 pre-existing failures in backtest-basis-panel.test.tsx and backtest-panel.test.tsx (unrelated to this story, confirmed by running against clean git state).

### Change Log

- 2026-02-06: Story 2.3 implemented. StrategyLogicSummary component with 3 states, 3 confidence levels, collapsible code, full a11y. Integrated into dashboard page above CodePreview. 28 tests pass.
- 2026-02-10: Code review passed — no issues found. 28/28 tests pass.
- 2026-02-11: Code review — Approved, no code changes. 0 HIGH issues.

### Review Follow-ups

- [ ] [MEDIUM-1] `git add` all new files: strategy-logic-summary.tsx, __tests__/

## Senior Developer Review (AI)

**Reviewer:** Anita | **Date:** 2026-02-11 | **Verdict:** Approved (no code changes needed)

**Issues Found:** 0 HIGH, 1 MEDIUM (untracked files), 0 LOW

**Test verification:** `bun run test -- --run strategy-logic-summary.test.tsx` → 28 passed, 0 failed

### File List

- `lucrum-web/src/components/strategy-editor/strategy-logic-summary.tsx` (NEW)
- `lucrum-web/src/components/strategy-editor/__tests__/strategy-logic-summary.test.tsx` (NEW)
- `lucrum-web/src/app/dashboard/page.tsx` (MODIFIED — import, logicSummary useMemo, StrategyLogicSummary placement, extractLogicSummary helper)
