'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { PresenceAvatars } from './presence-avatars';
import type { PresenceUser } from '@/hooks/use-presence';

interface BacktestFeedItem {
  id: number;
  userId: string;
  userName?: string;
  symbol: string;
  stockName: string | null;
  totalReturn: number | null;
  sharpeRatio: number | null;
  createdAt: string;
}

interface SharedBacktestFeedProps {
  teamId: number;
  onlineUsers?: PresenceUser[];
}

export function SharedBacktestFeed({ teamId, onlineUsers = [] }: SharedBacktestFeedProps) {
  const [items, setItems] = useState<BacktestFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch(`/api/history?type=backtest&tenantId=${teamId}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.data ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => {
    fetchFeed();
    // Poll every 15s for new results
    const interval = setInterval(fetchFeed, 15000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BarChart3 className="w-8 h-8 text-white/10 mb-2" />
        <p className="text-xs text-white/20">团队还没有回测记录</p>
        <p className="text-[11px] text-white/10 mt-1">运行回测后结果会出现在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isPositive = (item.totalReturn ?? 0) >= 0;
        const returnStr = item.totalReturn !== null
          ? `${isPositive ? '+' : ''}${(item.totalReturn * 100).toFixed(2)}%`
          : '—';

        // Find matching online user
        const author = onlineUsers.find((u) => u.userId === item.userId);

        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-white/[0.02] transition-colors cursor-pointer group"
          >
            {/* Author indicator */}
            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
              {author ? (
                <PresenceAvatars users={[author]} maxDisplay={1} size="sm" />
              ) : (
                <span className="text-[9px] text-white/30">
                  {(item.userName ?? item.userId).substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* Stock info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white truncate">
                  {item.stockName || item.symbol}
                </span>
                <span className="text-[10px] text-white/20 font-mono">{item.symbol}</span>
              </div>
            </div>

            {/* Return */}
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-3 h-3 text-profit" />
              ) : (
                <TrendingDown className="w-3 h-3 text-loss" />
              )}
              <span className={`text-xs font-mono tabular-nums font-medium ${
                isPositive ? 'text-profit' : 'text-loss'
              }`}>
                {returnStr}
              </span>
            </div>

            {/* Sharpe */}
            {item.sharpeRatio !== null && (
              <span className="text-[10px] font-mono tabular-nums text-white/20" title="Sharpe Ratio">
                S:{item.sharpeRatio.toFixed(2)}
              </span>
            )}

            {/* Time */}
            <span className="text-[10px] font-mono tabular-nums text-white/15 shrink-0">
              {formatShortTime(item.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatShortTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}
