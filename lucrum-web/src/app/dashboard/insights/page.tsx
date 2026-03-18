"use client";

/**
 * Institutional Insights Page
 * 机构洞察页面
 *
 * Professional-grade market intelligence for institutional investors
 * 面向机构投资者的专业级市场情报
 *
 * Features:
 * - Northbound capital flow (北向资金) - REAL DATA
 * - Margin trading data (融资融券) - REAL DATA
 * - Dragon Tiger List (龙虎榜) - REAL DATA
 * - Large order flow (大单流向) - REAL DATA
 * - Sector rotation analysis (板块轮动) - REAL DATA
 * - Market sentiment (市场情绪) - REAL DATA
 *
 * @module dashboard/insights
 */

import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
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

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Format large numbers to readable format (万/亿)
 * 格式化大数字为可读格式
 */
function formatAmount(num: number): string {
  const absNum = Math.abs(num);
  const sign = num >= 0 ? "+" : "-";
  if (absNum >= 1e8) return `${sign}${(absNum / 1e8).toFixed(2)}亿`;
  if (absNum >= 1e4) return `${sign}${(absNum / 1e4).toFixed(2)}万`;
  return `${sign}${absNum.toFixed(2)}`;
}

/**
 * Format margin balance (万亿/亿/万)
 * 格式化融资融券余额
 */
function formatBalance(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}万亿`;
  if (num >= 1e8) return `${(num / 1e8).toFixed(2)}亿`;
  if (num >= 1e4) return `${(num / 1e4).toFixed(2)}万`;
  return num.toFixed(2);
}

/**
 * Get color class based on value
 * 根据值获取颜色类
 */
function getValueColor(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-white/50";
}

/**
 * Get sentiment label based on score
 * 根据分数获取情绪标签
 */
function getSentimentLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "偏多", color: "bg-profit/20 text-profit" };
  if (score >= 50) return { label: "中性", color: "bg-accent/20 text-accent" };
  if (score >= 30) return { label: "偏空", color: "bg-loss/20 text-loss" };
  return { label: "极度恐慌", color: "bg-loss/30 text-loss" };
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export default function InsightsPage() {
  // Fetch real market data
  // 获取真实市场数据
  const marketOpen = isMarketOpen();

  const { data: northBound, loading: northBoundLoading } = useNorthBoundFlow({
    refreshInterval: marketOpen ? 30000 : 60000,
  });

  const { data: indices, loading: indicesLoading } = useMajorIndices({
    refreshInterval: marketOpen ? 10000 : 60000,
  });

  const { data: dragonTiger, loading: dragonTigerLoading } = useDragonTigerList({
    refreshInterval: 300000, // 5 min
    days: 5,
    limit: 20,
  });

  const { data: sectors, loading: sectorsLoading } = useSectorCapitalFlow({
    refreshInterval: marketOpen ? 30000 : 120000,
    sectorType: "industry",
    limit: 15,
  });

  const { data: marginData, loading: marginLoading } = useMarginTradingData({
    refreshInterval: 600000, // 10 min
    days: 7,
  });

  const { data: largeOrders, loading: largeOrdersLoading } = useLargeOrderFlow({
    refreshInterval: marketOpen ? 30000 : 120000,
    limit: 20,
  });

  const { data: sentiment, loading: sentimentLoading } = useMarketSentiment({
    refreshInterval: marketOpen ? 60000 : 300000,
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState<"capital" | "dragon" | "sector" | "order">("capital");

  // Current time for display
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get latest margin data
  const latestMargin = marginData?.[0];

  // Get sentiment label
  const sentimentInfo = sentiment ? getSentimentLabel(sentiment.sentimentScore) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Unified Dashboard Header */}
      <DashboardHeader />

      {/* Main content */}
      <main className="max-w-[1920px] mx-auto px-3 sm:p-4">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                机构洞察
                <span className="text-base font-normal text-white/50 ml-2">
                  / Institutional Insights
                </span>
              </h1>
              <p className="text-white/60 text-sm">
                专业级市场情报，助力机构投资决策
                <span className="ml-2 text-accent text-xs">（实时数据）</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/50">
                {currentTime.toLocaleString("zh-CN")}
              </div>
              <div className={`text-xs ${marketOpen ? "text-profit" : "text-white/30"}`}>
                {marketOpen ? "交易中" : "已休市"}
              </div>
            </div>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Northbound Capital Card */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">北向资金（今日）</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${marketOpen ? "bg-profit/20 text-profit" : "bg-white/10 text-white/50"}`}>
                {marketOpen ? "实时" : "收盘"}
              </span>
            </div>
            {northBoundLoading ? (
              <div className="h-8 bg-surface animate-pulse rounded" />
            ) : northBound ? (
              <>
                <div className={`text-2xl font-bold font-mono ${getValueColor(northBound.total)}`}>
                  {formatAmount(northBound.total)}
                </div>
                <div className="flex gap-4 mt-2 text-xs">
                  <div>
                    <span className="text-white/40">沪股通 </span>
                    <span className={getValueColor(northBound.shConnect)}>
                      {formatAmount(northBound.shConnect)}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40">深股通 </span>
                    <span className={getValueColor(northBound.szConnect)}>
                      {formatAmount(northBound.szConnect)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-white/30">暂无数据</div>
            )}
          </div>

          {/* Main Capital Flow Card - Using Large Order Data */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">主力资金净流入</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">TOP20汇总</span>
            </div>
            {largeOrdersLoading ? (
              <div className="h-8 bg-surface animate-pulse rounded" />
            ) : largeOrders && largeOrders.length > 0 ? (
              <>
                {(() => {
                  const totalMain = largeOrders.reduce((sum, o) => sum + o.mainNetInflow, 0);
                  const totalSuper = largeOrders.reduce((sum, o) => sum + o.superLargeNetInflow, 0);
                  const totalLarge = largeOrders.reduce((sum, o) => sum + o.largeNetInflow, 0);
                  return (
                    <>
                      <div className={`text-2xl font-bold font-mono ${getValueColor(totalMain)}`}>
                        {formatAmount(totalMain)}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <div>
                          <span className="text-white/40">超大单 </span>
                          <span className={getValueColor(totalSuper)}>{formatAmount(totalSuper)}</span>
                        </div>
                        <div>
                          <span className="text-white/40">大单 </span>
                          <span className={getValueColor(totalLarge)}>{formatAmount(totalLarge)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="text-white/30">暂无数据</div>
            )}
          </div>

          {/* Margin Trading Card */}
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
                <div className="text-2xl font-bold font-mono text-white">
                  {formatBalance(latestMargin.totalBalance)}
                </div>
                <div className="flex gap-4 mt-2 text-xs">
                  <div>
                    <span className="text-white/40">融资余额 </span>
                    <span className="text-white/70">{formatBalance(latestMargin.marginBalance)}</span>
                  </div>
                  <div>
                    <span className="text-white/40">融券余额 </span>
                    <span className="text-white/70">{formatBalance(latestMargin.shortBalanceAmount)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-white/30">暂无数据</div>
            )}
          </div>

          {/* Market Sentiment Card */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">市场情绪指数</span>
              {sentimentInfo && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${sentimentInfo.color}`}>
                  {sentimentInfo.label}
                </span>
              )}
            </div>
            {sentimentLoading ? (
              <div className="h-8 bg-surface animate-pulse rounded" />
            ) : sentiment ? (
              <>
                <div className="text-2xl font-bold font-mono text-accent">
                  {sentiment.sentimentScore.toFixed(0)}
                </div>
                <div className="flex gap-4 mt-2 text-xs">
                  <div>
                    <span className="text-white/40">涨跌比 </span>
                    <span className="text-profit">{sentiment.upCount}:{sentiment.downCount}</span>
                  </div>
                  <div>
                    <span className="text-white/40">涨停 </span>
                    <span className="text-profit">{sentiment.limitUpCount}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-white/30">暂无数据</div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border mb-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab("capital")}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === "capital"
                ? "text-accent border-b-2 border-accent"
                : "text-white/50 hover:text-white"
            }`}
          >
            资金流向
          </button>
          <button
            onClick={() => setActiveTab("dragon")}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === "dragon"
                ? "text-accent border-b-2 border-accent"
                : "text-white/50 hover:text-white"
            }`}
          >
            龙虎榜
          </button>
          <button
            onClick={() => setActiveTab("sector")}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === "sector"
                ? "text-accent border-b-2 border-accent"
                : "text-white/50 hover:text-white"
            }`}
          >
            板块轮动
          </button>
          <button
            onClick={() => setActiveTab("order")}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === "order"
                ? "text-accent border-b-2 border-accent"
                : "text-white/50 hover:text-white"
            }`}
          >
            大单流向
          </button>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main Content Area */}
          <div className="lg:col-span-9">
            <div className="bg-surface rounded-xl border border-border">
              {/* Capital Flow Tab */}
              {activeTab === "capital" && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-white/50 border-b border-border">
                        <th className="text-left px-4 py-3 font-medium">日期</th>
                        <th className="text-right px-4 py-3 font-medium">融资余额</th>
                        <th className="text-right px-4 py-3 font-medium">融资买入</th>
                        <th className="text-right px-4 py-3 font-medium">融资净买入</th>
                        <th className="text-right px-4 py-3 font-medium">融券余额</th>
                        <th className="text-right px-4 py-3 font-medium">两融余额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marginLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                            加载中...
                          </td>
                        </tr>
                      ) : marginData && marginData.length > 0 ? (
                        marginData.map((item) => (
                          <tr key={item.tradeDate} className="text-sm border-b border-border/50 hover:bg-white/5">
                            <td className="px-4 py-3 text-white/70">{item.tradeDate}</td>
                            <td className="px-4 py-3 text-right text-white/70 font-mono">
                              {formatBalance(item.marginBalance)}
                            </td>
                            <td className="px-4 py-3 text-right text-white/70 font-mono">
                              {formatBalance(item.marginBuy)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${getValueColor(item.netBuy)}`}>
                              {formatAmount(item.netBuy)}
                            </td>
                            <td className="px-4 py-3 text-right text-white/70 font-mono">
                              {formatBalance(item.shortBalanceAmount)}
                            </td>
                            <td className="px-4 py-3 text-right text-white font-mono font-medium">
                              {formatBalance(item.totalBalance)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                            暂无数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Dragon Tiger Tab */}
              {activeTab === "dragon" && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-white/50 border-b border-border">
                        <th className="text-left px-4 py-3 font-medium">股票</th>
                        <th className="text-left px-4 py-3 font-medium">上榜原因</th>
                        <th className="text-right px-4 py-3 font-medium">涨跌幅</th>
                        <th className="text-right px-4 py-3 font-medium">买入金额</th>
                        <th className="text-right px-4 py-3 font-medium">卖出金额</th>
                        <th className="text-right px-4 py-3 font-medium">净买入</th>
                        <th className="text-left px-4 py-3 font-medium">日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dragonTigerLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-white/30">
                            加载中...
                          </td>
                        </tr>
                      ) : dragonTiger && dragonTiger.length > 0 ? (
                        dragonTiger.map((item, idx) => (
                          <tr key={`${item.symbol}-${item.tradeDate}-${idx}`} className="text-sm border-b border-border/50 hover:bg-white/5">
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{item.name}</div>
                              <div className="text-xs text-white/40">{item.symbol}</div>
                            </td>
                            <td className="px-4 py-3 text-white/70 text-xs max-w-[150px] truncate" title={item.reason}>
                              {item.reason}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${getValueColor(item.changePercent)}`}>
                              {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 text-right text-profit font-mono">
                              {formatAmount(item.buyAmount)}
                            </td>
                            <td className="px-4 py-3 text-right text-loss font-mono">
                              {formatAmount(-item.sellAmount)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono font-medium ${getValueColor(item.netBuyAmount)}`}>
                              {formatAmount(item.netBuyAmount)}
                            </td>
                            <td className="px-4 py-3 text-white/50">{item.tradeDate}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-white/30">
                            暂无数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sector Rotation Tab */}
              {activeTab === "sector" && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-white/50 border-b border-border">
                        <th className="text-left px-4 py-3 font-medium">板块名称</th>
                        <th className="text-right px-4 py-3 font-medium">涨跌幅</th>
                        <th className="text-right px-4 py-3 font-medium">主力净流入</th>
                        <th className="text-right px-4 py-3 font-medium">主力占比</th>
                        <th className="text-left px-4 py-3 font-medium">领涨股</th>
                        <th className="text-right px-4 py-3 font-medium">领涨股涨幅</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorsLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                            加载中...
                          </td>
                        </tr>
                      ) : sectors && sectors.length > 0 ? (
                        sectors.map((sector) => (
                          <tr key={sector.sectorCode} className="text-sm border-b border-border/50 hover:bg-white/5">
                            <td className="px-4 py-3 text-white font-medium">{sector.sectorName}</td>
                            <td className={`px-4 py-3 text-right font-mono font-medium ${getValueColor(sector.changePercent)}`}>
                              {sector.changePercent >= 0 ? "+" : ""}{(sector.changePercent * 100).toFixed(2)}%
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${getValueColor(sector.mainNetInflow)}`}>
                              {formatAmount(sector.mainNetInflow)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${getValueColor(sector.mainNetInflowPercent)}`}>
                              {sector.mainNetInflowPercent >= 0 ? "+" : ""}{sector.mainNetInflowPercent.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 text-white">{sector.leadingStock}</td>
                            <td className={`px-4 py-3 text-right font-mono ${getValueColor(sector.leadingStockChange)}`}>
                              {sector.leadingStockChange >= 0 ? "+" : ""}{(sector.leadingStockChange * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                            暂无数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Large Order Flow Tab */}
              {activeTab === "order" && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-white/50 border-b border-border">
                        <th className="text-left px-4 py-3 font-medium">股票</th>
                        <th className="text-right px-4 py-3 font-medium">现价</th>
                        <th className="text-right px-4 py-3 font-medium">涨跌幅</th>
                        <th className="text-right px-4 py-3 font-medium">超大单</th>
                        <th className="text-right px-4 py-3 font-medium">大单</th>
                        <th className="text-right px-4 py-3 font-medium">主力净流入</th>
                      </tr>
                    </thead>
                    <tbody>
                      {largeOrdersLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                            加载中...
                          </td>
                        </tr>
                      ) : largeOrders && largeOrders.length > 0 ? (
                        largeOrders.map((item) => (
                          <tr key={item.symbol} className="text-sm border-b border-border/50 hover:bg-white/5">
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{item.name}</div>
                              <div className="text-xs text-white/40">{item.symbol}</div>
                            </td>
                            <td className="px-4 py-3 text-right text-white font-mono">
                              {item.price.toFixed(2)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${getValueColor(item.changePercent)}`}>
                              {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${getValueColor(item.superLargeNetInflow)}`}>
                              {formatAmount(item.superLargeNetInflow)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${getValueColor(item.largeNetInflow)}`}>
                              {formatAmount(item.largeNetInflow)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono font-medium ${getValueColor(item.mainNetInflow)}`}>
                              {formatAmount(item.mainNetInflow)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                            暂无数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Quick Indicators */}
          <div className="lg:col-span-3 space-y-4">
            {/* Market Indices */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium text-white mb-3">主要指数</h3>
              {indicesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-background animate-pulse rounded" />
                  ))}
                </div>
              ) : indices && indices.length > 0 ? (
                <div className="space-y-2">
                  {indices.slice(0, 6).map((idx) => (
                    <div key={idx.symbol} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-xs text-white/70">{idx.name}</span>
                      <div className="text-right">
                        <div className="text-sm font-mono text-white">{idx.price.toLocaleString()}</div>
                        <div className={`text-xs font-mono ${getValueColor(idx.changePercent)}`}>
                          {idx.changePercent >= 0 ? "+" : ""}{idx.changePercent.toFixed(2)}%
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
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-6 bg-background animate-pulse rounded" />
                  ))}
                </div>
              ) : sentiment ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">两市成交额</span>
                    <span className="text-sm font-mono text-white">
                      {formatBalance(sentiment.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">上涨家数</span>
                    <span className="text-sm font-mono text-profit">{sentiment.upCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">下跌家数</span>
                    <span className="text-sm font-mono text-loss">{sentiment.downCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">涨停家数</span>
                    <span className="text-sm font-mono text-profit">{sentiment.limitUpCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">跌停家数</span>
                    <span className="text-sm font-mono text-loss">{sentiment.limitDownCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">平均涨跌幅</span>
                    <span className={`text-sm font-mono ${getValueColor(sentiment.avgChangePercent)}`}>
                      {sentiment.avgChangePercent >= 0 ? "+" : ""}{sentiment.avgChangePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-white/30 text-sm">暂无数据</div>
              )}
            </div>

            {/* Data Source Info */}
            <div className="bg-accent/5 rounded-xl border border-accent/20 p-4">
              <h3 className="text-sm font-medium text-accent mb-2">数据来源</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                数据来源于东方财富API，实时更新。交易时段每30秒刷新，非交易时段每分钟刷新。
                部分数据存在延迟，仅供参考。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
