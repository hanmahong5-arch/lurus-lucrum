/**
 * Command Palette Data & Utilities
 *
 * Defines navigation commands, action commands, and search/filter logic
 * for the global command palette (Cmd+K).
 */

import {
  Code,
  BarChart3,
  MessageCircle,
  Globe,
  CandlestickChart,
  Clock,
  Building2,
  FilePlus,
  Play,
  Download,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface CommandItem {
  /** Unique identifier */
  id: string;
  /** Display label (Chinese) */
  label: string;
  /** English keywords for search matching */
  keywords: string[];
  /** Icon component */
  icon: LucideIcon;
  /** Navigation target (if navigation command) */
  href?: string;
  /** Action callback (if action command) */
  action?: string;
}

export interface RecentItem {
  /** Command ID */
  id: string;
  /** Display label */
  label: string;
  /** Navigation href */
  href: string;
  /** Timestamp of last use */
  timestamp: number;
}

// ============================================================
// Constants
// ============================================================

export const RECENT_STORAGE_KEY = 'gushen:recent-commands';
export const MAX_RECENT_ITEMS = 5;

// ============================================================
// Navigation Commands
// ============================================================

export const NAVIGATION_COMMANDS: CommandItem[] = [
  {
    id: 'nav-strategy-editor',
    label: '策略编辑器',
    keywords: ['strategy', 'editor', 'code', 'edit'],
    icon: Code,
    href: '/dashboard',
  },
  {
    id: 'nav-validation',
    label: '多股验证',
    keywords: ['validation', 'multi', 'stock', 'batch', 'sector'],
    icon: BarChart3,
    href: '/dashboard/strategy-validation',
  },
  {
    id: 'nav-advisor',
    label: 'AI 顾问',
    keywords: ['advisor', 'ai', 'chat', 'consult'],
    icon: MessageCircle,
    href: '/dashboard/advisor',
  },
  {
    id: 'nav-strategies',
    label: '策略发现',
    keywords: ['discovery', 'strategies', 'popular', 'trending', 'browse'],
    icon: Globe,
    href: '/dashboard/strategies',
  },
  {
    id: 'nav-trading',
    label: '交易面板',
    keywords: ['trading', 'panel', 'trade', 'order'],
    icon: CandlestickChart,
    href: '/dashboard/trading',
  },
  {
    id: 'nav-history',
    label: '历史记录',
    keywords: ['history', 'record', 'log', 'past'],
    icon: Clock,
    href: '/dashboard/history',
  },
  {
    id: 'nav-insights',
    label: '机构洞察',
    keywords: ['insights', 'institutional', 'research', 'market'],
    icon: Building2,
    href: '/dashboard/insights',
  },
];

// ============================================================
// Action Commands
// ============================================================

export const ACTION_COMMANDS: CommandItem[] = [
  {
    id: 'action-new-strategy',
    label: '新建策略',
    keywords: ['new', 'create', 'strategy'],
    icon: FilePlus,
    href: '/dashboard',
    action: 'new-strategy',
  },
  {
    id: 'action-run-backtest',
    label: '运行回测',
    keywords: ['run', 'backtest', 'execute', 'test'],
    icon: Play,
    href: '/dashboard',
    action: 'run-backtest',
  },
  {
    id: 'action-export-report',
    label: '导出报告',
    keywords: ['export', 'report', 'download', 'pdf', 'csv'],
    icon: Download,
    href: '/dashboard/history',
    action: 'export-report',
  },
];

// ============================================================
// Pinyin Matching Utility
// ============================================================

/**
 * Generate pinyin initials from Chinese text for fuzzy matching.
 * Uses pinyin-pro if available, otherwise falls back to simple matching.
 */
type PinyinFn = (text: string, options: { pattern: 'first' | 'pinyin'; toneType: 'none' }) => string;

let pinyinFn: PinyinFn | null = null;

async function loadPinyin() {
  if (pinyinFn) return;
  try {
    const mod = await import('pinyin-pro');
    pinyinFn = mod.pinyin as PinyinFn;
  } catch {
    // Graceful degradation: pinyin matching unavailable
  }
}

// Pre-load pinyin module
loadPinyin();

/**
 * Get pinyin initials for a Chinese string synchronously.
 * Falls back to empty string if pinyin-pro is not loaded.
 */
function getPinyinInitials(text: string): string {
  if (!pinyinFn) return '';
  try {
    const result = pinyinFn(text, { pattern: 'first', toneType: 'none' });
    return typeof result === 'string' ? result.replace(/\s/g, '') : '';
  } catch {
    return '';
  }
}

/**
 * Get full pinyin for a Chinese string synchronously.
 */
function getFullPinyin(text: string): string {
  if (!pinyinFn) return '';
  try {
    const result = pinyinFn(text, { pattern: 'pinyin', toneType: 'none' });
    return typeof result === 'string' ? result.replace(/\s/g, '') : '';
  } catch {
    return '';
  }
}

// ============================================================
// Search / Filter Logic
// ============================================================

/**
 * Filter commands by search query.
 * Supports: Chinese characters, pinyin initials, English keywords.
 */
export function filterCommandsByQuery(
  commands: CommandItem[],
  query: string
): CommandItem[] {
  if (!query.trim()) {
    return commands;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return commands.filter((cmd) => {
    // Match by Chinese label
    if (cmd.label.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Match by English keywords
    if (cmd.keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery))) {
      return true;
    }

    // Match by pinyin initials (e.g., "clbj" -> "策略编辑器")
    const initials = getPinyinInitials(cmd.label);
    if (initials && initials.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Match by full pinyin
    const fullPy = getFullPinyin(cmd.label);
    if (fullPy && fullPy.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    return false;
  });
}

// ============================================================
// Recent Items Management
// ============================================================

/**
 * Load recent command items from localStorage.
 */
export function loadRecentItems(): RecentItem[] {
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!stored) return [];
    const items: unknown = JSON.parse(stored);
    if (!Array.isArray(items)) return [];
    // Validate and return only valid items
    return items
      .filter(
        (item): item is RecentItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as RecentItem).id === 'string' &&
          typeof (item as RecentItem).label === 'string' &&
          typeof (item as RecentItem).href === 'string' &&
          typeof (item as RecentItem).timestamp === 'number'
      )
      .slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

/**
 * Save a command to recent items.
 * Moves existing items to front, enforces max limit (FIFO eviction).
 */
export function saveRecentItem(item: Omit<RecentItem, 'timestamp'>): void {
  try {
    const current = loadRecentItems();

    // Remove existing entry with same ID
    const filtered = current.filter((r) => r.id !== item.id);

    // Add to front with new timestamp
    const updated: RecentItem[] = [
      { ...item, timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT_ITEMS);

    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Graceful degradation: ignore localStorage errors
  }
}
