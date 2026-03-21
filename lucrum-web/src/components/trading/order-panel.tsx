"use client";

/**
 * Professional Order Panel Component
 *
 * Features:
 * - Round-lot (hand/手) based input (1 lot = 100 shares for A-share)
 * - Real-time cost calculation with commission preview
 * - Quick quantity buttons (1/5/10 lots, full/half/third position)
 * - Price input with limit price shortcuts (market/limit/upper limit/lower limit)
 * - Pre-order confirmation dialog
 * - Integration with trading-store
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTradingStore } from "@/lib/stores/trading-store";
import { OrderConfirmDialog } from "./order-confirm-dialog";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";

// =============================================================================
// CONSTANTS
// =============================================================================

const SHARES_PER_LOT = 100;
const DEFAULT_COMMISSION_RATE = 0.0003; // 0.03% (standard A-share commission)
const MIN_COMMISSION = 5; // Minimum commission per trade (CNY)
const STAMP_TAX_RATE = 0.001; // 0.1% stamp tax (sell-side only)
const PRICE_LIMIT_PERCENT = 0.1; // 10% daily price limit for A-share

// =============================================================================
// TYPES
// =============================================================================

export type OrderSide = "buy" | "sell";
export type PriceMode = "limit" | "market" | "upper_limit" | "lower_limit";

export interface OrderPanelProps {
  symbol: string;
  symbolName: string;
  currentPrice: number;
  prevClose: number;
  className?: string;
  onOrderPlaced?: () => void;
  disabled?: boolean;
}

export interface OrderPreview {
  side: OrderSide;
  symbol: string;
  symbolName: string;
  lots: number;
  shares: number;
  price: number;
  priceMode: PriceMode;
  subtotal: number;
  commission: number;
  stampTax: number;
  totalCost: number;
  balanceBefore: number;
  balanceAfter: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function OrderPanel({
  symbol,
  symbolName,
  currentPrice,
  prevClose,
  className,
  onOrderPlaced,
  disabled = false,
}: OrderPanelProps) {
  // Trading store
  const balance = useTradingStore((s) => s.balance);
  const openPosition = useTradingStore((s) => s.openPosition);
  const closePosition = useTradingStore((s) => s.closePosition);
  const getOpenPositions = useTradingStore((s) => s.getOpenPositions);
  const placeOrder = useTradingStore((s) => s.placeOrder);

  // Local state
  const [activeSide, setActiveSide] = useState<OrderSide>("buy");
  const [priceMode, setPriceMode] = useState<PriceMode>("limit");
  const [priceInput, setPriceInput] = useState("");
  const [lotsInput, setLotsInput] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<OrderPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Double-click prevention: leading-edge debounce (1000ms cooldown)
  const submitCooldownRef = useRef(false);

  // Computed: effective price based on mode
  const effectivePrice = useMemo(() => {
    if (currentPrice <= 0 || prevClose <= 0) return 0;
    switch (priceMode) {
      case "market":
        return currentPrice;
      case "upper_limit":
        return Math.round(prevClose * (1 + PRICE_LIMIT_PERCENT) * 100) / 100;
      case "lower_limit":
        return Math.round(prevClose * (1 - PRICE_LIMIT_PERCENT) * 100) / 100;
      case "limit":
      default:
        return parseFloat(priceInput) || 0;
    }
  }, [priceMode, priceInput, currentPrice, prevClose]);

  // Computed: lots and shares
  const lots = useMemo(() => {
    const val = parseInt(lotsInput, 10);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [lotsInput]);

  const shares = lots * SHARES_PER_LOT;

  // Computed: cost breakdown
  const costBreakdown = useMemo(() => {
    if (effectivePrice <= 0 || lots <= 0) return null;
    const subtotal = effectivePrice * shares;
    const rawCommission = subtotal * DEFAULT_COMMISSION_RATE;
    const commission = Math.max(rawCommission, MIN_COMMISSION);
    const stampTax = activeSide === "sell" ? subtotal * STAMP_TAX_RATE : 0;
    const totalCost = subtotal + commission + stampTax;
    return { subtotal, commission, stampTax, totalCost };
  }, [effectivePrice, shares, lots, activeSide]);

  // Computed: price distance from current
  const priceDistance = useMemo(() => {
    if (currentPrice <= 0 || effectivePrice <= 0) return null;
    const diff = effectivePrice - currentPrice;
    const percent = (diff / currentPrice) * 100;
    return { diff, percent };
  }, [currentPrice, effectivePrice]);

  // Computed: max affordable lots for buy
  const maxAffordableLots = useMemo(() => {
    if (effectivePrice <= 0) return 0;
    const pricePerLot = effectivePrice * SHARES_PER_LOT;
    // Reserve for commission
    const usableBalance = balance * 0.999;
    return Math.floor(usableBalance / pricePerLot);
  }, [balance, effectivePrice]);

  // Computed: current position for this symbol
  const currentPosition = useMemo(() => {
    const positions = getOpenPositions();
    return positions.find((p) => p.symbol === symbol);
  }, [getOpenPositions, symbol]);

  const maxSellLots = currentPosition
    ? Math.floor(currentPosition.size / SHARES_PER_LOT)
    : 0;

  // Handler: set lots by quick buttons
  const handleQuickLots = useCallback((value: number) => {
    setLotsInput(String(value));
  }, []);

  // Handler: set lots by position fraction
  const handlePositionFraction = useCallback(
    (fraction: number) => {
      if (activeSide === "buy") {
        const maxLots = maxAffordableLots;
        const targetLots = Math.floor(maxLots * fraction);
        setLotsInput(String(Math.max(1, targetLots)));
      } else {
        const targetLots = Math.floor(maxSellLots * fraction);
        setLotsInput(String(Math.max(0, targetLots)));
      }
    },
    [activeSide, maxAffordableLots, maxSellLots],
  );

  // Handler: pre-order validation and confirmation (with double-click prevention)
  const handleSubmit = useCallback(() => {
    if (lots <= 0 || effectivePrice <= 0 || !costBreakdown) return;
    if (isSubmitting) return; // Block while another order is pending

    // Leading-edge debounce: prevent rapid double-click (1000ms cooldown)
    if (submitCooldownRef.current) return;
    submitCooldownRef.current = true;
    setTimeout(() => { submitCooldownRef.current = false; }, 1000);

    if (activeSide === "buy" && costBreakdown.totalCost > balance) {
      return; // Insufficient funds — UI will show this
    }

    if (activeSide === "sell" && lots > maxSellLots) {
      return; // Insufficient position
    }

    const preview: OrderPreview = {
      side: activeSide,
      symbol,
      symbolName,
      lots,
      shares,
      price: effectivePrice,
      priceMode,
      subtotal: costBreakdown.subtotal,
      commission: costBreakdown.commission,
      stampTax: costBreakdown.stampTax,
      totalCost: costBreakdown.totalCost,
      balanceBefore: balance,
      balanceAfter:
        activeSide === "buy"
          ? balance - costBreakdown.totalCost
          : balance + costBreakdown.subtotal - costBreakdown.commission - costBreakdown.stampTax,
    };

    setPendingOrder(preview);
    setShowConfirm(true);
  }, [
    lots,
    effectivePrice,
    costBreakdown,
    activeSide,
    balance,
    maxSellLots,
    symbol,
    symbolName,
    shares,
    priceMode,
  ]);

  // Handler: confirm order execution (with submitting state)
  const handleConfirmOrder = useCallback(() => {
    if (!pendingOrder || isSubmitting) return;

    setIsSubmitting(true);

    if (pendingOrder.priceMode === "market") {
      // Market order: execute immediately
      if (pendingOrder.side === "buy") {
        openPosition({
          symbol: pendingOrder.symbol,
          name: pendingOrder.symbolName,
          side: "long",
          size: pendingOrder.shares,
          entryPrice: pendingOrder.price,
          commission: pendingOrder.commission,
        });
      } else {
        // Sell: close existing position
        if (currentPosition) {
          closePosition(currentPosition.id, pendingOrder.price, pendingOrder.commission);
        }
      }
    } else {
      // Limit order: place pending order in store
      placeOrder({
        symbol: pendingOrder.symbol,
        name: pendingOrder.symbolName,
        side: pendingOrder.side,
        type: "limit",
        price: pendingOrder.price,
        size: pendingOrder.shares,
      });
    }

    // Reset form
    setLotsInput("");
    setPriceInput("");
    setShowConfirm(false);
    setPendingOrder(null);
    setIsSubmitting(false);
    onOrderPlaced?.();
  }, [pendingOrder, isSubmitting, currentPosition, openPosition, closePosition, placeOrder, onOrderPlaced]);

  // Handler: cancel confirmation
  const handleCancelConfirm = useCallback(() => {
    setShowConfirm(false);
    setPendingOrder(null);
    setIsSubmitting(false);
  }, []);

  // Validation state
  const insufficientFunds =
    activeSide === "buy" && costBreakdown !== null && costBreakdown.totalCost > balance;
  const insufficientPosition =
    activeSide === "sell" && lots > maxSellLots;
  const canSubmit =
    lots > 0 &&
    effectivePrice > 0 &&
    !insufficientFunds &&
    !insufficientPosition &&
    !disabled &&
    !isSubmitting;

  return (
    <>
      <div className={cn("bg-surface rounded-xl border border-border", className)}>
        {/* Buy/Sell toggle */}
        <div className="flex">
          <button
            type="button"
            onClick={() => setActiveSide("buy")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-all btn-tactile rounded-tl-xl",
              activeSide === "buy"
                ? "bg-profit text-white"
                : "bg-surface text-white/50 hover:text-white hover:bg-white/5",
            )}
          >
            买入
          </button>
          <button
            type="button"
            onClick={() => setActiveSide("sell")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-all btn-tactile rounded-tr-xl",
              activeSide === "sell"
                ? "bg-loss text-white"
                : "bg-surface text-white/50 hover:text-white hover:bg-white/5",
            )}
          >
            卖出
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Current symbol info */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-white">{symbolName}</span>
              <span className="text-xs text-white/40 ml-2">{symbol}</span>
            </div>
            <div className="text-right">
              <span className="font-mono tabular-nums text-sm font-medium text-white">
                {currentPrice > 0 ? `¥${currentPrice.toFixed(2)}` : "--"}
              </span>
            </div>
          </div>

          {/* Price mode buttons */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">委托类型</label>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { mode: "limit" as PriceMode, label: "限价" },
                  { mode: "market" as PriceMode, label: "市价" },
                  { mode: "upper_limit" as PriceMode, label: "涨停价" },
                  { mode: "lower_limit" as PriceMode, label: "跌停价" },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPriceMode(mode);
                    if (mode !== "limit") setPriceInput("");
                  }}
                  className={cn(
                    "py-1.5 text-xs font-medium rounded transition btn-tactile",
                    priceMode === mode
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "text-white/50 border border-border hover:text-white hover:border-white/20",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Price input */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">
              委托价格
            </label>
            {priceMode === "limit" ? (
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : "0.00"}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white font-mono tabular-nums text-sm focus:outline-none focus:border-accent transition"
              />
            ) : (
              <div className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-white/70 font-mono tabular-nums text-sm">
                {effectivePrice > 0 ? `¥${effectivePrice.toFixed(2)}` : "--"}
                <span className="text-xs text-white/40 ml-2">
                  {priceMode === "market" && "(市价)"}
                  {priceMode === "upper_limit" && "(涨停)"}
                  {priceMode === "lower_limit" && "(跌停)"}
                </span>
              </div>
            )}
            {/* Price distance indicator */}
            {priceMode === "limit" && priceDistance && effectivePrice > 0 && (
              <div className="mt-1 text-xs">
                <span className="text-white/40">距现价 </span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    priceDistance.percent >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {priceDistance.percent >= 0 ? "+" : ""}
                  {priceDistance.percent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {/* Lot input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-white/50">委托数量 (手)</label>
              <span className="text-xs text-white/40">
                {activeSide === "buy"
                  ? `可买 ${maxAffordableLots} 手`
                  : `可卖 ${maxSellLots} 手`}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="1"
                placeholder="0"
                value={lotsInput}
                onChange={(e) => setLotsInput(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 text-white font-mono tabular-nums text-sm focus:outline-none focus:border-accent transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                手
              </span>
            </div>
            {lots > 0 && (
              <div className="mt-1 text-xs text-white/40 font-mono tabular-nums">
                {effectivePrice > 0 ? (
                  <>
                    = {shares.toLocaleString()} 股 &times; ¥{effectivePrice.toFixed(2)} = ¥
                    {(shares * effectivePrice).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </>
                ) : (
                  <span className="text-white/30">请先选择股票或设置委托价格</span>
                )}
              </div>
            )}
          </div>

          {/* Quick quantity buttons */}
          <div className="grid grid-cols-6 gap-1">
            {[1, 5, 10].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickLots(val)}
                className="py-1.5 text-xs text-white/50 hover:text-white border border-border rounded hover:border-accent/50 transition btn-tactile"
              >
                {val}手
              </button>
            ))}
            {[
              { label: "1/3仓", frac: 1 / 3 },
              { label: "半仓", frac: 0.5 },
              { label: "全仓", frac: 1 },
            ].map(({ label, frac }) => (
              <button
                key={label}
                type="button"
                onClick={() => handlePositionFraction(frac)}
                className="py-1.5 text-xs text-white/50 hover:text-white border border-border rounded hover:border-accent/50 transition btn-tactile"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cost breakdown */}
          {costBreakdown && lots > 0 && (
            <div className="p-3 bg-background rounded-lg space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">交易金额</span>
                <span className="text-white font-mono tabular-nums">
                  ¥{costBreakdown.subtotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">
                  佣金 ({(DEFAULT_COMMISSION_RATE * 10000).toFixed(0)}
                  ‱)
                </span>
                <span className="text-white font-mono tabular-nums">
                  ¥{costBreakdown.commission.toFixed(2)}
                </span>
              </div>
              {activeSide === "sell" && (
                <div className="flex justify-between">
                  <span className="text-white/50">印花税 (1‰)</span>
                  <span className="text-white font-mono tabular-nums">
                    ¥{costBreakdown.stampTax.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-border/50 font-medium">
                <span className="text-white/70">
                  {activeSide === "buy" ? "预计总成本" : "预计到账"}
                </span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    activeSide === "buy" ? "text-profit" : "text-loss",
                  )}
                >
                  ¥{activeSide === "buy"
                    ? costBreakdown.totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : (costBreakdown.subtotal - costBreakdown.commission - costBreakdown.stampTax).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                </span>
              </div>
            </div>
          )}

          {/* Validation warnings */}
          {insufficientFunds && (
            <div className="text-xs text-loss bg-loss/10 rounded-lg px-3 py-2">
              余额不足，需要 ¥
              {costBreakdown?.totalCost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              ，当前余额 ¥
              {balance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          )}
          {insufficientPosition && (
            <div className="text-xs text-loss bg-loss/10 rounded-lg px-3 py-2">
              持仓不足，可卖 {maxSellLots} 手，尝试卖出 {lots} 手
            </div>
          )}

          {/* Submit button with contextual disable reason */}
          <DisabledWithReason
            disabled={!canSubmit && !isSubmitting}
            reason={
              disabled
                ? "交易功能暂不可用"
                : lots <= 0
                  ? "请输入委托数量"
                  : effectivePrice <= 0
                    ? "请设置委托价格"
                    : insufficientFunds
                      ? "余额不足，请减少数量或降低价格"
                      : insufficientPosition
                        ? `持仓不足，最多可卖 ${maxSellLots} 手`
                        : "请完善下单信息"
            }
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "w-full py-3 text-sm font-medium rounded-lg transition btn-tactile",
                activeSide === "buy"
                  ? canSubmit
                    ? "bg-profit hover:bg-profit/80 text-white shadow-glow-profit"
                    : "bg-profit/30 text-white/50 cursor-not-allowed"
                  : canSubmit
                    ? "bg-loss hover:bg-loss/80 text-white shadow-glow-loss"
                    : "bg-loss/30 text-white/50 cursor-not-allowed",
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  提交中...
                </span>
              ) : activeSide === "buy" ? "确认买入" : "确认卖出"}
            </button>
          </DisabledWithReason>

          {/* Account summary */}
          <div className="pt-3 border-t border-border space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/50">可用余额</span>
              <span className="text-white font-mono tabular-nums">
                ¥{balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            {currentPosition && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">当前持仓</span>
                <span className="text-white font-mono tabular-nums">
                  {Math.floor(currentPosition.size / SHARES_PER_LOT)} 手 ({currentPosition.size} 股)
                </span>
              </div>
            )}
            {currentPosition && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">持仓盈亏</span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    currentPosition.unrealizedPnL >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {currentPosition.unrealizedPnL >= 0 ? "+" : ""}¥
                  {currentPosition.unrealizedPnL.toFixed(2)}
                  <span className="text-white/40 ml-1">
                    ({currentPosition.unrealizedPnLPercent >= 0 ? "+" : ""}
                    {currentPosition.unrealizedPnLPercent.toFixed(2)}%)
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && pendingOrder && (
        <OrderConfirmDialog
          order={pendingOrder}
          onConfirm={handleConfirmOrder}
          onCancel={handleCancelConfirm}
        />
      )}
    </>
  );
}
