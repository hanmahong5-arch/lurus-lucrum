'use client';

/**
 * Watchlist Panel Component
 *
 * Slide-out panel accessible from the dashboard header (star icon).
 * Provides organized stock group management with:
 * - Tabbed group switching with stock counts
 * - Search to add stocks
 * - Remove stocks with one click
 * - Quick actions: apply to portfolio backtest, scan, export
 * - Create/rename/delete groups
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Star,
  X,
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Edit2,
  Check,
  BarChart3,
  Radar,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import {
  useWatchlistStore,
  selectGroups,
  selectActiveGroupId,
  selectIsPanelOpen,
  selectActiveGroup,
} from '@/lib/stores/watchlist-store';

// =============================================================================
// Constants
// =============================================================================

const MAX_GROUPS = 10;

// =============================================================================
// Types
// =============================================================================

interface SearchResult {
  symbol: string;
  name: string;
  displayName: string;
  isST: boolean;
  exchange: string;
}

// =============================================================================
// Panel Component
// =============================================================================

export interface WatchlistPanelProps {
  /** Callback to apply a watchlist group to portfolio backtest */
  onApplyToBacktest?: (stocks: Array<{ symbol: string; name: string; sector?: string }>) => void;
  /** Callback to scan watchlist in analysis */
  onScanInAnalysis?: (symbols: string[]) => void;
  className?: string;
}

export function WatchlistPanel({
  onApplyToBacktest,
  onScanInAnalysis,
  className,
}: WatchlistPanelProps) {
  const groups = useWatchlistStore(selectGroups);
  const activeGroupId = useWatchlistStore(selectActiveGroupId);
  const isPanelOpen = useWatchlistStore(selectIsPanelOpen);
  const activeGroup = useWatchlistStore(selectActiveGroup);

  const {
    createGroup,
    deleteGroup,
    renameGroup,
    addStock,
    removeStock,
    updateStockNote,
    exportGroup,
    importGroup,
    setActiveGroupId,
    setPanelOpen,
  } = useWatchlistStore();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editingNoteSymbol, setEditingNoteSymbol] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.results) {
            setSearchResults(data.results as SearchResult[]);
            setShowSearchResults(true);
          }
        })
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside search dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPanelOpen) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isPanelOpen, setPanelOpen]);

  const handleAddStock = useCallback(
    (result: SearchResult) => {
      if (!activeGroupId) return;
      addStock(activeGroupId, {
        symbol: result.symbol,
        name: result.name,
      });
      setSearchQuery('');
      setShowSearchResults(false);
    },
    [activeGroupId, addStock]
  );

  const handleCreateGroup = useCallback(() => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    const id = createGroup(trimmed);
    if (id) {
      setActiveGroupId(id);
    }
    setNewGroupName('');
    setIsCreatingGroup(false);
  }, [newGroupName, createGroup, setActiveGroupId]);

  const handleRename = useCallback(
    (id: string) => {
      const trimmed = editGroupName.trim();
      if (trimmed) {
        renameGroup(id, trimmed);
      }
      setEditingGroupId(null);
      setEditGroupName('');
    },
    [editGroupName, renameGroup]
  );

  const handleExport = useCallback(() => {
    const json = exportGroup(activeGroupId);
    if (!json) return;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist-${activeGroup?.name ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeGroupId, activeGroup?.name, exportGroup]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === 'string') {
          importGroup(text);
        }
      };
      reader.readAsText(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [importGroup]
  );

  const handleSaveNote = useCallback(
    (symbol: string) => {
      updateStockNote(activeGroupId, symbol, noteText);
      setEditingNoteSymbol(null);
      setNoteText('');
    },
    [activeGroupId, noteText, updateStockNote]
  );

  // Active group stocks (memoized)
  const stocks = useMemo(() => activeGroup?.stocks ?? [], [activeGroup]);

  if (!isPanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => setPanelOpen(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface border-l border-border',
          'flex flex-col shadow-2xl',
          'animate-in slide-in-from-right duration-200',
          className
        )}
        role="dialog"
        aria-label="自选股管理"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold text-white">自选股管理</h2>
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Group Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border overflow-x-auto scrollbar-hide shrink-0">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center shrink-0">
              {editingGroupId === group.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(group.id);
                      if (e.key === 'Escape') setEditingGroupId(null);
                    }}
                    className="w-20 px-1.5 py-1 text-xs bg-white/10 border border-accent/50 rounded text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRename(group.id)}
                    className="p-0.5 text-accent hover:text-accent/80"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveGroupId(group.id)}
                  onDoubleClick={() => {
                    if (group.id !== 'default') {
                      setEditingGroupId(group.id);
                      setEditGroupName(group.name);
                    }
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap',
                    activeGroupId === group.id
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                  )}
                >
                  {group.name}
                  <span className="ml-1 font-mono tabular-nums text-[10px] opacity-60">
                    ({group.stocks.length})
                  </span>
                </button>
              )}
            </div>
          ))}

          {/* Create group button */}
          {groups.length < MAX_GROUPS && (
            <>
              {isCreatingGroup ? (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateGroup();
                      if (e.key === 'Escape') setIsCreatingGroup(false);
                    }}
                    placeholder="组名..."
                    className="w-20 px-1.5 py-1 text-xs bg-white/10 border border-accent/50 rounded text-white placeholder-white/30 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateGroup}
                    className="p-0.5 text-accent hover:text-accent/80"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingGroup(true)}
                  className="p-1.5 rounded-md text-white/30 hover:text-accent hover:bg-accent/10 transition shrink-0"
                  title="新建分组"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-border shrink-0" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索添加股票..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search results dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute left-4 right-4 mt-1 bg-surface border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto z-10">
              {searchResults.map((result) => {
                const alreadyAdded = stocks.some((s) => s.symbol === result.symbol);
                return (
                  <button
                    key={result.symbol}
                    onClick={() => {
                      if (!alreadyAdded) handleAddStock(result);
                    }}
                    disabled={alreadyAdded}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-2 text-left transition border-b border-white/5 last:border-b-0',
                      alreadyAdded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-white/5'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white font-medium">
                        {result.displayName}
                      </span>
                      {result.isST && (
                        <span className="ml-1.5 text-[10px] px-1 py-0.5 bg-loss/20 text-loss rounded">
                          ST
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white/30">{result.exchange}</span>
                    {alreadyAdded && (
                      <span className="text-xs text-white/30">已添加</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Stock list */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {stocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <Star className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暂无自选股</p>
              <p className="text-xs mt-1">使用搜索框添加股票到此分组</p>
            </div>
          ) : (
            <div className="space-y-1">
              {stocks.map((stock) => (
                <div
                  key={stock.symbol}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition"
                >
                  {/* Stock info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono tabular-nums text-white/50">
                        {stock.symbol}
                      </span>
                      <span className="text-sm font-medium text-white truncate">
                        {stock.name}
                      </span>
                      {stock.sector && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-white/5 text-white/40 rounded">
                          {stock.sector}
                        </span>
                      )}
                    </div>

                    {/* Note display */}
                    {editingNoteSymbol === stock.symbol ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNote(stock.symbol);
                            if (e.key === 'Escape') setEditingNoteSymbol(null);
                          }}
                          placeholder="添加备注..."
                          className="flex-1 px-2 py-0.5 text-xs bg-white/5 border border-white/10 rounded text-white/70 placeholder-white/20 focus:outline-none focus:border-accent/50"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveNote(stock.symbol)}
                          className="p-0.5 text-accent"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : stock.notes ? (
                      <button
                        onClick={() => {
                          setEditingNoteSymbol(stock.symbol);
                          setNoteText(stock.notes ?? '');
                        }}
                        className="text-[10px] text-white/30 hover:text-white/50 mt-0.5 truncate block max-w-full text-left"
                      >
                        {stock.notes}
                      </button>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={() => {
                        setEditingNoteSymbol(stock.symbol);
                        setNoteText(stock.notes ?? '');
                      }}
                      className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/5"
                      title="备注"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeStock(activeGroupId, stock.symbol)}
                      className="p-1 rounded text-white/30 hover:text-loss hover:bg-loss/10"
                      title="移除"
                      aria-label={`移除 ${stock.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-border space-y-2 shrink-0">
          {/* Quick actions */}
          {stocks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {onApplyToBacktest && (
                <button
                  onClick={() =>
                    onApplyToBacktest(
                      stocks.map((s) => ({
                        symbol: s.symbol,
                        name: s.name,
                        sector: s.sector,
                      }))
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-accent/10 hover:bg-accent/20 text-accent transition border border-accent/20"
                >
                  <BarChart3 className="w-3 h-3" />
                  应用到组合回测
                </button>
              )}
              {onScanInAnalysis && (
                <button
                  onClick={() => onScanInAnalysis(stocks.map((s) => s.symbol))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition border border-white/10"
                >
                  <Radar className="w-3 h-3" />
                  在扫描器中分析
                </button>
              )}
            </div>
          )}

          {/* Import / Export / Delete group */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={stocks.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="导出列表"
            >
              <Download className="w-3 h-3" />
              导出
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition"
              title="导入列表"
            >
              <Upload className="w-3 h-3" />
              导入
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            {activeGroupId !== 'default' && (
              <button
                onClick={() => {
                  if (window.confirm(`确定删除分组"${activeGroup?.name}"吗?`)) {
                    deleteGroup(activeGroupId);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-loss/60 hover:text-loss hover:bg-loss/10 transition ml-auto"
                title="删除分组"
              >
                <Trash2 className="w-3 h-3" />
                删除分组
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default WatchlistPanel;
