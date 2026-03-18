/**
 * KLineChart - Candlestick chart component
 *
 * Uses react-native-wagmi-charts for K-line rendering.
 * Supports pinch-to-zoom, pan, crosshair, and timeframe switching.
 */

import { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { CandlestickChart } from "react-native-wagmi-charts";
import { Text, MonoText } from "@/components/common";
import { Colors, Spacing, BorderRadius, FontSizes } from "@/constants/theme";
import type { KLineData, KLineTimeFrame } from "@shared/types";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface KLineChartProps {
  data: KLineData[];
  symbol: string;
  timeframe: KLineTimeFrame;
  onTimeframeChange?: (tf: KLineTimeFrame) => void;
  height?: number;
}

const TIMEFRAME_OPTIONS: { value: KLineTimeFrame; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "60m", label: "1h" },
  { value: "1d", label: "D" },
  { value: "1w", label: "W" },
  { value: "1M", label: "M" },
];

export function KLineChart({
  data,
  symbol,
  timeframe,
  onTimeframeChange,
  height = 300,
}: KLineChartProps) {
  const [selectedCandle, setSelectedCandle] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    timestamp: number;
  } | null>(null);

  // Convert to wagmi-charts format
  const chartData = useMemo(() => {
    return data.map((item) => ({
      timestamp: item.time * 1000, // wagmi-charts expects milliseconds
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.emptyChart}>
          <Text variant="caption">No chart data available</Text>
        </View>
      </View>
    );
  }

  const lastCandle = chartData[chartData.length - 1]!;
  const displayCandle = selectedCandle ?? {
    open: lastCandle.open,
    high: lastCandle.high,
    low: lastCandle.low,
    close: lastCandle.close,
    timestamp: lastCandle.timestamp,
  };

  const changePercent =
    displayCandle.open > 0
      ? ((displayCandle.close - displayCandle.open) / displayCandle.open) * 100
      : 0;
  const isPositive = displayCandle.close >= displayCandle.open;

  return (
    <View style={styles.container}>
      {/* OHLC Display */}
      <View style={styles.ohlcRow}>
        <OHLCItem label="O" value={displayCandle.open} />
        <OHLCItem label="H" value={displayCandle.high} />
        <OHLCItem label="L" value={displayCandle.low} />
        <OHLCItem label="C" value={displayCandle.close} />
        <MonoText
          size="sm"
          color={isPositive ? Colors.profit : Colors.loss}
        >
          {isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%
        </MonoText>
      </View>

      {/* Timeframe Selector */}
      {onTimeframeChange && (
        <View style={styles.timeframeRow}>
          {TIMEFRAME_OPTIONS.map((tf) => (
            <Pressable
              key={tf.value}
              style={[
                styles.timeframeBtn,
                timeframe === tf.value && styles.timeframeBtnActive,
              ]}
              onPress={() => onTimeframeChange(tf.value)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  timeframe === tf.value && styles.timeframeTextActive,
                ]}
              >
                {tf.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Candlestick Chart */}
      <CandlestickChart.Provider data={chartData}>
        <CandlestickChart height={height} width={SCREEN_WIDTH - 32}>
          <CandlestickChart.Candles
            positiveColor={Colors.profit}
            negativeColor={Colors.loss}
          />
          <CandlestickChart.Crosshair
            color={Colors.textMuted}
            onCurrentXChange={(value: number) => {
              if (value !== -1) {
                const candle = chartData[Math.round(value)];
                if (candle) {
                  setSelectedCandle({
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    timestamp: candle.timestamp,
                  });
                }
              } else {
                setSelectedCandle(null);
              }
            }}
          >
            <CandlestickChart.Tooltip />
          </CandlestickChart.Crosshair>
        </CandlestickChart>
      </CandlestickChart.Provider>
    </View>
  );
}

function OHLCItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.ohlcItem}>
      <Text style={styles.ohlcLabel}>{label}</Text>
      <MonoText size="xs" color={Colors.textSecondary}>
        {value.toFixed(2)}
      </MonoText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  emptyChart: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ohlcRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  ohlcItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ohlcLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  timeframeRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: 2,
  },
  timeframeBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  timeframeBtnActive: {
    backgroundColor: Colors.surfaceHover,
  },
  timeframeText: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  timeframeTextActive: {
    color: Colors.primary,
  },
});
