"use client";

/**
 * Order Confirmation Dialog
 *
 * Displays a summary card before executing the order.
 * Shows: symbol, direction, quantity, price, fees, balance impact.
 */

import { cn } from "@/lib/utils";
import type { OrderPreview } from "./order-panel";

// =============================================================================
// TYPES
// =============================================================================

interface OrderConfirmDialogProps {
  order: OrderPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function OrderConfirmDialog({
  order,
  onConfirm,
  onCancel,
}: OrderConfirmDialogProps) {
  const isBuy = order.side === "buy";

  const priceModeLabel = {
    limit: "限价",
    market: "市价",
    upper_limit: "涨停价",
    lower_limit: "跌停价",
  }[order.priceMode];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-surface border border-border rounded-xl shadow-card-lg w-[360px] animate-slide-up">
        {/* Header */}
        <div
          className={cn(
            "px-6 py-4 rounded-t-xl border-b border-border",
            isBuy ? "bg-profit/10" : "bg-loss/10",
          )}
        >
          <h3 className="text-base font-medium text-white">
            {isBuy ? "确认买入" : "确认卖出"}
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            请仔细确认以下交易信息
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          {/* Symbol */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-medium">
              {order.symbolName}
            </span>
            <span className="text-xs text-white/40">{order.symbol}</span>
          </div>

          <div className="border-t border-border/50" />

          {/* Order details */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white/50">委托方式</span>
              <span className="text-white">
                {priceModeLabel}
                {isBuy ? "买入" : "卖出"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">委托数量</span>
              <span className="text-white font-mono tabular-nums">
                {order.lots} 手 ({order.shares.toLocaleString()} 股)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">委托价格</span>
              <span className="text-white font-mono tabular-nums">
                ¥{order.price.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Cost breakdown */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white/50">交易金额</span>
              <span className="text-white font-mono tabular-nums">
                ¥{order.subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">手续费</span>
              <span className="text-white font-mono tabular-nums">
                ¥{order.commission.toFixed(2)}
              </span>
            </div>
            {order.stampTax > 0 && (
              <div className="flex justify-between">
                <span className="text-white/50">印花税</span>
                <span className="text-white font-mono tabular-nums">
                  ¥{order.stampTax.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-border/50" />

          {/* Total and balance impact */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between font-medium">
              <span className="text-white/70">
                {isBuy ? "预计总成本" : "预计到账"}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums text-sm",
                  isBuy ? "text-profit" : "text-loss",
                )}
              >
                ¥{order.totalCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">账户余额</span>
              <span className="text-white font-mono tabular-nums">
                ¥{order.balanceBefore.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-white/30 mx-1">&rarr;</span>
                <span
                  className={cn(
                    order.balanceAfter < order.balanceBefore * 0.1
                      ? "text-loss"
                      : "text-white",
                  )}
                >
                  ¥{order.balanceAfter.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm text-white/60 border border-border rounded-lg hover:bg-white/5 transition btn-tactile"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium rounded-lg transition btn-tactile",
              isBuy
                ? "bg-profit hover:bg-profit/80 text-white"
                : "bg-loss hover:bg-loss/80 text-white",
            )}
          >
            {isBuy ? "确认买入" : "确认卖出"}
          </button>
        </div>
      </div>
    </div>
  );
}
