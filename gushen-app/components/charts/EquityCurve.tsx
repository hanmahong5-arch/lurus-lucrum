/**
 * EquityCurve - Line chart for backtest equity progression
 *
 * Uses react-native-svg for a simple line chart with gradient fill.
 */

import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Polyline, Line } from "react-native-svg";
import { Text, MonoText } from "@/components/common";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { EquityPoint } from "@shared/types";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface EquityCurveProps {
  data: EquityPoint[];
  height?: number;
  width?: number;
  showLabels?: boolean;
}

export function EquityCurve({
  data,
  height = 200,
  width = SCREEN_WIDTH - 64,
  showLabels = true,
}: EquityCurveProps) {
  if (data.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.empty}>
          <Text variant="caption">Insufficient data for chart</Text>
        </View>
      </View>
    );
  }

  const equities = data.map((d) => d.equity);
  const minVal = Math.min(...equities);
  const maxVal = Math.max(...equities);
  const range = maxVal - minVal || 1;
  const padding = { top: 8, bottom: showLabels ? 24 : 8, left: 8, right: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const isPositive = equities[equities.length - 1]! >= equities[0]!;
  const lineColor = isPositive ? Colors.profit : Colors.loss;

  // Build polyline points
  const points = equities
    .map((val, i) => {
      const x = padding.left + (i / (equities.length - 1)) * chartW;
      const y = padding.top + (1 - (val - minVal) / range) * chartH;
      return `${x},${y}`;
    })
    .join(" ");

  // Grid lines (3 horizontal)
  const gridLines = [0.25, 0.5, 0.75].map((pct) => ({
    y: padding.top + pct * chartH,
    value: maxVal - pct * range,
  }));

  // Date labels (start, end)
  const startDate = data[0]!.date.slice(5); // MM-DD
  const endDate = data[data.length - 1]!.date.slice(5);

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {gridLines.map((line, i) => (
          <Line
            key={i}
            x1={padding.left}
            y1={line.y}
            x2={width - padding.right}
            y2={line.y}
            stroke={Colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}

        {/* Equity curve */}
        <Polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      {/* Labels */}
      {showLabels && (
        <View style={styles.labels}>
          <MonoText size="xs" color={Colors.textMuted}>{startDate}</MonoText>
          <MonoText size="xs" color={Colors.textMuted}>{endDate}</MonoText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
