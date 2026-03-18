/**
 * Strategy Tab - Strategy list, AI generation entry
 */

import { View, FlatList, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Card, Button } from "@/components/common";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const MOCK_STRATEGIES = [
  {
    id: "1",
    name: "MACD Cross Strategy",
    description: "Buy on golden cross, sell on death cross",
    lastBacktest: { sharpe: "1.85", winRate: "62.3%", maxDrawdown: "-12.4%" },
    score: "A",
  },
  {
    id: "2",
    name: "Bollinger Band Breakout",
    description: "Entry on lower band touch, exit on upper band",
    lastBacktest: { sharpe: "1.42", winRate: "55.8%", maxDrawdown: "-18.2%" },
    score: "B",
  },
  {
    id: "3",
    name: "RSI Mean Reversion",
    description: "Buy when RSI < 30, sell when RSI > 70",
    lastBacktest: { sharpe: "2.10", winRate: "68.1%", maxDrawdown: "-8.9%" },
    score: "S",
  },
];

const SCORE_COLORS: Record<string, string> = {
  S: Colors.scoreS,
  A: Colors.scoreA,
  B: Colors.scoreB,
  C: Colors.scoreC,
  D: Colors.scoreD,
};

export default function StrategyScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="heading">Strategy</Text>
        <Pressable style={styles.addBtn}>
          <Ionicons name="add" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      {/* AI Generate Entry */}
      <Card style={styles.aiCard}>
        <View style={styles.aiCardContent}>
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles" size={24} color={Colors.ai} />
          </View>
          <View style={styles.aiTextBlock}>
            <Text style={styles.aiTitle}>AI Strategy Generator</Text>
            <Text variant="caption">
              Describe your trading idea in natural language
            </Text>
          </View>
        </View>
        <Button
          title="Create with AI"
          onPress={() => router.push("/backtest/run")}
          variant="primary"
          style={styles.aiBtn}
        />
      </Card>

      {/* Strategy List */}
      <View style={styles.sectionHeader}>
        <Text variant="label">My Strategies</Text>
        <Text variant="caption">{MOCK_STRATEGIES.length} total</Text>
      </View>

      <FlatList
        data={MOCK_STRATEGIES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable>
            <Card style={styles.strategyCard}>
              <View style={styles.strategyHeader}>
                <View style={styles.strategyTitleRow}>
                  <Text style={styles.strategyName}>{item.name}</Text>
                  <View style={[styles.scoreBadge, { backgroundColor: SCORE_COLORS[item.score] + "20" }]}>
                    <MonoText size="sm" color={SCORE_COLORS[item.score]}>
                      {item.score}
                    </MonoText>
                  </View>
                </View>
                <Text variant="caption">{item.description}</Text>
              </View>
              <View style={styles.metricsRow}>
                <MetricPill label="Sharpe" value={item.lastBacktest.sharpe} />
                <MetricPill label="Win" value={item.lastBacktest.winRate} />
                <MetricPill label="MDD" value={item.lastBacktest.maxDrawdown} />
              </View>
            </Card>
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <MonoText size="xs" color={Colors.textPrimary}>{value}</MonoText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiCard: {
    marginBottom: Spacing.xl,
    borderColor: Colors.aiBorder,
    borderLeftWidth: 3,
    borderLeftColor: Colors.ai,
  },
  aiCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.aiBg,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTextBlock: {
    flex: 1,
    gap: 2,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  aiBtn: {
    height: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  strategyCard: {
    marginBottom: Spacing.sm,
  },
  strategyHeader: {
    gap: 4,
    marginBottom: Spacing.md,
  },
  strategyTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  strategyName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    flex: 1,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metricPill: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  listContent: {
    paddingBottom: 20,
  },
});
