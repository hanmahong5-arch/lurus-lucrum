/**
 * Portfolio Tab - Backtest history with real API, run new backtest
 */

import { useState, useCallback } from "react";
import { View, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Card, StatCard, Loading } from "@/components/common";
import { Skeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useBacktestHistory } from "@/lib/hooks/use-backtest";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { BacktestHistoryItem } from "@shared/types";

export default function PortfolioScreen() {
  const [activeTab, setActiveTab] = useState<"history" | "paper">("history");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useBacktestHistory({ limit: 20 });

  const backtests = data?.pages.flatMap((p) => p.backtests) ?? [];
  const stats = data?.pages[0]?.stats;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="heading">Portfolio</Text>
        <Pressable
          onPress={() => router.push("/backtest/run")}
          style={styles.addBtn}
        >
          <Ionicons name="flask-outline" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Summary Cards */}
      {stats ? (
        <View style={styles.summaryRow}>
          <StatCard
            label="Avg Return"
            value={`${stats.avgReturn >= 0 ? "+" : ""}${(stats.avgReturn * 100).toFixed(1)}%`}
            direction={stats.avgReturn >= 0 ? "up" : "down"}
          />
          <StatCard
            label="Avg Sharpe"
            value={stats.avgSharpe.toFixed(2)}
          />
          <StatCard
            label="Best"
            value={`+${(stats.bestReturn * 100).toFixed(1)}%`}
            direction="up"
          />
        </View>
      ) : isLoading ? (
        <View style={styles.summaryRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton width={60} height={10} />
              <Skeleton width={40} height={16} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : null}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={activeTab === "history" ? styles.tabTextActive : styles.tabText}>
            Backtest History
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "paper" && styles.tabActive]}
          onPress={() => setActiveTab("paper")}
        >
          <Text style={activeTab === "paper" ? styles.tabTextActive : styles.tabText}>
            Paper Trading
          </Text>
        </Pressable>
      </View>

      {activeTab === "history" ? (
        <FlatList
          data={backtests}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressBackgroundColor={Colors.surface}
            />
          }
          renderItem={({ item }) => <BacktestCard item={item} />}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? <Loading message="Loading more..." /> : null
          }
          ListEmptyComponent={
            isLoading ? (
              <View>
                {[1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    width="100%"
                    height={100}
                    borderRadius={12}
                    style={{ marginBottom: 8 }}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="flask-outline"
                title="No backtest history"
                message="Run your first backtest to see results here"
                actionLabel="Run Backtest"
                onAction={() => router.push("/backtest/run")}
              />
            )
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <EmptyState
          icon="analytics-outline"
          title="Paper Trading"
          message="Coming soon — virtual portfolio with real-time P&L tracking"
        />
      )}
    </Screen>
  );
}

function BacktestCard({ item }: { item: BacktestHistoryItem }) {
  const isPositive = item.metrics.totalReturn >= 0;
  const returnPct = (item.metrics.totalReturn * 100).toFixed(2);

  return (
    <Pressable onPress={() => router.push(`/backtest/${item.id}`)}>
      <Card style={styles.backtestCard}>
        <View style={styles.backtestHeader}>
          <Text style={styles.strategyName} numberOfLines={1}>
            {item.strategy?.name ?? "Custom Strategy"}
          </Text>
          <MonoText
            size="sm"
            color={isPositive ? Colors.profit : Colors.loss}
          >
            {isPositive ? "+" : ""}
            {returnPct}%
          </MonoText>
        </View>
        <View style={styles.backtestMeta}>
          <Text variant="caption">
            {item.stockName} ({item.symbol})
          </Text>
          <Text variant="caption">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.backtestMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Sharpe</Text>
            <MonoText size="sm">{item.metrics.sharpeRatio.toFixed(2)}</MonoText>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Win</Text>
            <MonoText size="sm">{(item.metrics.winRate * 100).toFixed(0)}%</MonoText>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>MDD</Text>
            <MonoText size="sm" color={Colors.loss}>
              {(item.metrics.maxDrawdown * 100).toFixed(1)}%
            </MonoText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
      </Card>
    </Pressable>
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
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  skeletonCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: "center",
  },
  tabRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: "500", color: Colors.textSecondary },
  tabTextActive: { fontSize: 13, fontWeight: "600", color: "#fff" },
  backtestCard: { marginBottom: Spacing.sm },
  backtestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  strategyName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  backtestMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  backtestMetrics: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  metricItem: { flexDirection: "row", gap: 4, alignItems: "center" },
  metricLabel: { fontSize: 12, color: Colors.textMuted },
  listContent: { paddingBottom: 20 },
});
