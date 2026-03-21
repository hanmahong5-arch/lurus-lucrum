'use client';

/**
 * Global Keyboard Shortcut Registry
 *
 * Provides Vim-style multi-key sequences (g+w, g+m, etc.) and
 * modifier-based shortcuts (Cmd+K, Cmd+S, etc.) for power users.
 *
 * Shortcuts only fire when no input/textarea/contenteditable is focused,
 * unless the shortcut is marked as `global: true`.
 *
 * @module hooks/use-keyboard-shortcuts
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// Types
// =============================================================================

export interface ShortcutDef {
  /** Human-readable label (Chinese) */
  label: string;
  /** Display key combo for UI */
  display: string;
  /** Category for grouping in help dialog */
  category: 'nav' | 'action' | 'panel';
  /** Action to execute — either a route or a callback key */
  route?: string;
  /** Named action dispatched via onAction callback */
  actionId?: string;
  /** If true, fires even when an input is focused */
  global?: boolean;
}

export type ShortcutMap = Record<string, ShortcutDef>;

/**
 * All registered keyboard shortcuts.
 * Key format:
 *   - Sequence: "g w" (press g, then w within timeout)
 *   - Modifier: "mod+k" (Cmd on Mac, Ctrl otherwise)
 *   - Single: "/" or "?" or "Escape"
 */
export const SHORTCUTS: ShortcutMap = {
  // Navigation sequences
  'g w': {
    label: '策略工作台',
    display: 'g \u2192 w',
    category: 'nav',
    route: '/dashboard',
  },
  'g m': {
    label: '策略市场',
    display: 'g \u2192 m',
    category: 'nav',
    route: '/dashboard/marketplace',
  },
  'g v': {
    label: '策略验证',
    display: 'g \u2192 v',
    category: 'nav',
    route: '/dashboard/validation',
  },
  'g t': {
    label: '交易中心',
    display: 'g \u2192 t',
    category: 'nav',
    route: '/dashboard/trading',
  },
  'g a': {
    label: '分析中心',
    display: 'g \u2192 a',
    category: 'nav',
    route: '/dashboard/analysis',
  },
  'g i': {
    label: 'AI 顾问',
    display: 'g \u2192 i',
    category: 'nav',
    route: '/dashboard/advisor',
  },
  'g h': {
    label: '历史中心',
    display: 'g \u2192 h',
    category: 'nav',
    route: '/dashboard/history',
  },

  // Modifier shortcuts
  'mod+k': {
    label: '命令面板',
    display: '\u2318 K',
    category: 'action',
    actionId: 'command-palette',
    global: true,
  },
  'mod+s': {
    label: '保存策略',
    display: '\u2318 S',
    category: 'action',
    actionId: 'save',
    global: true,
  },

  // Single-key shortcuts
  '/': {
    label: '搜索股票',
    display: '/',
    category: 'action',
    actionId: 'search-stock',
  },
  '?': {
    label: '显示快捷键',
    display: '?',
    category: 'panel',
    actionId: 'show-shortcuts',
  },
  Escape: {
    label: '关闭面板/取消',
    display: 'Esc',
    category: 'action',
    actionId: 'escape',
    global: true,
  },
  f: {
    label: '打开自选股',
    display: 'f',
    category: 'panel',
    actionId: 'toggle-watchlist',
  },
};

// =============================================================================
// Helpers
// =============================================================================

/** Sequence timeout in milliseconds */
const SEQUENCE_TIMEOUT_MS = 800;

/**
 * Check if the currently focused element is an input-like element.
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // Also check for cmdk input used in command palette
  if (el.getAttribute('role') === 'combobox') return true;
  return false;
}

/**
 * Detect if current platform is Mac (for Cmd vs Ctrl).
 */
function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform?.toLowerCase().includes('mac') ?? false;
}

// =============================================================================
// Hook
// =============================================================================

export interface UseKeyboardShortcutsOptions {
  /**
   * Callback for named actions that cannot be handled by simple routing.
   * Receives the actionId from the shortcut definition.
   */
  onAction?: (actionId: string) => void;
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
}

/**
 * Register global keyboard shortcuts for the dashboard.
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   onAction: (id) => {
 *     if (id === 'show-shortcuts') setShowHelp(true);
 *     if (id === 'toggle-watchlist') toggleWatchlist();
 *   },
 * });
 * ```
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onAction, enabled = true } = options;
  const router = useRouter();
  const pendingKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActionRef = useRef(onAction);

  // Keep the callback ref current
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const isMod = isMacPlatform() ? e.metaKey : e.ctrlKey;
      const key = e.key;

      // --- Modifier shortcuts (mod+key) ---
      if (isMod && !e.shiftKey && !e.altKey) {
        const combo = `mod+${key.toLowerCase()}`;
        const def = SHORTCUTS[combo];
        if (def) {
          e.preventDefault();
          if (def.route) {
            router.push(def.route);
          }
          if (def.actionId) {
            onActionRef.current?.(def.actionId);
          }
          return;
        }
      }

      // Skip non-global, non-modifier shortcuts when input is focused
      if (isInputFocused()) return;

      // --- Sequence keys (g + <letter>) ---
      if (pendingKeyRef.current) {
        const sequence = `${pendingKeyRef.current} ${key}`;
        pendingKeyRef.current = null;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const def = SHORTCUTS[sequence];
        if (def) {
          e.preventDefault();
          if (def.route) {
            router.push(def.route);
          }
          if (def.actionId) {
            onActionRef.current?.(def.actionId);
          }
          return;
        }
      }

      // Start a sequence if this key is the first part of any sequence
      const startsSequence = Object.keys(SHORTCUTS).some(
        (k) => k.startsWith(`${key} `) && k.includes(' ')
      );
      if (startsSequence) {
        pendingKeyRef.current = key;
        timeoutRef.current = setTimeout(() => {
          pendingKeyRef.current = null;
        }, SEQUENCE_TIMEOUT_MS);
        return;
      }

      // --- Single-key shortcuts ---
      // Handle "?" which requires Shift+/ on most keyboards
      const effectiveKey = e.shiftKey && key === '?' ? '?' : key;

      const def = SHORTCUTS[effectiveKey];
      if (def) {
        // Don't prevent default for Escape — let dialogs handle it too
        if (effectiveKey !== 'Escape') {
          e.preventDefault();
        }
        if (def.route) {
          router.push(def.route);
        }
        if (def.actionId) {
          onActionRef.current?.(def.actionId);
        }
      }
    },
    [enabled, router]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Get the modifier symbol for the current platform.
 * Mac: Command symbol, others: "Ctrl"
 */
export function useModifierSymbol(): string {
  const [symbol, setSymbol] = useState('\u2318');

  useEffect(() => {
    if (!isMacPlatform()) {
      setSymbol('Ctrl');
    }
  }, []);

  return symbol;
}

/**
 * Get categorized shortcuts for display.
 */
export function getShortcutsByCategory(): Record<string, Array<{ key: string; def: ShortcutDef }>> {
  const categories: Record<string, Array<{ key: string; def: ShortcutDef }>> = {
    nav: [],
    action: [],
    panel: [],
  };

  for (const [key, def] of Object.entries(SHORTCUTS)) {
    const cat = categories[def.category];
    if (cat) {
      cat.push({ key, def });
    }
  }

  return categories;
}
