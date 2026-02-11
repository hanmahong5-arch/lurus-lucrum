# GuShen Design System: The Quant's Cockpit

**Philosophy**: This interface is a professional tool, not a toy. It prioritizes **Control**, **Speed**, **Precision**, and **Insight**.

## 1. Core Principles

- **Dark Mode Only**: We use deep, rich voids (`bg-void`), not pure black.
- **Data Density**: High information density with clear hierarchy.
- **Visual Feedback**: Every interaction must feel tactile and responsive.
- **Financial Precision**: All numbers must be monospaced and tabular.

## 2. Color System (Tailwind Classes)

### Backgrounds

| Class              | Hex       | Usage                                  |
| ------------------ | --------- | -------------------------------------- |
| `bg-void`          | `#09090b` | Main application background (The Void) |
| `bg-surface`       | `#18181b` | Cards, panels, sidebars                |
| `bg-surface-hover` | `#27272a` | Interactive elements on hover          |

### Accents

| Class                         | Usage                                               |
| ----------------------------- | --------------------------------------------------- |
| `text-primary` / `bg-primary` | **Trust/Action**. Main buttons, active tabs, links. |
| `text-accent` / `bg-accent`   | **Warning/VIP**. Critical alerts, premium features. |

### Market Sentiment (Dynamic)

| Class              | Usage                                               |
| ------------------ | --------------------------------------------------- |
| `text-profit`      | **Positive Outcome** (Red in CN, Green in US).      |
| `text-loss`        | **Negative Outcome** (Green in CN, Red in US).      |
| `text-profit-neon` | **Glowing Positive**. Use for active signals/pills. |
| `text-loss-neon`   | **Glowing Negative**. Use for active signals/pills. |

## 3. Typography

### Font Stacks

- **UI / Headings**: `font-sans` (Inter)
- **Data / Code**: `font-mono` (JetBrains Mono)

### Text Utilities

- **`tabular-nums`**: **MANDATORY** for all financial data (prices, %, dates).
- **`text-data-xs`** to **`text-data-2xl`**: Specialized sizes for data grids.
- **`text-stat-sm`** to **`text-stat-xl`**: Large display numbers for KPIs.

## 4. Common Components

### Glass Panel

Use for floating elements (modals, sticky headers, chat windows).

```tsx
<div className="glass-panel p-4 rounded-lg">{/* Content */}</div>
```

### Stat Card

Standard KPI display.

```tsx
<div className="stat-card">
  <span className="stat-label">Total Equity</span>
  <span className="stat-value text-profit tabular-nums">¥1,245,000.00</span>
</div>
```

### Ticker Tape

Scrolling market data strip.

```tsx
<div className="ticker-tape">
  <span>SHCOMP: 3200.50</span>
  <span className="text-profit">+1.2%</span>
</div>
```

## 5. Animation & Interaction

- **Tactile Buttons**: Add `btn-tactile` to primary actions for a press effect.
- **Live Updates**: Add `animate-pulse-profit` or `animate-pulse-loss` to a cell when data changes.
- **Active Glow**: Add `glow-active` to selected tabs or active strategy cards.

## 6. Extended Design Tokens (Story 1.1)

### Score Colors (策略评分色)

| Class | Hex | Usage |
|-------|-----|-------|
| `text-score-s` / `bg-score-s` | `#fbbf24` | 金色 - S 级卓越策略 |
| `text-score-a` / `bg-score-a` | `#22d3ee` | 青色 - A 级优秀策略 |
| `text-score-b` / `bg-score-b` | `#3b82f6` | 蓝色 - B 级良好策略 |
| `text-score-c` / `bg-score-c` | `#6b7280` | 灰色 - C 级一般策略 |
| `text-score-d` / `bg-score-d` | `#fb923c` | 橙色 - D 级需改进策略 |

### Data Source Colors (数据源标识色)

| Class | Hex | Usage |
|-------|-----|-------|
| `text-source-db` / `bg-source-db` | `#3b82f6` | 蓝色 - 真实数据库数据 |
| `text-source-api` / `bg-source-api` | `#eab308` | 黄色 - 实时 API 数据 |
| `text-source-sim` / `bg-source-sim` | `#6b7280` | 灰色 - 模拟数据 |

### AI Visual Language (AI 视觉语言)

| Class | Usage |
|-------|-------|
| `text-ai` | 紫色 AI 标记文字 (#a78bfa) |
| `bg-ai-bg` | AI 背景色 (10% 透明度) |
| `border-ai-border` | AI 边框色 (20% 透明度) |
| `ai-mark` | AI 内容标记 (左边框 + 背景 + 图标色) |
| `ai-mark-pulse` | 带呼吸灯动画的 AI 标记 |
| `animate-ai-pulse` | AI 呼吸灯动画 (1.5s) |

> **Note:** AI tokens are reserved for Epic 5 (AI Co-pilot). Not currently used in application code.

```tsx
// AI 生成内容示例
<div className="ai-mark py-2 rounded">
  <span className="text-ai">AI 建议: 考虑增加止损条件</span>
</div>

// 带动画的 AI 标记
<div className="ai-mark-pulse py-2 rounded">
  <span>AI 正在分析...</span>
</div>
```

### Workflow Step Colors (工作流步骤色)

| Class | Hex | Usage |
|-------|-----|-------|
| `text-step-active` / `bg-step-active` | `#3b82f6` | 蓝色 - 当前活跃步骤 |
| `text-step-done` / `bg-step-done` | `#22c55e` | 绿色 - 已完成步骤 |
| `text-step-pending` / `bg-step-pending` | `#64748b` | 深灰 - 待执行步骤 (WCAG fix from #4b5563) |

### Status Light Colors (状态灯色)

| Class | Hex | Usage |
|-------|-----|-------|
| `text-status-ready` / `bg-status-ready` | `#22c55e` | 绿灯 - 就绪 |
| `text-status-warn` / `bg-status-warn` | `#eab308` | 黄灯 - 警告 |
| `text-status-block` / `bg-status-block` | `#ef4444` | 红灯 - 阻断 |

### Surface Level Extension (背景层级)

| Class | Hex | Usage |
|-------|-----|-------|
| `bg-surface-elevated` | `#1f1f23` | Level 2 - 内嵌卡片 |
| `bg-surface-modal` | `#2d2d33` | Level 4 - Modal/Dialog |

### Chart Extension Colors (图表扩展色)

| Class | Hex | Usage |
|-------|-----|-------|
| `text-chart-benchmark` / `stroke-chart-benchmark` | `#6b7280` | 灰色 - CSI 300 等基准线 |
| `text-chart-signal` / `stroke-chart-signal` | `#a78bfa` | 紫色 - 买卖信号标记 |

### Typography Extension (字体扩展)

| Class | Size | Usage |
|-------|------|-------|
| `text-display` | `clamp(32px, 5vw, 48px)` | 大型评分/英雄数字 (fontWeight: 700) |
| `text-data-sm` | `13px` (was 12px) | 小型数据文字 (提升可读性) |

> **Note:** `text-display` is intended for hero-size score displays and large dashboard numbers. Prefer over `text-5xl` for responsive score rendering.

```tsx
// 大型评分显示
<span className="text-display text-score-s tabular-nums">S</span>
```

## 7. Do's and Don'ts

- **DO** use `tabular-nums` for every single number that might change.
- **DO** use `text-neutral-400` for labels to let the white/colored data pop.
- **DO** use `ai-mark` class for AI-generated content to maintain visual consistency.
- **DO** use semantic score colors (`text-score-s` etc.) instead of hardcoded hex values.
- **DO** use triple encoding (color + text description + icon) for all grade/status indicators to ensure colorblind accessibility.
- **DON'T** use bright backgrounds. Keep it dark.
- **DON'T** use rounded corners larger than `rounded-lg` for data containers (keep it sharp).
- **DON'T** use raw color values when semantic tokens exist.
