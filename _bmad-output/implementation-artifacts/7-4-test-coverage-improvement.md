# Story 7.4: Test Coverage Improvement

## Status: done

## Description

As a development team,
I want data layer and component layer test coverage to reach targets,
So that code quality is guaranteed and refactoring does not introduce regressions.

## Acceptance Criteria

- Data layer (lib/) coverage >= 60% (NFR-5.2)
- Component layer (components/) coverage >= 50% (NFR-5.3)
- Tests use Vitest + React Testing Library
- Test files placed in `__tests__/` alongside source modules
- All tests pass with `bun run test`

## Technical Notes

### Modules Requiring Tests (lib/)

Priority targets (no existing tests):
1. `lib/utils.ts` - cn(), formatPnL(), formatCurrency()
2. `lib/strategy/parameter-parser.ts` - parseStrategyParameters(), validateParameter(), cross-param rules
3. `lib/comparison/metric-diff.ts` - calculateMetricDiff()
4. `lib/comparison/winner-resolver.ts` - resolveGroupWinner(), resolveCategoryWinners(), generateSummaryText()
5. `lib/risk/risk-manager.ts` - RiskManager.validateOrder(), validatePortfolio()
6. `lib/trading/kline-validator.ts` - validateKLineData(), quickValidate()

Already have tests:
- `lib/backtest/__tests__/` (22 test files)
- `lib/backtest/score/__tests__/`
- `lib/financial/__tests__/`
- `lib/strategy/__tests__/version-manager.test.ts`
- `lib/stores/__tests__/`
- `lib/advisor/__tests__/`
- `lib/comparison/__tests__/comparison-engine.test.ts`
- `lib/design-system/__tests__/`
- `lib/report/__tests__/`

### Test Pattern

```
src/lib/<module>/__tests__/<file>.test.ts
```

## Dev Checklist

- [ ] Add tests for lib/utils.ts
- [ ] Add tests for lib/strategy/parameter-parser.ts
- [ ] Add tests for lib/comparison/metric-diff.ts
- [ ] Add tests for lib/comparison/winner-resolver.ts
- [ ] Add tests for lib/risk/risk-manager.ts
- [ ] Add tests for lib/trading/kline-validator.ts
- [ ] All tests pass
- [ ] Record test count in process.md
