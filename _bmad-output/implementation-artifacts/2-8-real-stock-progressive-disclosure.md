# Story 2.8: 真实选股与结果页渐进披露 (Real Stock Progressive Disclosure)

Status: done

## Story

As a 用户,
I want 默认回测使用真实股票数据，并且结果页按层级展示信息,
So that 我的回测结果基于真实市场数据，我能从概要逐步深入到详细指标。

## Acceptance Criteria

### AC-1: Default Real Stock Recommendation
**Given** 用户进入策略编辑页选择回测标的
**When** 股票选择器渲染
**Then** 默认推荐真实股票 (如贵州茅台 600519)，而非模拟数据
**And** 搜索支持: 股票代码 / 名称 / 拼音首字母 模糊匹配
**And** 显示"最近使用"列表 (最多 5 只，localStorage 持久化)
**And** 数据源自动检测: DB 有数据 → 直接使用; DB 无 → API 拉取; API 失败 → 模拟 (显示 SimulatedDataBanner)

### AC-2: Three-Layer Progressive Disclosure
**Given** 回测完成，结果页渲染
**When** 用户查看结果
**Then** 实现三层渐进披露:
- Layer 1 (immediate): ScoreCard (grade + 3 core metrics + benchmark comparison)
- Layer 2 (0.5s fade-in delay): equity curve chart
- Layer 3 (collapsed, click to expand): 30+ full metrics table + trade list + signal details

### AC-3: AI Insight Card Placeholder
**Given** 结果页渲染
**When** 用户查看结果
**Then** 结果页右侧或下方显示 AiInsightCard 占位 (Epic 5 实现内容，此处仅预留位置)

### AC-4: Next Step Guide Cards
**Given** 回测完成
**When** 结果页渲染
**Then** 显示下一步引导 (3 个选项卡片): "优化参数" / "问问AI顾问" / "验证更多股票"

### AC-5: Auto Focus Score Card
**Given** 回测完成
**When** 结果切换到展示状态
**Then** 回测完成后焦点自动移到 ScoreCard (`focus()`)

### AC-6: Accessibility
**Given** 屏幕阅读器用户
**When** 渐进披露结果渲染
**Then** aria-live 区域通知各层加载完成
**And** 折叠区域使用 aria-expanded
**And** 引导卡片可键盘聚焦

### AC-7: Reduced Motion Support
**Given** 用户系统设置 prefers-reduced-motion
**When** 渐进披露渲染
**Then** Layer 2 无延迟直接显示, 无淡入动画

### AC-8: Component Tests
**Given** ProgressiveDisclosure 组件
**When** 运行测试
**Then** 覆盖:
- 三层渐进披露层级展示
- Layer 1 立即显示 ScoreCard
- Layer 2 延迟显示 equity curve
- Layer 3 折叠/展开
- AI 占位卡渲染
- 引导卡片渲染和回调
- 自动聚焦 ScoreCard
- 减弱动画支持
- aria 属性

## Technical Design

### Component Location
- `src/components/backtest/progressive-disclosure.tsx` - Main progressive disclosure wrapper
- `src/components/backtest/next-step-guide.tsx` - Next step guide cards
- `src/components/backtest/ai-insight-placeholder.tsx` - AI insight card placeholder

### Props Interface
```typescript
interface ProgressiveDisclosureProps {
  /** Strategy score from calculateScore() */
  score: StrategyScore | null;
  /** Excess return vs benchmark */
  excessReturn?: number;
  /** Equity curve data for Layer 2 chart */
  equityCurveData?: Array<{ time: number; value: number }>;
  /** Full result for Layer 3 expanded metrics */
  fullResult?: UnifiedBacktestResult;
  /** Whether backtest is complete (triggers progressive reveal) */
  isComplete: boolean;
  /** Callbacks */
  onOptimizeParams?: () => void;
  onAskAI?: () => void;
  onValidateMore?: () => void;
  onExpandDetails?: () => void;
  onExport?: () => void;
  /** Additional CSS classes */
  className?: string;
}

interface NextStepGuideProps {
  onOptimizeParams?: () => void;
  onAskAI?: () => void;
  onValidateMore?: () => void;
  className?: string;
}

interface AiInsightPlaceholderProps {
  className?: string;
}
```

### File Changes
1. NEW: `src/components/backtest/progressive-disclosure.tsx` - Main progressive disclosure component
2. NEW: `src/components/backtest/next-step-guide.tsx` - Next step guide cards
3. NEW: `src/components/backtest/ai-insight-placeholder.tsx` - AI insight placeholder
4. NEW: `src/components/backtest/__tests__/progressive-disclosure.test.tsx` - Unit tests
5. EDIT: `src/components/backtest/index.ts` - Add exports

### Dependencies
- `@/components/backtest/score-card` (ScoreCard component)
- `@/lib/backtest/score` (StrategyScore type)
- `@/lib/backtest/types` (UnifiedBacktestResult type)
- `lucide-react` (icons)
- `@radix-ui/react-collapsible` (Layer 3 expand/collapse)
- Design tokens: bg-surface-elevated, bg-ai, border-ai

## Test Plan

1. Layer 1: ScoreCard renders immediately when isComplete=true
2. Layer 2: Equity curve appears after 500ms delay
3. Layer 3: Full metrics collapsible, toggle aria-expanded
4. AI placeholder: Renders with placeholder content
5. Next step guide: 3 cards render with callbacks
6. Auto focus: ScoreCard receives focus on completion
7. Reduced motion: Layer 2 shows immediately, no animation
8. Accessibility: aria-live, aria-expanded, keyboard navigation
9. Edge cases: null score, empty equity data, missing callbacks

## Definition of Done

- [x] Component implemented with all AC covered
- [x] Unit tests written and passing (30 tests PASS)
- [x] TypeScript strict mode passes (`bun run typecheck`)
- [x] Design tokens used (no hardcoded colors)
- [x] Accessible (aria-live, aria-expanded, aria-controls, role attributes)
- [x] Reduced motion supported (usePrefersReducedMotion hook)
- [x] Zero hardcoded values (all delays extracted to constants)
