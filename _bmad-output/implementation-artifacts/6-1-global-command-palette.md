# Story 6-1: Global Command Palette (Cmd+K)

## Story

**As a** power user,
**I want** to press Cmd/Ctrl+K to open a global search and navigation palette,
**So that** I can quickly jump to any feature without navigating through menus.

## Status

| Field | Value |
|-------|-------|
| Epic | 6 - Workflow Efficiency & Versioning |
| Priority | P1 |
| Story Points | 5 |
| Status | done |

## Acceptance Criteria

### AC-1: Keyboard Shortcut Trigger
- **Given** the user is on any dashboard page
- **When** they press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
- **Then** the GlobalCommandPalette dialog opens with the search input auto-focused

### AC-2: Search & Fuzzy Match
- **Given** the command palette is open
- **When** the user types in the search input
- **Then** results are filtered using instant fuzzy matching
- **And** matching supports Chinese characters and pinyin initials (e.g., "cl" matches "策略编辑器")

### AC-3: Categorized Results
- **Given** the command palette is open with no search query
- **Then** results are grouped into categories:
  - Navigation: "策略编辑器" / "多股验证" / "AI 顾问" / "策略发现" / "交易面板" / "历史记录" / "机构洞察"
  - Actions: "新建策略" / "运行回测" / "导出报告"
  - Recent: Last 5 visited pages/features (persisted in localStorage)

### AC-4: Keyboard Navigation
- **Given** the command palette shows results
- **When** the user presses arrow keys (Up/Down), results are highlighted
- **And** pressing Enter executes the selected command
- **And** pressing Escape closes the palette

### AC-5: Command Execution
- **Given** the user selects a navigation item
- **When** they press Enter or click
- **Then** the router navigates to the target page
- **And** the palette closes

### AC-6: Mobile Exclusion
- **Given** the viewport is < 768px
- **Then** the command palette shortcut hint is hidden from the UI
- **And** Cmd+K still functions if triggered (graceful, not broken)

### AC-7: Accessibility
- **Given** the command palette is rendered
- **Then** it uses `role="dialog"` with `aria-label="Command palette"`
- **And** search input has `aria-label="Search commands"`
- **And** result groups use appropriate ARIA group roles

## Technical Notes

- Built on existing `cmdk` library (already in package.json) + Radix Dialog
- Uses existing `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem` from `@/components/ui/command`
- Pinyin matching via `pinyin-pro` library (already in dependencies)
- Recent pages stored in localStorage with key `lucrum:recent-commands`
- Maximum 5 recent items, FIFO eviction
- Component location: `src/components/command-palette/global-command-palette.tsx`
- Tests location: `src/components/command-palette/__tests__/global-command-palette.test.tsx`
- Integration point: `src/app/layout.tsx` (global scope, always mounted)

## Dependencies

- `cmdk` ^1.1.1 (existing)
- `@radix-ui/react-dialog` (existing)
- `pinyin-pro` (existing)
- `lucide-react` (existing)
- `next/navigation` (useRouter)

## Definition of Done

- [x] Component renders with Cmd+K trigger
- [x] Fuzzy search with Chinese + pinyin support
- [x] Categorized results (Navigation, Actions, Recent)
- [x] Full keyboard navigation (arrows, Enter, Escape)
- [x] Router navigation on selection
- [x] Recent pages tracked in localStorage
- [x] Mobile: shortcut hint hidden < 768px
- [x] ARIA accessibility attributes
- [x] Unit tests passing (27/27)
- [x] TypeScript typecheck passing
