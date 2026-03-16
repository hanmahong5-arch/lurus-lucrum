"use client";

/**
 * Trading Dashboard Page with K-line Chart and Real-time Data
 * 交易面板页面，包含K线图表和实时数据
 *
 * Features:
 * - Real-time K-line chart with market data
 * - Five-tier orderbook display (Level 2)
 * - Technical indicator quick panel
 * - Mock trading with A-share rules
 * - Unified DashboardHeader with user status
 *
 * 功能：
 * - 实时K线图和市场数据
 * - 五档行情显示（二级市场数据）
 * - 技术指标快速面板
 * - 模拟交易（A股规则）
 * - 统一的仪表板头部，包含用户状态
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useMajorIndices, useNorthBoundFlow } from "@/hooks/use-market-data";
import { DataStatusPanel } from "@/components/dashboard/data-status-panel";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  SymbolSelector,
  type SymbolInfo,
} from "@/components/trading/symbol-selector";
import { OrderbookPanel } from "@/components/trading/orderbook-panel";
import { IndicatorQuickPanel } from "@/components/trading/indicator-quick-panel";
import {
  getTradingStatusInfo,
  formatTimeRemaining,
  getTimeToNextEvent,
  isMarketOpen,
} from "@/lib/trading/time-utils";

// Dynamically import chart to avoid SSR issues with canvas
// 动态导入图表以避免 SSR 与 canvas 的兼容问题
const KLineChart = dynamic(
  () => import("@/components/charts/kline-chart").then((mod) => mod.KLineChart),
  {
    ssr: false,
    loading: () => (
      <div className="bg-surface rounded-xl border border-border h-[500px] flex items-center justify-center">
        <div className="text-white/50">加载图表中...</div>
      </div>
    ),
  },
);

// =============================================================================
// TYPES / 类型定义
// =============================================================================

// Position type definition
interface Position {
  symbol: string;
  name: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

// Order type definition
interface Order {
  id: string;
  symbol: string;
  name: string;
  side: "buy" | "sell";
  type: "limit" | "market" | "stop-loss";
  price: number;
  size: number;
  filled: number;
  status: "open" | "filled" | "cancelled";
  time: string;
}

// =============================================================================
// MOCK DATA / 模拟数据
// =============================================================================

// Initial mock position data for A-shares
const INITIAL_POSITIONS: Position[] = [
  {
    symbol: "600519",
    name: "贵州茅台",
    side: "long",
    size: 100,
    entryPrice: 1720.0,
    currentPrice: 1750.0,
    pnl: 3000.0,
    pnlPercent: 1.74,
  },
  {
    symbol: "000333",
    name: "美的集团",
    side: "long",
    size: 500,
    entryPrice: 55.0,
    currentPrice: 56.8,
    pnl: 900.0,
    pnlPercent: 3.27,
  },
];

// Initial mock order data
const INITIAL_ORDERS: Order[] = [
  {
    id: "ORD001",
    symbol: "601318",
    name: "中国平安",
    side: "buy",
    type: "limit",
    price: 47.5,
    size: 200,
    filled: 0,
    status: "open",
    time: "2026-01-19 10:30:00",
  },
];

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Format large numbers to readable format (万/亿)
 */
function formatAmount(num: number): string {
  if (Math.abs(num) >= 100000000) return (num / 100000000).toFixed(2) + "亿";
  if (Math.abs(num) >= 10000) return (num / 10000).toFixed(2) + "万";
  return num.toFixed(2);
}

/**
 * Format price for display
 */
function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  return price.toFixed(4);
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export default function TradingPage() {
  // Selected symbol state
  const [selectedSymbol, setSelectedSymbol] = useState("600519");
  const [selectedSymbolInfo, setSelectedSymbolInfo] =
    useState<SymbolInfo | null>(null);

  // Trading status state (updates every second)
  const [tradingStatus, setTradingStatus] = useState(getTradingStatusInfo());
  const [timeToNext, setTimeToNext] = useState(getTimeToNextEvent());

  // Tab and order state
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "market">(
    "market",
  );
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [orderType, setOrderType] = useState<"limit" | "market" | "stop-loss">(
    "limit",
  );
  const [orderPrice, setOrderPrice] = useState("");
  const [orderSize, setOrderSize] = useState("");
  const [balance, setBalance] = useState(500000); // 50万模拟资金
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Fetch real-time market data
  const {
    data: indices,
    loading: indicesLoading,
    error: indicesError,
  } = useMajorIndices({
    refreshInterval: isMarketOpen() ? 10000 : 60000, // 交易时间10秒刷新，非交易时间60秒
  });

  const { data: northBound, loading: northBoundLoading } = useNorthBoundFlow({
    refreshInterval: 60000,
  });

  // Update trading status every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTradingStatus(getTradingStatusInfo());
      setTimeToNext(getTimeToNextEvent());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show notification helper
  const showNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 3000);
    },
    [],
  );

  // Calculate total PnL
  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPositionValue = positions.reduce(
    (sum, pos) => sum + pos.currentPrice * pos.size,
    0,
  );

  // Get current symbol price (from selected info or fallback)
  const currentSymbolPrice = selectedSymbolInfo?.price || 0;

  // Handle symbol change
  const handleSymbolChange = useCallback(
    (symbol: string, info?: SymbolInfo) => {
      setSelectedSymbol(symbol);
      if (info) {
        setSelectedSymbolInfo(info);
      }
    },
    [],
  );

  // Close position handler
  const handleClosePosition = useCallback(
    (symbol: string) => {
      const position = positions.find((p) => p.symbol === symbol);
      if (!position) return;

      setBalance((prev) => prev + position.currentPrice * position.size);
      setPositions((prev) => prev.filter((p) => p.symbol !== symbol));
      showNotification(
        "success",
        `已平仓 ${position.name}，盈亏: ${position.pnl >= 0 ? "+" : ""}¥${position.pnl.toFixed(2)}`,
      );
    },
    [positions, showNotification],
  );

  // Cancel order handler
  const handleCancelOrder = useCallback(
    (orderId: string) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      showNotification("success", `订单 ${orderId} 已撤销`);
    },
    [showNotification],
  );

  // Place order handler
  const handlePlaceOrder = useCallback(
    (side: "buy" | "sell") => {
      const price =
        orderType === "market" ? currentSymbolPrice : parseFloat(orderPrice);
      const size = parseFloat(orderSize);

      if (!size || size <= 0) {
        showNotification("error", "请输入有效的数量");
        return;
      }

      // A股一手=100股
      if (size % 100 !== 0) {
        showNotification("error", "A股交易数量必须为100的整数倍（一手=100股）");
        return;
      }

      if (orderType !== "market" && (!price || price <= 0)) {
        showNotification("error", "请输入有效的价格");
        return;
      }

      const orderValue = price * size;
      if (side === "buy" && orderValue > balance) {
        showNotification("error", "余额不足");
        return;
      }

      // Check trading status
      if (!tradingStatus.canTrade) {
        showNotification("error", `当前${tradingStatus.label}，无法下单`);
        return;
      }

      const symbolName = selectedSymbolInfo?.name || selectedSymbol;

      if (orderType === "market") {
        if (side === "buy") {
          setBalance((prev) => prev - orderValue);
          const newPosition: Position = {
            symbol: selectedSymbol,
            name: symbolName,
            side: "long",
            size,
            entryPrice: price,
            currentPrice: price,
            pnl: 0,
            pnlPercent: 0,
          };
          setPositions((prev) => [...prev, newPosition]);
          showNotification(
            "success",
            `市价买入 ${symbolName} ${size}股 @ ¥${price.toFixed(2)}`,
          );
        } else {
          const existingPosition = positions.find(
            (p) => p.symbol === selectedSymbol && p.side === "long",
          );
          if (existingPosition && existingPosition.size >= size) {
            const pnl = (price - existingPosition.entryPrice) * size;
            setBalance((prev) => prev + price * size);
            if (existingPosition.size === size) {
              setPositions((prev) =>
                prev.filter(
                  (p) => p.symbol !== selectedSymbol || p.side !== "long",
                ),
              );
            } else {
              setPositions((prev) =>
                prev.map((p) =>
                  p.symbol === selectedSymbol && p.side === "long"
                    ? { ...p, size: p.size - size }
                    : p,
                ),
              );
            }
            showNotification(
              "success",
              `市价卖出 ${symbolName} ${size}股，盈亏: ${pnl >= 0 ? "+" : ""}¥${pnl.toFixed(2)}`,
            );
          } else {
            showNotification("error", "持仓不足");
          }
        }
      } else {
        const newOrder: Order = {
          id: `ORD${Date.now().toString().slice(-6)}`,
          symbol: selectedSymbol,
          name: symbolName,
          side,
          type: orderType,
          price,
          size,
          filled: 0,
          status: "open",
          time: new Date().toLocaleString("zh-CN"),
        };
        setOrders((prev) => [...prev, newOrder]);
        showNotification(
          "success",
          `${orderType === "limit" ? "限价" : "止损"}${side === "buy" ? "买入" : "卖出"}订单已提交`,
        );
      }

      setOrderPrice("");
      setOrderSize("");
    },
    [
      orderType,
      orderPrice,
      orderSize,
      selectedSymbol,
      selectedSymbolInfo,
      currentSymbolPrice,
      balance,
      positions,
      tradingStatus,
      showNotification,
    ],
  );

  // Set size percentage (按手数计算)
  const handleSetSizePercentage = useCallback(
    (percentage: number) => {
      const price =
        orderType === "market"
          ? currentSymbolPrice
          : parseFloat(orderPrice) || currentSymbolPrice;
      if (price <= 0) return;

      const maxValue = balance * (percentage / 100);
      const maxShares = Math.floor(maxValue / price);
      const lots = Math.floor(maxShares / 100); // 一手=100股
      setOrderSize((lots * 100).toString());
    },
    [balance, currentSymbolPrice, orderPrice, orderType],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
            notification.type === "success" ? "bg-profit/90" : "bg-loss/90"
          } text-white`}
        >
          {notification.message}
        </div>
      )}

      {/* Unified Dashboard Header with user status / 统一的仪表板头部，包含用户状态 */}
      <DashboardHeader />

      {/* Main content */}
      <main className="max-w-[1920px] mx-auto px-3 sm:p-4">
        {/* Market Overview Bar */}
        <div className="mb-4 bg-surface rounded-xl border border-border p-3 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px] sm:min-w-0">
            {/* Indices */}
            <div className="flex items-center gap-3 sm:gap-6">
              {indicesLoading && !indices ? (
                <div className="text-white/50 text-sm">加载指数...</div>
              ) : indicesError ? (
                <div className="text-loss text-sm">指数加载失败</div>
              ) : indices && indices.length > 0 ? (
                indices.slice(0, 5).map((idx) => (
                  <div key={idx.symbol} className="flex items-center gap-2">
                    <span className="text-xs text-white/50">{idx.name}</span>
                    <span className="text-sm font-medium text-white">
                      {idx.price.toLocaleString()}
                    </span>
                    <span
                      className={`text-xs ${
                        idx.changePercent >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {idx.changePercent >= 0 ? "+" : ""}
                      {idx.changePercent.toFixed(2)}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-white/50 text-sm">暂无指数数据</div>
              )}
            </div>

            {/* North-bound Flow */}
            <div className="flex items-center gap-4">
              {northBound && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">北向资金</span>
                    <span
                      className={`text-sm font-medium ${
                        northBound.total >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {northBound.total >= 0 ? "+" : ""}
                      {formatAmount(northBound.total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">沪股通</span>
                    <span
                      className={`text-xs ${
                        northBound.shConnect >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {formatAmount(northBound.shConnect)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">深股通</span>
                    <span
                      className={`text-xs ${
                        northBound.szConnect >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {formatAmount(northBound.szConnect)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left sidebar - Symbol selector */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-xl border border-border p-3">
              <h3 className="text-sm font-medium text-white mb-3">
                选择股票 / Symbol
              </h3>
              <SymbolSelector
                value={selectedSymbol}
                onChange={handleSymbolChange}
                showQuote={true}
              />

              {/* Selected symbol info */}
              {selectedSymbolInfo && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      ¥{selectedSymbolInfo.price?.toFixed(2) || "-"}
                    </div>
                    <div
                      className={`text-sm ${
                        (selectedSymbolInfo.changePercent || 0) >= 0
                          ? "text-profit"
                          : "text-loss"
                      }`}
                    >
                      {(selectedSymbolInfo.changePercent || 0) >= 0 ? "+" : ""}
                      {selectedSymbolInfo.changePercent?.toFixed(2)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Quick access - recent/favorite stocks */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-white/50 mb-2">快捷访问</div>
                <div className="space-y-1">
                  {[
                    // Use unique identifiers matching symbol-selector.tsx
                    { symbol: "sh000001", name: "上证指数", type: "index" },
                    { symbol: "sz399001", name: "深证成指", type: "index" },
                    { symbol: "sz399006", name: "创业板指", type: "index" },
                  ].map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => handleSymbolChange(item.symbol)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                        selectedSymbol === item.symbol
                          ? "bg-accent/10 text-accent"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Center - Chart */}
          <div className="lg:col-span-7">
            <KLineChart
              symbol={selectedSymbol}
              height={500}
              showVolume={true}
              showMA={true}
              maWindows={[5, 20, 60]}
              onSymbolChange={handleSymbolChange}
            />
          </div>

          {/* Right sidebar - Order entry */}
          <div className="lg:col-span-3">
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium text-white mb-4">
                下单 / Place Order
              </h3>

              {/* Trading status warning */}
              {!tradingStatus.canTrade && (
                <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="text-xs text-yellow-400">
                    当前{tradingStatus.label}，订单将在下个交易时段处理
                  </div>
                </div>
              )}

              {/* Order type tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setOrderType("limit")}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                    orderType === "limit"
                      ? "bg-accent/10 text-accent"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  限价单
                </button>
                <button
                  onClick={() => setOrderType("market")}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                    orderType === "market"
                      ? "bg-accent/10 text-accent"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  市价单
                </button>
                <button
                  onClick={() => setOrderType("stop-loss")}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                    orderType === "stop-loss"
                      ? "bg-accent/10 text-accent"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  止损单
                </button>
              </div>

              {/* Price input */}
              <div className="mb-3">
                <label className="block text-xs text-white/50 mb-1">
                  价格 / Price {orderType === "market" && "(市价)"}
                </label>
                <input
                  type="number"
                  placeholder={
                    orderType === "market"
                      ? formatPrice(currentSymbolPrice)
                      : "0.00"
                  }
                  value={orderType === "market" ? "" : orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  disabled={orderType === "market"}
                  className={`w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent ${
                    orderType === "market"
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                />
              </div>

              {/* Size input */}
              <div className="mb-3">
                <label className="block text-xs text-white/50 mb-1">
                  数量 / Size（股，100的整数倍）
                </label>
                <input
                  type="number"
                  placeholder="100"
                  step="100"
                  min="100"
                  value={orderSize}
                  onChange={(e) => setOrderSize(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                />
              </div>

              {/* Size percentage buttons */}
              <div className="flex gap-2 mb-4">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleSetSizePercentage(pct)}
                    className="flex-1 py-1 text-xs text-white/50 hover:text-white border border-border rounded hover:border-accent/50 transition"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Order summary */}
              {orderSize && (orderType === "market" || orderPrice) && (
                <div className="mb-4 p-2 bg-background rounded-lg">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">预估金额</span>
                    <span className="text-white">
                      ¥
                      {(
                        parseFloat(orderSize) *
                        (orderType === "market"
                          ? currentSymbolPrice
                          : parseFloat(orderPrice) || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Buy/Sell buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handlePlaceOrder("buy")}
                  disabled={!tradingStatus.canTrade}
                  className={`flex-1 py-3 font-medium rounded-lg transition ${
                    tradingStatus.canTrade
                      ? "bg-profit hover:bg-profit/80 text-white"
                      : "bg-profit/30 text-white/50 cursor-not-allowed"
                  }`}
                >
                  买入 / Buy
                </button>
                <button
                  onClick={() => handlePlaceOrder("sell")}
                  disabled={!tradingStatus.canTrade}
                  className={`flex-1 py-3 font-medium rounded-lg transition ${
                    tradingStatus.canTrade
                      ? "bg-loss hover:bg-loss/80 text-white"
                      : "bg-loss/30 text-white/50 cursor-not-allowed"
                  }`}
                >
                  卖出 / Sell
                </button>
              </div>

              {/* Account summary */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/50">可用余额</span>
                  <span className="text-white">
                    ¥{balance.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/50">持仓市值</span>
                  <span className="text-white">
                    ¥{totalPositionValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">总盈亏</span>
                  <span className={totalPnL >= 0 ? "text-profit" : "text-loss"}>
                    {totalPnL >= 0 ? "+" : ""}¥{totalPnL.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom - Positions, Orders, and Market Data */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main table section */}
          <div className="lg:col-span-9">
            <div className="bg-surface rounded-xl border border-border">
              {/* Tabs - Fixed z-index and button type for proper click handling */}
              <div className="flex border-b border-border relative z-10">
                <button
                  type="button"
                  onClick={() => setActiveTab("market")}
                  className={`px-6 py-3 text-sm font-medium transition relative z-10 cursor-pointer ${
                    activeTab === "market"
                      ? "text-accent border-b-2 border-accent"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  实时行情 / Market
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("positions")}
                  className={`px-6 py-3 text-sm font-medium transition relative z-10 cursor-pointer ${
                    activeTab === "positions"
                      ? "text-accent border-b-2 border-accent"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  持仓 / Positions ({positions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className={`px-6 py-3 text-sm font-medium transition relative z-10 cursor-pointer ${
                    activeTab === "orders"
                      ? "text-accent border-b-2 border-accent"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  挂单 / Orders ({orders.length})
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {activeTab === "market" ? (
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-white/50 border-b border-border">
                        <th className="text-left px-4 py-3 font-medium">
                          指数名称
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          最新价
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          涨跌
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          涨跌幅
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          成交量
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          成交额
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {indices && indices.length > 0 ? (
                        indices.map((idx) => (
                          <tr
                            key={idx.symbol}
                            className="text-sm border-b border-border/50 hover:bg-white/5 cursor-pointer"
                            onClick={() => handleSymbolChange(idx.symbol)}
                          >
                            <td className="px-4 py-3 text-white font-medium">
                              {idx.name}
                            </td>
                            <td className="px-4 py-3 text-right text-white">
                              {idx.price.toLocaleString()}
                            </td>
                            <td
                              className={`px-4 py-3 text-right ${
                                idx.change >= 0 ? "text-profit" : "text-loss"
                              }`}
                            >
                              {idx.change >= 0 ? "+" : ""}
                              {idx.change.toFixed(2)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-medium ${
                                idx.changePercent >= 0
                                  ? "text-profit"
                                  : "text-loss"
                              }`}
                            >
                              {idx.changePercent >= 0 ? "+" : ""}
                              {idx.changePercent.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 text-right text-white/70">
                              {formatAmount(idx.volume)}
                            </td>
                            <td className="px-4 py-3 text-right text-white/70">
                              {formatAmount(idx.amount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-white/50"
                          >
                            {indicesLoading ? "加载中..." : "暂无数据"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : activeTab === "positions" ? (
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-white/50 border-b border-border">
                        <th className="text-left px-4 py-3 font-medium">
                          股票
                        </th>
                        <th className="text-left px-4 py-3 font-medium">
                          方向
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          数量
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          成本价
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          现价
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          市值
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          盈亏
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.length > 0 ? (
                        positions.map((pos, index) => (
                          <tr
                            key={index}
                            className="text-sm border-b border-border/50 hover:bg-white/5"
                          >
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">
                                {pos.name}
                              </div>
                              <div className="text-xs text-white/40">
                                {pos.symbol}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  pos.side === "long"
                                    ? "bg-profit/20 text-profit"
                                    : "bg-loss/20 text-loss"
                                }`}
                              >
                                {pos.side === "long" ? "多" : "空"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-white">
                              {pos.size}股
                            </td>
                            <td className="px-4 py-3 text-right text-white/70">
                              ¥{pos.entryPrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-white">
                              ¥{pos.currentPrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-white">
                              ¥{(pos.currentPrice * pos.size).toLocaleString()}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-medium ${
                                pos.pnl >= 0 ? "text-profit" : "text-loss"
                              }`}
                            >
                              {pos.pnl >= 0 ? "+" : ""}¥{pos.pnl.toFixed(2)}
                              <br />
                              <span className="text-xs">
                                ({pos.pnlPercent >= 0 ? "+" : ""}
                                {pos.pnlPercent.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleClosePosition(pos.symbol)}
                                disabled={!tradingStatus.canTrade}
                                className={`px-3 py-1 text-xs border rounded transition ${
                                  tradingStatus.canTrade
                                    ? "text-loss border-loss/30 hover:bg-loss/10"
                                    : "text-white/30 border-white/10 cursor-not-allowed"
                                }`}
                              >
                                平仓
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-8 text-center text-white/50"
                          >
                            暂无持仓
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-white/50 border-b border-border">
                        <th className="text-left px-4 py-3 font-medium">
                          订单号
                        </th>
                        <th className="text-left px-4 py-3 font-medium">
                          股票
                        </th>
                        <th className="text-left px-4 py-3 font-medium">
                          方向
                        </th>
                        <th className="text-left px-4 py-3 font-medium">
                          类型
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          价格
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          数量
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          时间
                        </th>
                        <th className="text-right px-4 py-3 font-medium">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length > 0 ? (
                        orders.map((order) => (
                          <tr
                            key={order.id}
                            className="text-sm border-b border-border/50 hover:bg-white/5"
                          >
                            <td className="px-4 py-3 text-white/50 font-mono text-xs">
                              {order.id}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">
                                {order.name}
                              </div>
                              <div className="text-xs text-white/40">
                                {order.symbol}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  order.side === "buy"
                                    ? "bg-profit/20 text-profit"
                                    : "bg-loss/20 text-loss"
                                }`}
                              >
                                {order.side === "buy" ? "买入" : "卖出"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/70 text-xs">
                              {order.type === "limit"
                                ? "限价"
                                : order.type === "market"
                                  ? "市价"
                                  : "止损"}
                            </td>
                            <td className="px-4 py-3 text-right text-white">
                              ¥{order.price.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-white">
                              {order.size}股
                            </td>
                            <td className="px-4 py-3 text-right text-white/50 text-xs">
                              {order.time}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                className="px-3 py-1 text-xs text-loss border border-loss/30 rounded hover:bg-loss/10 transition"
                              >
                                撤单
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-8 text-center text-white/50"
                          >
                            暂无挂单
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right Side Panels - Orderbook, Indicators, and Data Status */}
          <div className="lg:col-span-3 space-y-4">
            {/* Level 2 Orderbook / 五档行情 */}
            <OrderbookPanel
              symbol={selectedSymbol}
              onPriceClick={(price) => setOrderPrice(price.toString())}
            />

            {/* Technical Indicators / 技术指标 */}
            <IndicatorQuickPanel
              symbol={selectedSymbol}
              compact={true}
            />

            {/* Data Status Panel / 数据状态面板 */}
            <DataStatusPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
