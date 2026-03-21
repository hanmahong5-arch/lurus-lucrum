"use client";

/**
 * Order List Component
 *
 * Displays pending and recent orders with cancel functionality.
 * Shows lot-based quantities with proper A-share formatting.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTradingStore } from "@/lib/stores/trading-store";

// =============================================================================
// CONSTANTS
// =============================================================================

const SHARES_PER_LOT = 100;

// =============================================================================
// TYPES
// =============================================================================

interface OrderListProps {
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function OrderList({ className }: OrderListProps) {
  const orders = useTradingStore((s) => Array.from(s.orders.values()));
  const cancelOrder = useTradingStore((s) => s.cancelOrder);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "pending" || o.status === "partial"),
    [orders],
  );

  const recentOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === "filled" || o.status === "cancelled")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 20),
    [orders],
  );

  if (pendingOrders.length === 0 && recentOrders.length === 0) {
    return (
      <div className={cn("", className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-white">
            委托记录
            <span className="text-white/40 ml-1.5 text-xs">(0)</span>
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-white/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-white/40">暂无委托</p>
          <p className="text-xs text-white/25 mt-1">下单后委托记录将显示在这里</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("", className)}>
      {/* Pending orders */}
      {pendingOrders.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-white">
              挂单中
              <span className="text-white/40 ml-1.5 text-xs">
                ({pendingOrders.length})
              </span>
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {pendingOrders.map((order) => {
              const lots = Math.floor(order.size / SHARES_PER_LOT);
              const isBuy = order.side === "buy";
              return (
                <div
                  key={order.id}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          isBuy
                            ? "bg-profit/15 text-profit"
                            : "bg-loss/15 text-loss",
                        )}
                      >
                        {isBuy ? "买" : "卖"}
                      </span>
                      <span className="text-sm text-white font-medium truncate">
                        {order.name}
                      </span>
                      <span className="text-xs text-white/30">{order.symbol}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 font-mono tabular-nums">
                      <span>{lots}手</span>
                      <span>¥{order.price.toFixed(2)}</span>
                      <span>
                        {order.type === "limit" ? "限价" : order.type === "stop" ? "止损" : "市价"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelOrder(order.id)}
                    className="px-2.5 py-1 text-xs text-loss border border-loss/30 rounded hover:bg-loss/10 transition btn-tactile flex-shrink-0"
                  >
                    撤单
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recent completed/cancelled orders */}
      {recentOrders.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-white">
              成交记录
              <span className="text-white/40 ml-1.5 text-xs">
                ({recentOrders.length})
              </span>
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {recentOrders.map((order) => {
              const lots = Math.floor(order.size / SHARES_PER_LOT);
              const isBuy = order.side === "buy";
              const isFilled = order.status === "filled";
              return (
                <div
                  key={order.id}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          isBuy
                            ? "bg-profit/15 text-profit"
                            : "bg-loss/15 text-loss",
                        )}
                      >
                        {isBuy ? "买" : "卖"}
                      </span>
                      <span className="text-sm text-white font-medium truncate">
                        {order.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          isFilled ? "text-white/40" : "text-white/25",
                        )}
                      >
                        {isFilled ? "已成交" : "已撤销"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 font-mono tabular-nums">
                      <span>{lots}手</span>
                      <span>
                        ¥{(order.averagePrice > 0 ? order.averagePrice : order.price).toFixed(2)}
                      </span>
                      <span>
                        {new Date(order.updatedAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
