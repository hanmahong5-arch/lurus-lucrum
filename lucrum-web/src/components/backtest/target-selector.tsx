"use client";

/**
 * Unified Backtest Target Selector Component
 * 统一回测标的选择器组件
 *
 * Supports three modes: sector, individual stock, and portfolio
 * 支持三种模式：板块、个股和组合
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Building2,
  LineChart,
  Briefcase,
  Search,
  Filter,
  X,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  BacktestTarget,
  BacktestTargetMode,
  SectorTarget,
  StockTarget,
  PortfolioTarget,
  PortfolioStock,
  SectorFilter,
} from "@/lib/backtest/types";
import {
  SW_SECTORS,
  CONCEPT_SECTORS,
  type SectorInfo,
} from "@/lib/data-service/sources/eastmoney-sector";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface TargetSelectorProps {
  value?: BacktestTarget;
  onChange: (target: BacktestTarget) => void;
  className?: string;
  disabled?: boolean;
}

interface SectorItemProps {
  sector: SectorInfo;
  selected: boolean;
  onSelect: (sector: SectorInfo) => void;
}

interface StockSearchProps {
  onSelect: (stock: StockTarget) => void;
  selectedStock?: StockTarget | null;
}

interface PortfolioEditorProps {
  portfolio: PortfolioTarget;
  onChange: (portfolio: PortfolioTarget) => void;
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const STOCK_SEARCH_API = "/api/stocks/search";
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULT_LIMIT = 20;
const SEARCH_MIN_QUERY_LENGTH = 1;

// =============================================================================
// STOCK SEARCH HOOK / 股票搜索 Hook
// =============================================================================

/**
 * Map exchange name from API to market code used by backtest types.
 */
function mapExchangeToMarket(exchange: string, symbol: string): "SH" | "SZ" {
  const upper = exchange.toUpperCase();
  if (upper === "SH" || upper === "SSE") return "SH";
  if (upper === "SZ" || upper === "SZSE") return "SZ";
  // Beijing Stock Exchange (BJ/BSE, codes 8xx/4xx) not yet supported.
  // Log warning and infer from symbol prefix as best-effort fallback.
  console.warn(
    `[target-selector] Unknown exchange "${exchange}" for symbol "${symbol}", inferring from symbol prefix`
  );
  return symbol.startsWith("6") ? "SH" : "SZ";
}

type MatchType = "exact" | "name" | "pinyin";

interface EnhancedStockResult extends StockTarget {
  matchType: MatchType;
  matchIndices: number[];
}

interface StockSearchGroups {
  exact: EnhancedStockResult[];
  name: EnhancedStockResult[];
  pinyin: EnhancedStockResult[];
}

interface StockSearchState {
  results: EnhancedStockResult[];
  groups: StockSearchGroups;
  isSearching: boolean;
  error: string | null;
}

/**
 * Debounced stock search hook calling /api/stocks/search.
 * Handles 300ms debounce, AbortController cancellation, pinyin matching, and result grouping.
 */
function useStockSearch(query: string): StockSearchState {
  const emptyGroups: StockSearchGroups = { exact: [], name: [], pinyin: [] };
  const [results, setResults] = useState<EnhancedStockResult[]>([]);
  const [groups, setGroups] = useState<StockSearchGroups>(emptyGroups);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < SEARCH_MIN_QUERY_LENGTH) {
      setResults([]);
      setGroups(emptyGroups);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `${STOCK_SEARCH_API}?q=${encodeURIComponent(query)}&limit=${SEARCH_RESULT_LIMIT}&excludeST=false`,
          { signal: controller.signal },
        );
        const data = await res.json();

        if (data.success && data.results) {
          const mapped: EnhancedStockResult[] = data.results.map(
            (r: {
              symbol: string;
              name: string;
              exchange: string;
              matchType?: MatchType;
              matchIndices?: number[];
            }) => ({
              symbol: r.symbol,
              name: r.name,
              market: mapExchangeToMarket(r.exchange, r.symbol),
              matchType: r.matchType || "name",
              matchIndices: r.matchIndices || [],
            }),
          );

          // Group results by match type
          const grouped: StockSearchGroups = { exact: [], name: [], pinyin: [] };
          for (const item of mapped) {
            grouped[item.matchType].push(item);
          }

          setResults(mapped);
          setGroups(grouped);
          setError(null);
        } else {
          setResults([]);
          setGroups(emptyGroups);
          setError(data.error || "搜索失败");
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setResults([]);
        setGroups(emptyGroups);
        setError("网络错误，请重试");
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { results, groups, isSearching, error };
}

// =============================================================================
// HIGHLIGHT COMPONENT / 高亮组件
// =============================================================================

/**
 * Render text with matching characters highlighted
 */
function HighlightedText({
  text,
  matchIndices,
  className,
}: {
  text: string;
  matchIndices: number[];
  className?: string;
}) {
  if (matchIndices.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const indexSet = new Set(matchIndices);
  const parts: { text: string; highlighted: boolean }[] = [];
  let current = "";
  let currentHighlighted = false;

  for (let i = 0; i < text.length; i++) {
    const isMatch = indexSet.has(i);
    if (i === 0) {
      currentHighlighted = isMatch;
      current = text[i]!;
    } else if (isMatch === currentHighlighted) {
      current += text[i]!;
    } else {
      parts.push({ text: current, highlighted: currentHighlighted });
      current = text[i]!;
      currentHighlighted = isMatch;
    }
  }
  if (current) {
    parts.push({ text: current, highlighted: currentHighlighted });
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.highlighted ? (
          <span key={i} className="text-primary font-semibold">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

// =============================================================================
// RECENT STOCKS HOOK / 最近使用股票 Hook
// =============================================================================

const RECENT_STOCKS_KEY = "lucrum:recent-stocks";
const RECENT_STOCKS_MAX = 5;

/**
 * Hook for managing recently selected stocks with localStorage persistence.
 * Stores up to 5 stocks, most recently used first.
 */
function useRecentStocks() {
  const [recentStocks, setRecentStocks] = useState<StockTarget[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_STOCKS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StockTarget[];
        if (Array.isArray(parsed)) {
          setRecentStocks(parsed.slice(0, RECENT_STOCKS_MAX));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Add a stock to recent list (push to front, deduplicate)
  const addRecent = useCallback((stock: StockTarget) => {
    if (!stock.symbol) return;

    setRecentStocks((prev) => {
      const filtered = prev.filter((s) => s.symbol !== stock.symbol);
      const updated = [
        { symbol: stock.symbol, name: stock.name, market: stock.market },
        ...filtered,
      ].slice(0, RECENT_STOCKS_MAX);

      try {
        localStorage.setItem(RECENT_STOCKS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }

      return updated;
    });
  }, []);

  return { recentStocks, addRecent };
}

// =============================================================================
// SECTOR ITEM COMPONENT / 板块项组件
// =============================================================================

function SectorItem({ sector, selected, onSelect }: SectorItemProps) {
  return (
    <button
      onClick={() => onSelect(sector)}
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        selected && "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      <span className="truncate">{sector.name}</span>
      {selected && <Check className="h-4 w-4 ml-2 flex-shrink-0" />}
    </button>
  );
}

// =============================================================================
// SECTOR FILTER COMPONENT / 板块过滤器组件
// =============================================================================

interface SectorFilterPanelProps {
  filters: SectorFilter;
  onChange: (filters: SectorFilter) => void;
}

function SectorFilterPanel({ filters, onChange }: SectorFilterPanelProps) {
  return (
    <div className="space-y-3 p-3 border rounded-md bg-muted/30">
      <div className="text-sm font-medium flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <span>过滤条件 / Filters</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Exclude ST stocks */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="excludeST"
            checked={filters.excludeST ?? true}
            onCheckedChange={(checked) =>
              onChange({ ...filters, excludeST: checked === true })
            }
          />
          <Label htmlFor="excludeST" className="text-sm">
            排除ST股票
          </Label>
        </div>

        {/* Exclude new stocks */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="excludeNew"
            checked={filters.excludeNew ?? true}
            onCheckedChange={(checked) =>
              onChange({ ...filters, excludeNew: checked === true })
            }
          />
          <Label htmlFor="excludeNew" className="text-sm">
            排除次新股
          </Label>
        </div>
      </div>

      {/* Market cap filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm whitespace-nowrap">市值下限</Label>
        <Input
          type="number"
          placeholder="0"
          className="h-8 w-24"
          value={filters.minMarketCap ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              minMarketCap: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
        <span className="text-sm text-muted-foreground">亿元</span>
      </div>
    </div>
  );
}

// =============================================================================
// SECTOR MODE COMPONENT / 板块模式组件
// =============================================================================

interface SectorModeProps {
  value?: SectorTarget;
  onChange: (sector: SectorTarget) => void;
}

function SectorMode({ value, onChange }: SectorModeProps) {
  const [industryOpen, setIndustryOpen] = useState(true);
  const [conceptOpen, setConceptOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<SectorFilter>({
    excludeST: true,
    excludeNew: true,
  });

  // Filter sectors by search query
  const filteredIndustries = useMemo(() => {
    if (!searchQuery) return SW_SECTORS;
    const query = searchQuery.toLowerCase();
    return SW_SECTORS.filter(
      (s) =>
        s.name.includes(searchQuery) ||
        s.nameEn.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  const filteredConcepts = useMemo(() => {
    if (!searchQuery) return CONCEPT_SECTORS;
    const query = searchQuery.toLowerCase();
    return CONCEPT_SECTORS.filter(
      (s) =>
        s.name.includes(searchQuery) ||
        s.nameEn.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  const handleSectorSelect = useCallback(
    (sector: SectorInfo) => {
      onChange({
        code: sector.code,
        name: sector.name,
        type: sector.type,
        filters,
      });
    },
    [onChange, filters],
  );

  const handleFiltersChange = useCallback(
    (newFilters: SectorFilter) => {
      setFilters(newFilters);
      if (value) {
        onChange({ ...value, filters: newFilters });
      }
    },
    [value, onChange],
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索板块名称或代码..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Shenwan Industries */}
      <Collapsible open={industryOpen} onOpenChange={setIndustryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto">
            <span className="font-medium">
              申万行业 ({filteredIndustries.length})
            </span>
            {industryOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-4 gap-1.5 mt-2 max-h-48 overflow-y-auto">
            {filteredIndustries.map((sector) => (
              <SectorItem
                key={sector.code}
                sector={{ ...sector, type: "industry" }}
                selected={value?.code === sector.code}
                onSelect={handleSectorSelect}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Concept Sectors */}
      <Collapsible open={conceptOpen} onOpenChange={setConceptOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto">
            <span className="font-medium">
              热门概念 ({filteredConcepts.length})
            </span>
            {conceptOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-4 gap-1.5 mt-2 max-h-48 overflow-y-auto">
            {filteredConcepts.map((sector) => (
              <SectorItem
                key={sector.code}
                sector={{ ...sector, type: "concept" }}
                selected={value?.code === sector.code}
                onSelect={handleSectorSelect}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Selected sector display */}
      {value && (
        <div className="p-3 border rounded-md bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{value.name}</span>
              <span className="text-sm text-muted-foreground ml-2">
                ({value.code})
              </span>
            </div>
            <Badge
              variant={value.type === "industry" ? "default" : "secondary"}
            >
              {value.type === "industry" ? "行业" : "概念"}
            </Badge>
          </div>
        </div>
      )}

      {/* Filters */}
      <SectorFilterPanel filters={filters} onChange={handleFiltersChange} />
    </div>
  );
}

// =============================================================================
// STOCK MODE COMPONENT / 个股模式组件
// =============================================================================

interface StockModeProps {
  value?: StockTarget;
  onChange: (stock: StockTarget) => void;
}

function StockMode({ value, onChange }: StockModeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { groups, isSearching, error: searchError, results: searchResults } = useStockSearch(searchQuery);
  const { recentStocks, addRecent } = useRecentStocks();

  // Popular stocks for quick access
  const commonStocks: StockTarget[] = useMemo(
    () => [
      { symbol: "600519", name: "贵州茅台", market: "SH" },
      { symbol: "000858", name: "五粮液", market: "SZ" },
      { symbol: "600036", name: "招商银行", market: "SH" },
      { symbol: "000001", name: "平安银行", market: "SZ" },
      { symbol: "601318", name: "中国平安", market: "SH" },
      { symbol: "300750", name: "宁德时代", market: "SZ" },
      { symbol: "002594", name: "比亚迪", market: "SZ" },
      { symbol: "600276", name: "恒瑞医药", market: "SH" },
    ],
    [],
  );

  const handleStockSelect = useCallback(
    (stock: StockTarget) => {
      onChange(stock);
      addRecent(stock);
      setOpen(false);
      setSearchQuery("");
    },
    [onChange, addRecent],
  );

  /** Render a single search result item with match highlighting */
  const renderResultItem = useCallback(
    (stock: EnhancedStockResult) => {
      // For exact (symbol) matches, highlight the symbol; for name/pinyin, highlight the name
      const symbolHighlight = stock.matchType === "exact" ? stock.matchIndices : [];
      const nameHighlight = stock.matchType !== "exact" ? stock.matchIndices : [];

      return (
        <CommandItem
          key={stock.symbol}
          onSelect={() => handleStockSelect(stock)}
        >
          <HighlightedText
            text={stock.symbol}
            matchIndices={symbolHighlight}
            className="font-mono"
          />
          <HighlightedText
            text={stock.name}
            matchIndices={nameHighlight}
            className="ml-2"
          />
          <Badge variant="outline" className="ml-auto">
            {stock.market}
          </Badge>
        </CommandItem>
      );
    },
    [handleStockSelect],
  );

  const GROUP_LABELS: Record<MatchType, string> = {
    exact: "精确匹配",
    name: "名称匹配",
    pinyin: "拼音匹配",
  };

  return (
    <div className="space-y-4">
      {/* Stock search */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value ? (
              <span>
                {value.name} ({value.symbol})
              </span>
            ) : (
              <span className="text-muted-foreground">
                搜索股票代码、名称或拼音...
              </span>
            )}
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0 z-50" align="start" sideOffset={4} collisionPadding={8}>
          {/* Disable cmdk built-in filtering — results are API-controlled */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="输入代码、名称或拼音首字母..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {isSearching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    搜索中...
                  </span>
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <CommandEmpty>{searchError || "未找到匹配的股票"}</CommandEmpty>
              ) : (
                <>
                  {/* Grouped search results */}
                  {(["exact", "name", "pinyin"] as const).map((groupKey) => {
                    const items = groups[groupKey];
                    if (items.length === 0) return null;
                    return (
                      <CommandGroup key={groupKey} heading={GROUP_LABELS[groupKey]}>
                        {items.map(renderResultItem)}
                      </CommandGroup>
                    );
                  })}
                  {/* Show recent + popular stocks when no search query */}
                  {!searchQuery && (
                    <>
                      {recentStocks.length > 0 && (
                        <CommandGroup heading="最近使用">
                          {recentStocks.map((stock) => (
                            <CommandItem
                              key={`recent-${stock.symbol}`}
                              onSelect={() => handleStockSelect(stock)}
                            >
                              <span className="font-mono">{stock.symbol}</span>
                              <span className="ml-2">{stock.name}</span>
                              <Badge variant="outline" className="ml-auto">
                                {stock.market}
                              </Badge>
                              {value?.symbol === stock.symbol && (
                                <Check className="ml-2 h-4 w-4" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      <CommandGroup heading="热门股票">
                        {commonStocks.map((stock) => (
                          <CommandItem
                            key={stock.symbol}
                            onSelect={() => handleStockSelect(stock)}
                          >
                            <span className="font-mono">{stock.symbol}</span>
                            <span className="ml-2">{stock.name}</span>
                            <Badge variant="outline" className="ml-auto">
                              {stock.market}
                            </Badge>
                            {value?.symbol === stock.symbol && (
                              <Check className="ml-2 h-4 w-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected stock display */}
      {value && (
        <div className="p-4 border rounded-md bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-lg">{value.name}</div>
              <div className="text-sm text-muted-foreground font-mono">
                {value.symbol}.{value.market}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onChange({ symbol: "", name: "", market: "SH" })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick access — recent stocks first, then fill with popular up to 8.
          Reflects the user's actual workflow instead of always showing the
          same hardcoded names. Deduped by symbol. */}
      <div>
        <div className="text-sm font-medium mb-2">快捷选择 / Quick Access</div>
        <div className="grid grid-cols-4 gap-2">
          {(() => {
            const seen = new Set<string>();
            const merged: StockTarget[] = [];
            for (const s of [...recentStocks, ...commonStocks]) {
              if (!s.symbol || seen.has(s.symbol)) continue;
              seen.add(s.symbol);
              merged.push(s);
              if (merged.length >= 8) break;
            }
            return merged.map((stock) => (
              <Button
                key={stock.symbol}
                variant={value?.symbol === stock.symbol ? "primary" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => handleStockSelect(stock)}
              >
                {stock.name}
              </Button>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PORTFOLIO MODE COMPONENT / 组合模式组件
// =============================================================================

interface PortfolioModeProps {
  value?: PortfolioTarget;
  onChange: (portfolio: PortfolioTarget) => void;
}

function PortfolioMode({ value, onChange }: PortfolioModeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [portfolioName, setPortfolioName] = useState(value?.name || "我的组合");
  const { results: apiResults, isSearching, error: searchError } = useStockSearch(searchQuery);

  // Popular stocks for quick access when not searching
  const popularStocks: StockTarget[] = useMemo(
    () => [
      { symbol: "600519", name: "贵州茅台", market: "SH" },
      { symbol: "000858", name: "五粮液", market: "SZ" },
      { symbol: "600036", name: "招商银行", market: "SH" },
      { symbol: "000001", name: "平安银行", market: "SZ" },
      { symbol: "601318", name: "中国平安", market: "SH" },
      { symbol: "300750", name: "宁德时代", market: "SZ" },
      { symbol: "002594", name: "比亚迪", market: "SZ" },
      { symbol: "600276", name: "恒瑞医药", market: "SH" },
      { symbol: "000333", name: "美的集团", market: "SZ" },
      { symbol: "600887", name: "伊利股份", market: "SH" },
    ],
    [],
  );

  const stocks = value?.stocks || [];

  const handleAddStock = useCallback(
    (stock: StockTarget) => {
      if (stocks.some((s) => s.symbol === stock.symbol)) return;

      const newStocks: PortfolioStock[] = [
        ...stocks,
        { symbol: stock.symbol, name: stock.name },
      ];
      onChange({ name: portfolioName, stocks: newStocks });
    },
    [stocks, portfolioName, onChange],
  );

  const handleRemoveStock = useCallback(
    (symbol: string) => {
      const newStocks = stocks.filter((s) => s.symbol !== symbol);
      onChange({ name: portfolioName, stocks: newStocks });
    },
    [stocks, portfolioName, onChange],
  );

  const handleNameChange = useCallback(
    (name: string) => {
      setPortfolioName(name);
      onChange({ name, stocks });
    },
    [stocks, onChange],
  );

  // Show API results when searching, popular stocks otherwise
  const displayStocks = searchQuery ? apiResults : popularStocks;

  return (
    <div className="space-y-4">
      {/* Portfolio name */}
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap">组合名称</Label>
        <Input
          value={portfolioName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="输入组合名称..."
          className="flex-1"
        />
      </div>

      {/* Current stocks */}
      <div className="space-y-2">
        <div className="text-sm font-medium">已选股票 ({stocks.length})</div>
        {stocks.length === 0 ? (
          <div className="p-4 border border-dashed rounded-md text-center text-muted-foreground text-sm">
            暂未添加股票，请从下方选择添加
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stocks.map((stock) => (
              <Badge
                key={stock.symbol}
                variant="secondary"
                className="pl-3 pr-1 py-1"
              >
                <span>{stock.name}</span>
                <span className="text-muted-foreground ml-1 font-mono text-xs">
                  {stock.symbol}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 ml-1 p-0"
                  onClick={() => handleRemoveStock(stock.symbol)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Add stocks */}
      <div className="space-y-2">
        <div className="text-sm font-medium">添加股票</div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索股票代码或名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {searchQuery && !isSearching && displayStocks.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            {searchError || "未找到匹配的股票"}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto">
            {displayStocks.map((stock) => {
              const isAdded = stocks.some((s) => s.symbol === stock.symbol);
              return (
                <Button
                  key={stock.symbol}
                  variant={isAdded ? "secondary" : "outline"}
                  size="sm"
                  className="text-xs"
                  disabled={isAdded}
                  onClick={() => handleAddStock(stock)}
                >
                  {isAdded ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  {stock.name}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function TargetSelector({
  value,
  onChange,
  className,
  disabled = false,
}: TargetSelectorProps) {
  const [mode, setMode] = useState<BacktestTargetMode>(value?.mode || "sector");

  const handleModeChange = useCallback(
    (newMode: string) => {
      const modeValue = newMode as BacktestTargetMode;
      setMode(modeValue);
      onChange({ mode: modeValue });
    },
    [onChange],
  );

  const handleSectorChange = useCallback(
    (sector: SectorTarget) => {
      onChange({ mode: "sector", sector });
    },
    [onChange],
  );

  const handleStockChange = useCallback(
    (stock: StockTarget) => {
      onChange({ mode: "stock", stock });
    },
    [onChange],
  );

  const handlePortfolioChange = useCallback(
    (portfolio: PortfolioTarget) => {
      onChange({ mode: "portfolio", portfolio });
    },
    [onChange],
  );

  return (
    <div className={cn("space-y-4", className)}>
      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sector" disabled={disabled}>
            <Building2 className="h-4 w-4 mr-2" />
            板块
          </TabsTrigger>
          <TabsTrigger value="stock" disabled={disabled}>
            <LineChart className="h-4 w-4 mr-2" />
            个股
          </TabsTrigger>
          <TabsTrigger value="portfolio" disabled={disabled}>
            <Briefcase className="h-4 w-4 mr-2" />
            组合
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sector" className="mt-4">
          <SectorMode value={value?.sector} onChange={handleSectorChange} />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <StockMode value={value?.stock} onChange={handleStockChange} />
        </TabsContent>

        <TabsContent value="portfolio" className="mt-4">
          <PortfolioMode
            value={value?.portfolio}
            onChange={handlePortfolioChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TargetSelector;
