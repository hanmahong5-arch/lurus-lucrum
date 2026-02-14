# Story 7.2: E2E Critical User Journeys
# Story 7.2: E2E 测试关键用户旅程

## Story

**As a** development team,
**I want** critical user journeys covered by automated E2E tests,
**So that** every deployment can automatically verify core functionality is not broken.

**作为** 开发团队,
**我想要** 关键用户旅程有自动化 E2E 测试保障,
**从而** 每次部署前能自动验证核心功能不被破坏。

## Status

| Field | Value |
|-------|-------|
| Story ID | 7-2 |
| Epic | Epic 7 - Platform Maturity & Accessibility |
| Priority | P1 |
| NFRs | NFR-5.4 (Critical path E2E) |
| Dependencies | Epic 1-6 (all features in place) |

## Acceptance Criteria

### AC-1: Playwright Configuration
- [ ] Playwright installed and configured in `gushen-web/`
- [ ] `playwright.config.ts` defines 4 viewport projects:
  - Desktop: 1920x1080 (Chrome)
  - Laptop: 1280x800 (Chrome)
  - Tablet: 768x1024 (Chrome)
  - Mobile: 390x844 (Chrome)
- [ ] `test:e2e` script added to `package.json`
- [ ] E2E tests located in `gushen-web/tests/e2e/`

### AC-2: Journey 1 - Strategy Creation & Backtest (Core Flow)
- [ ] Happy path: Input strategy description -> Generate code -> Select stock -> Run backtest -> See ScoreCard
- [ ] Error path: Network failure during generation -> Fallback code shown

### AC-3: Journey 2 - Multi-Stock Validation
- [ ] Happy path: Select strategy -> Select sector -> Run batch validation -> Ranking table displayed
- [ ] Error path: Empty data / no stocks in sector -> Empty state shown

### AC-4: Journey 3 - AI Advisor Consultation
- [ ] Happy path: Navigate to advisor -> Send question -> Receive streaming response
- [ ] Error path: AI service unavailable -> Error message shown

### AC-5: Journey 4 - Strategy Discovery & Import
- [ ] Happy path: Navigate to discovery page -> Filter strategies -> Click detail -> Import to editor
- [ ] Error path: No strategies available -> Empty state shown

### AC-6: Test Matrix
- [ ] Each journey tested across 4 viewports = 16 test combinations
- [ ] CI integration: `bun run test:e2e` script ready for GitHub Actions

### AC-7: Test Quality
- [ ] Tests use data-testid attributes for stable selectors
- [ ] Tests include proper waiting for async operations
- [ ] Tests are independent (no shared state between tests)

## Technical Notes

- Playwright is configured but E2E tests do NOT need to actually run against a dev server
- Tests are written as spec files with proper Playwright test structure
- Mock/intercept network requests where needed for deterministic testing
- Use `page.route()` for API mocking in E2E tests
- All comments in English

## Test Files

| File | Journey | Description |
|------|---------|-------------|
| `tests/e2e/strategy-creation.spec.ts` | J1 | Strategy creation & backtest |
| `tests/e2e/multi-stock-validation.spec.ts` | J2 | Multi-stock validation |
| `tests/e2e/ai-advisor.spec.ts` | J3 | AI advisor consultation |
| `tests/e2e/strategy-discovery.spec.ts` | J4 | Strategy discovery & import |
| `tests/e2e/fixtures/test-data.ts` | Shared | Mock data for E2E tests |

## Definition of Done

- [ ] Playwright config created with 4 viewports
- [ ] 4 journey spec files created with happy + error paths
- [ ] Test data fixtures for mock API responses
- [ ] `test:e2e` script in package.json
- [ ] Vitest unit tests still pass
- [ ] TypeScript typecheck passes
- [ ] Sprint status updated to `done`
