"use client";

/**
 * K-Line Chart Component using TradingView Lightweight Charts
 *
 * Features:
 * - Candlestick chart with volume overlay and MA lines
 * - MACD / RSI indicator sub-panels (separate synced chart instances)
 * - Enhanced trade markers showing short reason + price/P&L
 * - Trade narrative panel on marker click
 * - Trade list <-> chart scroll interaction via imperative handle
 * - Timeframe switching with live data refresh
 *
 * @module components/charts/kline-chart
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
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
import type { BacktestDailyLog } from "@/lib/backtest/types";
import { TradeNarrative } from "@/components/backtest/trade-narrative";
import { useThemeRgb } from "@/lib/theme";

// =============================================================================
// CONSTANTS
// =============================================================================

// Candle / volume colors follow the [data-market] dimension, not the theme —
// CN traders read red-up/green-down, US traders read green-up/red-down, and
// both conventions are independent of the visual theme. Kept as resolved hex
// because lightweight-charts does not parse CSS variables.
const CANDLE_UP_COLOR = "#10b981";
const CANDLE_DOWN_COLOR = "#ef4444";
const VOLUME_UP_COLOR = "rgba(16, 185, 129, 0.5)";
const VOLUME_DOWN_COLOR = "rgba(239, 68, 68, 0.5)";

const MA_COLORS = ["#f5a623", "#3b82f6", "#a855f7", "#ec4899"];

// Indicator sub-panel colors
const INDICATOR_COLORS = {
  macdDif: "#3b82f6",
  macdDea: "#f97316",
  macdHistPositive: "rgba(239, 68, 68, 0.7)",
  macdHistNegative: "rgba(16, 185, 129, 0.7)",
  rsiLine: "#8b5cf6",
  rsiOverbought: "rgba(239, 68, 68, 0.3)",
  rsiOversold: "rgba(16, 185, 129, 0.3)",
};

// Sub-panel heights
const MACD_PANEL_HEIGHT = 120;
const RSI_PANEL_HEIGHT = 100;

export const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: "1m", label: "1\u5206" },
  { value: "5m", label: "5\u5206" },
  { value: "15m", label: "15\u5206" },
  { value: "30m", label: "30\u5206" },
  { value: "60m", label: "1\u5c0f\u65f6" },
  { value: "1d", label: "\u65e5\u7ebf" },
  { value: "1w", label: "\u5468\u7ebf" },
];

// =============================================================================
// TYPES
// =============================================================================

export interface TradeMarkerInfo {
  timestamp: number;
  type: "buy" | "sell";
  executePrice: number;
  signalPrice: number;
  quantity: number;
  lots: number;
  commission: number;
  slippage: number;
  triggerReason: string;
  indicatorValues: Record<string, number>;
  pnl?: number;
  pnlPercent?: number;
  holdingDays?: number;
}

/** Imperative handle exposed to parent via ref */
export interface KLineChartHandle {
  scrollToTrade: (timestamp: number) => void;
}

export interface KLineChartProps {
  symbol: string;
  initialTimeFrame?: TimeFrame;
  externalData?: KLineData[];

  /** Trade markers from backtest results */
  tradeMarkers?: TradeMarkerInfo[];

  /** Daily indicator logs from backtest engine for sub-panels */
  dailyLogs?: BacktestDailyLog[];

  /** Which indicator sub-panels to show (auto-detected from dailyLogs if omitted) */
  showIndicators?: ("macd" | "rsi")[];

  height?: number;
  showVolume?: boolean;
  showMA?: boolean;
  maWindows?: number[];

  /** Called when user clicks a trade marker on the chart */
  onTradeSelect?: (trade: TradeMarkerInfo | null) => void;

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
// HELPERS
// =============================================================================

/**
 * Extract the core 2-4 character Chinese keyword from a trigger reason string.
 * A trader seeing the marker + keyword should immediately understand the signal.
 */
function getShortReason(reason: string): string {
  if (reason.includes("\u91d1\u53c9")) return "\u91d1\u53c9";
  if (reason.includes("\u6b7b\u53c9")) return "\u6b7b\u53c9";
  if (reason.includes("\u8d85\u5356")) return "\u8d85\u5356";
  if (reason.includes("\u8d85\u4e70")) return "\u8d85\u4e70";
  if (reason.includes("\u7a81\u7834")) return "\u7a81\u7834";
  if (reason.includes("\u8dcc\u7834")) return "\u8dcc\u7834";
  if (reason.includes("\u53cd\u5f39")) return "\u53cd\u5f39";
  if (reason.includes("\u56de\u8c03")) return "\u56de\u8c03";
  if (reason.includes("\u6b62\u635f")) return "\u6b62\u635f";
  if (reason.includes("\u6b62\u76c8")) return "\u6b62\u76c8";
  if (reason.includes("\u653e\u91cf")) return "\u653e\u91cf";
  if (reason.includes("\u7f29\u91cf")) return "\u7f29\u91cf";
  return "\u4fe1\u53f7";
}

/**
 * Build the marker text shown on the chart.
 * Buy: "金叉 ¥1,720"  Sell: "+8.3%"
 */
function buildMarkerText(marker: TradeMarkerInfo): string {
  if (marker.type === "buy") {
    const keyword = getShortReason(marker.triggerReason);
    const price =
      marker.executePrice >= 1000
        ? `\u00a5${Math.round(marker.executePrice).toLocaleString()}`
        : `\u00a5${marker.executePrice.toFixed(1)}`;
    return `${keyword} ${price}`;
  }
  // Sell: show P&L percentage
  if (marker.pnlPercent !== undefined && isFinite(marker.pnlPercent)) {
    const sign = marker.pnlPercent > 0 ? "+" : "";
    return `${sign}${marker.pnlPercent.toFixed(1)}%`;
  }
  return `\u00a5${marker.executePrice.toFixed(0)}`;
}

/**
 * Calculate Simple Moving Average from candlestick data
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
      if (item) sum += item.close;
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

/**
 * Detect which indicators have data in the daily logs.
 */
function detectAvailableIndicators(
  logs: BacktestDailyLog[],
): Set<"macd" | "rsi"> {
  const available = new Set<"macd" | "rsi">();
  if (!logs || logs.length === 0) return available;

  // Sample a few bars in the middle to detect indicators
  const sampleIndices = [
    Math.floor(logs.length * 0.3),
    Math.floor(logs.length * 0.5),
    Math.floor(logs.length * 0.7),
  ];

  for (const idx of sampleIndices) {
    const log = logs[idx];
    if (!log) continue;
    const ind = log.indicators;
    if (
      ind.macdDif !== undefined &&
      ind.macdDea !== undefined &&
      ind.macdHist !== undefined
    ) {
      available.add("macd");
    }
    if (ind.rsi !== undefined) {
      available.add("rsi");
    }
  }
  return available;
}

/**
 * Get direction arrow for an indicator value relative to its context.
 */
function getDirectionArrow(
  current: number | undefined,
  previous: number | undefined,
): string {
  if (current === undefined || previous === undefined) return "\u2500\u2500";
  const diff = current - previous;
  if (Math.abs(diff) < 0.001) return "\u2500\u2500";
  return diff > 0 ? "\u2197" : "\u2198";
}

/**
 * Pair buy/sell trades into entry-exit pairs for narrative linking.
 */
function pairTrades(
  markers: TradeMarkerInfo[],
): Map<number, TradeMarkerInfo> {
  const buyToSell = new Map<number, TradeMarkerInfo>();
  const buys: TradeMarkerInfo[] = [];

  const sorted = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  for (const m of sorted) {
    if (m.type === "buy") {
      buys.push(m);
    } else if (m.type === "sell" && buys.length > 0) {
      const matchedBuy = buys.shift()!;
      buyToSell.set(matchedBuy.timestamp, m);
    }
  }
  return buyToSell;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const KLineChart = forwardRef<KLineChartHandle, KLineChartProps>(
  function KLineChartInner(
    {
      symbol,
      initialTimeFrame = "1d",
      externalData,
      tradeMarkers,
      dailyLogs,
      showIndicators: showIndicatorsProp,
      height = 500,
      showVolume = true,
      showMA = true,
      maWindows = [5, 20, 60],
      onTradeSelect,
      onTimeFrameChange,
      onSymbolChange,
      onDataUpdate,
    },
    ref,
  ) {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
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

    const [activeTradeMarker, setActiveTradeMarker] =
      useState<TradeMarkerInfo | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{
      x: number;
      y: number;
    } | null>(null);

    // Clicked trade for narrative panel (persistent until dismissed)
    const [selectedTrade, setSelectedTrade] =
      useState<TradeMarkerInfo | null>(null);

    const [chartInitialized, setChartInitialized] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const isInitializingRef = useRef(false);

    // -----------------------------------------------------------------------
    // Theme-driven chart palette
    //
    // Initial createChart() uses these values; a follow-up useEffect re-applies
    // them on theme change via applyOptions(), so switching themes never
    // destroys the chart instance.
    // -----------------------------------------------------------------------
    const chartBg = useThemeRgb("bg-void");
    const chartText = useThemeRgb("fg-muted", 0.7);
    const chartGrid = useThemeRgb("bg-surface-border", 0.5);
    const chartCrosshair = useThemeRgb("color-accent");

    // -----------------------------------------------------------------------
    // Refs — main chart
    // -----------------------------------------------------------------------
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const maSeriesRefs = useRef<ISeriesApi<"Line">[]>([]);

    // Refs — MACD sub-chart
    const macdContainerRef = useRef<HTMLDivElement>(null);
    const macdChartRef = useRef<IChartApi | null>(null);
    const macdHistSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const macdDifSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const macdDeaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    // Refs — RSI sub-chart
    const rsiContainerRef = useRef<HTMLDivElement>(null);
    const rsiChartRef = useRef<IChartApi | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    // -----------------------------------------------------------------------
    // Data fetching
    // -----------------------------------------------------------------------
    const {
      data: fetchedData,
      loading,
      error,
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

    const klineData = externalData ?? fetchedData;

    // -----------------------------------------------------------------------
    // Trade lookup maps
    // -----------------------------------------------------------------------
    const tradesByTime = useMemo(() => {
      if (!tradeMarkers || tradeMarkers.length === 0)
        return new Map<number, TradeMarkerInfo>();
      const map = new Map<number, TradeMarkerInfo>();
      for (const marker of tradeMarkers) {
        map.set(marker.timestamp, marker);
      }
      return map;
    }, [tradeMarkers]);

    const tradesByTimeRef = useRef(tradesByTime);
    useEffect(() => {
      tradesByTimeRef.current = tradesByTime;
    }, [tradesByTime]);

    // Pair buy -> sell for narrative linking
    const tradePairs = useMemo(
      () => (tradeMarkers ? pairTrades(tradeMarkers) : new Map()),
      [tradeMarkers],
    );

    // -----------------------------------------------------------------------
    // Detect which indicator sub-panels to show
    // -----------------------------------------------------------------------
    const activeIndicators = useMemo(() => {
      if (showIndicatorsProp) return new Set(showIndicatorsProp);
      if (dailyLogs && dailyLogs.length > 0)
        return detectAvailableIndicators(dailyLogs);
      return new Set<"macd" | "rsi">();
    }, [showIndicatorsProp, dailyLogs]);

    const showMacd = activeIndicators.has("macd");
    const showRsi = activeIndicators.has("rsi");

    // -----------------------------------------------------------------------
    // Hydration
    // -----------------------------------------------------------------------
    useEffect(() => {
      setIsClient(true);
    }, []);

    const tradingStatus = isClient
      ? getTradingStatusInfo()
      : { label: "", color: "gray" as const };
    const dataTimestamp = isClient ? getDataTimestampLabel() : "";

    // -----------------------------------------------------------------------
    // Convert K-line data to chart format
    // -----------------------------------------------------------------------
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
            ? VOLUME_UP_COLOR
            : VOLUME_DOWN_COLOR,
      }));

      return { candles, volumes };
    }, [klineData]);

    // -----------------------------------------------------------------------
    // Timeframe handler
    // -----------------------------------------------------------------------
    const handleTimeFrameChange = useCallback(
      (tf: TimeFrame) => {
        if (tf === selectedTimeFrame) {
          refresh();
          return;
        }
        setSelectedTimeFrame(tf);
        onTimeFrameChange?.(tf);
      },
      [selectedTimeFrame, onTimeFrameChange, refresh],
    );

    // -----------------------------------------------------------------------
    // Imperative handle for parent to scroll chart to a trade
    // -----------------------------------------------------------------------
    useImperativeHandle(
      ref,
      () => ({
        scrollToTrade(timestamp: number) {
          const chart = chartRef.current;
          if (!chart) return;

          // Show ~30 bars of context (30 days for daily)
          const contextBars = 30 * 86400;
          const from = (timestamp - contextBars) as unknown as Time;
          const to = (timestamp + 10 * 86400) as unknown as Time;
          chart.timeScale().setVisibleRange({ from, to });

          // Also select the trade for narrative
          const trade = tradesByTimeRef.current.get(timestamp);
          if (trade) {
            setSelectedTrade(trade);
            onTradeSelect?.(trade);
          }
        },
      }),
      [onTradeSelect],
    );

    // -----------------------------------------------------------------------
    // Helper: create a sub-panel chart with shared styling
    // -----------------------------------------------------------------------
    const createSubChart = useCallback(
      (container: HTMLDivElement, panelHeight: number): IChartApi => {
        return createChart(container, {
          width: container.clientWidth,
          height: panelHeight,
          layout: {
            background: {
              type: ColorType.Solid,
              color: chartBg,
            },
            textColor: chartText,
          },
          grid: {
            vertLines: { color: chartGrid },
            horzLines: { color: chartGrid },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: chartCrosshair,
              width: 1,
              style: 2,
              labelBackgroundColor: chartCrosshair,
              labelVisible: false,
            },
            horzLine: {
              color: chartCrosshair,
              width: 1,
              style: 2,
              labelBackgroundColor: chartCrosshair,
            },
          },
          rightPriceScale: {
            borderColor: chartGrid,
          },
          timeScale: {
            borderColor: chartGrid,
            timeVisible: false,
            visible: false,
          },
        });
      },
      [chartBg, chartText, chartGrid, chartCrosshair],
    );

    // -----------------------------------------------------------------------
    // Sync visible range across main + sub-charts
    // -----------------------------------------------------------------------
    const syncTimeScales = useCallback(
      (sourceChart: IChartApi, targetCharts: IChartApi[]) => {
        sourceChart
          .timeScale()
          .subscribeVisibleLogicalRangeChange((range) => {
            if (!range) return;
            for (const target of targetCharts) {
              target.timeScale().setVisibleLogicalRange(range);
            }
          });
      },
      [],
    );

    // -----------------------------------------------------------------------
    // Initialize main chart (once after hydration)
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (!isClient || chartInitialized || isInitializingRef.current) return;
      isInitializingRef.current = true;

      let cancelled = false;
      let resizeTimeout: NodeJS.Timeout;
      let chart: IChartApi | null = null;
      let macdChart: IChartApi | null = null;
      let rsiChart: IChartApi | null = null;

      const initChart = () => {
        if (cancelled || !chartContainerRef.current) {
          isInitializingRef.current = false;
          return;
        }

        const rect = chartContainerRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          requestAnimationFrame(initChart);
          return;
        }

        // ----- Main candlestick chart -----
        chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: height,
          layout: {
            background: {
              type: ColorType.Solid,
              color: chartBg,
            },
            textColor: chartText,
          },
          grid: {
            vertLines: { color: chartGrid },
            horzLines: { color: chartGrid },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: chartCrosshair,
              width: 1,
              style: 2,
              labelBackgroundColor: chartCrosshair,
            },
            horzLine: {
              color: chartCrosshair,
              width: 1,
              style: 2,
              labelBackgroundColor: chartCrosshair,
            },
          },
          rightPriceScale: {
            borderColor: chartGrid,
            scaleMargins: {
              top: 0.1,
              bottom: showVolume ? 0.25 : 0.1,
            },
          },
          timeScale: {
            borderColor: chartGrid,
            timeVisible: true,
            secondsVisible: false,
          },
        });
        chartRef.current = chart;

        const candleSeries = chart.addCandlestickSeries({
          upColor: CANDLE_UP_COLOR,
          downColor: CANDLE_DOWN_COLOR,
          borderVisible: false,
          wickUpColor: CANDLE_UP_COLOR,
          wickDownColor: CANDLE_DOWN_COLOR,
        });
        candleSeriesRef.current = candleSeries;

        if (showVolume) {
          const volumeSeries = chart.addHistogramSeries({
            color: VOLUME_UP_COLOR,
            priceFormat: { type: "volume" },
            priceScaleId: "",
          });
          volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
          });
          volumeSeriesRef.current = volumeSeries;
        }

        if (showMA) {
          maSeriesRefs.current = maWindows.map((_, index) =>
            chart!.addLineSeries({
              color: MA_COLORS[index % MA_COLORS.length],
              lineWidth: 1,
              crosshairMarkerVisible: false,
              priceLineVisible: false,
              lastValueVisible: false,
            }),
          );
        }

        // ----- MACD sub-chart -----
        if (showMacd && macdContainerRef.current) {
          macdChart = createSubChart(
            macdContainerRef.current,
            MACD_PANEL_HEIGHT,
          );
          macdChartRef.current = macdChart;

          macdHistSeriesRef.current = macdChart.addHistogramSeries({
            priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
            priceScaleId: "macd",
          });
          macdHistSeriesRef.current.priceScale().applyOptions({
            scaleMargins: { top: 0.1, bottom: 0.1 },
          });

          macdDifSeriesRef.current = macdChart.addLineSeries({
            color: INDICATOR_COLORS.macdDif,
            lineWidth: 1,
            priceScaleId: "macd",
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          macdDeaSeriesRef.current = macdChart.addLineSeries({
            color: INDICATOR_COLORS.macdDea,
            lineWidth: 1,
            priceScaleId: "macd",
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          });
        }

        // ----- RSI sub-chart -----
        if (showRsi && rsiContainerRef.current) {
          rsiChart = createSubChart(
            rsiContainerRef.current,
            RSI_PANEL_HEIGHT,
          );
          rsiChartRef.current = rsiChart;

          rsiSeriesRef.current = rsiChart.addLineSeries({
            color: INDICATOR_COLORS.rsiLine,
            lineWidth: 1,
            priceScaleId: "rsi",
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          rsiSeriesRef.current.priceScale().applyOptions({
            scaleMargins: { top: 0.05, bottom: 0.05 },
          });
        }

        // ----- Crosshair sync -----
        const subCharts = [macdChart, rsiChart].filter(
          Boolean,
        ) as IChartApi[];

        // Main -> sub-charts crosshair sync
        chart.subscribeCrosshairMove((param) => {
          // Sync crosshair to sub-charts
          for (const sub of subCharts) {
            if (param.time) {
              // setCrosshairPosition needs a series; use first available
              const series =
                sub === macdChart
                  ? macdDifSeriesRef.current
                  : rsiSeriesRef.current;
              if (series) {
                try {
                  sub.setCrosshairPosition(
                    NaN,
                    param.time,
                    series,
                  );
                } catch {
                  // Ignore if time not in range
                }
              }
            } else {
              sub.clearCrosshairPosition();
            }
          }

          // Update OHLCV crosshair data
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

            const ts = param.time as number;
            const tradeAtTime = tradesByTimeRef.current.get(ts);
            if (tradeAtTime) {
              setActiveTradeMarker(tradeAtTime);
              setTooltipPosition(
                param.point
                  ? { x: param.point.x, y: param.point.y }
                  : null,
              );
            } else {
              setActiveTradeMarker(null);
              setTooltipPosition(null);
            }
          }
        });

        // Sub-charts -> main crosshair sync (bidirectional)
        for (const sub of subCharts) {
          sub.subscribeCrosshairMove((param) => {
            if (param.time && candleSeriesRef.current) {
              try {
                chart!.setCrosshairPosition(
                  NaN,
                  param.time,
                  candleSeriesRef.current,
                );
              } catch {
                // Ignore
              }
            } else {
              chart!.clearCrosshairPosition();
            }
            // Also sync other sub-charts
            for (const other of subCharts) {
              if (other === sub) continue;
              if (param.time) {
                const series =
                  other === macdChart
                    ? macdDifSeriesRef.current
                    : rsiSeriesRef.current;
                if (series) {
                  try {
                    other.setCrosshairPosition(
                      NaN,
                      param.time,
                      series,
                    );
                  } catch {
                    // Ignore
                  }
                }
              } else {
                other.clearCrosshairPosition();
              }
            }
          });
        }

        // ----- Time scale sync -----
        syncTimeScales(chart, subCharts);
        for (const sub of subCharts) {
          syncTimeScales(sub, [
            chart!,
            ...subCharts.filter((s) => s !== sub),
          ]);
        }

        // ----- Click handler for trade markers -----
        chart.subscribeClick((param) => {
          if (!param.time) {
            setSelectedTrade(null);
            onTradeSelect?.(null);
            return;
          }
          const ts = param.time as number;
          const trade = tradesByTimeRef.current.get(ts);
          if (trade) {
            setSelectedTrade(trade);
            onTradeSelect?.(trade);
          } else {
            setSelectedTrade(null);
            onTradeSelect?.(null);
          }
        });

        // ----- Resize -----
        const handleResize = () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            const containerWidth =
              chartContainerRef.current?.clientWidth;
            if (!containerWidth) return;

            chartRef.current?.applyOptions({ width: containerWidth });
            macdChartRef.current?.applyOptions({
              width: containerWidth,
            });
            rsiChartRef.current?.applyOptions({
              width: containerWidth,
            });
          }, 150);
        };
        window.addEventListener("resize", handleResize);

        setChartInitialized(true);
      };

      requestAnimationFrame(initChart);

      return () => {
        cancelled = true;
        clearTimeout(resizeTimeout);
        window.removeEventListener("resize", () => {});
        chart?.remove();
        macdChart?.remove();
        rsiChart?.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        maSeriesRefs.current = [];
        macdChartRef.current = null;
        macdHistSeriesRef.current = null;
        macdDifSeriesRef.current = null;
        macdDeaSeriesRef.current = null;
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
        isInitializingRef.current = false;
        setChartInitialized(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isClient, showMacd, showRsi]);

    // -----------------------------------------------------------------------
    // React to theme changes — re-apply layout / grid / crosshair colors on
    // every chart instance via applyOptions(). This is an incremental update;
    // no chart is destroyed or recreated, so user pan / zoom state survives.
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (!chartInitialized) return;
      const layoutOptions = {
        layout: {
          background: { type: ColorType.Solid, color: chartBg },
          textColor: chartText,
        },
        grid: {
          vertLines: { color: chartGrid },
          horzLines: { color: chartGrid },
        },
        crosshair: {
          vertLine: {
            color: chartCrosshair,
            labelBackgroundColor: chartCrosshair,
          },
          horzLine: {
            color: chartCrosshair,
            labelBackgroundColor: chartCrosshair,
          },
        },
        rightPriceScale: { borderColor: chartGrid },
        timeScale: { borderColor: chartGrid },
      } as const;
      chartRef.current?.applyOptions(layoutOptions);
      macdChartRef.current?.applyOptions(layoutOptions);
      rsiChartRef.current?.applyOptions(layoutOptions);
    }, [chartInitialized, chartBg, chartText, chartGrid, chartCrosshair]);

    // -----------------------------------------------------------------------
    // Update chart data
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (!candleSeriesRef.current || !chartInitialized) return;
      if (chartData.candles.length === 0) return;

      // Main series
      candleSeriesRef.current.setData(chartData.candles);

      // Enhanced trade markers
      if (tradeMarkers && tradeMarkers.length > 0) {
        const markers: SeriesMarker<Time>[] = tradeMarkers
          .filter((m) => m.timestamp > 0)
          .map((m) => ({
            time: m.timestamp as Time,
            position: (m.type === "buy"
              ? "belowBar"
              : "aboveBar") as SeriesMarkerPosition,
            shape: (m.type === "buy"
              ? "arrowUp"
              : "arrowDown") as SeriesMarkerShape,
            color:
              m.type === "buy" ? "#ef4444" : "#10b981",
            text: buildMarkerText(m),
            size: 2,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));
        candleSeriesRef.current.setMarkers(markers);
      } else {
        candleSeriesRef.current.setMarkers([]);
      }

      // Volume
      if (showVolume && volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(chartData.volumes);
      }

      // MA lines
      if (showMA) {
        maWindows.forEach((window, index) => {
          const maData = calculateSMA(chartData.candles, window);
          maSeriesRefs.current[index]?.setData(maData);
        });
      }

      // ----- Indicator sub-panels from dailyLogs -----
      if (dailyLogs && dailyLogs.length > 0) {
        // MACD
        if (showMacd && macdHistSeriesRef.current) {
          const histData: HistogramData<Time>[] = [];
          const difData: LineData<Time>[] = [];
          const deaData: LineData<Time>[] = [];

          for (const log of dailyLogs) {
            const t = log.time as Time;
            const ind = log.indicators;
            if (
              ind.macdHist !== undefined &&
              isFinite(ind.macdHist)
            ) {
              histData.push({
                time: t,
                value: ind.macdHist,
                color:
                  ind.macdHist >= 0
                    ? INDICATOR_COLORS.macdHistPositive
                    : INDICATOR_COLORS.macdHistNegative,
              });
            }
            if (
              ind.macdDif !== undefined &&
              isFinite(ind.macdDif)
            ) {
              difData.push({ time: t, value: ind.macdDif });
            }
            if (
              ind.macdDea !== undefined &&
              isFinite(ind.macdDea)
            ) {
              deaData.push({ time: t, value: ind.macdDea });
            }
          }

          macdHistSeriesRef.current.setData(histData);
          macdDifSeriesRef.current?.setData(difData);
          macdDeaSeriesRef.current?.setData(deaData);

          // Mark golden/dead cross points on MACD histogram
          if (macdDifSeriesRef.current && difData.length > 1) {
            const crossMarkers: SeriesMarker<Time>[] = [];
            for (let i = 1; i < difData.length; i++) {
              const prevDif = difData[i - 1]!;
              const currDif = difData[i]!;
              const prevDea = deaData[i - 1];
              const currDea = deaData[i];
              if (!prevDea || !currDea) continue;

              // Golden cross: DIF crosses above DEA
              if (
                prevDif.value <= prevDea.value &&
                currDif.value > currDea.value
              ) {
                crossMarkers.push({
                  time: currDif.time,
                  position: "belowBar" as SeriesMarkerPosition,
                  shape: "circle" as SeriesMarkerShape,
                  color: "#ef4444",
                  text: "",
                  size: 1,
                });
              }
              // Dead cross: DIF crosses below DEA
              if (
                prevDif.value >= prevDea.value &&
                currDif.value < currDea.value
              ) {
                crossMarkers.push({
                  time: currDif.time,
                  position: "aboveBar" as SeriesMarkerPosition,
                  shape: "circle" as SeriesMarkerShape,
                  color: "#10b981",
                  text: "",
                  size: 1,
                });
              }
            }
            if (crossMarkers.length > 0) {
              macdDifSeriesRef.current.setMarkers(crossMarkers);
            }
          }

          macdChartRef.current?.timeScale().fitContent();
        }

        // RSI
        if (showRsi && rsiSeriesRef.current) {
          const rsiData: LineData<Time>[] = [];

          for (const log of dailyLogs) {
            const rsiVal = log.indicators.rsi;
            if (rsiVal !== undefined && isFinite(rsiVal)) {
              rsiData.push({
                time: log.time as Time,
                value: rsiVal,
              });
            }
          }

          rsiSeriesRef.current.setData(rsiData);
          rsiChartRef.current?.timeScale().fitContent();
        }
      }

      // Fit content
      chartRef.current?.timeScale().fitContent();
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
      dailyLogs,
      showMacd,
      showRsi,
    ]);

    // -----------------------------------------------------------------------
    // Format helpers
    // -----------------------------------------------------------------------
    const formatVolume = useCallback((value: number | null): string => {
      if (value === null) return "-";
      if (value >= 100000000)
        return (value / 100000000).toFixed(2) + "\u4ebf";
      if (value >= 10000) return (value / 10000).toFixed(2) + "\u4e07";
      if (value >= 1000) return (value / 1000).toFixed(2) + "K";
      return value.toString();
    }, []);

    // Find the daily log entry for the selected trade (for narrative)
    const selectedTradeLog = useMemo(() => {
      if (!selectedTrade || !dailyLogs) return null;
      return (
        dailyLogs.find((l) => l.time === selectedTrade.timestamp) ?? null
      );
    }, [selectedTrade, dailyLogs]);

    // Find the paired exit trade for a selected buy
    const pairedTrade = useMemo(() => {
      if (!selectedTrade) return null;
      if (selectedTrade.type === "buy") {
        return tradePairs.get(selectedTrade.timestamp) ?? null;
      }
      // For sell, find the matching buy
      if (!tradeMarkers) return null;
      const entries = Array.from(tradePairs);
      for (const [buyTs, sellMarker] of entries) {
        if (sellMarker.timestamp === selectedTrade.timestamp) {
          return tradesByTime.get(buyTs) ?? null;
        }
      }
      return null;
    }, [selectedTrade, tradePairs, tradeMarkers, tradesByTime]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
      <div className="bg-surface rounded-xl border border-border overflow-hidden relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-3">
              <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-white text-sm">
                {"\u52a0\u8f7d "}
                {TIMEFRAME_LABELS[selectedTimeFrame]?.zh ||
                  selectedTimeFrame}{" "}
                {"\u6570\u636e..."}
              </span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                {symbol}
              </span>
              <span className="text-xs text-white/40 uppercase">
                {TIMEFRAME_LABELS[selectedTimeFrame]?.zh ||
                  selectedTimeFrame}
              </span>
            </div>

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

            {isMock && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                {"\u6a21\u62df\u6570\u636e"}
              </div>
            )}

            {/* OHLCV crosshair info */}
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
                    (crosshairData.change ?? 0) >= 0
                      ? "text-profit"
                      : "text-loss"
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
            <span className="text-xs text-white/40">{dataTimestamp}</span>

            {source !== "none" && !isMock && (
              <span className="text-xs text-white/30">{source}</span>
            )}

            <button
              onClick={() => refresh()}
              disabled={loading}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded transition disabled:opacity-50"
              title={"\u5237\u65b0\u6570\u636e"}
              aria-label={"\u5237\u65b0\u6570\u636e"}
            >
              <svg
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

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
              <div
                key={window}
                className="flex items-center gap-1 text-xs"
              >
                <div
                  className="w-3 h-0.5 rounded"
                  style={{
                    backgroundColor:
                      MA_COLORS[index % MA_COLORS.length],
                  }}
                />
                <span
                  style={{
                    color: MA_COLORS[index % MA_COLORS.length],
                  }}
                >
                  MA{window}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-loss/10 border-b border-loss/30 flex items-center justify-between" role="alert">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-loss"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
              {"\u91cd\u8bd5"}
            </button>
          </div>
        )}

        {/* Chart area: main + sub-panels + optional narrative */}
        <div className="flex">
          {/* Charts column */}
          <div className="flex-1 min-w-0">
            {/* Main candlestick chart */}
            <div
              ref={chartContainerRef}
              role="img"
              aria-label={`K线图表: ${symbol}, ${TIMEFRAME_LABELS[selectedTimeFrame]?.zh || selectedTimeFrame}`}
              className="w-full bg-[#0f1117] relative"
              style={{
                height: `${height}px`,
                minHeight: `${height}px`,
              }}
            >
              {/* Hover tooltip */}
              {activeTradeMarker && tooltipPosition && !selectedTrade && (
                <div
                  className="absolute z-10 pointer-events-none"
                  style={{
                    left: Math.min(
                      tooltipPosition.x + 12,
                      (chartContainerRef.current?.clientWidth ?? 0) -
                        260,
                    ),
                    top: Math.max(tooltipPosition.y - 20, 8),
                  }}
                >
                  <TradeTooltip marker={activeTradeMarker} />
                </div>
              )}
            </div>

            {/* MACD Sub-Panel */}
            {showMacd && (
              <div className="border-t border-white/5">
                <div className="flex items-center gap-3 px-4 py-1">
                  <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                    MACD
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span
                      className="flex items-center gap-1"
                      style={{
                        color: INDICATOR_COLORS.macdDif,
                      }}
                    >
                      <span
                        className="inline-block w-2 h-0.5"
                        style={{
                          backgroundColor:
                            INDICATOR_COLORS.macdDif,
                        }}
                      />
                      DIF
                    </span>
                    <span
                      className="flex items-center gap-1"
                      style={{
                        color: INDICATOR_COLORS.macdDea,
                      }}
                    >
                      <span
                        className="inline-block w-2 h-0.5"
                        style={{
                          backgroundColor:
                            INDICATOR_COLORS.macdDea,
                        }}
                      />
                      DEA
                    </span>
                  </div>
                </div>
                <div
                  ref={macdContainerRef}
                  className="w-full bg-[#0f1117]"
                  style={{ height: `${MACD_PANEL_HEIGHT}px` }}
                />
              </div>
            )}

            {/* RSI Sub-Panel */}
            {showRsi && (
              <div className="border-t border-white/5">
                <div className="flex items-center gap-3 px-4 py-1">
                  <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                    RSI(14)
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-white/20">
                    <span>
                      70{" "}
                      {"\u8d85\u4e70"}
                    </span>
                    <span>
                      30{" "}
                      {"\u8d85\u5356"}
                    </span>
                  </div>
                </div>
                <div
                  ref={rsiContainerRef}
                  className="w-full bg-[#0f1117]"
                  style={{ height: `${RSI_PANEL_HEIGHT}px` }}
                />
              </div>
            )}
          </div>

          {/* Trade Narrative Panel — appears when a trade is clicked */}
          {selectedTrade && (
            <div className="w-72 xl:w-80 border-l border-white/5 bg-[#0f1117] overflow-y-auto shrink-0">
              <TradeNarrative
                trade={selectedTrade}
                pairedTrade={pairedTrade}
                dailyLog={selectedTradeLog}
                onClose={() => {
                  setSelectedTrade(null);
                  onTradeSelect?.(null);
                }}
                onNavigateToPaired={(timestamp) => {
                  const chart = chartRef.current;
                  if (!chart) return;
                  const contextBars = 30 * 86400;
                  const from = (timestamp -
                    contextBars) as unknown as Time;
                  const to = (timestamp +
                    10 * 86400) as unknown as Time;
                  chart.timeScale().setVisibleRange({ from, to });
                  const trade =
                    tradesByTimeRef.current.get(timestamp);
                  if (trade) {
                    setSelectedTrade(trade);
                    onTradeSelect?.(trade);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);

// Re-export types for convenience
export type { TimeFrame, KLineData };
export { getShortReason, getDirectionArrow };

// =============================================================================
// TRADE TOOLTIP (hover) — compact version shown on crosshair hover
// =============================================================================

function TradeTooltip({ marker }: { marker: TradeMarkerInfo }) {
  const isBuy = marker.type === "buy";
  const date = new Date(marker.timestamp * 1000).toLocaleDateString(
    "zh-CN",
  );

  const indicatorEntries = Object.entries(marker.indicatorValues).slice(
    0,
    4,
  );

  return (
    <div
      className="w-60 rounded-lg border shadow-xl text-xs"
      style={{
        background: "rgba(15,17,23,0.97)",
        borderColor: isBuy
          ? "rgba(239,68,68,0.5)"
          : "rgba(16,185,129,0.5)",
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 rounded-t-lg flex items-center justify-between"
        style={{
          background: isBuy
            ? "rgba(239,68,68,0.15)"
            : "rgba(16,185,129,0.15)",
        }}
      >
        <span
          className="font-bold text-sm"
          style={{ color: isBuy ? "#ef4444" : "#10b981" }}
        >
          {isBuy
            ? "\u25b2 \u4e70\u5165"
            : "\u25bc \u5356\u51fa"}
        </span>
        <span className="text-white/50">{date}</span>
      </div>

      {/* Execution info */}
      <div
        className="px-3 py-2 space-y-1 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex justify-between">
          <span className="text-white/40">
            {"\u6210\u4ea4\u4ef7"}
          </span>
          <span className="text-white font-mono tabular-nums">
            {"\u00a5"}
            {marker.executePrice.toFixed(2)}
            <span className="text-white/30 ml-1 text-[10px]">
              ({"\u4fe1\u53f7"} {"\u00a5"}
              {marker.signalPrice.toFixed(2)})
            </span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">
            {"\u6570\u91cf"}
          </span>
          <span className="text-white font-mono tabular-nums">
            {marker.quantity.toLocaleString()}{" "}
            {"\u80a1\uff08"}
            {marker.lots} {"\u624b\uff09"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">
            {"\u4ea4\u6613\u6210\u672c"}
          </span>
          <span className="text-white/60 font-mono tabular-nums">
            {"\u00a5"}
            {(marker.commission + marker.slippage).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Trigger */}
      <div
        className="px-3 py-2 space-y-1 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="text-white/30 text-[10px] uppercase tracking-wide">
          {"\u89e6\u53d1\u4f9d\u636e"}
        </div>
        <div className="text-white/70 leading-relaxed break-words">
          {marker.triggerReason || "\u2014"}
        </div>
        {indicatorEntries.length > 0 && (
          <div className="text-white/40 font-mono tabular-nums text-[10px] mt-1">
            {indicatorEntries
              .map(([k, v]) => `${k}=${v.toFixed(2)}`)
              .join("  /  ")}
          </div>
        )}
      </div>

      {/* P&L */}
      {!isBuy && marker.pnl !== undefined && (
        <div className="px-3 py-2">
          <div className="text-white/30 text-[10px] uppercase tracking-wide mb-1">
            {"\u76c8\u4e8f"}
          </div>
          <div className="flex items-center gap-3">
            {marker.holdingDays !== undefined && (
              <span className="text-white/40">
                {"\u6301\u4ed3"} {marker.holdingDays}{" "}
                {"\u5929"}
              </span>
            )}
            <span
              className="font-mono tabular-nums font-medium"
              style={{
                color:
                  (marker.pnl ?? 0) >= 0
                    ? "#10b981"
                    : "#ef4444",
              }}
            >
              {(marker.pnl ?? 0) >= 0 ? "+" : ""}
              {"\u00a5"}
              {(marker.pnl ?? 0).toFixed(2)}
              {marker.pnlPercent !== undefined && (
                <span className="ml-1">
                  ({marker.pnlPercent >= 0 ? "+" : ""}
                  {marker.pnlPercent.toFixed(2)}%)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Click hint */}
      <div className="px-3 py-1.5 text-[10px] text-white/20 text-center border-t border-white/5">
        {"\u70b9\u51fb\u67e5\u770b\u8be6\u7ec6\u5206\u6790"}
      </div>
    </div>
  );
}
