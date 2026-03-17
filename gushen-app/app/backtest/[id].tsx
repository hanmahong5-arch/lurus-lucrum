/**
 * Backtest Result Detail (Modal)
 *
 * Shows full backtest results: equity curve, metrics, trades.
 * Opens as a slide-up modal from portfolio or strategy screens.
 */

import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Card, Loading } from "@/components/common";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { useBacktestDetail } from "@/lib/hooks/use-backtest";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function BacktestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: result, isLoading, error } = useBacktestDetail(id);

  return (
    <Screen>
      {/* Header with close button */}
      <View style={styles.header}>
        <Text variant="heading" style={styles.headerTitle}>
          Backtest Result
        </Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {isLoading && <Loading fullScreen message="Loading result..." />}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : "Failed to load"}
          </Text>
        </View>
      )}

      {result && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Strategy Info */}
          <Card style={styles.infoCard}>
            <Text style={styles.strategyName}>
              {result.strategy?.name ?? "Custom Strategy"}
            </Text>
            <Text variant="caption">
              {result.stockName} ({result.symbol}) | {result.startDate} ~ {result.endDate}
            </Text>
            <Text variant="caption" style={styles.metaText}>
              {result.dataSource} | {(result.executionTime / 1000).toFixed(1)}s
            </Text>
          </Card>

          {/* Key Metrics Grid */}
          <View style={styles.metricsGrid}>
            <MetricBox
              label="Total Return"
              value={`${result.metrics.totalReturn >= 0 ? "+" : ""}${(result.metrics.totalReturn * 100).toFixed(2)}%`}
              color={result.metrics.totalReturn >= 0 ? Colors.profit : Colors.loss}
            />
            <MetricBox
              label="Sharpe"
              value={result.metrics.sharpeRatio.toFixed(2)}
            />
            <MetricBox
              label="Max DD"
              value={`${(result.metrics.maxDrawdown * 100).toFixed(1)}%`}
              color={Colors.loss}
            />
            <MetricBox
              label="Win Rate"
              value={`${(result.metrics.winRate * 100).toFixed(1)}%`}
            />
            <MetricBox
              label="Trades"
              value={String(result.metrics.totalTrades)}
            />
            <MetricBox
              label="PF"
              value={result.metrics.profitFactor.toFixed(2)}
            />
            <MetricBox
              label="Sortino"
              value={result.metrics.sortinoRatio.toFixed(2)}
            />
            <MetricBox
              label="Calmar"
              value={result.metrics.calmarRatio.toFixed(2)}
            />
            <MetricBox
              label="Annualized"
              value={`${(result.metrics.annualizedReturn * 100).toFixed(1)}%`}
              color={result.metrics.annualizedReturn >= 0 ? Colors.profit : Colors.loss}
            />
          </View>

          {/* Equity Curve */}
          {result.equityCurve.length > 0 && (
            <Card style={styles.chartCard}>
              <Text variant="label" style={styles.chartLabel}>Equity Curve</Text>
              <EquityCurve data={result.equityCurve} height={220} />
            </Card>
          )}

          {/* Trade List */}
          {result.trades.length > 0 && (
            <Card style={styles.tradeCard}>
              <Text variant="label" style={styles.chartLabel}>
                Trades ({result.trades.length})
              </Text>
              {result.trades.slice(0, 20).map((trade) => (
                <View key={trade.id} style={styles.tradeRow}>
                  <View style={styles.tradeInfo}>
                    <Text
                      style={[
                        styles.tradeType,
                        { color: trade.type === "buy" ? Colors.profit : Colors.loss },
                      ]}
                    >
                      {trade.type.toUpperCase()}
                    </Text>
                    <Text variant="caption">
                      {trade.date} | {trade.quantity} shares
                    </Text>
                  </View>
                  <View style={styles.tradeRight}>
                    <MonoText size="sm" color={Colors.textPrimary}>
                      {trade.price.toFixed(2)}
                    </MonoText>
                    {trade.pnlPercent != null && (
                      <MonoText
                        size="xs"
                        color={trade.pnlPercent >= 0 ? Colors.profit : Colors.loss}
                      >
                        {trade.pnlPercent >= 0 ? "+" : ""}
                        {trade.pnlPercent.toFixed(2)}%
                      </MonoText>
                    )}
                  </View>
                </View>
              ))}
              {result.trades.length > 20 && (
                <Text variant="caption" style={styles.moreText}>
                  +{result.trades.length - 20} more trades
                </Text>
              )}
            </Card>
          )}

          <View style={styles.spacer} />
        </ScrollView>
      )}
    </Screen>
  );
}

function MetricBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <MonoText size="sm" color={color ?? Colors.textPrimary}>
        {value}
      </MonoText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerTitle: { fontSize: 20 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  errorText: { color: Colors.statusBlock, fontSize: 14 },
  infoCard: { marginBottom: Spacing.lg, gap: 4 },
  strategyName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  metaText: { marginTop: 2 },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  metricBox: {
    width: "31%",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  chartCard: { marginBottom: Spacing.lg },
  chartLabel: { marginBottom: Spacing.md },
  tradeCard: { marginBottom: Spacing.lg },
  tradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tradeInfo: { gap: 2, flex: 1 },
  tradeRight: { alignItems: "flex-end", gap: 2 },
  tradeType: { fontSize: 13, fontWeight: "700" },
  moreText: { textAlign: "center", marginTop: Spacing.md },
  spacer: { height: 40 },
});
