# Story 3.1: 内置策略模板库 (Built-in Strategy Template Library)

Status: done

## Story

As a 投资学习者,
I want 从预置的经典策略模板中选择一个开始,
So that 我不需要自己编写策略也能体验完整的回测流程。

## Acceptance Criteria

### AC-1: Template Card Grid Display
**Given** 用户在策略编辑页点击"浏览模板"或首次进入空编辑器
**When** 模板选择器渲染
**Then** 显示策略模板卡片网格，包含 >=5 个内置模板:
- 双均线交叉策略 (简单): MA5/MA20 金叉买入、死叉卖出
- KDJ 超买超卖策略 (简单): KDJ<20 买入、KDJ>80 卖出
- MACD 动量策略 (进阶): MACD 金叉 + 量能确认
- 布林带突破策略 (进阶): 突破上轨买入、跌破中轨卖出
- 多因子综合策略 (专业): RSI + MACD + 均线三重确认

### AC-2: Template Card Content
**Given** 模板卡片网格已渲染
**When** 用户浏览模板
**Then** 每张卡片显示: 策略名称 + 一句话描述 + 难度标签 (简单/进阶/专业) + ScoreCard(mini) 预设评分范围

### AC-3: Template Selection & Fill
**Given** 用户点击模板卡片
**When** 选择动作执行
**Then** 自动填充策略描述 + 代码 + 参数到编辑器
**And** 填充通过 onSelectTemplate 回调传递

### AC-4: Template Data Structure
**Given** 模板数据
**When** 加载模板
**Then** 每个模板包含: id, name, description, difficulty, code, defaultParams, conditions (buy/sell/position)
**And** 模板数据已存储在 `src/lib/strategy-templates/` 目录

### AC-5: Difficulty Labels
**Given** 模板卡片渲染
**When** 显示难度标签
**Then** 难度标签 (简单=绿色/进阶=黄色/专业=红色) 颜色正确

### AC-6: Component Tests
**Given** BuiltinTemplateLibrary 组件
**When** 运行测试
**Then** 覆盖: 模板列表渲染、>=5 个模板显示、点击填充回调、难度标签颜色、空状态、筛选功能

## Technical Design

### Architecture
Story 3.1 builds on the existing strategy-templates infrastructure. The codebase already has:
- `src/lib/strategy-templates/index.ts` - 60+ templates with types and helpers
- `src/components/strategy-editor/strategy-templates.tsx` - StrategyTemplateList component

What's needed for FR-1.5 compliance:
1. A **dedicated builtin template registry** that curates the 5 required templates specifically for quick-start
2. A **BuiltinTemplateGrid** component optimized for the quick-start flow (card grid with mini ScoreCard)
3. **Vnpy code generation** per template (code + params + conditions structure)
4. Tests covering all acceptance criteria

### New Files
1. `src/lib/strategy-templates/builtin-templates.ts` - Curated 5+ builtin templates with code, params, conditions
2. `src/components/strategy-editor/builtin-template-grid.tsx` - Card grid component for quick-start
3. `src/lib/strategy-templates/__tests__/builtin-templates.test.ts` - Template data tests
4. `src/components/strategy-editor/__tests__/builtin-template-grid.test.tsx` - Component tests

### Interfaces
```typescript
interface BuiltinTemplate {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: StrategyCategory;
  icon: string;
  code: string;  // vnpy CtaTemplate Python code
  defaultParams: Record<string, number | string>;
  conditions: {
    buy: string[];
    sell: string[];
    position?: string;
  };
  expectedScoreRange: { min: ScoreGrade; max: ScoreGrade };
  prompt: string;
}
```

### Dependencies
- `@/lib/strategy-templates` (existing StrategyTemplate type)
- `@/lib/backtest/score/types` (ScoreGrade type)
- `@testing-library/react` (tests)
- `vitest` (tests)

## Test Plan

1. Template data: >=5 builtin templates exist with all required fields
2. Template completeness: each template has id, name, description, difficulty, code, defaultParams, conditions
3. Code validity: each template code is non-empty and contains vnpy patterns
4. Difficulty distribution: at least 1 beginner, 1 intermediate, 1 advanced
5. Component render: BuiltinTemplateGrid renders all templates as cards
6. Card content: each card shows name, description, difficulty badge
7. Click handler: clicking template card calls onSelect with correct data
8. Difficulty colors: beginner=green, intermediate=yellow, advanced=red
9. Grid layout: responsive grid (3 cols desktop, 2 tablet, 1 mobile)
10. Empty state: handles zero templates gracefully

## Definition of Done

- [x] >=5 builtin templates with complete data (code, params, conditions) — 6 templates implemented
- [x] BuiltinTemplateGrid component implemented
- [x] Unit tests written and passing (74 tests PASS)
- [x] TypeScript strict mode passes (`bun run typecheck`)
- [x] Design tokens used (no hardcoded colors)
- [x] Accessible (ARIA labels, keyboard navigation)
- [x] Zero hardcoded values
