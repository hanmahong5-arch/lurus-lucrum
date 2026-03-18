# Story 1.6: 金融数据格式化适配器

Status: done

## Story

As a 用户,
I want 所有金融数字使用一致的格式、颜色和排版,
So that 我能快速识别涨跌方向，信任数据的专业精度。

## Acceptance Criteria

### AC-1: FinancialDisplayData 接口
**Given** 任何金融数据需要在 UI 中展示
**When** 数据通过适配器处理
**Then** 返回统一的展示对象:
```typescript
interface FinancialDisplayData {
  raw: Decimal;
  formatted: string;        // "32.50%" or "¥15.20"
  direction: 'up' | 'down' | 'neutral';
  ariaLabel: string;        // "上涨 32.50%"
  colorToken: string;       // "text-profit" | "text-loss" | "text-muted"
  responsive: {
    full: string;           // "总收益率 +32.50%"
    compact: string;        // "+32.5%"
  };
}
```

### AC-2: 数据精度规则
**Given** 不同类型的金融数据
**When** 格式化数据
**Then** 应用精度规则:
- 价格: 2 位小数 (例: ¥15.20)
- 百分比: 2 位小数 (例: 32.50%)
- 比率 (夏普等): 3 位小数 (例: 1.234)

### AC-3: 排版样式强制
**Given** 金融数字需要渲染
**When** 使用 FinancialValue 组件
**Then** 强制使用 `font-mono` + `tabular-nums` class

### AC-4: 涨跌方向三重编码
**Given** 涨跌数据需要显示
**When** 渲染涨跌方向
**Then** 使用三重编码 (色盲友好):
- 颜色: text-profit (涨) / text-loss (跌) / text-muted (平)
- 箭头: ↑ (涨) / ↓ (跌) / - (平)
- 符号: + (涨) / - (跌) / (无符号 平)

### AC-5: Decimal.js 内部计算
**Given** 金融数据需要计算
**When** 内部处理数据
**Then** 使用 Decimal.js，禁止 JavaScript 原生浮点数

### AC-6: useFinancialFormat Hook
**Given** 开发者需要格式化金融数据
**When** 使用 hook
**Then** 提供:
```typescript
useFinancialFormat(
  value: Decimal | string | number,
  type: 'price' | 'percent' | 'ratio',
  options?: { label?: string; showArrow?: boolean }
): FinancialDisplayData
```

### AC-7: FinancialValue 组件
**Given** 需要渲染格式化的金融数据
**When** 使用组件
**Then** 提供:
```typescript
<FinancialValue
  data={financialDisplayData}
  variant?: 'full' | 'compact'
  showArrow?: boolean
/>
```
自动应用 class 和 aria-label

### AC-8: 组件测试覆盖
**Given** 金融数据适配器需要质量保障
**When** 运行测试套件
**Then** 测试覆盖:
- 正值/负值/零值格式化
- 精度规则 (price/percent/ratio)
- 方向判断
- aria-label 生成
- Decimal.js 精度验证
- 组件渲染

## Tasks / Subtasks

- [x] Task 1: 创建 FinancialDisplayData 类型定义 (AC: #1)
  - [x] 1.1 创建 `src/lib/financial/types.ts`
  - [x] 1.2 定义 FinancialDisplayData 接口
  - [x] 1.3 定义 FinancialDataType 类型 ('price' | 'percent' | 'ratio')
  - [x] 1.4 定义 Direction 类型 ('up' | 'down' | 'neutral')

- [x] Task 2: 创建格式化工具函数 (AC: #2, #4, #5)
  - [x] 2.1 创建 `src/lib/financial/formatters.ts`
  - [x] 2.2 实现 formatPrice (2 位小数, ¥ 前缀)
  - [x] 2.3 实现 formatPercent (2 位小数, % 后缀)
  - [x] 2.4 实现 formatRatio (3 位小数)
  - [x] 2.5 实现 getDirection (判断涨跌)
  - [x] 2.6 实现 getColorToken (返回颜色 class)
  - [x] 2.7 实现 getAriaLabel (生成无障碍文字)

- [x] Task 3: 创建 useFinancialFormat Hook (AC: #6)
  - [x] 3.1 创建 `src/lib/financial/use-financial-format.ts`
  - [x] 3.2 实现 hook 逻辑
  - [x] 3.3 支持 Decimal | string | number 输入
  - [x] 3.4 支持 options (label, showArrow)

- [x] Task 4: 创建 FinancialValue 组件 (AC: #3, #7)
  - [x] 4.1 创建 `src/components/financial/financial-value.tsx`
  - [x] 4.2 实现 font-mono + tabular-nums 样式
  - [x] 4.3 实现 variant (full/compact)
  - [x] 4.4 实现 showArrow 选项
  - [x] 4.5 应用 aria-label

- [x] Task 5: 编写单元测试 (AC: #8)
  - [x] 5.1 测试正值/负值/零值格式化
  - [x] 5.2 测试精度规则
  - [x] 5.3 测试方向判断
  - [x] 5.4 测试 aria-label 生成
  - [x] 5.5 测试 Decimal.js 精度
  - [x] 5.6 测试组件渲染

## Dev Notes

### 架构模式遵循

- **类型位置**: `src/lib/financial/types.ts`
- **工具函数位置**: `src/lib/financial/formatters.ts`
- **Hook 位置**: `src/lib/financial/use-financial-format.ts`
- **组件位置**: `src/components/financial/financial-value.tsx`
- **设计令牌**: 使用 DESIGN_SYSTEM.md 中的 profit/loss/muted 颜色

### FinancialDisplayData 结构

```typescript
import Decimal from 'decimal.js';

type Direction = 'up' | 'down' | 'neutral';
type FinancialDataType = 'price' | 'percent' | 'ratio';

interface FinancialDisplayData {
  raw: Decimal;
  formatted: string;
  direction: Direction;
  ariaLabel: string;
  colorToken: string;
  responsive: {
    full: string;
    compact: string;
  };
}
```

### 精度配置

```typescript
const PRECISION: Record<FinancialDataType, number> = {
  price: 2,    // ¥15.20
  percent: 2,  // 32.50%
  ratio: 3,    // 1.234
};
```

### 方向符号映射

| Direction | Color | Arrow | Sign |
|-----------|-------|-------|------|
| up | text-profit | ↑ | + |
| down | text-loss | ↓ | - |
| neutral | text-muted | - | (none) |

### 使用示例

```tsx
// Hook 用法
const data = useFinancialFormat(new Decimal('32.50'), 'percent', {
  label: '总收益率',
  showArrow: true,
});
// → { formatted: '+32.50%', direction: 'up', ariaLabel: '总收益率 上涨 32.50%', ... }

// 组件用法
<FinancialValue data={data} variant="full" showArrow />
// → <span class="font-mono tabular-nums text-profit" aria-label="总收益率 上涨 32.50%">
//     ↑ 总收益率 +32.50%
//   </span>
```

### 关键技术约束

1. **Decimal.js**: 所有计算必须使用 Decimal.js
2. **font-mono**: 强制等宽字体
3. **tabular-nums**: 强制等宽数字
4. **三重编码**: 颜色 + 箭头 + 符号 (色盲友好)
5. **aria-label**: 每个值都需要无障碍描述

### 已有 Decimal.js 集成

项目已有 `src/lib/backtest/core/financial-math.ts`，可参考其 `FinancialAmount` 类。

### 相关现有代码

| 文件 | 职责 | 修改类型 |
|------|------|---------|
| `lucrum-web/src/lib/backtest/core/financial-math.ts` | Decimal.js 封装 | 参考 |
| `lucrum-web/tailwind.config.ts` | profit/loss 颜色 | 已有 |

### Previous Story Intelligence

- Story 1.1: 设计令牌已实现，text-profit/text-loss/text-muted 可用
- Project 已有 Decimal.js 和 FinancialAmount 类，遵循 ADR-006

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6] - Story 定义
- [Source: lucrum-web/src/lib/backtest/core/financial-math.ts] - Decimal.js 封装
- [Source: lucrum-web/tailwind.config.ts] - 设计令牌配置

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without blocking issues.

### Completion Notes List

- Created FinancialDisplayData interface with Decimal.js raw value, formatted string, direction, aria-label, color token, responsive text
- Precision rules: price (2), percent (2), ratio (3) decimal places
- Triple encoding for direction: color (text-profit/text-loss/text-muted) + arrow (↑/↓/-) + sign (+/-)
- formatPrice, formatPercent, formatRatio use absolute values; sign handled separately
- useFinancialFormat hook with memoization for performance
- FinancialValue component with font-mono + tabular-nums mandatory styling
- SimpleFinancialValue component for static values without hook
- Full accessibility: aria-label for all values, aria-hidden for arrows
- Transitions with motion-reduce support
- 96 unit tests pass (60 formatter tests + 36 component tests)
- TypeScript strict mode compliance verified

### File List

- lucrum-web/src/lib/financial/types.ts (new - Type definitions)
- lucrum-web/src/lib/financial/formatters.ts (new - Formatting functions)
- lucrum-web/src/lib/financial/use-financial-format.ts (new - React hook)
- lucrum-web/src/lib/financial/index.ts (new - Module exports)
- lucrum-web/src/lib/financial/__tests__/formatters.test.ts (new - 60 formatter tests)
- lucrum-web/src/components/financial/financial-value.tsx (new - FinancialValue component)
- lucrum-web/src/components/financial/__tests__/financial-value.test.tsx (new - 36 component tests)

## Change Log

- 2026-02-05: Story 1.6 implemented - Financial data adapter with FinancialDisplayData, useFinancialFormat hook, FinancialValue component, and 96 tests
- 2026-02-06: Code review fixes — (1) toDecimal() now guards against NaN/Infinity, degrades to Decimal(0). (2) SimpleFinancialValue sign regex fixed for price type (was `^[+-]`, now `([¥]?)[+-]`). All 96 tests pass.
- 2026-02-11: Code review — Approved, no code changes. 0 HIGH issues.

### Review Follow-ups

- [ ] [MEDIUM-1] `git add` all new files: lib/financial/, components/financial/
- [ ] [MEDIUM-2] Integrate FinancialValue/useFinancialFormat into actual pages (backtest results, stock ranking)

## Senior Developer Review (AI)

**Reviewer:** Anita | **Date:** 2026-02-11 | **Verdict:** Approved (no code changes needed)

**Issues Found:** 0 HIGH, 2 MEDIUM, 3 LOW

**No code fixes required.** Excellent architectural separation (types/formatters/hook/component). Decimal.js precision handling and triple encoding implementation are solid.

**Note:** `Decimal.set()` is called identically in both `formatters.ts` and `financial-math.ts` — currently no conflict, but consider consolidating into a shared config module.

**Remaining action items:** MEDIUM-1 (git add), MEDIUM-2 (integrate into pages)

**Test verification:** `bun run test -- --run formatters.test.ts financial-value.test.tsx` → 96 passed, 0 failed

