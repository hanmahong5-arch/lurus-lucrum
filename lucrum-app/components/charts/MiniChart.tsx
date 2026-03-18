/**
 * MiniChart - Sparkline-style mini price chart for stock rows
 *
 * Renders a simple line chart using react-native-svg.
 * Lightweight alternative to full K-line chart.
 */

import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { Colors } from "@/constants/theme";

interface MiniChartProps {
  data: number[]; // Close prices
  width?: number;
  height?: number;
  positive?: boolean; // Override direction color
}

export function MiniChart({
  data,
  width = 80,
  height = 32,
  positive,
}: MiniChartProps) {
  if (data.length < 2) return <View style={{ width, height }} />;

  const isPositive = positive ?? data[data.length - 1]! >= data[0]!;
  const color = isPositive ? Colors.profit : Colors.loss;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((value, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
