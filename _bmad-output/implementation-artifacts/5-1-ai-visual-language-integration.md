# Story 5-1: AI Visual Language & Context Integration
# AI 视觉语言与上下文集成

## Story

As a user,
I want AI-related UI elements to have a unified visual identity, and I want to seamlessly enter AI conversations from backtest results,
So that I can instantly distinguish "my data" from "AI suggestions" and don't need to leave the current page.

## Status

| Field | Value |
|-------|-------|
| Epic | 5 - AI Co-pilot |
| Priority | P0 |
| FRs | FR-5.6 (partial - sidebar foundation) |
| NFRs | NFR-1.5 (AI response <10s) |
| Dependencies | Epic 1 (Toast, StatusBar, design tokens), Epic 2 (backtest results) |

## Acceptance Criteria

### AC-1: AI Visual Language (ai-mark class)
- **Given** any UI area containing AI-generated content
- **When** AI elements render
- **Then** unified AI visual language is applied:
  - Background: `bg-ai-bg` (rgba(167,139,250,0.10))
  - Left accent: `border-left: 3px solid` ai color (#a78bfa)
  - Border: `border-ai-border`
  - Processing state: `ai-pulse` breathing animation (1500ms loop)
  - One-click apply via `ai-mark` Tailwind class
- **And** `prefers-reduced-motion` disables ai-pulse animation

### AC-2: AiInsightSidebar Component
- **Given** backtest result page has a "Ask AI" button (Secondary + arrow icon)
- **When** user clicks the button
- **Then** AI sidebar opens in split mode:
  - Left: backtest results preserved
  - Right: AI conversation panel
  - Auto-carries context: strategy code + parameters + backtest result summary

### AC-3: Row-Level "Ask AI" in Validation Table
- **Given** multi-stock validation ranking table
- **When** user clicks row-level "Ask AI" button
- **Then** AI sidebar opens with stock-specific context
  - Pre-filled question: "Why does {stockName}'s strategy perform {well/poorly}?"

### AC-4: Context Builder Integration
- **Given** AI sidebar is opened with context
- **When** context is passed
- **Then** AdvisorContext includes:
  - Strategy code (truncated to 500 chars if needed)
  - Key parameters (name + value)
  - Backtest summary (total return, max drawdown, Sharpe, win rate, score)
  - Stock info (symbol, name) when from row-level trigger

### AC-5: Component Tests
- ai-mark class rendering
- Sidebar open/close toggle
- Context passing from backtest results
- Row-level trigger with stock context
- Reduced motion compliance

## Technical Notes

### New Files
1. `src/components/advisor/ai-insight-sidebar.tsx` - Split-mode sidebar with embedded AdvisorChat
2. `src/components/advisor/ai-mark.tsx` - Reusable AI content marker wrapper
3. `src/components/advisor/__tests__/ai-insight-sidebar.test.tsx` - Component tests
4. `src/components/advisor/__tests__/ai-mark.test.tsx` - AI mark tests
5. `src/lib/advisor/backtest-context-builder.ts` - Build AdvisorContext from backtest results

### Modified Files
1. `src/components/strategy-editor/backtest-panel.tsx` - Add "Ask AI" button
2. `src/components/strategy-validation/stock-ranking.tsx` - Add row-level "Ask AI" button

### Design Tokens (Already Defined in Epic 1)
- `ai-mark` class: left border + bg + text color
- `ai-mark-pulse`: with breathing animation
- `animate-ai-pulse`: 1.5s keyframe
- Colors: `text-ai`, `bg-ai-bg`, `border-ai-border`

### Architecture Decisions
- Sidebar uses Zustand store for open/close state + context passing
- Context is serialized to AdvisorContext format at the boundary
- Sidebar is lazy-loaded to avoid bundle size impact on non-AI pages
