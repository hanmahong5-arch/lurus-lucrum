# Story 5-2: Smart Question Chips
# 智能推荐问题

## Story

As a user,
I want the AI advisor to automatically recommend 3 high-value questions based on backtest results,
So that I don't need to think about "what to ask" and can get useful analysis with a single click.

## Status

| Field | Value |
|-------|-------|
| Epic | 5 - AI Co-pilot |
| Priority | P1 |
| FRs | FR-5.6 (partial - context-aware recommendations) |
| NFRs | NFR-1.5 (AI response <10s) |
| Dependencies | Story 5-1 (AI sidebar, context passing, ai-mark) |

## Acceptance Criteria

### AC-1: SmartQuestionChips Component Rendering
- **Given** user enters AI advisor from backtest results (context available)
- **When** AI panel renders
- **Then** SmartQuestionChips component displays 3 recommended question chips:
  - Question 1: About the most prominent metric (e.g., "Why did the max drawdown happen in March?")
  - Question 2: About parameter optimization (e.g., "How to optimize the stop-loss parameter?")
  - Question 3: About applicability (e.g., "Is this strategy suitable for a ranging market?")

### AC-2: Question Generation Logic
- **Given** backtest results with ScoreBreakdown data
- **When** SmartQuestionChips generates questions
- **Then** recommendation logic:
  - Analyzes ScoreBreakdown to find the weakest dimension (lowest score)
  - Identifies the most significant metric from backtest summary
  - Generates context-specific questions (not generic)

### AC-3: Chip Interaction
- **Given** chips are rendered
- **When** user clicks a chip
- **Then** the question text is auto-filled into the chat input and sent automatically
- **And** chips use Badge variant=outline styling, clickable with hover feedback

### AC-4: No-Context Fallback
- **Given** no backtest context is available (user opened advisor directly)
- **When** AI panel renders
- **Then** SmartQuestionChips are NOT displayed
- **And** guidance text shown instead: "Ask any investment-related question"

### AC-5: Component Tests
- Chips render correctly with backtest context
- Click sends question to chat input
- No chips when context is absent
- Correct question generation based on score breakdown

## Technical Notes

### New Files
1. `src/components/advisor/smart-question-chips.tsx` - SmartQuestionChips component
2. `src/lib/advisor/question-generator.ts` - Question generation logic (pure function)
3. `src/components/advisor/__tests__/smart-question-chips.test.tsx` - Component tests
4. `src/lib/advisor/__tests__/question-generator.test.ts` - Logic tests

### Modified Files
1. `src/components/advisor/advisor-chat.tsx` - Integrate SmartQuestionChips into chat welcome area
2. `src/lib/stores/ai-sidebar-store.ts` - Add scoreBreakdown to BacktestContextPayload
3. `src/components/advisor/index.ts` - Export SmartQuestionChips

### Architecture Decisions
- Question generation is a pure function in lib/advisor/ (testable, no side effects)
- Chips pass question text to parent via callback (onQuestionSelect)
- Score breakdown data flows from sidebar store -> AdvisorChat -> SmartQuestionChips
- AI visual language (ai-mark, text-ai) used for chip container styling
