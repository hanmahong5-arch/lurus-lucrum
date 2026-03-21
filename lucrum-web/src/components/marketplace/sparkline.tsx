"use client";

/**
 * Sparkline - Lightweight inline chart for strategy cards.
 * Renders a mini SVG line chart from an array of net-value data points.
 */

import { useMemo } from "react";

interface SparklineProps {
  /** Array of numeric data points (e.g. net asset values) */
  data: number[];
  /** SVG width in pixels */
  width?: number;
  /** SVG height in pixels */
  height?: number;
  /** Whether the trend is positive (determines stroke color) */
  positive?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  positive,
  className,
}: SparklineProps) {
  const pathD = useMemo(() => {
    if (data.length < 2) return "";

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const drawW = width - padding * 2;
    const drawH = height - padding * 2;

    const points = data.map((v, i) => {
      const x = padding + (i / (data.length - 1)) * drawW;
      const y = padding + drawH - ((v - min) / range) * drawH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M${points.join("L")}`;
  }, [data, width, height]);

  // Determine color from prop or from data trend
  const lastVal = data[data.length - 1];
  const firstVal = data[0];
  const isUp = positive ?? (data.length >= 2 && lastVal !== undefined && firstVal !== undefined && lastVal >= firstVal);
  const strokeColor = isUp
    ? "rgb(var(--color-profit))"
    : "rgb(var(--color-loss))";

  if (data.length < 2) {
    return (
      <div
        className={className}
        style={{ width, height }}
        aria-label="No data available for chart"
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label="Strategy performance sparkline"
    >
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
