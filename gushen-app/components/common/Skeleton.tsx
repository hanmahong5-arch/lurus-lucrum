/**
 * Skeleton loading placeholders
 */

import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, type ViewStyle } from "react-native";
import { Colors, BorderRadius } from "@/constants/theme";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = BorderRadius.sm,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: Colors.surfaceHover,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Pre-built skeleton for a stock list row */
export function StockRowSkeleton() {
  return (
    <View style={skeletonStyles.stockRow}>
      <View style={skeletonStyles.stockInfo}>
        <Skeleton width={120} height={14} />
        <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
      </View>
      <View style={skeletonStyles.stockPrice}>
        <Skeleton width={70} height={14} />
        <Skeleton width={50} height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

/** Pre-built skeleton for index cards row */
export function IndexCardsSkeleton() {
  return (
    <View style={skeletonStyles.indexRow}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={skeletonStyles.indexCard}>
          <Skeleton width={40} height={10} />
          <Skeleton width={70} height={14} style={{ marginTop: 6 }} />
          <Skeleton width={50} height={10} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stockInfo: {
    gap: 2,
  },
  stockPrice: {
    alignItems: "flex-end",
    gap: 2,
  },
  indexRow: {
    flexDirection: "row",
    gap: 8,
  },
  indexCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: "center",
  },
});
