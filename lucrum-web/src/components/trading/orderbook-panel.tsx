"use client";

/**
 * Orderbook Panel Component - Five-tier bid/ask quotes display
 * 五档行情面板组件 - 显示五档买卖盘口
 *
 * Displays real-time level 2 market data with bid/ask prices and volumes.
 * 显示实时二级市场数据，包含买卖价格和数量
 */

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Order book level data
 */
export interface OrderLevel {
  price: number;
  volume: number;
  orders?: number; // Number of orders at this level
}

/**
 * Complete order book data
 */
export interface OrderBookData {
  symbol: string;
  lastPrice: number;
  prevClose: number;
  asks: OrderLevel[]; // Sell orders (ascending by price)
  bids: OrderLevel[]; // Buy orders (descending by price)
  timestamp: Date;
}

/**
 * Component props
 */
export interface OrderbookPanelProps {
  symbol: string;
  className?: string;
  onPriceClick?: (price: number) => void;
  showSpread?: boolean;
  levels?: number; // Default 5
}

// =============================================================================
// MOCK DATA GENERATOR / 模拟数据生成器
// =============================================================================

/**
 * Generate mock orderbook data for demonstration
 * 生成模拟盘口数据用于演示
 */
function generateMockOrderbook(symbol: string, basePrice: number): OrderBookData {
  const asks: OrderLevel[] = [];
  const bids: OrderLevel[] = [];

  // Generate 5 ask levels (sell side - prices go up)
  for (let i = 0; i < 5; i++) {
    const priceOffset = (i + 1) * 0.01 * basePrice * (0.001 + Math.random() * 0.001);
    asks.push({
      price: basePrice + priceOffset,
      volume: Math.floor(1000 + Math.random() * 50000),
      orders: Math.floor(1 + Math.random() * 20),
    });
  }

  // Generate 5 bid levels (buy side - prices go down)
  for (let i = 0; i < 5; i++) {
    const priceOffset = (i + 1) * 0.01 * basePrice * (0.001 + Math.random() * 0.001);
    bids.push({
      price: basePrice - priceOffset,
      volume: Math.floor(1000 + Math.random() * 50000),
      orders: Math.floor(1 + Math.random() * 20),
    });
  }

  return {
    symbol,
    lastPrice: basePrice,
    prevClose: basePrice * (1 - (Math.random() * 0.02 - 0.01)),
    asks: asks.sort((a, b) => a.price - b.price), // Ascending
    bids: bids.sort((a, b) => b.price - a.price), // Descending
    timestamp: new Date(),
  };
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function OrderbookPanel({
  symbol,
  className,
  onPriceClick,
  showSpread = true,
  levels = 5,
}: OrderbookPanelProps) {
  const [orderbook, setOrderbook] = useState<OrderBookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch orderbook data (mock for now)
  useEffect(() => {
    setIsLoading(true);

    // Determine base price based on symbol
    let basePrice = 50;
    if (symbol.includes("600519")) basePrice = 1750;
    else if (symbol.includes("000333")) basePrice = 56.8;
    else if (symbol.includes("601318")) basePrice = 48.5;
    else if (symbol.includes("300750")) basePrice = 185;

    // Simulate API delay
    const timer = setTimeout(() => {
      const mockData = generateMockOrderbook(symbol, basePrice);
      setOrderbook(mockData);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [symbol]);

  // Simulate real-time updates
  useEffect(() => {
    if (!orderbook) return;

    const interval = setInterval(() => {
      setOrderbook((prev) => {
        if (!prev) return null;
        return generateMockOrderbook(symbol, prev.lastPrice * (1 + (Math.random() * 0.002 - 0.001)));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [symbol, orderbook !== null]);

  // Calculate spread
  const spread = useMemo(() => {
    if (!orderbook || orderbook.asks.length === 0 || orderbook.bids.length === 0) return null;
    const lowestAsk = orderbook.asks[0]?.price ?? 0;
    const highestBid = orderbook.bids[0]?.price ?? 0;
    return {
      absolute: lowestAsk - highestBid,
      percentage: ((lowestAsk - highestBid) / highestBid) * 100,
    };
  }, [orderbook]);

  // Calculate max volume for bar width
  const maxVolume = useMemo(() => {
    if (!orderbook) return 1;
    const allVolumes = [...orderbook.asks, ...orderbook.bids].map((l) => l.volume);
    return Math.max(...allVolumes, 1);
  }, [orderbook]);

  // Calculate price change from previous close
  const priceChange = useMemo(() => {
    if (!orderbook) return null;
    const change = orderbook.lastPrice - orderbook.prevClose;
    const changePercent = (change / orderbook.prevClose) * 100;
    return { absolute: change, percent: changePercent };
  }, [orderbook]);

  // Format volume for display
  const formatVolume = (volume: number): string => {
    if (volume >= 10000) return (volume / 10000).toFixed(1) + "万";
    return volume.toLocaleString();
  };

  // Format price for display
  const formatPrice = (price: number): string => {
    if (price >= 100) return price.toFixed(2);
    return price.toFixed(3);
  };

  if (isLoading) {
    return (
      <div className={cn("bg-surface rounded-xl border border-border p-4", className)}>
        <div className="text-sm font-medium text-white mb-3">五档行情 / Level 2</div>
        <div className="flex items-center justify-center h-48">
          <div className="text-white/50 text-sm">加载中...</div>
        </div>
      </div>
    );
  }

  if (!orderbook) {
    return (
      <div className={cn("bg-surface rounded-xl border border-border p-4", className)}>
        <div className="text-sm font-medium text-white mb-3">五档行情 / Level 2</div>
        <div className="flex items-center justify-center h-48">
          <div className="text-white/50 text-sm">暂无数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-surface rounded-xl border border-border p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-white">五档行情 / Level 2</div>
        <div className="text-xs text-white/40">
          {orderbook.timestamp.toLocaleTimeString("zh-CN")}
        </div>
      </div>

      {/* Ask side (sell orders) - displayed in reverse order */}
      <div className="space-y-1 mb-2">
        {orderbook.asks
          .slice(0, levels)
          .reverse()
          .map((level, index) => (
            <OrderRow
              key={`ask-${index}`}
              label={`卖${levels - index}`}
              price={level.price}
              volume={level.volume}
              orders={level.orders}
              maxVolume={maxVolume}
              side="ask"
              prevClose={orderbook.prevClose}
              onClick={() => onPriceClick?.(level.price)}
            />
          ))}
      </div>

      {/* Spread indicator */}
      {showSpread && spread && (
        <div className="flex items-center justify-center py-2 border-y border-border/50 my-2">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-white/50">最新</span>
              <span className={cn(
                "font-mono font-medium",
                priceChange && priceChange.absolute >= 0 ? "text-profit" : "text-loss"
              )}>
                {formatPrice(orderbook.lastPrice)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/50">价差</span>
              <span className="font-mono text-white">
                {formatPrice(spread.absolute)}
              </span>
              <span className="text-white/40">
                ({spread.percentage.toFixed(3)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bid side (buy orders) */}
      <div className="space-y-1 mt-2">
        {orderbook.bids.slice(0, levels).map((level, index) => (
          <OrderRow
            key={`bid-${index}`}
            label={`买${index + 1}`}
            price={level.price}
            volume={level.volume}
            orders={level.orders}
            maxVolume={maxVolume}
            side="bid"
            prevClose={orderbook.prevClose}
            onClick={() => onPriceClick?.(level.price)}
          />
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-white/50">卖盘总量</span>
          <span className="text-loss font-mono">
            {formatVolume(orderbook.asks.reduce((sum, l) => sum + l.volume, 0))}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">买盘总量</span>
          <span className="text-profit font-mono">
            {formatVolume(orderbook.bids.reduce((sum, l) => sum + l.volume, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS / 子组件
// =============================================================================

interface OrderRowProps {
  label: string;
  price: number;
  volume: number;
  orders?: number;
  maxVolume: number;
  side: "ask" | "bid";
  prevClose: number;
  onClick?: () => void;
}

function OrderRow({
  label,
  price,
  volume,
  orders,
  maxVolume,
  side,
  prevClose,
  onClick,
}: OrderRowProps) {
  const barWidth = (volume / maxVolume) * 100;
  const priceChange = ((price - prevClose) / prevClose) * 100;
  const isPositive = priceChange >= 0;

  // Format price for display
  const formatPrice = (p: number): string => {
    if (p >= 100) return p.toFixed(2);
    return p.toFixed(3);
  };

  // Format volume for display
  const formatVolume = (v: number): string => {
    if (v >= 10000) return (v / 10000).toFixed(1) + "万";
    return v.toLocaleString();
  };

  return (
    <div
      className={cn(
        "relative flex items-center h-6 px-2 rounded cursor-pointer transition hover:bg-white/5",
        "group"
      )}
      onClick={onClick}
    >
      {/* Volume bar background */}
      <div
        className={cn(
          "absolute inset-y-0 transition-all",
          side === "ask" ? "right-0 bg-loss/10" : "left-0 bg-profit/10"
        )}
        style={{ width: `${barWidth}%` }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-between w-full text-xs">
        <span className="text-white/50 w-8">{label}</span>
        <span
          className={cn(
            "font-mono font-medium flex-1 text-center",
            isPositive ? "text-profit" : "text-loss"
          )}
        >
          {formatPrice(price)}
        </span>
        <span
          className={cn(
            "font-mono w-16 text-right",
            side === "ask" ? "text-loss/80" : "text-profit/80"
          )}
        >
          {formatVolume(volume)}
        </span>
        {orders !== undefined && (
          <span className="text-white/30 w-8 text-right ml-1">
            {orders}笔
          </span>
        )}
      </div>
    </div>
  );
}

export default OrderbookPanel;
