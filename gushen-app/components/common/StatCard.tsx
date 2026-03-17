/**
 * StatCard - KPI display card matching design system stat-card
 */

import { View, StyleSheet } from "react-native";
import { Text, MonoText } from "./Text";
import { Card } from "./Card";
import { Colors, FontSizes, Spacing, type Direction, DirectionColors } from "@/constants";

interface StatCardProps {
  label: string;
  value: string;
  direction?: Direction;
  suffix?: string;
}

export function StatCard({ label, value, direction, suffix }: StatCardProps) {
  const valueColor = direction ? DirectionColors[direction] : Colors.textPrimary;

  return (
    <Card style={styles.container}>
      <Text variant="label">{label}</Text>
      <View style={styles.valueRow}>
        <MonoText size="statSm" color={valueColor}>
          {value}
        </MonoText>
        {suffix && (
          <Text variant="caption" style={styles.suffix}>
            {suffix}
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 120,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: Spacing.xs,
    gap: 4,
  },
  suffix: {
    fontSize: FontSizes.sm,
  },
});
