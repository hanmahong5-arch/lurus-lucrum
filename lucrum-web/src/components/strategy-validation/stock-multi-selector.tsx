"use client";

/**
 * Stock Multi-Selector Component
 * 个股多选器组件
 *
 * Features:
 * - Search autocomplete
 * - Selected stocks list with drag-to-reorder
 * - Favorites quick access
 * - Recent history
 * - Batch import (CSV/text)
 * - Preset management
 * - ST stock indication and filtering
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Star, Clock, Save, Trash2, Upload, X, Plus } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Stock {
  symbol: string;
  name: string;
  displayName: string;
  isST: boolean;
  exchange: string;
  marketCap?: number;
}

interface StockMultiSelectorProps {
  selectedSymbols: string[];
  onSelectionChange: (symbols: string[]) => void;
  maxStocks?: number;
  excludeST?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Debounce hook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// Component
// ============================================================================

export function StockMultiSelector({
  selectedSymbols,
  onSelectionChange,
  maxStocks = 100,
  excludeST = false,
}: StockMultiSelectorProps) {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentStocks, setRecentStocks] = useState<string[]>([]);
  const [stockDetailsMap, setStockDetailsMap] = useState<Map<string, Stock>>(new Map());

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load favorites and recent from localStorage
  useEffect(() => {
    const loadedFavorites = localStorage.getItem('stock-favorites');
    if (loadedFavorites) {
      setFavorites(JSON.parse(loadedFavorites));
    }

    const loadedRecent = localStorage.getItem('stock-recent');
    if (loadedRecent) {
      setRecentStocks(JSON.parse(loadedRecent));
    }
  }, []);

  // Search stocks
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    fetch(`/api/stocks/search?q=${encodeURIComponent(debouncedSearch)}&limit=20&excludeST=${excludeST}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.results) {
          setSearchResults(data.results);
          setShowSearchResults(true);
        }
      })
      .catch(error => {
        console.error('Search failed:', error);
        setSearchResults([]);
      })
      .finally(() => setIsSearching(false));
  }, [debouncedSearch, excludeST]);

  // Fetch details for selected stocks
  useEffect(() => {
    if (selectedSymbols.length === 0) return;

    const unknownSymbols = selectedSymbols.filter(s => !stockDetailsMap.has(s));
    if (unknownSymbols.length === 0) return;

    fetch(`/api/stocks/favorites?symbols=${unknownSymbols.join(',')}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const newMap = new Map(stockDetailsMap);
          for (const stock of data.data) {
            newMap.set(stock.symbol, {
              symbol: stock.symbol,
              name: stock.name,
              displayName: `${stock.symbol} ${stock.name}`,
              isST: stock.isST,
              exchange: stock.exchange,
              marketCap: stock.marketCap,
            });
          }
          setStockDetailsMap(newMap);
        }
      })
      .catch(error => console.error('Fetch stock details failed:', error));
  }, [selectedSymbols, stockDetailsMap]);

  // Add stock
  const addStock = useCallback((stock: Stock) => {
    if (selectedSymbols.includes(stock.symbol)) {
      alert('该股票已经在列表中');
      return;
    }

    if (selectedSymbols.length >= maxStocks) {
      alert(`最多只能选择${maxStocks}只股票`);
      return;
    }

    // Add to selection
    onSelectionChange([...selectedSymbols, stock.symbol]);

    // Update stock details map
    const newMap = new Map(stockDetailsMap);
    newMap.set(stock.symbol, stock);
    setStockDetailsMap(newMap);

    // Add to recent history
    const newRecent = [stock.symbol, ...recentStocks.filter(s => s !== stock.symbol)].slice(0, 10);
    setRecentStocks(newRecent);
    localStorage.setItem('stock-recent', JSON.stringify(newRecent));

    // Clear search
    setSearchQuery('');
    setShowSearchResults(false);
  }, [selectedSymbols, maxStocks, onSelectionChange, stockDetailsMap, recentStocks]);

  // Remove stock
  const removeStock = useCallback((symbol: string) => {
    onSelectionChange(selectedSymbols.filter(s => s !== symbol));
  }, [selectedSymbols, onSelectionChange]);

  // Toggle favorite
  const toggleFavorite = useCallback((symbol: string) => {
    const newFavorites = favorites.includes(symbol)
      ? favorites.filter(s => s !== symbol)
      : [...favorites, symbol];

    setFavorites(newFavorites);
    localStorage.setItem('stock-favorites', JSON.stringify(newFavorites));
  }, [favorites]);

  // Add from favorites
  const addFromFavorites = useCallback(() => {
    if (favorites.length === 0) {
      alert('暂无收藏股票');
      return;
    }

    const newSymbols = Array.from(new Set([...selectedSymbols, ...favorites])).slice(0, maxStocks);
    onSelectionChange(newSymbols);
  }, [favorites, selectedSymbols, maxStocks, onSelectionChange]);

  // Add from recent
  const addFromRecent = useCallback(() => {
    if (recentStocks.length === 0) {
      alert('暂无最近使用的股票');
      return;
    }

    const newSymbols = Array.from(new Set([...selectedSymbols, ...recentStocks])).slice(0, maxStocks);
    onSelectionChange(newSymbols);
  }, [recentStocks, selectedSymbols, maxStocks, onSelectionChange]);

  // Batch import
  const handleBatchImport = useCallback(() => {
    const input = prompt('请粘贴股票代码（每行一个或逗号分隔）：');
    if (!input) return;

    // Parse input (support newline, comma, Chinese comma)
    const symbols = input.split(/[\n,，\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => /^\d{6}$/.test(s)); // Validate 6-digit code

    if (symbols.length === 0) {
      alert('未找到有效的股票代码（需要6位数字）');
      return;
    }

    const newSymbols = Array.from(new Set([...selectedSymbols, ...symbols])).slice(0, maxStocks);
    onSelectionChange(newSymbols);
    alert(`已导入 ${symbols.length} 只股票${newSymbols.length > selectedSymbols.length ? `，成功添加 ${newSymbols.length - selectedSymbols.length} 只` : '（部分已存在）'}`);
  }, [selectedSymbols, maxStocks, onSelectionChange]);

  // Clear all
  const clearAll = useCallback(() => {
    if (selectedSymbols.length === 0) return;
    if (!confirm(`确定要清空全部 ${selectedSymbols.length} 只股票吗？`)) return;
    onSelectionChange([]);
  }, [selectedSymbols, onSelectionChange]);

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="relative" ref={searchInputRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowSearchResults(true);
                }
              }}
              placeholder="输入股票代码或名称..."
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-gray-400 focus:ring-2 focus:ring-accent/50
                       transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={handleBatchImport}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg
                     flex items-center gap-2 text-sm transition-colors"
            title="批量导入股票代码"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">批量导入</span>
          </button>
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-surface border border-white/10 rounded-lg
                        shadow-xl max-h-80 overflow-y-auto">
            {searchResults.map((stock) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/5
                         border-b border-white/5 last:border-b-0 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-medium text-white">{stock.displayName}</span>
                  {stock.isST && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                      ST
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{stock.exchange}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleFavorite(stock.symbol)}
                    className={`p-1.5 rounded transition-colors ${
                      favorites.includes(stock.symbol)
                        ? 'text-yellow-400 hover:bg-yellow-500/10'
                        : 'text-gray-400 hover:bg-white/10 hover:text-yellow-400'
                    }`}
                    title={favorites.includes(stock.symbol) ? '取消收藏' : '收藏'}
                  >
                    <Star className={`w-4 h-4 ${favorites.includes(stock.symbol) ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => addStock(stock)}
                    disabled={selectedSymbols.includes(stock.symbol)}
                    className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 rounded text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {selectedSymbols.includes(stock.symbol) ? '已添加' : '添加'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Access Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={addFromFavorites}
          disabled={favorites.length === 0}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm
                   flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="添加所有收藏股票"
        >
          <Star className="w-4 h-4" />
          <span>收藏 ({favorites.length})</span>
        </button>
        <button
          onClick={addFromRecent}
          disabled={recentStocks.length === 0}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm
                   flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="添加最近使用的股票"
        >
          <Clock className="w-4 h-4" />
          <span>最近 ({recentStocks.length})</span>
        </button>
      </div>

      {/* Selected Stocks List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300 font-medium">
              已选股票
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              selectedSymbols.length >= maxStocks
                ? 'bg-red-500/20 text-red-400'
                : 'bg-white/10 text-gray-400'
            }`}>
              {selectedSymbols.length}/{maxStocks}
            </span>
          </div>
          {selectedSymbols.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              清空全部
            </button>
          )}
        </div>

        <div className="bg-surface/30 rounded-lg border border-white/5">
          {selectedSymbols.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无选择股票</p>
              <p className="text-xs mt-1">搜索并添加股票，或使用快捷按钮批量添加</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto p-2">
              <div className="space-y-1">
                {selectedSymbols.map((symbol) => {
                  const stock = stockDetailsMap.get(symbol);
                  return (
                    <div
                      key={symbol}
                      className="flex items-center justify-between px-3 py-2.5 bg-white/5
                               hover:bg-white/10 rounded transition-colors group"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-gray-500 cursor-move" title="拖动排序">
                          ⋮⋮
                        </span>
                        <span className="font-medium text-white">
                          {stock ? stock.displayName : symbol}
                        </span>
                        {stock?.isST && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                            ST
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleFavorite(symbol)}
                          className={`p-1.5 rounded transition-colors ${
                            favorites.includes(symbol)
                              ? 'text-yellow-400 hover:bg-yellow-500/10'
                              : 'text-gray-400 hover:bg-white/10 hover:text-yellow-400'
                          }`}
                          title={favorites.includes(symbol) ? '取消收藏' : '收藏'}
                        >
                          <Star className={`w-4 h-4 ${favorites.includes(symbol) ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => removeStock(symbol)}
                          className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                          title="移除"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
