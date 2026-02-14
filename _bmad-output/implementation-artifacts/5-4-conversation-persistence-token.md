# Story 5-4: Conversation Persistence & Token Management
# 对话历史持久化与 Token 管理

## Story

As a user,
I want my conversation history to be saved and to see how much context capacity remains,
So that I can revisit previous analysis sessions and avoid being unexpectedly truncated.

## Status

| Field | Value |
|-------|-------|
| Epic | 5 - AI Co-pilot |
| Priority | P2 |
| FRs | FR-5.6 (Conversation history persistence) |
| NFRs | NFR-1.5 (AI response <10s) |
| Dependencies | Story 5-1 (AI sidebar, context), Story 5-3 (ApplySuggestionButton in chat) |

## Acceptance Criteria

### AC-1: Token Budget Indicator
- **Given** user is in an active AI conversation
- **When** the conversation panel renders
- **Then** a TokenBudgetIndicator displays at the top:
  - Progress bar: used tokens / total budget
  - Color transitions: green (<70%) -> yellow (70-90%) -> red (>90%)
  - Shows numeric usage (e.g., "2,100 / 3,000 tokens")

### AC-2: Token Exhaustion Warning
- **Given** token usage exceeds 90% of the budget
- **When** a new message is added
- **Then** a warning toast fires: "Context is nearly full, consider starting a new conversation"

### AC-3: Token Exhaustion Handling
- **Given** tokens are exhausted (>= 100%)
- **When** the AI response is truncated
- **Then**:
  - A truncation notice displays below the message
  - An auto-summary of the conversation so far is shown
  - A [Start New Conversation] button is presented

### AC-4: Conversation Session Persistence (localStorage)
- **Given** user has had a conversation with the AI advisor
- **When** the session data is persisted
- **Then** each session stores:
  - Unique session ID
  - Strategy context (symbol, parameters)
  - Message list (role, content, timestamp)
  - Creation timestamp
  - Token usage
- **And** a maximum of 10 sessions are retained (FIFO eviction)

### AC-5: Conversation History Browser
- **Given** user opens the conversation history panel
- **When** the panel renders
- **Then** a list of saved sessions displays:
  - Each row: timestamp + context summary + message count
  - Click to restore a session (loads messages into the chat)
  - Swipe/button to delete individual sessions

### AC-6: Save to Server (Optional)
- **Given** user clicks "Save Conversation" button
- **When** the action completes
- **Then** the current session is persisted to localStorage with a "starred" flag
- **And** starred sessions are exempt from FIFO eviction

### AC-7: Component Tests
- Token budget indicator renders with correct colors at each threshold
- Token exhaustion warning fires at >90%
- Truncation notice renders when tokens exhausted
- Sessions persist to and restore from localStorage
- FIFO eviction works correctly at 10 sessions
- History browser renders sessions and supports restore/delete
- Starred sessions are exempt from eviction

## Technical Notes

### New Files
1. `src/lib/advisor/conversation-store.ts` - Zustand store for conversation session management + localStorage persistence
2. `src/lib/advisor/token-tracker.ts` - Token tracking utility (pure functions for estimating and tracking usage)
3. `src/components/advisor/token-budget-indicator.tsx` - TokenBudgetIndicator UI component
4. `src/components/advisor/conversation-history.tsx` - Conversation history browser panel
5. `src/lib/advisor/__tests__/conversation-store.test.ts` - Store logic tests
6. `src/lib/advisor/__tests__/token-tracker.test.ts` - Token tracker tests
7. `src/components/advisor/__tests__/token-budget-indicator.test.tsx` - Indicator component tests
8. `src/components/advisor/__tests__/conversation-history.test.tsx` - History browser tests

### Modified Files
1. `src/components/advisor/advisor-chat.tsx` - Integrate TokenBudgetIndicator, conversation persistence, history panel toggle
2. `src/lib/advisor/index.ts` - Export new modules

### Architecture Decisions
- Conversation store is a dedicated Zustand store with `persist` middleware for localStorage
- Token tracking is pure functions in lib/advisor/ (testable, reusable)
- Token estimation reuses existing `estimateTokens` from context-builder.ts
- Maximum 10 sessions in localStorage to bound storage usage
- Starred sessions bypass FIFO eviction
- No DB persistence in this story (localStorage only + "starred" flag); full DB save deferred to future story
