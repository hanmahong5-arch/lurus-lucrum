"use client";

/**
 * K-Line Chart Component using TradingView Lightweight Charts
 * 使用 TradingView Lightweight Charts 的 K 线图组件
 *
 * REWRITTEN for proper timeframe switching:
 * - Timeframe changes trigger immediate data refresh
 * - Loading overlay shows during data fetch
 * - Error state with retry button
 * - Data source indicator (real/mock)
 *
 * @module components/charts/kline-chart
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
  CrosshairMode,
  ColorType,
  LineData,
  type SeriesMarker,
  type SeriesMarkerPosition,
  type SeriesMarkerShape,
} from "lightweight-charts";
import {
  useKLineData,
  type TimeFrame,
  type KLineData,
  TIMEFRAME_LABELS,
} from "@/hooks/use-kline-data";
import {
  getTradingStatusInfo,
  getDataTimestampLabel,
  isMarketOpen,
} from "@/lib/trading/time-utils";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

// Chart theme colors matching Lucrum brand
const CHART_COLORS = {
  background: "#0f1117",
  text: "rgba(255, 255, 255, 0.6)",
  grid: "rgba(255, 255, 255, 0.06)",
  upColor: "#10b981", // Green for gains
  downColor: "#ef4444", // Red for losses
  volumeUp: "rgba(16, 185, 129, 0.5)",
  volumeDown: "rgba(239, 68, 68, 0.5)",
  crosshair: "#f5a623", // Gold accent
};

// MA line colors
const MA_COLORS = ["#f5a623", "#3b82f6", "#a855f7", "#ec4899"];

// Time frame options for display
export const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: "1m", label: "1分" },
  { value: "5m", label: "5分" },
  { value: "15m", label: "15分" },
  { value: "30m", label: "30分" },
  { value: "60m", label: "1小时" },
  { value: "1d", label: "日线" },
  { value: "1w", label: "周线" },
];

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Trade marker data for displaying buy/sell signals on the K-line chart
 */
export interface TradeMarkerInfo {
  timestamp: number;         // Unix timestamp (seconds)
  type: "buy" | "sell";
  executePrice: number;
  signalPrice: number;
  quantity: number;
  lots: number;
  commission: number;
  slippage: number;
  triggerReason: string;
  indicatorValues: Record<string, number>;
  pnl?: number;              // Sell trades only
  pnlPercent?: number;
  holdingDays?: number;
}

export interface KLineChartProps {
  // Data source
  symbol: string;
  initialTimeFrame?: TimeFrame;

  // External data (optional - if not provided, will fetch internally)
  externalData?: KLineData[];

  // Trade markers from backtest results
  tradeMarkers?: TradeMarkerInfo[];

  // Display options
  height?: number;
  showVolume?: boolean;
  showMA?: boolean;
  maWindows?: number[];

  // Callbacks
  onTimeFrameChange?: (timeframe: TimeFrame) => void;
  onSymbolChange?: (symbol: string) => void;
  onDataUpdate?: (data: KLineData[]) => void;
}

interface CrosshairData {
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  time: string | null;
}

// =============================================================================
// INDICATOR CALCULATIONS / 指标计算
// =============================================================================

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(
  data: CandlestickData<Time>[],
  window: number,
): LineData<Time>[] {
  const result: LineData<Time>[] = [];

  for (let i = window - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < window; j++) {
      const item = data[i - j];
      if (item) {
        sum += item.close;
      }
    }
    const currentItem = data[i];
    if (currentItem) {
      result.push({
        time: currentItem.time,
        value: parseFloat((sum / window).toFixed(2)),
      });
    }
  }

  return result;
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function KLineChart({
  symbol,
  initialTimeFrame = "1d",
  externalData,
  tradeMarkers,
  height = 500,
  showVolume = true,
  showMA = true,
  maWindows = [5, 20, 60],
  onTimeFrameChange,
  onSymbolChange,
  onDataUpdate,
}: KLineChartProps) {
  // State - selectedTimeFrame is the KEY state that triggers data refetch
  const [selectedTimeFrame, setSelectedTimeFrame] =
    useState<TimeFrame>(initialTimeFrame);
  const [crosshairData, setCrosshairData] = useState<CrosshairData>({
    price: null,
    open: null,
    high: null,
    low: null,
    change: null,
    changePercent: null,
    volume: null,
    time: null,
  });

  // Active trade marker for hover tooltip
  const [activeTradeMarker, setActiveTradeMarker] = useState<TradeMarkerInfo | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Track whether chart is initialized and hydration complete
  const [chartInitialized, setChartInitialized] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Use ref to prevent re-initialization
  const isInitializingRef = useRef(false);

  // Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRefs = useRef<ISeriesApi<"Line">[]>([]);

  // Fetch K-line data using hook
  // KEY: This hook will refetch when symbol or selectedTimeFrame changes
  const {
    data: fetchedData,
    loading,
    error,
    lastUpdate,
    source,
    isMock,
    refresh,
  } = useKLineData({
    symbol,
    timeframe: selectedTimeFrame,
    count: 200,
    autoRefresh: true,
    refreshInterval: isMarketOpen() ? 5000 : 60000,
  });

  // Use external data if provided, otherwise use fetched data
  const klineData = externalData ?? fetchedData;

  // Build a lookup map from timestamp → TradeMarkerInfo for crosshair hover
  const tradesByTime = useMemo(() => {
    if (!tradeMarkers || tradeMarkers.length === 0) return new Map<number, TradeMarkerInfo>();
    const map = new Map<number, TradeMarkerInfo>();
    for (const marker of tradeMarkers) {
      map.set(marker.timestamp, marker);
    }
    return map;
  }, [tradeMarkers]);

  // Use a ref so the crosshairMove closure always accesses the latest map
  const tradesByTimeRef = useRef(tradesByTime);
  useEffect(() => {
    tradesByTimeRef.current = tradesByTime;
  }, [tradesByTime]);

  // Hydration safety - only run client-side code after mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get trading status for display (only on client to avoid hydration mismatch)
  const tradingStatus = isClient
    ? getTradingStatusInfo()
    : { label: "", color: "gray" as const };
  const dataTimestamp = isClient ? getDataTimestampLabel() : "";

  // Convert KLineData to chart format
  const chartData = useMemo(() => {
    if (!klineData || klineData.length === 0)
      return { candles: [], volumes: [] };

    const candles: CandlestickData<Time>[] = klineData.map((item) => ({
      time: item.time as Time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));

    const volumes: HistogramData<Time>[] = klineData.map((item) => ({
      time: item.time as Time,
      value: item.volume,
      color:
        item.close >= item.open
          ? CHART_COLORS.volumeUp
          : CHART_COLORS.volumeDown,
    }));

    return { candles, volumes };
  }, [klineData]);

  // Handle timeframe change - THIS IS THE KEY HANDLER
  const handleTimeFrameChange = useCallback(
    (tf: TimeFrame) => {
      console.log(
        `[KLineChart] Timeframe button clicked: ${selectedTimeFrame} -> ${tf}`,
      );

      if (tf === selectedTimeFrame) {
        // Same timeframe - just refresh
        console.log(`[KLineChart] Same timeframe, refreshing...`);
        refresh();
        return;
      }

      // Different timeframe - update state
      // This will trigger useKLineData to refetch due to dependency change
      setSelectedTimeFrame(tf);
      onTimeFrameChange?.(tf);
    },
    [selectedTimeFrame, onTimeFrameChange, refresh],
  );

  // Initialize chart (only once, after hydration)
  useEffect(() => {
    // Wait for client-side hydration to complete
    // Use ref to prevent multiple initializations
    if (!isClient || chartInitialized || isInitializingRef.current) return;

    // Mark as initializing to prevent re-entry
    isInitializingRef.current = true;

    // Use requestAnimationFrame to ensure DOM is ready
    let cancelled = false;
    let resizeTimeout: NodeJS.Timeout;
    let chart: IChartApi | null = null;

    const initChart = () => {
      if (cancelled || !chartContainerRef.current) {
        isInitializingRef.current = false;
        return;
      }

      const rect = chartContainerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Retry on next frame if container not ready
        requestAnimationFrame(initChart);
        return;
      }

      console.log(
        `[KLineChart] Initializing chart for ${symbol}, container: ${rect.width}x${rect.height}`,
      );

      // Create chart instance
      chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: height,
        layout: {
          background: { type: ColorType.Solid, color: CHART_COLORS.background },
          textColor: CHART_COLORS.text,
        },
        grid: {
          vertLines: { color: CHART_COLORS.grid },
          horzLines: { color: CHART_COLORS.grid },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: CHART_COLORS.crosshair,
            width: 1,
            style: 2,
            labelBackgroundColor: CHART_COLORS.crosshair,
          },
          horzLine: {
            color: CHART_COLORS.crosshair,
            width: 1,
            style: 2,
            labelBackgroundColor: CHART_COLORS.crosshair,
          },
        },
        rightPriceScale: {
          borderColor: CHART_COLORS.grid,
          scaleMargins: {
            top: 0.1,
            bottom: showVolume ? 0.25 : 0.1,
          },
        },
        timeScale: {
          borderColor: CHART_COLORS.grid,
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;

      // Add candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: CHART_COLORS.upColor,
        downColor: CHART_COLORS.downColor,
        borderVisible: false,
        wickUpColor: CHART_COLORS.upColor,
        wickDownColor: CHART_COLORS.downColor,
      });
      candleSeriesRef.current = candleSeries;

      // Add volume series
      if (showVolume) {
        const volumeSeries = chart.addHistogramSeries({
          color: CHART_COLORS.volumeUp,
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;
      }

      // Add MA lines
      if (showMA) {
        maSeriesRefs.current = maWindows.map((_, index) => {
          return chart!.addLineSeries({
            color: MA_COLORS[index % MA_COLORS.length],
            lineWidth: 1,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          });
        });
      }

      // Handle crosshair move
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData) {
          setCrosshairData({
            price: null,
            open: null,
            high: null,
            low: null,
            change: null,
            changePercent: null,
            volume: null,
            time: null,
          });
          setActiveTradeMarker(null);
          setTooltipPosition(null);
          return;
        }

        const candleData = param.seriesData.get(candleSeries) as
          | CandlestickData<Time>
          | undefined;
        const volumeData = volumeSeriesRef.current
          ? (param.seriesData.get(volumeSeriesRef.current) as
              | HistogramData<Time>
              | undefined)
          : undefined;

        if (candleData) {
          const change = candleData.close - candleData.open;
          const changePercent = (change / candleData.open) * 100;

          // Format time
          const date = new Date((param.time as number) * 1000);
          const timeStr = date.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });

          setCrosshairData({
            price: candleData.close,
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            volume: volumeData?.value ?? null,
            time: timeStr,
          });

          // Check if there's a trade marker at this timestamp
          const ts = param.time as number;
          const tradeAtTime = tradesByTimeRef.current.get(ts);
          if (tradeAtTime) {
            setActiveTradeMarker(tradeAtTime);
            setTooltipPosition(
              param.point ? { x: param.point.x, y: param.point.y } : null
            );
          } else {
            setActiveTradeMarker(null);
            setTooltipPosition(null);
          }
        }
      });

      // Handle resize with debounce to prevent flashing
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        }, 150);
      };
      window.addEventListener("resize", handleResize);

      setChartInitialized(true);
    };

    // Start initialization on next frame
    requestAnimationFrame(initChart);

    // Cleanup - only runs on unmount
    return () => {
      cancelled = true;
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", () => {});
      if (chart) {
        chart.remove();
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      maSeriesRefs.current = [];
      isInitializingRef.current = false;
      setChartInitialized(false);
    };
    // Only depend on isClient - chart should initialize once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  // Update chart data when data changes - THIS IS THE KEY EFFECT
  useEffect(() => {
    if (!candleSeriesRef.current || !chartInitialized) {
      console.log(`[KLineChart] Chart not ready, skipping data update`);
      return;
    }

    if (chartData.candles.length === 0) {
      console.log(`[KLineChart] No data to display`);
      return;
    }

    console.log(
      `[KLineChart] Updating chart with ${chartData.candles.length} bars ` +
        `for ${symbol} ${selectedTimeFrame} (source: ${source}${isMock ? " mock" : ""})`,
    );

    // Clear and set new candlestick data
    candleSeriesRef.current.setData(chartData.candles);

    // Set trade markers (buy/sell signals from backtest)
    if (tradeMarkers && tradeMarkers.length > 0) {
      const markers: SeriesMarker<Time>[] = tradeMarkers
        .filter((m) => m.timestamp > 0)
        .map((m) => ({
          time: m.timestamp as Time,
          position: (m.type === "buy" ? "belowBar" : "aboveBar") as SeriesMarkerPosition,
          shape: (m.type === "buy" ? "arrowUp" : "arrowDown") as SeriesMarkerShape,
          color: m.type === "buy" ? "#ef4444" : "#10b981", // CN convention: red=buy, green=sell
          text: m.type === "buy" ? "B" : "S",
          size: 1,
        }))
        // Sort ascending by time (required by lightweight-charts)
        .sort((a, b) => (a.time as number) - (b.time as number));
      candleSeriesRef.current.setMarkers(markers);
    } else {
      candleSeriesRef.current.setMarkers([]);
    }

    // Update volume data
    if (showVolume && volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(chartData.volumes);
    }

    // Update MA lines
    if (showMA) {
      maWindows.forEach((window, index) => {
        const maData = calculateSMA(chartData.candles, window);
        maSeriesRefs.current[index]?.setData(maData);
      });
    }

    // Fit content to show all data
    chartRef.current?.timeScale().fitContent();

    // Notify parent of data update
    onDataUpdate?.(klineData);
  }, [
    chartData,
    showVolume,
    showMA,
    maWindows,
    klineData,
    onDataUpdate,
    chartInitialized,
    symbol,
    selectedTimeFrame,
    source,
    isMock,
    tradeMarkers,
  ]);

  // Format volume for display
  const formatVolume = useCallback((value: number | null): string => {
    if (value === null) return "-";
    if (value >= 100000000) return (value / 100000000).toFixed(2) + "亿";
    if (value >= 10000) return (value / 10000).toFixed(2) + "万";
    if (value >= 1000) return (value / 1000).toFixed(2) + "K";
    return value.toString();
  }, []);

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden relative">
      {/* Loading Overlay - Shows during data fetch */}
      {loading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-3">
            <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-white text-sm">
              加载{" "}
              {TIMEFRAME_LABELS[selectedTimeFrame]?.zh || selectedTimeFrame}{" "}
              数据...
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          {/* Symbol and timeframe */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">{symbol}</span>
            <span className="text-xs text-white/40 uppercase">
              {TIMEFRAME_LABELS[selectedTimeFrame]?.zh || selectedTimeFrame}
            </span>
          </div>

          {/* Trading status indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
              tradingStatus.color === "green"
                ? "bg-profit/20 text-profit"
                : tradingStatus.color === "yellow"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-white/10 text-white/50"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                tradingStatus.color === "green"
                  ? "bg-profit animate-pulse"
                  : tradingStatus.color === "yellow"
                    ? "bg-yellow-400"
                    : "bg-white/30"
              }`}
            />
            {tradingStatus.label}
          </div>

          {/* Data source indicator */}
          {isMock && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              模拟数据
            </div>
          )}

          {/* OHLCV info from crosshair */}
          {crosshairData.price !== null && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-white/50">
                O:{" "}
                <span className="text-white">
                  {crosshairData.open?.toFixed(2)}
                </span>
              </span>
              <span className="text-white/50">
                H:{" "}
                <span className="text-white">
                  {crosshairData.high?.toFixed(2)}
                </span>
              </span>
              <span className="text-white/50">
                L:{" "}
                <span className="text-white">
                  {crosshairData.low?.toFixed(2)}
                </span>
              </span>
              <span className="text-white/50">
                C:{" "}
                <span
                  className={`font-medium ${
                    (crosshairData.change ?? 0) >= 0
                      ? "text-profit"
                      : "text-loss"
                  }`}
                >
                  {crosshairData.price.toFixed(2)}
                </span>
              </span>
              <span
                className={`${
                  (crosshairData.change ?? 0) >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {(crosshairData.change ?? 0) >= 0 ? "+" : ""}
                {crosshairData.change?.toFixed(2)} (
                {crosshairData.changePercent?.toFixed(2)}%)
              </span>
              <span className="text-white/50">
                Vol: {formatVolume(crosshairData.volume)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Data timestamp */}
          <span className="text-xs text-white/40">{dataTimestamp}</span>

          {/* Data source */}
          {source !== "none" && !isMock && (
            <span className="text-xs text-white/30">{source}</span>
          )}

          {/* Refresh button */}
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded transition disabled:opacity-50"
            title="刷新数据"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Time frame selector */}
          <div className="flex items-center gap-1">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => handleTimeFrameChange(tf.value)}
                disabled={loading}
                className={`px-3 py-1 text-xs rounded transition ${
                  selectedTimeFrame === tf.value
                    ? "bg-accent text-primary-600 font-medium"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                } disabled:opacity-50`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MA Legend */}
      {showMA && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border">
          {maWindows.map((window, index) => (
            <div key={window} className="flex items-center gap-1 text-xs">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: MA_COLORS[index % MA_COLORS.length] }}
              />
              <span style={{ color: MA_COLORS[index % MA_COLORS.length] }}>
                MA{window}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error message with retry */}
      {error && (
        <div className="px-4 py-3 bg-loss/10 border-b border-loss/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-loss"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm text-loss">{error}</span>
          </div>
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="px-3 py-1 bg-loss/20 text-loss text-xs rounded hover:bg-loss/30 transition disabled:opacity-50"
          >
            重试
          </button>
        </div>
      )}

      {/* Chart container - Fixed height and background to prevent flashing */}
      <div
        ref={chartContainerRef}
        className="w-full bg-[#0f1117] relative"
        style={{ height: `${height}px`, minHeight: `${height}px` }}
      >
        {/* Trade marker hover tooltip */}
        {activeTradeMarker && tooltipPosition && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: Math.min(tooltipPosition.x + 12, (chartContainerRef.current?.clientWidth ?? 0) - 260),
              top: Math.max(tooltipPosition.y - 20, 8),
            }}
          >
            <TradeTooltip marker={activeTradeMarker} />
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export types for convenience
export type { TimeFrame, KLineData };

// =============================================================================
// TRADE TOOLTIP / 交易标记详情浮层
// =============================================================================

function TradeTooltip({ marker }: { marker: TradeMarkerInfo }) {
  const isBuy = marker.type === "buy";
  const date = new Date(marker.timestamp * 1000).toLocaleDateString("zh-CN");

  const indicatorEntries = Object.entries(marker.indicatorValues).slice(0, 4);

  return (
    <div className="w-60 rounded-lg border shadow-xl text-xs"
      style={{
        background: "rgba(15,17,23,0.97)",
        borderColor: isBuy ? "rgba(239,68,68,0.5)" : "rgba(16,185,129,0.5)",
      }}
    >
      {/* Header — CN convention: red=buy, green=sell */}
      <div
        className="px-3 py-2 rounded-t-lg flex items-center justify-between"
        style={{ background: isBuy ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)" }}
      >
        <span
          className="font-bold text-sm"
          style={{ color: isBuy ? "#ef4444" : "#10b981" }}
        >
          {isBuy ? "▲ 买入" : "▼ 卖出"}
        </span>
        <span className="text-white/50">{date}</span>
      </div>

      {/* Execution info */}
      <div className="px-3 py-2 space-y-1 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex justify-between">
          <span className="text-white/40">成交价</span>
          <span className="text-white font-mono tabular-nums">
            ¥{marker.executePrice.toFixed(2)}
            <span className="text-white/30 ml-1 text-[10px]">
              (信号 ¥{marker.signalPrice.toFixed(2)})
            </span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">数量</span>
          <span className="text-white font-mono tabular-nums">
            {marker.quantity.toLocaleString()} 股（{marker.lots} 手）
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">交易成本</span>
          <span className="text-white/60 font-mono tabular-nums">
            ¥{(marker.commission + marker.slippage).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Trigger reason */}
      <div className="px-3 py-2 space-y-1 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="text-white/30 text-[10px] uppercase tracking-wide">触发依据</div>
        <div className="text-white/70 leading-relaxed break-words">
          {marker.triggerReason || "—"}
        </div>
        {indicatorEntries.length > 0 && (
          <div className="text-white/40 font-mono tabular-nums text-[10px] mt-1">
            {indicatorEntries.map(([k, v]) => `${k}=${v.toFixed(2)}`).join("  /  ")}
          </div>
        )}
      </div>

      {/* P&L — sell trades only */}
      {!isBuy && marker.pnl !== undefined && (
        <div className="px-3 py-2">
          <div className="text-white/30 text-[10px] uppercase tracking-wide mb-1">盈亏</div>
          <div className="flex items-center gap-3">
            {marker.holdingDays !== undefined && (
              <span className="text-white/40">持仓 {marker.holdingDays} 天</span>
            )}
            <span
              className="font-mono tabular-nums font-medium"
              style={{ color: (marker.pnl ?? 0) >= 0 ? "#10b981" : "#ef4444" }}
            >
              {(marker.pnl ?? 0) >= 0 ? "+" : ""}¥{(marker.pnl ?? 0).toFixed(2)}
              {marker.pnlPercent !== undefined && (
                <span className="ml-1">
                  ({marker.pnlPercent >= 0 ? "+" : ""}{marker.pnlPercent.toFixed(2)}%)
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
