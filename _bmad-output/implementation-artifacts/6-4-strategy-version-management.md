# Story 6-4: Strategy Version Management
# 策略版本管理

## Story

As a 量化分析师,
I want 策略的每次修改自动记录版本历史,
So that 我能追溯参数修改过程，回退到之前的版本。

## Status: done

## Epic: 6 - 工作流效率与版本管理 (Workflow Efficiency & Versioning)

## Requirements Mapping

| Requirement | Description |
|-------------|-------------|
| FR-1.7 | Strategy versioning (P2) |
| NFR-1.6 | Cache hit response < 50ms |
| NFR-2.5 | Workflow session recovery |

## Acceptance Criteria

### AC-1: Auto-versioning on Save
**Given** user modifies strategy code or parameters and saves
**When** save operation completes
**Then** a new version record is automatically created with:
- versionId, strategyId, code, params
- Auto-generated description (e.g., "Modified stop-loss param 3% -> 5%")
- createdAt timestamp
- Optional backtest score (if available)

### AC-2: Version History Panel
**Given** user opens version history
**When** the panel renders
**Then** displays a timeline list where each version shows:
- Timestamp + auto-generated description
- Score badge (mini variant) if backtest score exists
- Click to preview code and params with diff highlighting

### AC-3: Version Diff
**Given** user clicks a version entry
**When** the version preview loads
**Then** shows diff-highlighted changes between selected version and current version

### AC-4: Restore to Version
**Given** user clicks "Restore to this version" button
**When** confirmed
**Then** code and params are restored to the selected version state

### AC-5: Version Storage
- localStorage: 20 most recent versions per strategy
- DB (strategy_versions table): for actively saved strategies

### AC-6: Auto-description Generation
- Compare before/after parameter diffs
- Generate one-sentence summary of changes

## Technical Design

### New Files
1. `src/lib/strategy/version-manager.ts` - Version creation, diff, restore logic
2. `src/lib/strategy/__tests__/version-manager.test.ts` - Unit tests
3. `src/lib/stores/strategy-version-store.ts` - Zustand store for version state
4. `src/lib/stores/__tests__/strategy-version-store.test.ts` - Store tests

### Data Model
```typescript
interface StrategyVersion {
  versionId: string;
  strategyId: string;
  code: string;
  params: Record<string, unknown>;
  description: string;
  createdAt: number; // Unix timestamp ms
  score?: { grade: ScoreGrade; score: number };
}
```

### DB Schema Addition
```sql
-- strategy_versions table
-- version_id UUID PK
-- strategy_id UUID FK -> strategy_history.id
-- code TEXT
-- params JSONB
-- description VARCHAR(500)
-- score JSONB (nullable)
-- created_at TIMESTAMP
```

### Dependencies
- Existing `strategy-workspace-store.ts` (source of code/params)
- `lib/backtest/score` types (ScoreGrade)

## Dev Checklist
- [x] Write tests (RED) - 36 tests across 2 test files
- [x] Implement version-manager.ts (GREEN) - createVersion, generateVersionDescription, computeVersionDiff
- [x] Implement strategy-version-store.ts (GREEN) - Zustand store with persist, 20 version eviction
- [x] Add strategy_versions table to schema.ts - UUID PK, userId FK, params JSONB, score JSONB
- [x] Run tests and typecheck - 2215/2215 pass, tsc --noEmit clean
- [x] Refactor - Fixed Set iteration for TS downlevelIteration compatibility
