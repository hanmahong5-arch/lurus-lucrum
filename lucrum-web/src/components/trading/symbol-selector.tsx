"use client";

/**
 * Symbol Selector Component
 * 交易对选择器组件
 *
 * Provides stock/ETF selection with search, categories, and real-time quotes.
 * 提供股票/ETF选择，支持搜索、分类和实时行情
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Symbol information
 */
export interface SymbolInfo {
  symbol: string; // Stock code (e.g., "600000")
  name: string; // Stock name (e.g., "浦发银行")
  market: "SH" | "SZ" | "BJ" | "HK"; // Market (Shanghai/Shenzhen/Beijing/HongKong)
  type: "stock" | "etf" | "bond" | "index"; // Asset type
  price?: number; // Current price
  change?: number; // Price change
  changePercent?: number; // Change percentage
  volume?: number; // Trading volume
}

/**
 * Symbol category
 */
export interface SymbolCategory {
  id: string;
  name: string;
  nameEn: string;
  symbols: SymbolInfo[];
}

/**
 * Component props
 */
export interface SymbolSelectorProps {
  value: string;
  onChange: (symbol: string, info?: SymbolInfo) => void;
  categories?: SymbolCategory[];
  recentSymbols?: string[];
  showQuote?: boolean;
  className?: string;
}

// =============================================================================
// DEFAULT DATA / 默认数据
// =============================================================================

/**
 * Popular A-share stocks for demo
 * Note: Index symbols use special codes to avoid conflict with stock codes
 * 上证指数实际代码为 000001.SH，但为避免与平安银行冲突，这里使用 sh000001
 */
const DEFAULT_SYMBOLS: SymbolInfo[] = [
  // 上证指数 - Use unique identifier to avoid conflict with 平安银行 (000001.SZ)
  {
    symbol: "sh000001",
    name: "上证指数",
    market: "SH",
    type: "index",
    // Index shows point value, not price - no currency prefix needed
    changePercent: 0.85,
  },
  // 深证成指
  {
    symbol: "sz399001",
    name: "深证成指",
    market: "SZ",
    type: "index",
    changePercent: 1.12,
  },
  // 创业板指
  {
    symbol: "sz399006",
    name: "创业板指",
    market: "SZ",
    type: "index",
    changePercent: 1.45,
  },
  // 沪市大盘股
  {
    symbol: "600000",
    name: "浦发银行",
    market: "SH",
    type: "stock",
    price: 7.85,
    changePercent: 1.23,
  },
  {
    symbol: "600036",
    name: "招商银行",
    market: "SH",
    type: "stock",
    price: 35.2,
    changePercent: -0.56,
  },
  {
    symbol: "600519",
    name: "贵州茅台",
    market: "SH",
    type: "stock",
    price: 1750.0,
    changePercent: 0.34,
  },
  {
    symbol: "601318",
    name: "中国平安",
    market: "SH",
    type: "stock",
    price: 48.5,
    changePercent: 1.05,
  },
  // 深市大盘股
  {
    symbol: "000001",
    name: "平安银行",
    market: "SZ",
    type: "stock",
    price: 11.35,
    changePercent: 0.89,
  },
  {
    symbol: "000002",
    name: "万科A",
    market: "SZ",
    type: "stock",
    price: 8.92,
    changePercent: -1.22,
  },
  {
    symbol: "000333",
    name: "美的集团",
    market: "SZ",
    type: "stock",
    price: 56.8,
    changePercent: 0.53,
  },
  // 创业板
  {
    symbol: "300750",
    name: "宁德时代",
    market: "SZ",
    type: "stock",
    price: 185.0,
    changePercent: 2.15,
  },
  // ETF
  {
    symbol: "510300",
    name: "沪深300ETF",
    market: "SH",
    type: "etf",
    price: 4.125,
    changePercent: 0.73,
  },
  {
    symbol: "510500",
    name: "中证500ETF",
    market: "SH",
    type: "etf",
    price: 6.52,
    changePercent: 0.92,
  },
  {
    symbol: "159915",
    name: "创业板ETF",
    market: "SZ",
    type: "etf",
    price: 2.85,
    changePercent: 1.42,
  },
];

/**
 * Default categories
 */
const DEFAULT_CATEGORIES: SymbolCategory[] = [
  {
    id: "popular",
    name: "热门",
    nameEn: "Popular",
    symbols: DEFAULT_SYMBOLS.slice(0, 6),
  },
  {
    id: "index",
    name: "指数",
    nameEn: "Index",
    symbols: DEFAULT_SYMBOLS.filter((s) => s.type === "index"),
  },
  {
    id: "etf",
    name: "ETF",
    nameEn: "ETF",
    symbols: DEFAULT_SYMBOLS.filter((s) => s.type === "etf"),
  },
];

// =============================================================================
// PINYIN SUPPORT / 拼音支持
// =============================================================================

/**
 * Simple pinyin initial mapping for common Chinese characters
 * 简单的拼音首字母映射
 */
const PINYIN_MAP: Record<string, string> = {
  平: "P",
  安: "A",
  银: "Y",
  行: "H",
  招: "Z",
  商: "S",
  贵: "G",
  州: "Z",
  茅: "M",
  台: "T",
  中: "Z",
  国: "G",
  万: "W",
  科: "K",
  美: "M",
  的: "D",
  集: "J",
  团: "T",
  宁: "N",
  德: "D",
  时: "S",
  代: "D",
  沪: "H",
  深: "S",
  创: "C",
  业: "Y",
  板: "B",
  浦: "P",
  发: "F",
  上: "S",
  证: "Z",
  指: "Z",
  数: "S",
};

/**
 * Get pinyin initials for a Chinese string
 */
function getPinyinInitials(text: string): string {
  return text
    .split("")
    .map((char) => PINYIN_MAP[char] || char)
    .join("")
    .toUpperCase();
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function SymbolSelector({
  value,
  onChange,
  categories = DEFAULT_CATEGORIES,
  recentSymbols = [],
  showQuote = true,
  className,
}: SymbolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected symbol info
  const selectedSymbol = useMemo(() => {
    for (const category of categories) {
      const found = category.symbols.find((s) => s.symbol === value);
      if (found) return found;
    }
    return DEFAULT_SYMBOLS.find((s) => s.symbol === value);
  }, [value, categories]);

  // Filter symbols based on search query
  const filteredSymbols = useMemo(() => {
    if (!searchQuery) return null;

    const query = searchQuery.toUpperCase();
    const allSymbols = categories.flatMap((c) => c.symbols);
    const uniqueSymbols = Array.from(
      new Map(allSymbols.map((s) => [`${s.market}${s.symbol}`, s])).values(),
    );

    return uniqueSymbols.filter((symbol) => {
      // Match by code
      if (symbol.symbol.includes(query)) return true;
      // Match by name
      if (symbol.name.includes(searchQuery)) return true;
      // Match by pinyin initials
      const initials = getPinyinInitials(symbol.name);
      if (initials.includes(query)) return true;
      return false;
    });
  }, [searchQuery, categories]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle symbol selection
  const handleSelect = useCallback(
    (symbol: SymbolInfo) => {
      onChange(symbol.symbol, symbol);
      setIsOpen(false);
      setSearchQuery("");
    },
    [onChange],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      } else if (
        e.key === "Enter" &&
        filteredSymbols &&
        filteredSymbols.length > 0
      ) {
        handleSelect(filteredSymbols[0]!);
      }
    },
    [filteredSymbols, handleSelect],
  );

  // Format price change display
  const formatChange = (changePercent?: number) => {
    if (changePercent === undefined) return null;
    const isPositive = changePercent >= 0;
    return (
      <span className={isPositive ? "text-profit" : "text-loss"}>
        {isPositive ? "+" : ""}
        {changePercent.toFixed(2)}%
      </span>
    );
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Selected symbol display / trigger */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="w-full flex items-center justify-between p-3 bg-surface border border-border rounded-lg hover:border-accent/50 transition"
      >
        <div className="flex items-center gap-2">
          {selectedSymbol ? (
            <>
              <span className="text-sm font-medium text-white">
                {selectedSymbol.name}
              </span>
              <span className="text-xs text-white/40">
                {selectedSymbol.market}
                {selectedSymbol.symbol}
              </span>
            </>
          ) : (
            <span className="text-sm text-white/50">选择股票</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showQuote && selectedSymbol && (
            <>
              {selectedSymbol.price !== undefined && (
                <span className="text-sm font-medium text-white">
                  {selectedSymbol.type === "index"
                    ? selectedSymbol.price.toFixed(2)
                    : `¥${selectedSymbol.price.toFixed(2)}`}
                </span>
              )}
              {formatChange(selectedSymbol.changePercent)}
            </>
          )}
          <svg
            className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索代码/名称/拼音首字母..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-accent/50"
            />
          </div>

          {/* Search results or categories */}
          <div className="max-h-80 overflow-y-auto">
            {filteredSymbols ? (
              // Search results
              <div className="p-2">
                {filteredSymbols.length > 0 ? (
                  filteredSymbols.map((symbol) => (
                    <SymbolItem
                      key={`${symbol.market}${symbol.symbol}`}
                      symbol={symbol}
                      isSelected={symbol.symbol === value}
                      showQuote={showQuote}
                      onClick={() => handleSelect(symbol)}
                    />
                  ))
                ) : (
                  <div className="p-4 text-center text-white/40 text-sm">
                    未找到匹配的股票
                  </div>
                )}
              </div>
            ) : (
              // Category tabs and list
              <>
                {/* Category tabs */}
                <div className="flex border-b border-border">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                        activeCategory === category.id
                          ? "text-accent border-b-2 border-accent"
                          : "text-white/50 hover:text-white"
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                {/* Symbol list */}
                <div className="p-2">
                  {/* Recent symbols */}
                  {recentSymbols.length > 0 &&
                    activeCategory === categories[0]?.id && (
                      <div className="mb-2">
                        <div className="px-2 py-1 text-xs text-white/40">
                          最近浏览
                        </div>
                        {recentSymbols.slice(0, 3).map((code) => {
                          const info = DEFAULT_SYMBOLS.find(
                            (s) => s.symbol === code,
                          );
                          if (!info) return null;
                          return (
                            <SymbolItem
                              key={code}
                              symbol={info}
                              isSelected={code === value}
                              showQuote={showQuote}
                              onClick={() => handleSelect(info)}
                            />
                          );
                        })}
                        <div className="border-b border-border my-2" />
                      </div>
                    )}

                  {/* Category symbols */}
                  {categories
                    .find((c) => c.id === activeCategory)
                    ?.symbols.map((symbol) => (
                      <SymbolItem
                        key={`${symbol.market}${symbol.symbol}`}
                        symbol={symbol}
                        isSelected={symbol.symbol === value}
                        showQuote={showQuote}
                        onClick={() => handleSelect(symbol)}
                      />
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS / 子组件
// =============================================================================

interface SymbolItemProps {
  symbol: SymbolInfo;
  isSelected: boolean;
  showQuote: boolean;
  onClick: () => void;
}

function SymbolItem({
  symbol,
  isSelected,
  showQuote,
  onClick,
}: SymbolItemProps) {
  const isPositive = (symbol.changePercent ?? 0) >= 0;
  const isIndex = symbol.type === "index";

  // Format price display based on asset type
  // Indices show point value without currency prefix
  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return null;
    if (isIndex) {
      return price.toFixed(2); // No currency prefix for indices
    }
    return `¥${price.toFixed(2)}`;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-2 rounded-lg transition",
        isSelected
          ? "bg-accent/10 border border-accent/30"
          : "hover:bg-white/5",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="text-left">
          <div
            className={`text-sm font-medium ${isSelected ? "text-accent" : "text-white"}`}
          >
            {symbol.name}
          </div>
          <div className="text-xs text-white/40">
            {symbol.market}
            {symbol.symbol}
            {symbol.type === "etf" && (
              <span className="ml-1 px-1 py-0.5 bg-accent/20 text-accent rounded text-[10px]">
                ETF
              </span>
            )}
            {isIndex && (
              <span className="ml-1 px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                指数
              </span>
            )}
          </div>
        </div>
      </div>

      {showQuote && (
        <div className="text-right">
          {symbol.price !== undefined && (
            <div className="text-sm font-medium text-white">
              {formatPrice(symbol.price)}
            </div>
          )}
          {symbol.changePercent !== undefined && (
            <div
              className={`text-xs ${isPositive ? "text-profit" : "text-loss"}`}
            >
              {isPositive ? "+" : ""}
              {symbol.changePercent.toFixed(2)}%
            </div>
          )}
        </div>
      )}
    </button>
  );
}
