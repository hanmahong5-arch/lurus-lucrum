/**
 * Market Tab - Watchlist, indices, stock search
 *
 * Connected to real API hooks. Pull-to-refresh enabled.
 */

import { useState, useCallback } from "react";
import { View, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Card } from "@/components/common";
import { Skeleton, IndexCardsSkeleton, StockRowSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { MiniChart } from "@/components/charts/MiniChart";
import { StockSearchModal } from "@/components/market/StockSearchModal";
import { useMajorIndices, useBatchQuotes } from "@/lib/hooks/use-market-data";
import { useWatchlist } from "@/lib/hooks/use-watchlist";
import { Colors, Spacing } from "@/constants/theme";
import type { IndexQuote } from "@shared/types";

export default function MarketScreen() {
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { items: watchlistItems, symbols: watchlistSymbols, addStock, removeStock } = useWatchlist();
  const { data: indices, isLoading: indicesLoading, refetch: refetchIndices } = useMajorIndices(30_000);
  const { data: quotes, isLoading: quotesLoading, refetch: refetchQuotes } = useBatchQuotes(watchlistSymbols, 15_000);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchIndices(), refetchQuotes()]);
    setRefreshing(false);
  }, [refetchIndices, refetchQuotes]);

  const handleSearchSelect = (symbol: string, name: string) => {
    addStock(symbol, name);
    setSearchVisible(false);
  };

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading">Market</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setSearchVisible(true)} style={styles.iconBtn}>
            <Ionicons name="search" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={watchlistItems}
        keyExtractor={(item) => item.symbol}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.surface}
          />
        }
        ListHeaderComponent={
          <>
            {/* Index Summary */}
            {indicesLoading ? (
              <IndexCardsSkeleton />
            ) : (
              <View style={styles.indexRow}>
                {(indices ?? []).slice(0, 3).map((idx) => (
                  <IndexCard key={idx.symbol} index={idx} />
                ))}
              </View>
            )}

            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <Text variant="label">
                Watchlist ({watchlistItems.length})
              </Text>
              <Pressable onPress={() => setSearchVisible(true)}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const quote = quotes?.[item.symbol];
          const isPositive = (quote?.changePercent ?? 0) >= 0;
          return (
            <Pressable
              style={styles.stockRow}
              onPress={() => router.push(`/stock/${item.symbol}`)}
              onLongPress={() => removeStock(item.symbol)}
            >
              <View style={styles.stockInfo}>
                <Text style={styles.stockName}>{item.name}</Text>
                <MonoText size="xs" color={Colors.textSecondary}>
                  {item.symbol}
                </MonoText>
              </View>

              {/* Mini Sparkline placeholder — shows static for now */}
              <View style={styles.chartArea}>
                {quote && (
                  <MiniChart
                    data={[
                      quote.prevClose,
                      quote.open,
                      quote.low,
                      quote.high,
                      quote.price,
                    ]}
                    positive={isPositive}
                  />
                )}
              </View>

              <View style={styles.stockPrice}>
                {quote ? (
                  <>
                    <MonoText color={Colors.textPrimary}>
                      {quote.price.toFixed(2)}
                    </MonoText>
                    <View
                      style={[
                        styles.changeBadge,
                        { backgroundColor: isPositive ? `${Colors.profit}18` : `${Colors.loss}18` },
                      ]}
                    >
                      <MonoText
                        size="xs"
                        color={isPositive ? Colors.profit : Colors.loss}
                      >
                        {isPositive ? "+" : ""}
                        {quote.changePercent.toFixed(2)}%
                      </MonoText>
                    </View>
                  </>
                ) : quotesLoading ? (
                  <>
                    <Skeleton width={60} height={14} />
                    <Skeleton width={50} height={12} style={{ marginTop: 4 }} />
                  </>
                ) : (
                  <Text variant="caption">--</Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          quotesLoading ? (
            <View>
              {[1, 2, 3, 4, 5].map((i) => (
                <StockRowSkeleton key={i} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="telescope-outline"
              title="Watchlist is empty"
              message="Search and add stocks to track"
              actionLabel="Add Stock"
              onAction={() => setSearchVisible(true)}
            />
          )
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      {/* Search Modal */}
      <StockSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={handleSearchSelect}
        watchlistSymbols={watchlistSymbols}
      />
    </Screen>
  );
}

function IndexCard({ index }: { index: IndexQuote }) {
  const isPositive = index.changePercent >= 0;
  const color = isPositive ? Colors.profit : Colors.loss;
  // Extract short name from full Chinese name
  const shortName = index.name.length > 4 ? index.name.slice(0, 4) : index.name;

  return (
    <Card style={styles.indexCard}>
      <Text style={styles.indexName}>{shortName}</Text>
      <MonoText size="sm" color={Colors.textPrimary}>
        {index.price > 0 ? index.price.toFixed(0) : "--"}
      </MonoText>
      <MonoText size="xs" color={color}>
        {index.price > 0
          ? `${isPositive ? "+" : ""}${index.changePercent.toFixed(2)}%`
          : "--"}
      </MonoText>
    </Card>
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
  headerActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  indexRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  indexCard: {
    flex: 1,
    padding: Spacing.md,
    alignItems: "center",
    gap: 2,
  },
  indexName: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stockInfo: {
    flex: 1,
    gap: 2,
  },
  stockName: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  chartArea: {
    width: 80,
    alignItems: "center",
  },
  stockPrice: {
    alignItems: "flex-end",
    minWidth: 80,
    gap: 4,
  },
  changeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
});
