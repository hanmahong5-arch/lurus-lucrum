"use client";

/**
 * Paper Trading Page
 * 模拟交易页面 - 完整的交易功能，处理各种边缘情况
 * Uses DashboardHeader for consistent navigation across all dashboard pages
 * 使用 DashboardHeader 确保所有仪表板页面导航一致
 */

import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Send,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wallet,
  BarChart3,
  Activity
} from "lucide-react";

/**
 * Order interface
 * 订单接口
 */
interface Order {
  orderid: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  offset: "OPEN" | "CLOSE";
  price: number;
  volume: number;
  traded: number;
  status: "SUBMITTING" | "NOTTRADED" | "PARTTRADED" | "ALLTRADED" | "CANCELLED" | "REJECTED";
  datetime: string;
}

/**
 * Position interface
 * 持仓接口
 */
interface Position {
  symbol: string;
  direction: "LONG" | "SHORT";
  volume: number;
  frozen: number;
  price: number;
  pnl: number;
  pnl_pct: number;
}

/**
 * Account interface
 * 账户接口
 */
interface Account {
  initial_capital: number;
  balance: number;
  frozen: number;
  available: number;
  total_pnl: number;
  total_commission: number;
  return_pct: number;
}

/**
 * Order validation result
 * 订单验证结果
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate order before submission
 * 提交前验证订单 - 处理各种边缘情况
 */
function validateOrder(
  symbol: string,
  direction: "LONG" | "SHORT",
  volume: number,
  price: number,
  account: Account | null,
  positions: Position[]
): ValidationResult {
  const errors: string[] = [];

  // 1. Basic validation / 基础验证
  if (!symbol.trim()) {
    errors.push("请选择交易品种 / Please select a symbol");
  }

  // 2. Volume validation - A-share must be multiples of 100
  // 数量验证 - A股必须是100的整数倍
  if (volume < 100) {
    errors.push("最小交易数量为100股 / Minimum volume is 100 shares");
  }
  if (volume % 100 !== 0) {
    errors.push("数量必须为100的整数倍 / Volume must be multiples of 100");
  }

  // 3. Price validation / 价格验证
  if (price <= 0) {
    errors.push("价格必须大于0 / Price must be greater than 0");
  }

  // 4. Buy - check available funds
  // 买入 - 检查可用资金
  if (direction === "LONG" && account) {
    const requiredFunds = price * volume * 1.0003; // Include estimated commission
    if (requiredFunds > account.available) {
      errors.push(
        `资金不足: 需要 ¥${requiredFunds.toFixed(2)}, 可用 ¥${account.available.toFixed(2)} / Insufficient funds`
      );
    }
  }

  // 5. Sell - check available position
  // 卖出 - 检查可用持仓
  if (direction === "SHORT") {
    const position = positions.find(
      (p) => p.symbol === symbol && p.direction === "LONG"
    );
    const availableVolume = position ? position.volume - position.frozen : 0;
    if (availableVolume < volume) {
      errors.push(
        `持仓不足: 需要 ${volume} 股, 可卖 ${availableVolume} 股 / Insufficient position`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Paper Trading Page
 * 模拟交易页面 - 完整的交易功能，处理各种边缘情况
 */
export default function PaperTradingPage() {
  // State
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Order form state
  const [orderSymbol, setOrderSymbol] = useState("000001.SZSE");
  const [orderDirection, setOrderDirection] = useState<"LONG" | "SHORT">("LONG");
  const [orderVolume, setOrderVolume] = useState(100);
  const [orderPrice, setOrderPrice] = useState(10.0);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Popular symbols for quick selection
  // 常用品种快速选择
  const popularSymbols = [
    { code: "000001.SZSE", name: "平安银行" },
    { code: "600519.SSE", name: "贵州茅台" },
    { code: "000858.SZSE", name: "五粮液" },
    { code: "600036.SSE", name: "招商银行" },
    { code: "000333.SZSE", name: "美的集团" },
  ];

  // Fetch account data
  // 获取账户数据
  const fetchAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/account/info");
      const data = await response.json();
      if (data.success && data.account) {
        setAccount(data.account);
      }
    } catch (err) {
      console.error("Failed to fetch account:", err);
    }
  }, []);

  // Fetch positions
  // 获取持仓
  const fetchPositions = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/account/positions");
      const data = await response.json();
      if (data.success) {
        setPositions(data.positions || []);
      }
    } catch (err) {
      console.error("Failed to fetch positions:", err);
    }
  }, []);

  // Fetch orders
  // 获取委托
  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/trading/orders");
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  }, []);

  // Refresh all data
  // 刷新所有数据
  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchAccount(), fetchPositions(), fetchOrders()]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchAccount, fetchPositions, fetchOrders]);

  // Initial load
  useEffect(() => {
    refreshAll();
    // Auto refresh every 5 seconds
    // 每5秒自动刷新
    const interval = setInterval(refreshAll, 5000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // Validate order on input change
  // 输入变化时验证订单
  useEffect(() => {
    const result = validateOrder(
      orderSymbol,
      orderDirection,
      orderVolume,
      orderPrice,
      account,
      positions
    );
    setValidationErrors(result.errors);
  }, [orderSymbol, orderDirection, orderVolume, orderPrice, account, positions]);

  // Submit order
  // 提交订单
  const handleSubmitOrder = async () => {
    // Final validation before submit
    // 提交前最终验证
    const validation = validateOrder(
      orderSymbol,
      orderDirection,
      orderVolume,
      orderPrice,
      account,
      positions
    );

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setOrderSubmitting(true);
    try {
      const response = await fetch("/api/backend/trading/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: orderSymbol,
          direction: orderDirection,
          offset: orderDirection === "LONG" ? "OPEN" : "CLOSE",
          price: orderPrice,
          volume: orderVolume,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Reset form and refresh data
        // 重置表单并刷新数据
        setOrderVolume(100);
        await refreshAll();
        setError(null);
      } else {
        setError(data.error || data.message || "Failed to submit order");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Cancel order
  // 撤销订单
  const handleCancelOrder = async (orderId: string) => {
    try {
      const response = await fetch("/api/backend/trading/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderid: orderId }),
      });

      const data = await response.json();

      if (data.success) {
        await refreshAll();
      } else {
        setError(data.error || "Failed to cancel order");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  };

  // Get order status badge
  // 获取订单状态徽章
  const getOrderStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "ALLTRADED":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-profit/20 text-profit text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            全部成交
          </span>
        );
      case "PARTTRADED":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full">
            <Activity className="w-3 h-3" />
            部分成交
          </span>
        );
      case "NOTTRADED":
      case "SUBMITTING":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white/60 text-xs rounded-full">
            <Clock className="w-3 h-3" />
            等待成交
          </span>
        );
      case "CANCELLED":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white/40 text-xs rounded-full">
            <X className="w-3 h-3" />
            已撤销
          </span>
        );
      case "REJECTED":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-loss/20 text-loss text-xs rounded-full">
            <AlertTriangle className="w-3 h-3" />
            已拒绝
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Unified Dashboard Header with account status */}
      {/* 统一的仪表板头部，包含账户状态 */}
      <DashboardHeader />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-loss/10 border border-loss/30 rounded-lg flex items-center justify-between">
            <p className="text-loss text-sm">⚠️ {error}</p>
            <button onClick={() => setError(null)} className="text-loss/60 hover:text-loss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Account summary */}
        {account && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-surface border border-border rounded-xl">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                <Wallet className="w-4 h-4" />
                总资产
              </div>
              <div className="text-xl font-bold text-white">
                ¥{account.balance.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 bg-surface border border-border rounded-xl">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                <BarChart3 className="w-4 h-4" />
                可用资金
              </div>
              <div className="text-xl font-bold text-white">
                ¥{account.available.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 bg-surface border border-border rounded-xl">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                {account.total_pnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-profit" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-loss" />
                )}
                总盈亏
              </div>
              <div className={`text-xl font-bold ${account.total_pnl >= 0 ? "text-profit" : "text-loss"}`}>
                {account.total_pnl >= 0 ? "+" : ""}¥{account.total_pnl.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 bg-surface border border-border rounded-xl">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                <Activity className="w-4 h-4" />
                收益率
              </div>
              <div className={`text-xl font-bold ${account.return_pct >= 0 ? "text-profit" : "text-loss"}`}>
                {account.return_pct >= 0 ? "+" : ""}{(account.return_pct * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Order form */}
          <div className="lg:col-span-1">
            <div className="p-6 bg-surface border border-border rounded-xl">
              <h2 className="text-lg font-bold text-white mb-4">
                下单 / Place Order
              </h2>

              {/* Symbol selection */}
              <div className="mb-4">
                <label className="block text-sm text-white/60 mb-2">交易品种</label>
                <select
                  value={orderSymbol}
                  onChange={(e) => setOrderSymbol(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50"
                >
                  {popularSymbols.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Direction */}
              <div className="mb-4">
                <label className="block text-sm text-white/60 mb-2">方向</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOrderDirection("LONG")}
                    className={`py-2 rounded-lg font-medium transition ${
                      orderDirection === "LONG"
                        ? "bg-profit text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    买入
                  </button>
                  <button
                    onClick={() => setOrderDirection("SHORT")}
                    className={`py-2 rounded-lg font-medium transition ${
                      orderDirection === "SHORT"
                        ? "bg-loss text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    卖出
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <label className="block text-sm text-white/60 mb-2">价格</label>
                <input
                  type="number"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50"
                />
              </div>

              {/* Volume */}
              <div className="mb-4">
                <label className="block text-sm text-white/60 mb-2">数量 (100的整数倍)</label>
                <input
                  type="number"
                  value={orderVolume}
                  onChange={(e) => setOrderVolume(parseInt(e.target.value) || 0)}
                  step="100"
                  min="100"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent/50"
                />
              </div>

              {/* Estimated cost */}
              <div className="mb-4 p-3 bg-white/5 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">预估金额</span>
                  <span className="text-white font-medium">
                    ¥{(orderPrice * orderVolume).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="mb-4 p-3 bg-loss/10 border border-loss/30 rounded-lg">
                  {validationErrors.map((err, i) => (
                    <p key={i} className="text-loss text-sm">⚠️ {err}</p>
                  ))}
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmitOrder}
                disabled={orderSubmitting || validationErrors.length > 0}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 ${
                  orderDirection === "LONG"
                    ? "bg-profit hover:bg-profit/90 text-white"
                    : "bg-loss hover:bg-loss/90 text-white"
                }`}
              >
                {orderSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {orderDirection === "LONG" ? "买入" : "卖出"}
              </button>
            </div>
          </div>

          {/* Positions and Orders */}
          <div className="lg:col-span-2 space-y-6">
            {/* Positions */}
            <div className="p-6 bg-surface border border-border rounded-xl">
              <h2 className="text-lg font-bold text-white mb-4">
                持仓 / Positions
              </h2>
              {positions.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-8">
                  暂无持仓 / No positions
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-white/60 text-sm border-b border-white/10">
                        <th className="pb-3">品种</th>
                        <th className="pb-3">方向</th>
                        <th className="pb-3">数量</th>
                        <th className="pb-3">成本</th>
                        <th className="pb-3">盈亏</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-3 text-white font-medium">{pos.symbol}</td>
                          <td className="py-3">
                            <span className={pos.direction === "LONG" ? "text-profit" : "text-loss"}>
                              {pos.direction === "LONG" ? "多" : "空"}
                            </span>
                          </td>
                          <td className="py-3 text-white">{pos.volume}</td>
                          <td className="py-3 text-white">¥{pos.price.toFixed(2)}</td>
                          <td className={`py-3 font-medium ${pos.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                            {pos.pnl >= 0 ? "+" : ""}¥{pos.pnl.toFixed(2)}
                            <span className="text-xs ml-1">
                              ({pos.pnl_pct >= 0 ? "+" : ""}{(pos.pnl_pct * 100).toFixed(2)}%)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Active Orders */}
            <div className="p-6 bg-surface border border-border rounded-xl">
              <h2 className="text-lg font-bold text-white mb-4">
                委托 / Orders
              </h2>
              {orders.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-8">
                  暂无委托 / No orders
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-white/60 text-sm border-b border-white/10">
                        <th className="pb-3">品种</th>
                        <th className="pb-3">方向</th>
                        <th className="pb-3">价格</th>
                        <th className="pb-3">数量</th>
                        <th className="pb-3">成交</th>
                        <th className="pb-3">状态</th>
                        <th className="pb-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 10).map((order) => (
                        <tr key={order.orderid} className="border-b border-white/5">
                          <td className="py-3 text-white font-medium">{order.symbol}</td>
                          <td className="py-3">
                            <span className={order.direction === "LONG" ? "text-profit" : "text-loss"}>
                              {order.direction === "LONG" ? "买" : "卖"}
                            </span>
                          </td>
                          <td className="py-3 text-white">¥{order.price.toFixed(2)}</td>
                          <td className="py-3 text-white">{order.volume}</td>
                          <td className="py-3 text-white">{order.traded}</td>
                          <td className="py-3">{getOrderStatusBadge(order.status)}</td>
                          <td className="py-3">
                            {(order.status === "NOTTRADED" || order.status === "PARTTRADED") && (
                              <button
                                onClick={() => handleCancelOrder(order.orderid)}
                                className="text-white/40 hover:text-loss transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
