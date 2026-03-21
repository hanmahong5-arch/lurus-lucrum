"use client";

/**
 * Market Insights Dashboard
 *
 * Dashboard-style layout with:
 * - Sector rotation trend bar
 * - Northbound capital flow line
 * - Top 10 inflow/outflow bars
 * - Institutional viewpoint summaries
 * - Market indices and key metrics
 *
 * All financial numbers use font-mono tabular-nums.
 */

import { useState, useEffect } from "react";
import {
  useNorthBoundFlow,
  useMajorIndices,
  useDragonTigerList,
  useSectorCapitalFlow,
  useMarginTradingData,
  useLargeOrderFlow,
  useMarketSentiment,
} from "@/hooks/use-market-data";
import { isMarketOpen } from "@/lib/trading/time-utils";
import { cn } from "@/lib/utils";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatAmount(num: number): string {
  const absNum = Math.abs(num);
  const sign = num >= 0 ? "+" : "-";
  if (absNum >= 1e8) return `${sign}${(absNum / 1e8).toFixed(2)}亿`;
  if (absNum >= 1e4) return `${sign}${(absNum / 1e4).toFixed(2)}万`;
  return `${sign}${absNum.toFixed(2)}`;
}

function formatBalance(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}万亿`;
  if (num >= 1e8) return `${(num / 1e8).toFixed(2)}亿`;
  if (num >= 1e4) return `${(num / 1e4).toFixed(2)}万`;
  return num.toFixed(2);
}

function getValueColor(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-white/50";
}

function getSentimentLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "偏多", color: "bg-profit/20 text-profit" };
  if (score >= 50) return { label: "中性", color: "bg-accent/20 text-accent" };
  if (score >= 30) return { label: "偏空", color: "bg-loss/20 text-loss" };
  return { label: "极度恐慌", color: "bg-loss/30 text-loss" };
}

/** Simple horizontal bar component for capital flow visualization */
function FlowBar({
  value,
  maxAbs,
  label,
  sublabel,
}: {
  value: number;
  maxAbs: number;
  label: string;
  sublabel?: string;
}) {
  const widthPercent = maxAbs > 0 ? Math.min(100, (Math.abs(value) / maxAbs) * 100) : 0;
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 shrink-0 text-right">
        <div className="text-xs text-white truncate">{label}</div>
        {sublabel && (
          <div className="text-[10px] text-white/30">{sublabel}</div>
        )}
      </div>
      <div className="flex-1 h-5 relative">
        <div
          className={cn(
            "absolute top-0 h-full rounded transition-all duration-500",
            isPositive ? "bg-profit/30 left-0" : "bg-loss/30 right-0"
          )}
          style={{
            width: `${widthPercent}%`,
            ...(isPositive ? { left: 0 } : { right: 0 }),
          }}
        />
      </div>
      <div
        className={cn(
          "w-20 text-right text-xs font-mono tabular-nums shrink-0",
          getValueColor(value)
        )}
      >
        {formatAmount(value)}
      </div>
    </div>
  );
}

/** Skeleton placeholder */
function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-6 bg-background animate-pulse rounded" />
      ))}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InsightsContent() {
  const marketOpen = isMarketOpen();

  const { data: northBound, loading: northBoundLoading } = useNorthBoundFlow({
    refreshInterval: marketOpen ? 30000 : 60000,
  });
  const { data: indices, loading: indicesLoading } = useMajorIndices({
    refreshInterval: marketOpen ? 10000 : 60000,
  });
  const { data: dragonTiger, loading: dragonTigerLoading } =
    useDragonTigerList({ refreshInterval: 300000, days: 5, limit: 20 });
  const { data: sectors, loading: sectorsLoading } = useSectorCapitalFlow({
    refreshInterval: marketOpen ? 30000 : 120000,
    sectorType: "industry",
    limit: 15,
  });
  const { data: marginData, loading: marginLoading } = useMarginTradingData({
    refreshInterval: 600000,
    days: 7,
  });
  const { data: largeOrders, loading: largeOrdersLoading } =
    useLargeOrderFlow({
      refreshInterval: marketOpen ? 30000 : 120000,
      limit: 20,
    });
  const { data: sentiment, loading: sentimentLoading } = useMarketSentiment({
    refreshInterval: marketOpen ? 60000 : 300000,
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const latestMargin = marginData?.[0];
  const sentimentInfo = sentiment
    ? getSentimentLabel(sentiment.sentimentScore)
    : null;

  // Derived data for capital flow visualization
  const inflowTop = largeOrders
    ? [...largeOrders]
        .sort((a, b) => b.mainNetInflow - a.mainNetInflow)
        .slice(0, 10)
    : [];
  const outflowTop = largeOrders
    ? [...largeOrders]
        .sort((a, b) => a.mainNetInflow - b.mainNetInflow)
        .slice(0, 10)
    : [];
  const maxFlowAbs = largeOrders
    ? Math.max(
        ...largeOrders.map((o) => Math.abs(o.mainNetInflow)),
        1
      )
    : 1;

  // Sector rotation data for visual bar chart
  const sectorMaxAbs = sectors
    ? Math.max(...sectors.map((s) => Math.abs(s.mainNetInflow)), 1)
    : 1;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/50">
          {currentTime.toLocaleString("zh-CN")}
        </div>
        <div
          className={cn(
            "text-xs flex items-center gap-1.5",
            marketOpen ? "text-profit" : "text-white/30"
          )}
        >
          {marketOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
          )}
          {marketOpen ? "交易中" : "已休市"}
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Northbound Capital */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50">北向资金（今日）</span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                marketOpen
                  ? "bg-profit/20 text-profit"
                  : "bg-white/10 text-white/50"
              )}
            >
              {marketOpen ? "实时" : "收盘"}
            </span>
          </div>
          {northBoundLoading ? (
            <div className="h-8 bg-surface animate-pulse rounded" />
          ) : northBound ? (
            <>
              <div
                className={cn(
                  "text-2xl font-bold font-mono tabular-nums",
                  getValueColor(northBound.total)
                )}
              >
                {formatAmount(northBound.total)}
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <div>
                  <span className="text-white/40">沪股通 </span>
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      getValueColor(northBound.shConnect)
                    )}
                  >
                    {formatAmount(northBound.shConnect)}
                  </span>
                </div>
                <div>
                  <span className="text-white/40">深股通 </span>
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      getValueColor(northBound.szConnect)
                    )}
                  >
                    {formatAmount(northBound.szConnect)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-white/30">暂无数据</div>
          )}
        </div>

        {/* Main Capital Flow */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50">主力资金净流入</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
              TOP20汇总
            </span>
          </div>
          {largeOrdersLoading ? (
            <div className="h-8 bg-surface animate-pulse rounded" />
          ) : largeOrders && largeOrders.length > 0 ? (
            (() => {
              const totalMain = largeOrders.reduce(
                (sum, o) => sum + o.mainNetInflow,
                0
              );
              const totalSuper = largeOrders.reduce(
                (sum, o) => sum + o.superLargeNetInflow,
                0
              );
              const totalLarge = largeOrders.reduce(
                (sum, o) => sum + o.largeNetInflow,
                0
              );
              return (
                <>
                  <div
                    className={cn(
                      "text-2xl font-bold font-mono tabular-nums",
                      getValueColor(totalMain)
                    )}
                  >
                    {formatAmount(totalMain)}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <div>
                      <span className="text-white/40">超大单 </span>
                      <span
                        className={cn(
                          "font-mono tabular-nums",
                          getValueColor(totalSuper)
                        )}
                      >
                        {formatAmount(totalSuper)}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/40">大单 </span>
                      <span
                        className={cn(
                          "font-mono tabular-nums",
                          getValueColor(totalLarge)
                        )}
                      >
                        {formatAmount(totalLarge)}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="text-white/30">暂无数据</div>
          )}
        </div>

        {/* Margin Trading */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50">融资融券余额</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50">
              {latestMargin?.tradeDate?.slice(5) ?? "T-1"}
            </span>
          </div>
          {marginLoading ? (
            <div className="h-8 bg-surface animate-pulse rounded" />
          ) : latestMargin ? (
            <>
              <div className="text-2xl font-bold font-mono tabular-nums text-white">
                {formatBalance(latestMargin.totalBalance)}
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <div>
                  <span className="text-white/40">融资余额 </span>
                  <span className="text-white/70 font-mono tabular-nums">
                    {formatBalance(latestMargin.marginBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-white/40">融券余额 </span>
                  <span className="text-white/70 font-mono tabular-nums">
                    {formatBalance(latestMargin.shortBalanceAmount)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-white/30">暂无数据</div>
          )}
        </div>

        {/* Market Sentiment */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50">市场情绪指数</span>
            {sentimentInfo && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  sentimentInfo.color
                )}
              >
                {sentimentInfo.label}
              </span>
            )}
          </div>
          {sentimentLoading ? (
            <div className="h-8 bg-surface animate-pulse rounded" />
          ) : sentiment ? (
            <>
              <div className="text-2xl font-bold font-mono tabular-nums text-accent">
                {sentiment.sentimentScore.toFixed(0)}
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <div>
                  <span className="text-white/40">涨跌比 </span>
                  <span className="text-profit font-mono tabular-nums">
                    {sentiment.upCount}:{sentiment.downCount}
                  </span>
                </div>
                <div>
                  <span className="text-white/40">涨停 </span>
                  <span className="text-profit font-mono tabular-nums">
                    {sentiment.limitUpCount}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-white/30">暂无数据</div>
          )}
        </div>
      </div>

      {/* Dashboard Grid: 2x2 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: Sector Rotation Trend */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            板块轮动趋势
            <span className="text-[10px] text-white/30 font-normal">
              主力净流入
            </span>
          </h3>
          {sectorsLoading ? (
            <CardSkeleton rows={6} />
          ) : sectors && sectors.length > 0 ? (
            <div className="space-y-0.5">
              {sectors.slice(0, 10).map((sector) => (
                <FlowBar
                  key={sector.sectorCode}
                  value={sector.mainNetInflow}
                  maxAbs={sectorMaxAbs}
                  label={sector.sectorName}
                  sublabel={`${sector.changePercent >= 0 ? "+" : ""}${(sector.changePercent * 100).toFixed(2)}%`}
                />
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-sm py-8 text-center">
              暂无数据
            </div>
          )}
        </div>

        {/* Panel 2: Northbound Capital Flow */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            北向资金流向
            <span className="text-[10px] text-white/30 font-normal">
              近期趋势
            </span>
          </h3>
          {marginLoading ? (
            <CardSkeleton rows={6} />
          ) : marginData && marginData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-white/40 border-b border-border">
                    <th className="text-left py-2 font-medium">日期</th>
                    <th className="text-right py-2 font-medium">融资余额</th>
                    <th className="text-right py-2 font-medium">融资净买入</th>
                    <th className="text-right py-2 font-medium">两融余额</th>
                  </tr>
                </thead>
                <tbody>
                  {marginData.slice(0, 7).map((item) => (
                    <tr
                      key={item.tradeDate}
                      className="text-xs border-b border-border/30 hover:bg-white/5"
                    >
                      <td className="py-1.5 text-white/60">
                        {item.tradeDate.slice(5)}
                      </td>
                      <td className="py-1.5 text-right text-white/70 font-mono tabular-nums">
                        {formatBalance(item.marginBalance)}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right font-mono tabular-nums",
                          getValueColor(item.netBuy)
                        )}
                      >
                        {formatAmount(item.netBuy)}
                      </td>
                      <td className="py-1.5 text-right text-white font-mono tabular-nums font-medium">
                        {formatBalance(item.totalBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-white/30 text-sm py-8 text-center">
              暂无数据
            </div>
          )}
        </div>

        {/* Panel 3: Top 10 Capital Inflow */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-profit mb-3 flex items-center gap-2">
            主力资金流入 Top 10
          </h3>
          {largeOrdersLoading ? (
            <CardSkeleton rows={6} />
          ) : inflowTop.length > 0 ? (
            <div className="space-y-0.5">
              {inflowTop.map((item) => (
                <FlowBar
                  key={item.symbol}
                  value={item.mainNetInflow}
                  maxAbs={maxFlowAbs}
                  label={item.name}
                  sublabel={item.symbol}
                />
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-sm py-8 text-center">
              暂无数据
            </div>
          )}
        </div>

        {/* Panel 4: Top 10 Capital Outflow */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-loss mb-3 flex items-center gap-2">
            主力资金流出 Top 10
          </h3>
          {largeOrdersLoading ? (
            <CardSkeleton rows={6} />
          ) : outflowTop.length > 0 ? (
            <div className="space-y-0.5">
              {outflowTop.map((item) => (
                <FlowBar
                  key={item.symbol}
                  value={item.mainNetInflow}
                  maxAbs={maxFlowAbs}
                  label={item.name}
                  sublabel={item.symbol}
                />
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-sm py-8 text-center">
              暂无数据
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: Dragon Tiger + Indices + Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Dragon Tiger List (takes 2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-white mb-3">
            龙虎榜（近5日）
          </h3>
          {dragonTigerLoading ? (
            <CardSkeleton rows={5} />
          ) : dragonTiger && dragonTiger.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-white/40 border-b border-border">
                    <th className="text-left py-2 font-medium">股票</th>
                    <th className="text-left py-2 font-medium">原因</th>
                    <th className="text-right py-2 font-medium">涨跌幅</th>
                    <th className="text-right py-2 font-medium">净买入</th>
                    <th className="text-left py-2 font-medium">日期</th>
                  </tr>
                </thead>
                <tbody>
                  {dragonTiger.slice(0, 10).map((item, idx) => (
                    <tr
                      key={`${item.symbol}-${item.tradeDate}-${idx}`}
                      className="text-xs border-b border-border/30 hover:bg-white/5"
                    >
                      <td className="py-1.5">
                        <div className="text-white font-medium">
                          {item.name}
                        </div>
                        <div className="text-white/30">{item.symbol}</div>
                      </td>
                      <td
                        className="py-1.5 text-white/60 max-w-[120px] truncate"
                        title={item.reason}
                      >
                        {item.reason}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right font-mono tabular-nums",
                          getValueColor(item.changePercent)
                        )}
                      >
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(2)}%
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right font-mono tabular-nums font-medium",
                          getValueColor(item.netBuyAmount)
                        )}
                      >
                        {formatAmount(item.netBuyAmount)}
                      </td>
                      <td className="py-1.5 text-white/40">
                        {item.tradeDate.slice(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-white/30 text-sm py-8 text-center">
              暂无数据
            </div>
          )}
        </div>

        {/* Market Indices + Key Metrics */}
        <div className="space-y-4">
          {/* Market Indices */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-white mb-3">主要指数</h3>
            {indicesLoading ? (
              <CardSkeleton rows={3} />
            ) : indices && indices.length > 0 ? (
              <div className="space-y-2">
                {indices.slice(0, 6).map((idx) => (
                  <div
                    key={idx.symbol}
                    className="flex items-center justify-between py-1.5 px-2 border border-border/50 rounded-lg"
                  >
                    <span className="text-xs text-white/70">{idx.name}</span>
                    <div className="text-right">
                      <div className="text-sm font-mono tabular-nums text-white">
                        {idx.price.toLocaleString()}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-mono tabular-nums",
                          getValueColor(idx.changePercent)
                        )}
                      >
                        {idx.changePercent >= 0 ? "+" : ""}
                        {idx.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/30 text-sm">暂无数据</div>
            )}
          </div>

          {/* Key Metrics */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-white mb-3">关键指标</h3>
            {sentimentLoading ? (
              <CardSkeleton rows={4} />
            ) : sentiment ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">两市成交额</span>
                  <span className="text-sm font-mono tabular-nums text-white">
                    {formatBalance(sentiment.totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">上涨家数</span>
                  <span className="text-sm font-mono tabular-nums text-profit">
                    {sentiment.upCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">下跌家数</span>
                  <span className="text-sm font-mono tabular-nums text-loss">
                    {sentiment.downCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">涨停/跌停</span>
                  <span className="text-sm font-mono tabular-nums">
                    <span className="text-profit">
                      {sentiment.limitUpCount}
                    </span>{" "}
                    /{" "}
                    <span className="text-loss">
                      {sentiment.limitDownCount}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">平均涨跌幅</span>
                  <span
                    className={cn(
                      "text-sm font-mono tabular-nums",
                      getValueColor(sentiment.avgChangePercent)
                    )}
                  >
                    {sentiment.avgChangePercent >= 0 ? "+" : ""}
                    {sentiment.avgChangePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-white/30 text-sm">暂无数据</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
