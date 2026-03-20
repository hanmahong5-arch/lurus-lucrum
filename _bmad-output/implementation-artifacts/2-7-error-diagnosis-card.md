# Story 2.7: 错误诊断卡 (ErrorDiagnosisCard)

Status: done

## Story

As a 用户,
I want 回测失败时看到结构化的错误信息和修复建议,
So that 我知道出了什么问题、为什么出问题、以及如何修复。

## Acceptance Criteria

### AC-1: Error Diagnosis Card Rendering
**Given** 回测执行失败
**When** 错误诊断卡渲染
**Then** 显示 ErrorDiagnosisCard 组件:
- 标题行: 错误类型图标 + "回测失败" + 错误代码 [BT3XX]
- 分隔线
- "问题": 一句话描述发生了什么 (中英双语)
- "原因": 一句话描述为什么
- 分隔线
- "建议": 可操作的修复建议
- 操作按钮: [应用建议] [换股票] [关闭]

### AC-2: Error Message Three Elements
**Given** 任意 BT error code
**When** 错误诊断卡渲染
**Then** 错误信息包含三要素:
- 发生了什么 (message)
- 期望是什么 (cause/context)
- 调用方能做什么 (suggestion + action buttons)

### AC-3: BT Error Code Namespace
**Given** 错误代码
**When** 解析错误类型
**Then** 使用 BT 前缀命名空间:
- BT1XX: 验证错误 (Validation)
- BT2XX: 数据错误 (Data)
- BT3XX: 计算错误 (Calculation)
- BT4XX: 引擎错误 (Engine)
- BT5XX: 网络错误 (Network)
- BT9XX: 系统错误 (System)

### AC-4: Error Type Categorization with Icons
**Given** 不同类别的错误代码
**When** 渲染错误诊断卡
**Then** 显示对应类别图标:
- Validation (BT1XX): ShieldAlert
- Data (BT2XX): Database
- Calculation (BT3XX): Calculator
- Engine (BT4XX): Cog
- Network (BT5XX): Wifi
- System (BT9XX): AlertTriangle

### AC-5: Collapsible Details
**Given** 错误诊断卡已渲染
**When** 用户点击展开/折叠按钮
**Then** 详细信息区域展开/折叠，使用 aria-expanded 标记状态

### AC-6: Action Buttons
**Given** 错误包含 actions 数组
**When** 渲染操作按钮
**Then** 显示可点击的操作按钮，点击时触发对应的 onClick 回调

### AC-7: Accessibility
**Given** 屏幕阅读器用户
**When** 错误诊断卡渲染
**Then** 使用 role="alert" 确保立即播报
**And** 折叠区域使用 aria-expanded
**And** 操作按钮可键盘聚焦和激活

### AC-8: Design Token Compliance
**Given** 错误诊断卡渲染
**When** 检查样式
**Then** 背景使用 bg-surface-elevated
**And** 左侧 2px border-status-block 红色标记
**And** 使用 Lucrum 设计令牌 (status-block 等颜色)

### AC-9: Component Tests
**Given** ErrorDiagnosisCard 组件
**When** 运行测试
**Then** 覆盖:
- 各错误类型渲染 (BT1XX-BT9XX)
- 错误信息三要素显示
- 应用建议回调
- aria 属性 (role="alert", aria-expanded)
- 按钮交互
- 折叠展开状态
- 空/无效 props 防御

## Technical Design

### Component Location
`src/components/feedback/error-diagnosis-card.tsx`

### Props Interface
```typescript
interface ErrorDiagnosisProps {
  /** ErrorInfo from backtest error system */
  error: ErrorInfo;
  /** Optional action buttons */
  actions?: ErrorAction[];
  /** Callback when close button is clicked */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
}

interface ErrorAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Button variant: primary action or secondary */
  variant?: "primary" | "secondary";
}
```

### Error Category Mapping
Uses `getErrorCategory()` to map BT error code prefix to:
- Category label (zh/en)
- Lucide icon component
- Severity-based styling

### File Changes
1. NEW: `src/components/feedback/error-diagnosis-card.tsx` - Main component
2. NEW: `src/components/feedback/__tests__/error-diagnosis-card.test.tsx` - Unit tests

### Dependencies
- `lucide-react` (for category icons, already installed)
- `@/lib/backtest/core/errors` (error code system, already exists)
- `@/lib/backtest/core/interfaces` (ErrorInfo type, already exists)
- Design tokens: status-block, bg-surface-elevated, text-neutral-400

## Test Plan

1. Rendering: Error card displays with correct structure
2. Error categories: Each BT code prefix renders correct icon and label
3. Bilingual messages: Chinese message + English message both displayed
4. Three elements: message, cause (from messageEn), suggestion all present
5. Actions: Custom action buttons render and fire callbacks
6. Close button: onClose callback fires on click
7. Collapsible: Details section toggles on click, aria-expanded updates
8. Accessibility: role="alert", aria-expanded, keyboard navigation
9. Defensive: Handles missing optional fields gracefully
10. Severity: Different visual treatment for info/warning/error severity

## Definition of Done

- [x] Component implemented with all AC covered
- [x] Unit tests written and passing (43 tests PASS)
- [x] TypeScript strict mode passes (`bun run typecheck`)
- [x] Lint: ESLint not configured in project (pre-existing)
- [x] Design tokens used (no hardcoded colors)
- [x] Accessible (role="alert", aria-expanded)
- [x] Bilingual error messages (zh + en)
- [x] Error message three elements enforced
- [x] Zero hardcoded values
