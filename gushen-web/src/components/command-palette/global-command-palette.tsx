'use client';

/**
 * Global Command Palette Component (Story 6-1)
 *
 * Provides Cmd/Ctrl+K global quick navigation and action execution.
 * Built on cmdk + Radix Dialog for accessible command palette UX.
 *
 * Features:
 * - Global keyboard shortcut (Cmd+K / Ctrl+K)
 * - Fuzzy search with Chinese + pinyin support
 * - Categorized results (Navigation, Actions, Recent)
 * - Full keyboard navigation (arrows, Enter, Escape)
 * - Recent command tracking (localStorage)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  NAVIGATION_COMMANDS,
  ACTION_COMMANDS,
  filterCommandsByQuery,
  loadRecentItems,
  saveRecentItem,
  type CommandItem as CommandItemType,
  type RecentItem,
} from './command-palette-data';

/**
 * Global Command Palette
 *
 * Mount once in the root layout for global availability.
 * Opens via Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 */
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  // Load recent items from localStorage on open
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // Reload recent items each time the palette opens
  useEffect(() => {
    if (open) {
      setRecentItems(loadRecentItems());
      setQuery('');
    }
  }, [open]);

  // Global keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter commands based on search query
  const filteredNavigation = useMemo(
    () => filterCommandsByQuery(NAVIGATION_COMMANDS, query),
    [query]
  );

  const filteredActions = useMemo(
    () => filterCommandsByQuery(ACTION_COMMANDS, query),
    [query]
  );

  // Filter recent items based on search query
  const filteredRecent = useMemo(() => {
    if (!query.trim()) return recentItems;
    const normalizedQuery = query.toLowerCase().trim();
    return recentItems.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.href.toLowerCase().includes(normalizedQuery)
    );
  }, [query, recentItems]);

  // Handle command selection
  const handleSelect = useCallback(
    (cmd: CommandItemType) => {
      // Track in recent items
      if (cmd.href) {
        saveRecentItem({
          id: cmd.id,
          label: cmd.label,
          href: cmd.href,
        });

        // Navigate to target
        router.push(cmd.href);
      }

      // Close palette
      setOpen(false);
    },
    [router]
  );

  // Handle recent item selection
  const handleRecentSelect = useCallback(
    (item: RecentItem) => {
      saveRecentItem({
        id: item.id,
        label: item.label,
        href: item.href,
      });

      router.push(item.href);
      setOpen(false);
    },
    [router]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="搜索命令或页面..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>没有找到匹配的命令</CommandEmpty>

        {/* Recent Items */}
        {filteredRecent.length > 0 && (
          <CommandGroup heading="最近">
            {filteredRecent.map((item) => {
              // Find the matching command to get the icon
              const cmd = [...NAVIGATION_COMMANDS, ...ACTION_COMMANDS].find(
                (c) => c.id === item.id
              );
              const Icon = cmd?.icon;

              return (
                <CommandItem
                  key={`recent-${item.id}`}
                  value={`recent-${item.label}`}
                  onSelect={() => handleRecentSelect(item)}
                >
                  {Icon && (
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {filteredRecent.length > 0 &&
          (filteredNavigation.length > 0 || filteredActions.length > 0) && (
            <CommandSeparator />
          )}

        {/* Navigation Commands */}
        {filteredNavigation.length > 0 && (
          <CommandGroup heading="导航">
            {filteredNavigation.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <CommandItem
                  key={cmd.id}
                  value={cmd.label}
                  onSelect={() => handleSelect(cmd)}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{cmd.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {filteredNavigation.length > 0 && filteredActions.length > 0 && (
          <CommandSeparator />
        )}

        {/* Action Commands */}
        {filteredActions.length > 0 && (
          <CommandGroup heading="操作">
            {filteredActions.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <CommandItem
                  key={cmd.id}
                  value={cmd.label}
                  onSelect={() => handleSelect(cmd)}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{cmd.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export default GlobalCommandPalette;
