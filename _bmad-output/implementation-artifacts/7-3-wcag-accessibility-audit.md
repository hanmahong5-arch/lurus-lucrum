# Story 7.3: WCAG 2.1 AA Accessibility Audit & Remediation

## Story

As a user with disabilities,
I want the platform to meet WCAG 2.1 AA accessibility standards,
So that I can fully operate the platform using keyboard and screen reader.

## Status: done

## Acceptance Criteria

1. **Accessibility utility modules** created in `src/lib/accessibility/`:
   - Focus trap management for modals and dialogs
   - Live region announcer for dynamic content updates
   - Skip-to-content link helper
   - Color contrast checking utilities
   - Keyboard navigation helpers

2. **Skip Link**: First Tab press reveals "Skip to main content" link

3. **Keyboard Navigation**:
   - Full keyboard backtest path: Tab chain complete (strategy input -> params -> stock selector -> date -> run)
   - Modal focus trap: Dialog focus cycles without escaping
   - Focus moves to ScoreCard after backtest completion

4. **Screen Reader Support**:
   - All financial data has aria-label (e.g., "Up 32.5%")
   - Score cards have complete descriptions
   - Progress bars have `aria-valuenow` + `aria-valuetext`

5. **prefers-reduced-motion**: All animations disabled, shimmer replaced with static "Loading..."

6. **forced-colors**: Glass panels and primary buttons have 2px solid border fallback

7. **Tests**: Accessibility test utilities + unit tests for all utilities

## Technical Tasks

1. Create `src/lib/accessibility/` module:
   - `focus-trap.ts` - Focus trap management
   - `live-region.ts` - ARIA live region announcer
   - `skip-link.ts` - Skip navigation helpers
   - `color-contrast.ts` - WCAG contrast ratio utilities
   - `keyboard-navigation.ts` - Keyboard interaction helpers
   - `index.ts` - Barrel export

2. Create `src/lib/accessibility/__tests__/` tests:
   - `focus-trap.test.ts`
   - `live-region.test.ts`
   - `skip-link.test.ts`
   - `color-contrast.test.ts`
   - `keyboard-navigation.test.ts`

3. Create `src/components/accessibility/` components:
   - `skip-link.tsx` - Skip to main content link
   - `live-region.tsx` - ARIA live region provider

4. Update `src/app/layout.tsx` to include SkipLink component

5. Add `prefers-reduced-motion` and `forced-colors` CSS support in `globals.css`

6. Audit and fix ARIA attributes on key components

## NFRs Addressed

- NFR-4.1: WCAG 2.1 Level AA 90%+ compliance
- NFR-4.2: Keyboard navigation - All interactive elements reachable
- NFR-4.3: Screen reader support - ARIA labels on all data tables
- NFR-4.4: Color contrast (dark mode) - 4.5:1 minimum ratio
