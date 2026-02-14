# Story 6-2: Two-Layer Parameter Tooltip
# 双层参数 Tooltip

## Story

As a user,
I want strategy parameters to have both layman and professional explanations on hover,
So that beginners can understand the meaning while experts can see technical details.

## Status

| Field | Value |
|-------|-------|
| Epic | 6 - Workflow Efficiency & Versioning |
| Priority | P1 |
| FRs | FR-1.4 (parameter editor enhancement) |
| NFRs | NFR-4.2 (keyboard reachable), NFR-4.3 (ARIA support) |
| Dependencies | None (builds on existing parameter-editor.tsx and enhanced-parameter-info.ts) |

## Acceptance Criteria

### AC-1: TwoLayerTooltip Component - Layman Layer (Hover)
- **Given** user hovers over a parameter's info icon in the parameter editor
- **When** Tooltip triggers
- **Then** a Radix Tooltip shows the layman explanation text
- **And** the layman text uses simple, non-technical language
- **And** tooltip auto-dismisses when pointer leaves

### AC-2: TwoLayerTooltip Component - Professional Layer (Click)
- **Given** the layman tooltip is visible
- **When** user clicks the info icon (or "Details" link inside tooltip)
- **Then** a Radix Popover opens showing the professional explanation
- **And** the popover includes technical details (formula references, EMA periods, etc.)
- **And** clicking outside or pressing Escape closes the popover

### AC-3: Component Props & API
- **Given** TwoLayerTooltip is used
- **Then** props interface is:
  - `layman: string` - Simple explanation for beginners
  - `professional: string` - Technical explanation for experts
  - `children: ReactNode` - Trigger element (info icon)
- **And** component composes Radix Tooltip + Popover primitives

### AC-4: Touch Device Support
- **Given** user is on a touch device (no hover)
- **When** user taps the trigger
- **Then** layman explanation is shown
- **When** user long-presses (>500ms)
- **Then** professional explanation is shown

### AC-5: Integration with Parameter Editor
- **Given** a parameter has enhanced info in `enhanced-parameter-info.ts`
- **When** parameter editor renders
- **Then** the info icon next to the parameter label is wrapped with TwoLayerTooltip
- **And** layman text is derived from `enhancedInfo.meaning`
- **And** professional text is derived from `enhancedInfo.mechanism`

### AC-6: Mobile Responsive (<768px)
- **Given** viewport width < 768px
- **When** tooltip/popover opens
- **Then** popover uses `side="bottom"` and full available width
- **And** content remains readable without horizontal scroll

### AC-7: Component Tests
- Hover triggers layman tooltip with correct text
- Click triggers professional popover with correct text
- Touch tap shows layman layer
- Escape key closes popover
- ARIA attributes present (role, aria-describedby)
- Renders nothing when both layman and professional are empty

## Technical Notes

### New Files
1. `src/components/ui/two-layer-tooltip.tsx` - TwoLayerTooltip component
2. `src/components/ui/__tests__/two-layer-tooltip.test.tsx` - Component tests

### Modified Files
1. `src/components/strategy-editor/parameter-editor.tsx` - Replace info icon button with TwoLayerTooltip
2. `src/lib/strategy/enhanced-parameter-info.ts` - Add `layman` field to EnhancedParameterInfo type (derive from meaning if not explicit)

### Architecture Decisions
- Component placed in `ui/` as it is a generic, reusable primitive (not business-logic specific)
- Radix Tooltip for hover (layman) + Radix Popover for click (professional) = two-layer UX
- Touch detection via `onTouchStart`/`onTouchEnd` with 500ms threshold for long-press
- Design system colors: `bg-surface`, `text-white/80` for layman; `bg-popover`, `text-popover-foreground` for professional
- ARIA: tooltip has `role="tooltip"`, popover has `role="dialog"` with `aria-label`
