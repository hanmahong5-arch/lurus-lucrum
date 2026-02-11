# Process Log | 变更日志

Previous entries archived to `doc/archive/process_v2026-02-06.md`.

---

## 2026-02-06: Story legacy-1-3 — Real Stock Target Selection
Removed mock default fallback, added pinyin search (pinyin-pro), search result grouping/highlighting, recent stocks (localStorage, max 5), DataSourceBadge (3 variants), SimulatedDataBanner (session-scoped), getKLineDateRange DB query + date range display + date picker constraints. Updated pre-existing backtest-panel tests to match new behavior.
Verification: `bunx tsc --noEmit → 0 errors` | `bun run test -- --run → 1352 passed, 1 failed (pre-existing in backtest-basis-panel.test.tsx, unrelated)`
Status: review. 63 tests in 4 Story-related files all pass.

---

## 2026-02-06: Code Review — Epic 1 + Epic 2 (9 stories)
Adversarial code review across all stories (1-1 through 1-6, legacy-1-3, 2-1, 2-2). 32 findings: 4 CRITICAL, 8 HIGH, 12 MEDIUM, 8 LOW.

**Fixes applied:**
1. StatusBar not in layout.tsx → added `<StatusBar />` to root layout + `useNetworkStatusListener()` call (Story 1.3)
2. `toDecimal()` NaN/Infinity guard → degrades to `Decimal(0)` (Story 1.6)
3. `SimpleFinancialValue` sign regex broken for price type → fixed `([¥]?)[+-]` (Story 1.6)
4. ScoreCard missing AC-5 comparison mode → added `state="comparison"` + `previousScore` prop + side-by-side UI (Story 2.2)

**Reclassified as non-issues after deeper analysis:**
- Empty symbol default in backtest-panel (run button disabled, handler validates)
- ai-bg/ai-border hardcoded opacity (intentional semantic tokens, validated by tests)
- localStorage SSR guard (inside useEffect, SSR-safe by design)
- aria-disabled on div[role=listitem] (valid per WAI-ARIA spec with event handlers)

Verification: `bun run typecheck → 0 errors` | `bun run test -- --run src/lib/financial src/components/financial → 96 passed` | `bun run test -- --run score-card.test → 37 passed`

---

## 2026-02-11: Code Review — Epic 1 + Epic 2 + legacy-1-3 (12 stories)
Full adversarial code review of all done stories. 605 tests across 12 stories, 0 failures.

**Fixes applied (Stories 1.1–1.3):**
1. Story 1.1: WCAG step-pending color #4b5563→#64748b (failed 3:1 contrast). Added 34 WCAG contrast ratio tests (59 total).
2. Story 1.2: Removed dead TOAST_ICONS code. Fixed options spread order bug. Added 11 behavioral spy tests (43 total).
3. Story 1.3: Added `md:pb-7` to body (StatusBar hid content). Fixed TS strict noUncheckedIndexedAccess in WCAG helper.

**Stories 1.4–2.5: No code changes needed.** All approved. Review records added to each story file.

**Cross-cutting action items:** (1) `git add` all untracked new files across all stories, (2) integrate unused components into actual pages (EmptyState, WorkflowStepper, FinancialValue).
Verification: `bun run test -- --run [per-story files]` → 605 passed, 0 failed across all 12 stories.
