# Story 5-3: Apply Suggestion Button
# AI 建议一键应用

## Story

As a user,
I want to apply AI parameter adjustment suggestions to my strategy with one click and optionally re-run the backtest,
So that I can instantly verify the effect of AI suggestions without manually modifying parameters.

## Status

| Field | Value |
|-------|-------|
| Epic | 5 - AI Co-pilot |
| Priority | P1 |
| FRs | FR-5.6 (partial - actionable AI suggestions) |
| NFRs | NFR-1.5 (AI response <10s) |
| Dependencies | Story 5-1 (AI sidebar, context), Story 5-2 (SmartQuestionChips context flow) |

## Acceptance Criteria

### AC-1: Structured Suggestion Rendering (ApplySuggestionButton)
- **Given** AI returns a response containing actionable parameter suggestions
- **When** the response is rendered in the advisor chat
- **Then** each suggestion displays in a structured card with:
  - Suggestion content (e.g., "Set stop-loss to 5%")
  - Rationale (e.g., "Based on historical drawdown analysis")
  - Expected impact (e.g., "Expected ~30% drawdown reduction")
  - [Apply to Strategy] button (Primary style)

### AC-2: One-Click Apply Flow
- **Given** user clicks "Apply to Strategy"
- **When** the button is clicked
- **Then**:
  - Parameters are automatically updated in the strategy workspace store
  - Toast(success) displays: "Parameter applied: stop-loss -> 5%"
  - A prompt appears asking "Re-run backtest?" with action option

### AC-3: Re-run Backtest Flow
- **Given** user has applied a suggestion
- **When** user clicks "Re-run backtest"
- **Then** backtest is automatically triggered with updated parameters

### AC-4: Button State Machine
- Button states: default -> applying (loading spinner) -> applied (green checkmark, 1s) -> reset to default
- Applied state auto-resets after 1 second

### AC-5: Non-Parameter Suggestions
- **Given** AI returns a purely analytical response (no parameter suggestions)
- **When** the response renders
- **Then** no ApplySuggestionButton is shown (only for actionable parameter suggestions)

### AC-6: Suggestion Parsing Logic
- Pure function that extracts structured suggestions from AI response text
- Detects parameter names, target values, rationale, and expected impact
- Returns empty array for non-actionable responses

### AC-7: Component Tests
- Suggestion card renders with all fields (content, rationale, impact)
- Apply button updates workspace store parameters
- Toast fires on successful apply
- Button state transitions correctly
- Non-parameter responses show no suggestion buttons
- Suggestion parser extracts correct data from AI response text

## Technical Notes

### New Files
1. `src/components/advisor/apply-suggestion-button.tsx` - ApplySuggestionButton component
2. `src/lib/advisor/suggestion-parser.ts` - Parse AI response for actionable suggestions (pure function)
3. `src/components/advisor/__tests__/apply-suggestion-button.test.tsx` - Component tests
4. `src/lib/advisor/__tests__/suggestion-parser.test.ts` - Parser logic tests

### Modified Files
1. `src/components/advisor/advisor-chat.tsx` - Render ApplySuggestionButton in assistant message bubbles
2. `src/lib/stores/ai-sidebar-store.ts` - (minimal: no changes expected)

### Architecture Decisions
- Suggestion parsing is a pure function in lib/advisor/ (testable, no side effects)
- Component uses strategy-workspace-store to update parameters
- AiMark wrapper for AI visual language consistency
- Button state managed via local useState + setTimeout
- Toast notification via existing toast system
