# Story 3.2: 策略发现页面与筛选 (Discovery Page & Filter)

Status: done

## Story

As a 用户,
I want 浏览 GitHub 爬取的热门策略并按类型、热度筛选,
So that 我能发现社区验证过的优质策略。

## Acceptance Criteria

### AC-1: Discovery Page Card Grid
**Given** 用户进入"发现"页面 (导航栏 Tab 或 /dashboard/strategies/discovery)
**When** 页面加载
**Then** 显示 Dashboard 卡片网格布局:
- StrategyDiscoveryCard 显示: 策略名称 + 一句话摘要 + 来源(GitHub) + 热度(Stars/Likes) + 策略类型标签
- 数据来源: 现有 `/api/strategies/popular` + `/api/strategies/trending` API (FR-8.5, FR-8.6)
- 卡片网格响应式: 桌面 3 列, 平板 2 列, 移动端 1 列

### AC-2: FilterBar Top Filters
**Given** 发现页面已加载
**When** 用户操作筛选栏
**Then** 顶部 FilterBar 包含:
- 类型筛选 (Select): 趋势跟踪 / 均值回归 / 动量 / 复合 / 全部
- 排序 (Select): 热度 / 最新 / Stars
- 关键词搜索 (Input): 300ms debounce 模糊匹配名称和描述
**And** 筛选结果实时更新卡片网格

### AC-3: Graceful Degradation Chain
**Given** 数据加载
**When** 各种数据状态
**Then** 降级链:
- 有数据: 正常显示卡片网格
- 爬虫数据不可用时: 显示 EmptyState "暂时无法获取最新策略" + [显示缓存] + [刷新]
- 有缓存数据: 优先显示 + 顶部 stale 提示 "显示的是 X 天前的数据"
- 无缓存且无数据: 显示内置策略模板 (builtin-templates) 作为替代内容
- 加载中: 显示 skeleton 占位

### AC-4: Card Click Navigation
**Given** 卡片网格已渲染
**When** 用户点击策略卡片
**Then** 触发 onSelectStrategy 回调，传递策略 ID 和基本信息
**And** 后续 Story 3-3 将实现详情面板展开

### AC-5: Stale Data Indicator
**Given** 缓存数据有 updatedAt 时间戳
**When** 数据超过配置的新鲜阈值 (默认 1 天)
**Then** 顶部显示提示条: "显示的是 {X} 天前的数据" + [刷新] 按钮

### AC-6: Component Tests
**Given** StrategyDiscoveryCard, FilterBar, DiscoveryPage 组件
**When** 运行测试
**Then** 覆盖: 卡片渲染、筛选功能、搜索 debounce、排序切换、空状态降级链、skeleton 加载态、响应式断点

## Technical Design

### Architecture

Story 3.2 builds on existing infrastructure:
- `GET /api/strategies/popular` — paginated list with type/source/search filters (already implemented)
- `GET /api/strategies/trending` — trending strategies with period filter (already implemented)
- `src/lib/strategy-templates/builtin-templates.ts` — fallback content (Story 3.1)
- `src/components/feedback/empty-state.tsx` — empty state component (Story 1.4)
- `src/lib/cache/` — HybridCache with TTL for popular strategies

What's needed:
1. **StrategyDiscoveryCard** — card component for displaying a crawled strategy
2. **FilterBar** — filter/sort/search toolbar
3. **useDiscoveryStrategies** — custom hook for data fetching with SWR/fetch + fallback logic
4. **Discovery page** — Next.js page at `/dashboard/strategies/discovery`
5. Tests for all components

### New Files
1. `src/components/discovery/strategy-discovery-card.tsx` — Card component
2. `src/components/discovery/filter-bar.tsx` — Filter toolbar
3. `src/components/discovery/discovery-page-content.tsx` — Page content (client component)
4. `src/components/discovery/stale-data-banner.tsx` — Stale data indicator
5. `src/components/discovery/discovery-skeleton.tsx` — Loading skeleton
6. `src/hooks/use-discovery-strategies.ts` — Data fetching hook with fallback chain
7. `src/app/dashboard/strategies/discovery/page.tsx` — Next.js page route
8. `src/components/discovery/__tests__/strategy-discovery-card.test.tsx` — Card tests
9. `src/components/discovery/__tests__/filter-bar.test.tsx` — Filter tests
10. `src/components/discovery/__tests__/discovery-page-content.test.tsx` — Integration tests

### Interfaces

```typescript
/** Strategy data from popular/trending API */
interface DiscoveryStrategy {
  id: number;
  source: string;
  name: string;
  description: string | null;
  author: string | null;
  strategyType: string | null;
  indicators: string[] | null;
  views: number;
  likes: number;
  popularityScore: string | null;
  isFeatured: boolean;
  originalUrl: string | null;
  updatedAt: string;
}

/** Filter state for discovery page */
interface DiscoveryFilters {
  type: string;       // 'all' | 'trend' | 'mean-revert' | 'momentum' | 'composite'
  sort: string;       // 'popularity' | 'latest' | 'stars'
  search: string;     // keyword search
}

/** Props for StrategyDiscoveryCard */
interface StrategyDiscoveryCardProps {
  strategy: DiscoveryStrategy;
  onSelect: (strategy: DiscoveryStrategy) => void;
  className?: string;
}

/** Props for FilterBar */
interface FilterBarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  totalCount: number;
  className?: string;
}
```

### Dependencies
- `@/components/feedback/empty-state` (Story 1.4)
- `@/lib/strategy-templates/builtin-templates` (Story 3.1, fallback)
- `@/components/ui/select` (Radix Select)
- `@/components/ui/input` (Radix Input)
- `@/components/ui/badge` (type labels)
- `@/components/ui/card` (card container)
- `lucide-react` (icons)
- `@testing-library/react` + `vitest` (tests)

## Test Plan

1. **StrategyDiscoveryCard**: renders name, description, author, type badge, popularity metrics
2. **StrategyDiscoveryCard**: click triggers onSelect with strategy data
3. **StrategyDiscoveryCard**: handles null/missing optional fields gracefully
4. **StrategyDiscoveryCard**: featured strategies show featured indicator
5. **FilterBar**: renders type select, sort select, search input
6. **FilterBar**: type filter change triggers onFiltersChange
7. **FilterBar**: sort change triggers onFiltersChange
8. **FilterBar**: search input debounces at 300ms
9. **FilterBar**: displays total count
10. **DiscoveryPageContent**: renders loading skeleton initially
11. **DiscoveryPageContent**: renders strategy cards when data loaded
12. **DiscoveryPageContent**: shows EmptyState when API fails and no cache
13. **DiscoveryPageContent**: shows stale data banner when cache is old
14. **DiscoveryPageContent**: falls back to builtin templates when no data at all
15. **DiscoveryPageContent**: applies type filter correctly
16. **DiscoveryPageContent**: applies search filter correctly
17. **Responsive**: grid shows 3 cols on desktop, 2 on tablet, 1 on mobile (via CSS class assertions)

## Definition of Done

- [x] StrategyDiscoveryCard component implemented
- [x] FilterBar component with type/sort/search implemented
- [x] Discovery page at /dashboard/strategies/discovery
- [x] Data fetching hook with graceful degradation chain
- [x] Stale data banner for cached results
- [x] Loading skeleton state
- [x] Unit tests written and passing (33 tests PASS)
- [x] TypeScript strict mode passes (`bun run typecheck`) (`bun run typecheck`)
- [x] Design tokens used (no hardcoded colors)
- [x] Accessible (ARIA labels, keyboard navigation) - 26 ARIA attributes
- [x] Zero hardcoded values
