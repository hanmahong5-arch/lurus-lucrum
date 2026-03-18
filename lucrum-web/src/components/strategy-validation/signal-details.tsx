"use client";

/**
 * Signal Details Table Component
 * 信号明细表组件
 *
 * Displays detailed list of all signals with export functionality
 * 展示所有信号的详细列表，支持导出功能
 *
 * Features:
 * - Virtual scrolling for large datasets (>100 items)
 * - Status filtering and search
 * - CSV export
 * - Enhanced signal status display
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/**
 * Threshold for enabling virtual scrolling
 * 启用虚拟滚动的阈值
 */
const VIRTUALIZATION_THRESHOLD = 100;

/**
 * Row height for virtual scrolling
 * 虚拟滚动行高
 */
const ROW_HEIGHT = 52;

/**
 * Number of rows to render outside viewport
 * 视口外渲染的行数缓冲
 */
const OVERSCAN = 5;

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Enhanced signal status type
 * 增强的信号状态类型
 */
export type SignalStatusType =
  | "win"
  | "loss"
  | "holding"
  | "suspended"
  | "cannot_execute"
  | "abnormal_data";

export interface SignalDetailItem {
  id: string;
  date: string;
  symbol: string;
  stockName: string;
  signal: string;
  buyPrice: number;
  sellPrice: number;
  returnPercent: number;
  holdingDays: number;
  status: SignalStatusType;
  // Enhanced fields / 增强字段
  statusReason?: string; // Reason for status / 状态原因
  isLimitUp?: boolean; // Entry limit up / 入场涨停
  isLimitDown?: boolean; // Entry limit down / 入场跌停
  isSuspended?: boolean; // Entry suspended / 入场停牌
  actualHoldingDays?: number; // Actual holding days / 实际持有天数
  netReturnPercent?: number; // Net return after costs / 扣费后净收益
}

interface SignalDetailsProps {
  data: SignalDetailItem[];
  strategyName?: string;
  sectorName?: string;
  className?: string;
  showEnhancedStatus?: boolean; // Show enhanced status details / 显示增强状态详情
}

type FilterStatus =
  | "all"
  | "win"
  | "loss"
  | "holding"
  | "suspended"
  | "cannot_execute";

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function SignalDetails({
  data,
  strategyName = "",
  sectorName = "",
  className = "",
  showEnhancedStatus = false,
}: SignalDetailsProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);
  const pageSize = 20;

  // Determine if virtual scrolling should be enabled
  const useVirtualization = data.length > VIRTUALIZATION_THRESHOLD;

  // Update container height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(
          Math.min(600, Math.max(400, window.innerHeight * 0.4)),
        );
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Filter and search data
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.filter((item) => {
      // Status filter with enhanced status support
      if (filterStatus !== "all") {
        const statusMatch =
          filterStatus === "win"
            ? item.status === "win"
            : filterStatus === "loss"
              ? item.status === "loss"
              : filterStatus === "holding"
                ? item.status === "holding"
                : filterStatus === "suspended"
                  ? item.status === "suspended"
                  : filterStatus === "cannot_execute"
                    ? item.status === "cannot_execute" ||
                      item.status === "abnormal_data"
                    : true;
        if (!statusMatch) return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.symbol.toLowerCase().includes(term) ||
          item.stockName.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [data, filterStatus, searchTerm]);

  // Pagination (only used when not virtualizing)
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useVirtualization
    ? filteredData
    : filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Virtual scrolling calculations
  const virtualData = useMemo(() => {
    if (!useVirtualization)
      return { items: paginatedData, startIndex: 0, totalHeight: 0 };

    const totalHeight = filteredData.length * ROW_HEIGHT;
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN,
    );
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const endIndex = Math.min(filteredData.length, startIndex + visibleCount);
    const items = filteredData.slice(startIndex, endIndex);

    return { items, startIndex, totalHeight };
  }, [
    useVirtualization,
    filteredData,
    scrollTop,
    containerHeight,
    paginatedData,
  ]);

  // Handle scroll for virtual list
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Stats with enhanced status
  const stats = useMemo(() => {
    const wins = filteredData.filter((d) => d.status === "win").length;
    const losses = filteredData.filter((d) => d.status === "loss").length;
    const holding = filteredData.filter((d) => d.status === "holding").length;
    const suspended = filteredData.filter(
      (d) => d.status === "suspended",
    ).length;
    const cannotExecute = filteredData.filter(
      (d) => d.status === "cannot_execute" || d.status === "abnormal_data",
    ).length;
    const completedSignals = filteredData.filter(
      (d) => d.status === "win" || d.status === "loss",
    );
    const avgReturn =
      completedSignals.length > 0
        ? completedSignals.reduce((sum, d) => sum + d.returnPercent, 0) /
          completedSignals.length
        : 0;

    return {
      wins,
      losses,
      holding,
      suspended,
      cannotExecute,
      total: filteredData.length,
      avgReturn,
    };
  }, [filteredData]);

  /**
   * Export to CSV
   * 导出为CSV
   */
  const handleExportCSV = useCallback(() => {
    const headers = [
      "日期",
      "股票代码",
      "股票名称",
      "信号",
      "买入价",
      "卖出价",
      "收益率(%)",
      "持有天数",
      "状态",
    ];

    const rows = filteredData.map((item) => [
      item.date,
      item.symbol,
      item.stockName,
      item.signal,
      item.buyPrice.toFixed(2),
      item.sellPrice.toFixed(2),
      item.returnPercent.toFixed(2),
      item.holdingDays.toString(),
      getStatusLabel(item.status),
    ]);

    const csvContent =
      "\uFEFF" + // BOM for Excel
      [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-details-${strategyName}-${sectorName}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredData, strategyName, sectorName]);

  if (!data || data.length === 0) {
    return (
      <div
        className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="text-sm font-medium text-white">
              信号明细 / Signal Details
            </span>
          </div>
        </div>
        <div className="p-8 text-center text-white/40">
          <p>暂无数据 / No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="text-sm font-medium text-white">
            信号明细 / Signal Details
          </span>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/70 hover:text-white transition"
        >
          📥 导出CSV
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Filter - Enhanced with more status types */}
          <div className="flex flex-wrap bg-primary/30 rounded-lg p-0.5 gap-0.5">
            {(
              [
                "all",
                "win",
                "loss",
                "holding",
                "suspended",
                "cannot_execute",
              ] as FilterStatus[]
            ).map((status) => {
              const count =
                status === "all"
                  ? data.length
                  : status === "cannot_execute"
                    ? data.filter(
                        (d) =>
                          d.status === "cannot_execute" ||
                          d.status === "abnormal_data",
                      ).length
                    : data.filter((d) => d.status === status).length;

              // Skip showing filter if count is 0 (except for "all")
              if (count === 0 && status !== "all") return null;

              return (
                <button
                  key={status}
                  onClick={() => {
                    setFilterStatus(status);
                    setCurrentPage(1);
                    setScrollTop(0);
                  }}
                  className={cn(
                    "px-2 py-1 text-xs rounded transition whitespace-nowrap",
                    filterStatus === status
                      ? status === "win"
                        ? "bg-profit text-white"
                        : status === "loss"
                          ? "bg-loss text-white"
                          : status === "holding"
                            ? "bg-accent text-primary-600"
                            : status === "suspended"
                              ? "bg-yellow-500 text-white"
                              : status === "cannot_execute"
                                ? "bg-gray-500 text-white"
                                : "bg-white/20 text-white"
                      : "text-white/50 hover:text-white",
                  )}
                >
                  {status === "all" && `全部 (${count})`}
                  {status === "win" && `盈利 (${count})`}
                  {status === "loss" && `亏损 (${count})`}
                  {status === "holding" && `持有 (${count})`}
                  {status === "suspended" && `停牌 (${count})`}
                  {status === "cannot_execute" && `无法执行 (${count})`}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="搜索股票代码或名称..."
              className="w-full px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* Stats Summary - Enhanced */}
        <div className="grid grid-cols-5 gap-2 p-3 bg-primary/20 rounded-lg">
          <div className="text-center">
            <div className="text-xs text-white/40">筛选结果</div>
            <div className="text-sm font-medium text-white">
              {stats.total}条
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">盈利</div>
            <div className="text-sm font-medium text-profit">
              {stats.wins}条
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">亏损</div>
            <div className="text-sm font-medium text-loss">
              {stats.losses}条
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">平均收益</div>
            <div
              className={cn(
                "text-sm font-medium",
                stats.avgReturn >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {stats.avgReturn >= 0 ? "+" : ""}
              {stats.avgReturn.toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">
              {stats.holding > 0
                ? "持有中"
                : stats.suspended > 0
                  ? "停牌"
                  : "其他"}
            </div>
            <div className="text-sm font-medium text-accent">
              {stats.holding + stats.suspended + stats.cannotExecute}条
            </div>
          </div>
        </div>

        {/* Virtual scrolling indicator */}
        {useVirtualization && (
          <div className="text-xs text-white/40 text-center">
            虚拟滚动已启用 ({filteredData.length} 条数据)
          </div>
        )}

        {/* Table - with virtual scrolling support */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 text-xs border-b border-border">
                <th className="text-left py-2 px-2">日期</th>
                <th className="text-left py-2 px-2">股票</th>
                <th className="text-left py-2 px-2">信号</th>
                <th className="text-right py-2 px-2">买入价</th>
                <th className="text-right py-2 px-2">卖出价</th>
                <th className="text-right py-2 px-2">收益</th>
                <th className="text-center py-2 px-2">持有</th>
                <th className="text-center py-2 px-2">状态</th>
              </tr>
            </thead>
          </table>

          {/* Virtual scrolling container */}
          {useVirtualization ? (
            <div
              ref={containerRef}
              className="overflow-y-auto"
              style={{ height: containerHeight }}
              onScroll={handleScroll}
            >
              <div
                style={{
                  height: virtualData.totalHeight,
                  position: "relative",
                }}
              >
                <table
                  className="w-full text-sm"
                  style={{
                    position: "absolute",
                    top: virtualData.startIndex * ROW_HEIGHT,
                  }}
                >
                  <tbody>
                    {virtualData.items.map((item, idx) => (
                      <SignalRow
                        key={item.id}
                        item={item}
                        showEnhancedStatus={showEnhancedStatus}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {paginatedData.map((item) => (
                  <SignalRow
                    key={item.id}
                    item={item}
                    showEnhancedStatus={showEnhancedStatus}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination - only show when not using virtual scrolling */}
        {!useVirtualization && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-xs text-white/40">
              第 {currentPage} / {totalPages} 页，共 {filteredData.length} 条
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded text-white/70 hover:text-white transition"
              >
                上一页
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 text-xs rounded transition",
                        currentPage === pageNum
                          ? "bg-accent text-primary-600"
                          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded text-white/70 hover:text-white transition"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Get status label for display and CSV export
 * 获取状态标签用于显示和CSV导出
 */
function getStatusLabel(status: SignalStatusType): string {
  const labels: Record<SignalStatusType, string> = {
    win: "盈利",
    loss: "亏损",
    holding: "持有中",
    suspended: "停牌",
    cannot_execute: "无法执行",
    abnormal_data: "数据异常",
  };
  return labels[status] || status;
}

// =============================================================================
// SUB-COMPONENTS / 子组件
// =============================================================================

/**
 * Signal row component - extracted for reuse in virtual and regular rendering
 * 信号行组件 - 提取为可复用组件用于虚拟和常规渲染
 */
function SignalRow({
  item,
  showEnhancedStatus,
}: {
  item: SignalDetailItem;
  showEnhancedStatus: boolean;
}) {
  const isCompleted = item.status === "win" || item.status === "loss";
  const isSpecialStatus =
    item.status === "suspended" ||
    item.status === "cannot_execute" ||
    item.status === "abnormal_data";

  return (
    <tr
      className="border-b border-border/50 hover:bg-white/5 transition"
      style={{ height: ROW_HEIGHT }}
    >
      <td className="py-2 px-2 text-white/70">{item.date}</td>
      <td className="py-2 px-2">
        <div className="text-white">{item.stockName}</div>
        <div className="text-xs text-white/40">{item.symbol}</div>
      </td>
      <td className="py-2 px-2 text-accent">
        {item.signal}
        {/* Show limit up/down indicator */}
        {item.isLimitUp && <span className="ml-1 text-xs text-loss">涨停</span>}
        {item.isLimitDown && (
          <span className="ml-1 text-xs text-profit">跌停</span>
        )}
      </td>
      <td className="py-2 px-2 text-right text-white/70">
        ¥{item.buyPrice.toFixed(2)}
      </td>
      <td className="py-2 px-2 text-right text-white/70">
        {isCompleted ? `¥${item.sellPrice.toFixed(2)}` : "-"}
      </td>
      <td
        className={cn(
          "py-2 px-2 text-right font-medium",
          isCompleted
            ? item.returnPercent >= 0
              ? "text-profit"
              : "text-loss"
            : "text-white/40",
        )}
      >
        {isCompleted
          ? `${item.returnPercent >= 0 ? "+" : ""}${item.returnPercent.toFixed(2)}%`
          : "-"}
        {/* Show net return if different from gross */}
        {showEnhancedStatus &&
          item.netReturnPercent !== undefined &&
          item.netReturnPercent !== item.returnPercent && (
            <div className="text-xs text-white/40">
              净: {item.netReturnPercent >= 0 ? "+" : ""}
              {item.netReturnPercent.toFixed(2)}%
            </div>
          )}
      </td>
      <td className="py-2 px-2 text-center text-white/50">
        {item.actualHoldingDays ?? item.holdingDays}天
        {/* Show original holding days if different */}
        {item.actualHoldingDays &&
          item.actualHoldingDays !== item.holdingDays && (
            <span className="text-xs text-white/30"> ({item.holdingDays})</span>
          )}
      </td>
      <td className="py-2 px-2 text-center">
        <StatusBadge
          status={item.status}
          reason={showEnhancedStatus ? item.statusReason : undefined}
        />
      </td>
    </tr>
  );
}

/**
 * Status badge component - enhanced with more status types
 * 状态徽章组件 - 增强支持更多状态类型
 */
function StatusBadge({
  status,
  reason,
}: {
  status: SignalStatusType;
  reason?: string;
}) {
  const config: Record<
    SignalStatusType,
    { bg: string; text: string; label: string; icon: string }
  > = {
    win: {
      bg: "bg-profit/20",
      text: "text-profit",
      label: "盈利",
      icon: "✓",
    },
    loss: {
      bg: "bg-loss/20",
      text: "text-loss",
      label: "亏损",
      icon: "✗",
    },
    holding: {
      bg: "bg-accent/20",
      text: "text-accent",
      label: "持有",
      icon: "○",
    },
    suspended: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      label: "停牌",
      icon: "⏸",
    },
    cannot_execute: {
      bg: "bg-gray-500/20",
      text: "text-gray-400",
      label: "无法执行",
      icon: "⊘",
    },
    abnormal_data: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
      label: "数据异常",
      icon: "⚠",
    },
  };

  const { bg, text, label, icon } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
        bg,
        text,
      )}
      title={reason}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}

export default SignalDetails;
