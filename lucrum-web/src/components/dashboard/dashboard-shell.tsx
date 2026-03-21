'use client';

/**
 * Dashboard Shell
 *
 * Client-side wrapper that provides:
 * - Global keyboard shortcuts (Vim-style navigation, modifier combos)
 * - Watchlist slide-out panel
 * - Shortcuts help dialog
 * - Smart next-action suggestion banner
 *
 * Rendered inside the dashboard layout around all page content.
 */

import { useState, useCallback } from 'react';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { WatchlistPanel } from '@/components/watchlist/watchlist-panel';
import { ShortcutsHelp } from '@/components/ui/shortcuts-help';
import { useWatchlistStore } from '@/lib/stores/watchlist-store';
import { SuggestionBanner } from '@/components/ui/suggestion-banner';
import { useSuggestions } from '@/hooks/use-suggestions';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { togglePanel, setPanelOpen } = useWatchlistStore();
  const { suggestion, dismiss } = useSuggestions();

  const handleAction = useCallback(
    (actionId: string) => {
      switch (actionId) {
        case 'show-shortcuts':
          setShortcutsOpen(true);
          break;
        case 'toggle-watchlist':
          togglePanel();
          break;
        case 'search-stock':
          // Open watchlist panel with focus on search
          setPanelOpen(true);
          break;
        case 'escape':
          setPanelOpen(false);
          setShortcutsOpen(false);
          break;
        case 'command-palette':
          // Handled by GlobalCommandPalette — no action needed here
          break;
        case 'save':
          // Handled by individual pages — no global action
          break;
        default:
          break;
      }
    },
    [togglePanel, setPanelOpen]
  );

  useKeyboardShortcuts({ onAction: handleAction });

  return (
    <>
      <SuggestionBanner suggestion={suggestion} onDismiss={dismiss} />
      {children}
      <WatchlistPanel />
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}

export default DashboardShell;
