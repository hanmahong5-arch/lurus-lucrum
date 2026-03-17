/**
 * Backtest Run Screen
 *
 * Configure and execute a backtest. Accessible from strategy or stock detail.
 * Params: symbol, strategyCode (optional), strategyName (optional)
 */

import { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Screen, Text, MonoText, Card, Button } from "@/components/common";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { useRunBacktest } from "@/lib/hooks/use-backtest";
import { useStockDateRange } from "@/lib/hooks/use-market-data";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const CAPITAL_OPTIONS = [100_000, 500_000, 1_000_000, 5_000_000];

const BUILTIN_STRATEGIES = [
  { id: "ma_cross", name: "MA Cross", desc: "Dual moving average crossover" },
  { id: "macd", name: "MACD", desc: "MACD golden/death cross" },
  { id: "rsi", name: "RSI", desc: "RSI overbought/oversold" },
  { id: "boll", name: "Bollinger", desc: "Bollinger band breakout" },
];

export default function BacktestRunScreen() {
  const params = useLocalSearchParams<{
    symbol?: string;
    strategyCode?: string;
    strategyName?: string;
  }>();

  const [symbol, setSymbol] = useState(params.symbol ?? "");
  const [strategyId, setStrategyId] = useState("ma_cross");
  const [capital, setCapital] = useState(1_000_000);
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2026-03-01");

  const { data: dateRange } = useStockDateRange(symbol);
  const runBacktest = useRunBacktest();

  const handleRun = () => {
    if (!symbol) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const hasCustomCode = !!params.strategyCode;
    runBacktest.mutate({
      target: {
        mode: "stock",
        stock: { symbol, name: symbol },
      },
      strategy: hasCustomCode
        ? { type: "custom", customCode: params.strategyCode }
        : { type: "builtin", builtinId: strategyId },
      config: {
        startDate,
        endDate,
        initialCapital: capital,
      },
    });
  };

  const result = runBacktest.data;
  const isPositive = (result?.returnMetrics.totalReturn ?? 0) >= 0;

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text variant="heading" style={styles.headerTitle}>Run Backtest</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stock Symbol */}
        <Card style={styles.section}>
          <Text variant="label" style={styles.sectionTitle}>Stock</Text>
          <TextInput
            style={styles.textInput}
            value={symbol}
            onChangeText={setSymbol}
            placeholder="e.g. 600519.SH"
            placeholderTextColor={Colors.textDisabled}
          />
          {dateRange && (
            <Text variant="caption" style={styles.dateHint}>
              Data: {dateRange.minDate} ~ {dateRange.maxDate} ({dateRange.dataPoints} bars)
            </Text>
          )}
        </Card>

        {/* Strategy Selection */}
        {!params.strategyCode && (
          <Card style={styles.section}>
            <Text variant="label" style={styles.sectionTitle}>Strategy</Text>
            <View style={styles.strategyGrid}>
              {BUILTIN_STRATEGIES.map((s) => (
                <Pressable
                  key={s.id}
                  style={[
                    styles.strategyChip,
                    strategyId === s.id && styles.strategyChipActive,
                  ]}
                  onPress={() => setStrategyId(s.id)}
                >
                  <Text
                    style={[
                      styles.strategyChipText,
                      strategyId === s.id && styles.strategyChipTextActive,
                    ]}
                  >
                    {s.name}
                  </Text>
                  <Text style={styles.strategyDesc} numberOfLines={1}>{s.desc}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        {params.strategyCode && (
          <Card style={styles.section}>
            <Text variant="label" style={styles.sectionTitle}>Strategy</Text>
            <View style={styles.customStrategyBadge}>
              <Ionicons name="sparkles" size={14} color={Colors.ai} />
              <Text style={styles.customStrategyText}>
                {params.strategyName ?? "AI Generated Strategy"}
              </Text>
            </View>
          </Card>
        )}

        {/* Capital */}
        <Card style={styles.section}>
          <Text variant="label" style={styles.sectionTitle}>Initial Capital</Text>
          <View style={styles.capitalRow}>
            {CAPITAL_OPTIONS.map((c) => (
              <Pressable
                key={c}
                style={[styles.capitalChip, capital === c && styles.capitalChipActive]}
                onPress={() => setCapital(c)}
              >
                <MonoText
                  size="xs"
                  color={capital === c ? Colors.primary : Colors.textSecondary}
                >
                  {c >= 1_000_000 ? `${c / 1_000_000}M` : `${c / 1_000}K`}
                </MonoText>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Date Range */}
        <Card style={styles.section}>
          <Text variant="label" style={styles.sectionTitle}>Date Range</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text variant="caption">From</Text>
              <TextInput
                style={styles.dateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>
            <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
            <View style={styles.dateField}>
              <Text variant="caption">To</Text>
              <TextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>
          </View>
        </Card>

        {/* Run Button */}
        <Button
          title={runBacktest.isPending ? "Running..." : "Run Backtest"}
          onPress={handleRun}
          loading={runBacktest.isPending}
          disabled={!symbol || runBacktest.isPending}
          style={styles.runBtn}
        />

        {/* Error */}
        {runBacktest.error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={16} color={Colors.statusBlock} />
            <Text style={styles.errorText}>
              {runBacktest.error instanceof Error
                ? runBacktest.error.message
                : "Backtest failed"}
            </Text>
          </View>
        )}

        {/* Results */}
        {result && (
          <View style={styles.results}>
            <Text variant="label" style={styles.sectionTitle}>Results</Text>

            {/* Key Metrics */}
            <View style={styles.metricsRow}>
              <MetricBox
                label="Return"
                value={`${isPositive ? "+" : ""}${(result.returnMetrics.totalReturn * 100).toFixed(2)}%`}
                color={isPositive ? Colors.profit : Colors.loss}
              />
              <MetricBox
                label="Sharpe"
                value={result.riskMetrics.sharpeRatio.toFixed(2)}
              />
              <MetricBox
                label="Max DD"
                value={`${(result.riskMetrics.maxDrawdown * 100).toFixed(1)}%`}
                color={Colors.loss}
              />
            </View>
            <View style={styles.metricsRow}>
              <MetricBox
                label="Win Rate"
                value={`${(result.tradingMetrics.winRate * 100).toFixed(1)}%`}
              />
              <MetricBox
                label="Trades"
                value={String(result.tradingMetrics.totalTrades)}
              />
              <MetricBox
                label="PF"
                value={result.tradingMetrics.profitFactor.toFixed(2)}
              />
            </View>

            {/* Equity Curve */}
            {result.equityCurve.length > 0 && (
              <View style={styles.chartSection}>
                <Text variant="label" style={styles.chartLabel}>Equity Curve</Text>
                <EquityCurve data={result.equityCurve} height={200} />
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    alignItems: "center",
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18 },
  section: { marginBottom: Spacing.md },
  sectionTitle: { marginBottom: Spacing.sm },
  textInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateHint: { marginTop: Spacing.xs },
  strategyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  strategyChip: {
    width: "48%",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  strategyChipActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  strategyChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  strategyChipTextActive: { color: Colors.primary },
  strategyDesc: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  customStrategyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.aiBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.aiBorder,
  },
  customStrategyText: {
    fontSize: 14,
    color: Colors.ai,
    fontWeight: "500",
  },
  capitalRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  capitalChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  capitalChipActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  dateField: { flex: 1, gap: 4 },
  dateInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  runBtn: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: `${Colors.statusBlock}15`,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: { color: Colors.statusBlock, fontSize: 13, flex: 1 },
  results: { marginTop: Spacing.sm },
  metricsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metricBox: {
    flex: 1,
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
  chartSection: { marginTop: Spacing.md },
  chartLabel: { marginBottom: Spacing.sm },
});
