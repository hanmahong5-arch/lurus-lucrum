"use client";

/**
 * Stock Ranking Component (Optimized)
 * 股票排行榜组件（优化版）
 *
 * Features:
 * - Virtual scrolling for large datasets (50+ rows)
 * - React.memo optimized sub-components
 * - Full ARIA accessibility support
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Responsive mobile card view
 * - Loading skeleton and error states
 * - CSV export with BOM for Excel compatibility
 * - Sharpe ratio display per stock
 * - Return range visualization bar
 * - Click-to-filter signal details
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const VIRTUALIZATION_THRESHOLD = 50;
const ROW_HEIGHT = 48;
const OVERSCAN = 5;
const MOBILE_BREAKPOINT = 768;

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface StockRankingItem {
  rank: number;
  symbol: string;
  stockName: string;
  signalCount: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  maxReturn: number;
  minReturn: number;
  sharpeRatio?: number; // Risk-adjusted return metric / 风险调整后收益指标
}

interface StockRankingProps {
  data: StockRankingItem[];
  className?: string;
  strategyName?: string; // For CSV filename / 用于CSV文件名
  sectorName?: string; // For CSV filename / 用于CSV文件名
  onStockClick?: (symbol: string | null) => void; // Callback when clicking a row / 点击行时的回调
  selectedStock?: string | null; // Currently selected stock / 当前选中的股票
  isLoading?: boolean; // Loading state / 加载状态
  error?: string; // Error message / 错误信息
}

type SortField =
  | "rank"
  | "signalCount"
  | "winRate"
  | "avgReturn"
  | "totalReturn"
  | "sharpeRatio";
type SortDirection = "asc" | "desc";

interface ReturnRangeBarProps {
  min: number;
  max: number;
  globalMin: number;
  globalMax: number;
}

interface StockTableRowProps {
  stock: StockRankingItem;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  isTopThree: boolean;
  returnRange: { min: number; max: number };
  onRowClick?: (symbol: string) => void;
  hasClickHandler: boolean;
}

// =============================================================================
// MEMOIZED SUB-COMPONENTS / 记忆化子组件
// =============================================================================

/**
 * Rank Badge - displays medal emoji for top 3, number for others
 * 排名徽章 - 前三名显示奖牌emoji，其余显示数字
 */
const RankBadge = React.memo(({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <span className="text-lg" role="img" aria-label="第一名">
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="text-lg" role="img" aria-label="第二名">
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="text-lg" role="img" aria-label="第三名">
        🥉
      </span>
    );
  }
  return (
    <span className="text-white/40" aria-label={`第${rank}名`}>
      {rank}
    </span>
  );
});
RankBadge.displayName = "RankBadge";

/**
 * Win Rate Badge - color-coded by performance threshold
 * 胜率徽章 - 按表现阈值着色
 */
const WinRateBadge = React.memo(({ winRate }: { winRate: number }) => {
  let bgColor: string;
  let textColor: string;

  if (winRate >= 70) {
    bgColor = "bg-profit/20";
    textColor = "text-profit";
  } else if (winRate >= 50) {
    bgColor = "bg-accent/20";
    textColor = "text-accent";
  } else if (winRate >= 30) {
    bgColor = "bg-yellow-500/20";
    textColor = "text-yellow-500";
  } else {
    bgColor = "bg-loss/20";
    textColor = "text-loss";
  }

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-xs font-medium font-mono tabular-nums",
        bgColor,
        textColor
      )}
    >
      {winRate.toFixed(0)}%
    </span>
  );
});
WinRateBadge.displayName = "WinRateBadge";

/**
 * Return Range Visualization Bar
 * 收益范围可视化条
 *
 * Displays a mini bar showing the return range from min to max
 * Red for negative, green for positive returns
 */
const ReturnRangeBar = React.memo(
  ({ min, max, globalMin, globalMax }: ReturnRangeBarProps) => {
    // Calculate positions as percentages within the global range
    const range = globalMax - globalMin;
    if (range === 0) {
      return <div className="h-2 w-full bg-white/10 rounded" />;
    }

    // Calculate the center point (0%) position
    const centerPct = ((0 - globalMin) / range) * 100;

    // Calculate min and max positions
    const minPct = ((min - globalMin) / range) * 100;
    const maxPct = ((max - globalMin) / range) * 100;

    // Determine colors based on whether range is mostly positive or negative
    const avgReturn = (min + max) / 2;

    return (
      <div
        className="relative h-3 w-full bg-white/5 rounded overflow-hidden"
        title={`${min.toFixed(1)}% ~ ${max.toFixed(1)}%`}
        aria-label={`收益范围 ${min.toFixed(1)}% 到 ${max.toFixed(1)}%`}
      >
        {/* Center line (0% mark) */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/20"
          style={{ left: `${centerPct}%` }}
        />
        {/* Return range bar */}
        <div
          className={cn(
            "absolute top-0.5 bottom-0.5 rounded-sm",
            avgReturn >= 0 ? "bg-profit/70" : "bg-loss/70"
          )}
          style={{
            left: `${Math.min(minPct, maxPct)}%`,
            width: `${Math.abs(maxPct - minPct)}%`,
            minWidth: "2px",
          }}
        />
        {/* Min/Max markers */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-0.5",
            min < 0 ? "bg-loss" : "bg-profit"
          )}
          style={{ left: `${minPct}%` }}
        />
        <div
          className={cn(
            "absolute top-0 bottom-0 w-0.5",
            max < 0 ? "bg-loss" : "bg-profit"
          )}
          style={{ left: `${maxPct}%` }}
        />
      </div>
    );
  }
);
ReturnRangeBar.displayName = "ReturnRangeBar";

/**
 * Stock Table Row - memoized for performance
 * 股票表格行 - 记忆化以提高性能
 */
const StockTableRow = React.memo(
  ({
    stock,
    index,
    isSelected,
    isFocused,
    isTopThree,
    returnRange,
    onRowClick,
    hasClickHandler,
  }: StockTableRowProps) => {
    const handleClick = useCallback(() => {
      onRowClick?.(stock.symbol);
    }, [onRowClick, stock.symbol]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick?.(stock.symbol);
        }
      },
      [onRowClick, stock.symbol]
    );

    return (
      <tr
        role="row"
        aria-selected={isSelected}
        aria-label={`${stock.stockName}: 排名 ${index + 1}, 胜率 ${stock.winRate.toFixed(0)}%, 平均收益 ${stock.avgReturn.toFixed(2)}%`}
        tabIndex={hasClickHandler ? 0 : -1}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "border-b border-border/50 transition outline-none",
          hasClickHandler && "cursor-pointer",
          isFocused && "ring-2 ring-accent ring-inset",
          isSelected
            ? "bg-accent/20 hover:bg-accent/25"
            : isTopThree
              ? "bg-accent/5 hover:bg-white/5"
              : "hover:bg-white/5"
        )}
      >
        <td className="py-2 px-2">
          <RankBadge rank={index + 1} />
        </td>
        <td className="py-2 px-2">
          <div className="text-white font-medium">{stock.stockName}</div>
          <div className="text-xs text-white/40">{stock.symbol}</div>
        </td>
        <td className="py-2 px-2 text-center text-white/70 font-mono tabular-nums">
          {stock.signalCount}
        </td>
        <td className="py-2 px-2 text-center">
          <WinRateBadge winRate={stock.winRate} />
        </td>
        <td
          className={cn(
            "py-2 px-2 text-right font-medium font-mono tabular-nums",
            stock.avgReturn >= 0 ? "text-profit" : "text-loss"
          )}
        >
          {stock.avgReturn >= 0 ? "+" : ""}
          {stock.avgReturn.toFixed(2)}%
        </td>
        <td
          className={cn(
            "py-2 px-2 text-right font-mono tabular-nums",
            stock.totalReturn >= 0 ? "text-profit/70" : "text-loss/70"
          )}
        >
          {stock.totalReturn >= 0 ? "+" : ""}
          {stock.totalReturn.toFixed(2)}%
        </td>
        <td
          className={cn(
            "py-2 px-2 text-right font-mono tabular-nums",
            stock.sharpeRatio !== undefined
              ? stock.sharpeRatio >= 1
                ? "text-profit"
                : stock.sharpeRatio >= 0
                  ? "text-accent"
                  : "text-loss"
              : "text-white/30"
          )}
        >
          {stock.sharpeRatio !== undefined
            ? stock.sharpeRatio.toFixed(2)
            : "-"}
        </td>
        <td className="py-2 px-2">
          <ReturnRangeBar
            min={stock.minReturn}
            max={stock.maxReturn}
            globalMin={returnRange.min}
            globalMax={returnRange.max}
          />
        </td>
      </tr>
    );
  }
);
StockTableRow.displayName = "StockTableRow";

/**
 * Mobile Card View - responsive card layout for small screens
 * 移动端卡片视图 - 小屏幕响应式卡片布局
 */
const MobileCard = React.memo(
  ({
    stock,
    index,
    isSelected,
    isFocused,
    returnRange,
    onRowClick,
    hasClickHandler,
  }: Omit<StockTableRowProps, "isTopThree">) => {
    const handleClick = useCallback(() => {
      onRowClick?.(stock.symbol);
    }, [onRowClick, stock.symbol]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick?.(stock.symbol);
        }
      },
      [onRowClick, stock.symbol]
    );

    return (
      <div
        role="listitem"
        aria-selected={isSelected}
        aria-label={`${stock.stockName}: 排名 ${index + 1}, 胜率 ${stock.winRate.toFixed(0)}%`}
        tabIndex={hasClickHandler ? 0 : -1}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "p-3 rounded-lg border transition outline-none",
          hasClickHandler && "cursor-pointer",
          isFocused && "ring-2 ring-accent",
          isSelected
            ? "bg-accent/20 border-accent/30"
            : "bg-white/5 border-border/50 hover:bg-white/10"
        )}
      >
        {/* Header: Rank + Name */}
        <div className="flex items-center gap-2 mb-2">
          <RankBadge rank={index + 1} />
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium truncate">
              {stock.stockName}
            </div>
            <div className="text-xs text-white/40">{stock.symbol}</div>
          </div>
          <WinRateBadge winRate={stock.winRate} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-white/40">信号数</div>
            <div className="font-mono tabular-nums text-white/70">
              {stock.signalCount}
            </div>
          </div>
          <div>
            <div className="text-white/40">平均收益</div>
            <div
              className={cn(
                "font-mono tabular-nums font-medium",
                stock.avgReturn >= 0 ? "text-profit" : "text-loss"
              )}
            >
              {stock.avgReturn >= 0 ? "+" : ""}
              {stock.avgReturn.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-white/40">夏普比率</div>
            <div
              className={cn(
                "font-mono tabular-nums",
                stock.sharpeRatio !== undefined
                  ? stock.sharpeRatio >= 1
                    ? "text-profit"
                    : stock.sharpeRatio >= 0
                      ? "text-accent"
                      : "text-loss"
                  : "text-white/30"
              )}
            >
              {stock.sharpeRatio !== undefined
                ? stock.sharpeRatio.toFixed(2)
                : "-"}
            </div>
          </div>
        </div>

        {/* Return Range */}
        <div className="mt-2">
          <ReturnRangeBar
            min={stock.minReturn}
            max={stock.maxReturn}
            globalMin={returnRange.min}
            globalMax={returnRange.max}
          />
        </div>
      </div>
    );
  }
);
MobileCard.displayName = "MobileCard";

/**
 * Loading Skeleton - placeholder UI during data loading
 * 加载骨架屏 - 数据加载期间的占位UI
 */
const LoadingSkeleton = React.memo(({ count = 5 }: { count?: number }) => (
  <div className="space-y-2 p-4" role="status" aria-label="加载中">
    {[...Array(count)].map((_, i) => (
      <div
        key={i}
        className="h-12 bg-white/5 rounded animate-pulse"
        style={{ animationDelay: `${i * 100}ms` }}
      />
    ))}
    <span className="sr-only">正在加载股票排行榜数据...</span>
  </div>
));
LoadingSkeleton.displayName = "LoadingSkeleton";

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function StockRanking({
  data,
  className = "",
  strategyName = "",
  sectorName = "",
  onStockClick,
  selectedStock,
  isLoading = false,
  error,
}: StockRankingProps) {
  // State
  const [sortField, setSortField] = useState<SortField>("avgReturn");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAll, setShowAll] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isMobile, setIsMobile] = useState(false);

  // Virtual scroll state
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Container height measurement for virtual scroll
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate global min/max for return range visualization
  const returnRange = useMemo(() => {
    if (!data || data.length === 0) return { min: 0, max: 0 };
    const allMin = Math.min(...data.map((d) => d.minReturn));
    const allMax = Math.max(...data.map((d) => d.maxReturn));
    // Ensure symmetric range for better visualization
    const absMax = Math.max(Math.abs(allMin), Math.abs(allMax));
    return { min: -absMax, max: absMax };
  }, [data]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return [...data].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "rank":
          comparison = a.rank - b.rank;
          break;
        case "signalCount":
          comparison = a.signalCount - b.signalCount;
          break;
        case "winRate":
          comparison = a.winRate - b.winRate;
          break;
        case "avgReturn":
          comparison = a.avgReturn - b.avgReturn;
          break;
        case "totalReturn":
          comparison = a.totalReturn - b.totalReturn;
          break;
        case "sharpeRatio":
          comparison = (a.sharpeRatio ?? 0) - (b.sharpeRatio ?? 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortField, sortDirection]);

  // Display data (limited or all)
  const displayData = showAll ? sortedData : sortedData.slice(0, 10);

  // Virtual scrolling logic
  const useVirtualization =
    sortedData.length > VIRTUALIZATION_THRESHOLD && showAll && !isMobile;

  const virtualData = useMemo(() => {
    if (!useVirtualization) {
      return { items: displayData, startIndex: 0, totalHeight: 0 };
    }

    const totalHeight = sortedData.length * ROW_HEIGHT;
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN
    );
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const endIndex = Math.min(sortedData.length, startIndex + visibleCount);

    return {
      items: sortedData.slice(startIndex, endIndex),
      startIndex,
      totalHeight,
    };
  }, [
    useVirtualization,
    sortedData,
    scrollTop,
    containerHeight,
    displayData,
    showAll,
  ]);

  // Handle scroll for virtual list
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Handle sort click
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

  // Handle row click - toggle stock selection for signal filtering
  const handleRowClick = useCallback(
    (symbol: string) => {
      if (!onStockClick) return;
      // Toggle selection: if same stock clicked, deselect
      onStockClick(selectedStock === symbol ? null : symbol);
    },
    [onStockClick, selectedStock]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = displayData.length - 1;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev === -1 ? 0 : Math.min(maxIndex, prev + 1)
          );
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex <= maxIndex && displayData[focusedIndex]) {
            handleRowClick(displayData[focusedIndex].symbol);
          }
          break;
        case "Escape":
          e.preventDefault();
          setFocusedIndex(-1);
          onStockClick?.(null);
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(maxIndex);
          break;
      }
    },
    [displayData, focusedIndex, handleRowClick, onStockClick]
  );

  // Render sort indicator
  const renderSortIndicator = useCallback(
    (field: SortField) => {
      if (sortField !== field) return null;
      return (
        <span className="ml-1" aria-hidden="true">
          {sortDirection === "asc" ? "↑" : "↓"}
        </span>
      );
    },
    [sortField, sortDirection]
  );

  // Get ARIA sort value
  const getAriaSort = useCallback(
    (field: SortField): "ascending" | "descending" | "none" => {
      if (sortField !== field) return "none";
      return sortDirection === "asc" ? "ascending" : "descending";
    },
    [sortField, sortDirection]
  );

  // Export to CSV with BOM for Excel compatibility
  const handleExportCSV = useCallback(() => {
    const headers = [
      "排名",
      "股票代码",
      "股票名称",
      "信号数",
      "胜率(%)",
      "平均收益(%)",
      "总收益(%)",
      "最大收益(%)",
      "最小收益(%)",
      "夏普比率",
    ];

    const rows = sortedData.map((stock, index) => [
      (index + 1).toString(),
      stock.symbol,
      stock.stockName,
      stock.signalCount.toString(),
      stock.winRate.toFixed(1),
      stock.avgReturn.toFixed(2),
      stock.totalReturn.toFixed(2),
      stock.maxReturn.toFixed(2),
      stock.minReturn.toFixed(2),
      stock.sharpeRatio !== undefined ? stock.sharpeRatio.toFixed(2) : "N/A",
    ]);

    const csvContent =
      "\uFEFF" + // BOM for Excel
      [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `股票排名-${strategyName || "策略"}-${sectorName || "板块"}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sortedData, strategyName, sectorName]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) {
      return { avgWinRate: 0, avgReturn: 0, profitableCount: 0 };
    }
    return {
      avgWinRate: data.reduce((sum, d) => sum + d.winRate, 0) / data.length,
      avgReturn: data.reduce((sum, d) => sum + d.avgReturn, 0) / data.length,
      profitableCount: data.filter((d) => d.avgReturn > 0).length,
    };
  }, [data]);

  // ==========================================================================
  // RENDER STATES
  // ==========================================================================

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-medium text-white">
              股票排行榜 / Stock Ranking
            </span>
          </div>
        </div>
        <LoadingSkeleton count={5} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-medium text-white">
              股票排行榜 / Stock Ranking
            </span>
          </div>
        </div>
        <div className="p-8 text-center" role="alert">
          <div className="text-loss text-lg mb-2">加载失败</div>
          <div className="text-white/50 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div
        className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-medium text-white">
              股票排行榜 / Stock Ranking
            </span>
          </div>
        </div>
        <div className="p-8 text-center text-white/40">
          <p>暂无数据 / No data available</p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <div
      className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <span className="text-sm font-medium text-white">
            股票排行榜 / Stock Ranking
          </span>
          {selectedStock && (
            <span className="px-2 py-0.5 text-xs bg-accent/20 text-accent rounded">
              已选: {selectedStock}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStockClick?.(null);
                }}
                className="ml-1 hover:text-white transition"
                aria-label="取消选择"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">共 {data.length} 只股票</span>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/70 hover:text-white transition"
            aria-label="导出CSV文件"
          >
            📥 导出CSV
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Mobile Card View */}
        {isMobile ? (
          <div
            role="list"
            aria-label="股票排行榜"
            className="space-y-2"
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {displayData.map((stock, index) => (
              <MobileCard
                key={stock.symbol}
                stock={stock}
                index={index}
                isSelected={selectedStock === stock.symbol}
                isFocused={focusedIndex === index}
                returnRange={returnRange}
                onRowClick={handleRowClick}
                hasClickHandler={!!onStockClick}
              />
            ))}
          </div>
        ) : (
          /* Desktop Table View */
          <div
            ref={containerRef}
            className={cn(
              "overflow-x-auto",
              useVirtualization && "max-h-[500px] overflow-y-auto"
            )}
            onScroll={useVirtualization ? handleScroll : undefined}
          >
            <table
              ref={tableRef}
              role="table"
              aria-label="股票排行榜"
              className="w-full text-sm"
              onKeyDown={handleKeyDown}
              tabIndex={0}
            >
              <thead>
                <tr role="row" className="text-white/50 text-xs border-b border-border">
                  <th
                    role="columnheader"
                    scope="col"
                    aria-sort={getAriaSort("rank")}
                    className="text-left py-2 px-2 cursor-pointer hover:text-white transition"
                    onClick={() => handleSort("rank")}
                    onKeyDown={(e) => e.key === "Enter" && handleSort("rank")}
                    tabIndex={0}
                  >
                    # {renderSortIndicator("rank")}
                  </th>
                  <th role="columnheader" scope="col" className="text-left py-2 px-2">
                    股票 / Stock
                  </th>
                  <th
                    role="columnheader"
                    scope="col"
                    aria-sort={getAriaSort("signalCount")}
                    className="text-center py-2 px-2 cursor-pointer hover:text-white transition"
                    onClick={() => handleSort("signalCount")}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSort("signalCount")
                    }
                    tabIndex={0}
                  >
                    信号 {renderSortIndicator("signalCount")}
                  </th>
                  <th
                    role="columnheader"
                    scope="col"
                    aria-sort={getAriaSort("winRate")}
                    className="text-center py-2 px-2 cursor-pointer hover:text-white transition"
                    onClick={() => handleSort("winRate")}
                    onKeyDown={(e) => e.key === "Enter" && handleSort("winRate")}
                    tabIndex={0}
                  >
                    胜率 {renderSortIndicator("winRate")}
                  </th>
                  <th
                    role="columnheader"
                    scope="col"
                    aria-sort={getAriaSort("avgReturn")}
                    className="text-right py-2 px-2 cursor-pointer hover:text-white transition"
                    onClick={() => handleSort("avgReturn")}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSort("avgReturn")
                    }
                    tabIndex={0}
                  >
                    平均收益 {renderSortIndicator("avgReturn")}
                  </th>
                  <th
                    role="columnheader"
                    scope="col"
                    aria-sort={getAriaSort("totalReturn")}
                    className="text-right py-2 px-2 cursor-pointer hover:text-white transition"
                    onClick={() => handleSort("totalReturn")}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSort("totalReturn")
                    }
                    tabIndex={0}
                  >
                    累计收益 {renderSortIndicator("totalReturn")}
                  </th>
                  <th
                    role="columnheader"
                    scope="col"
                    aria-sort={getAriaSort("sharpeRatio")}
                    className="text-right py-2 px-2 cursor-pointer hover:text-white transition"
                    onClick={() => handleSort("sharpeRatio")}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSort("sharpeRatio")
                    }
                    tabIndex={0}
                  >
                    夏普 {renderSortIndicator("sharpeRatio")}
                  </th>
                  <th role="columnheader" scope="col" className="text-center py-2 px-2 w-28">
                    收益范围
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Virtual scroll spacer (top) */}
                {useVirtualization && virtualData.startIndex > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={8}
                      style={{ height: virtualData.startIndex * ROW_HEIGHT }}
                    />
                  </tr>
                )}

                {/* Render items */}
                {(useVirtualization ? virtualData.items : displayData).map(
                  (stock, idx) => {
                    const actualIndex = useVirtualization
                      ? virtualData.startIndex + idx
                      : idx;
                    return (
                      <StockTableRow
                        key={stock.symbol}
                        stock={stock}
                        index={actualIndex}
                        isSelected={selectedStock === stock.symbol}
                        isFocused={focusedIndex === actualIndex}
                        isTopThree={actualIndex < 3}
                        returnRange={returnRange}
                        onRowClick={handleRowClick}
                        hasClickHandler={!!onStockClick}
                      />
                    );
                  }
                )}

                {/* Virtual scroll spacer (bottom) */}
                {useVirtualization && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={8}
                      style={{
                        height: Math.max(
                          0,
                          virtualData.totalHeight -
                            (virtualData.startIndex + virtualData.items.length) *
                              ROW_HEIGHT
                        ),
                      }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Show more/less */}
        {data.length > 10 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="px-4 py-2 text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition"
              aria-expanded={showAll}
              aria-controls="stock-ranking-table"
            >
              {showAll
                ? "收起 / Collapse"
                : `显示全部 ${data.length} 只 / Show All`}
            </button>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-xs text-white/40">平均胜率</div>
            <div className="text-sm font-medium text-white">
              {summaryStats.avgWinRate.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">平均收益</div>
            <div
              className={cn(
                "text-sm font-medium",
                summaryStats.avgReturn >= 0 ? "text-profit" : "text-loss"
              )}
            >
              {summaryStats.avgReturn.toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">盈利股票</div>
            <div className="text-sm font-medium text-profit">
              {summaryStats.profitableCount}/{data.length}
            </div>
          </div>
        </div>

        {/* Screen reader announcement for virtual scrolling */}
        {useVirtualization && (
          <div className="sr-only" role="status" aria-live="polite">
            正在显示第 {virtualData.startIndex + 1} 到{" "}
            {virtualData.startIndex + virtualData.items.length} 条，共{" "}
            {sortedData.length} 条
          </div>
        )}
      </div>
    </div>
  );
}

export default StockRanking;
