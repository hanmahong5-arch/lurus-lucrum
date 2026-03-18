/**
 * Stock Detail Screen
 *
 * Full K-line chart, quote info, quick actions.
 * Deep-linkable: lucrum://stock/600519
 */

import { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Button, Loading } from "@/components/common";
import { KLineChart } from "@/components/charts/KLineChart";
import { useStockQuote, useKLineData } from "@/lib/hooks/use-market-data";
import { useWatchlist } from "@/lib/hooks/use-watchlist";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { KLineTimeFrame } from "@shared/types";

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const [timeframe, setTimeframe] = useState<KLineTimeFrame>("1d");

  const { data: quote, isLoading: quoteLoading } = useStockQuote(symbol ?? "", 10_000);
  const { data: klineData, isLoading: klineLoading } = useKLineData(symbol ?? "", timeframe, 200);
  const { isInWatchlist, toggleWatchlist } = useWatchlist();

  if (!symbol) return null;

  const inWatchlist = isInWatchlist(symbol);
  const isPositive = (quote?.changePercent ?? 0) >= 0;

  return (
    <Screen padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.stockName}>{quote?.name ?? symbol}</Text>
          <MonoText size="sm" color={Colors.textSecondary}>{symbol}</MonoText>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => toggleWatchlist(symbol, quote?.name ?? symbol)}
            style={styles.actionBtn}
          >
            <Ionicons
              name={inWatchlist ? "star" : "star-outline"}
              size={22}
              color={inWatchlist ? Colors.accent : Colors.textSecondary}
            />
          </Pressable>
          <Pressable style={styles.actionBtn}>
            <Ionicons name="share-outline" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Price Banner */}
        {quoteLoading ? (
          <Loading message="Loading quote..." />
        ) : quote ? (
          <View style={styles.priceBanner}>
            <MonoText
              size="display"
              color={isPositive ? Colors.profit : Colors.loss}
            >
              {quote.price.toFixed(2)}
            </MonoText>
            <View style={styles.changeRow}>
              <MonoText
                size="lg"
                color={isPositive ? Colors.profit : Colors.loss}
              >
                {isPositive ? "+" : ""}
                {quote.change.toFixed(2)}
              </MonoText>
              <MonoText
                size="lg"
                color={isPositive ? Colors.profit : Colors.loss}
              >
                {isPositive ? "+" : ""}
                {quote.changePercent.toFixed(2)}%
              </MonoText>
            </View>
          </View>
        ) : null}

        {/* K-Line Chart */}
        <View style={styles.chartSection}>
          {klineLoading ? (
            <Loading message="Loading chart..." />
          ) : klineData && klineData.length > 0 ? (
            <KLineChart
              data={klineData}
              symbol={symbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              height={280}
            />
          ) : (
            <View style={styles.noChart}>
              <Text variant="caption">No chart data for this timeframe</Text>
            </View>
          )}
        </View>

        {/* Quote Details */}
        {quote && (
          <View style={styles.detailsSection}>
            <View style={styles.detailsGrid}>
              <DetailRow label="Open" value={quote.open.toFixed(2)} />
              <DetailRow label="High" value={quote.high.toFixed(2)} />
              <DetailRow label="Low" value={quote.low.toFixed(2)} />
              <DetailRow label="Prev Close" value={quote.prevClose.toFixed(2)} />
              <DetailRow label="Volume" value={formatVolume(quote.volume)} />
              <DetailRow label="Amount" value={formatAmount(quote.amount)} />
              <DetailRow label="Turnover" value={`${quote.turnoverRate.toFixed(2)}%`} />
              {quote.pe != null && <DetailRow label="P/E" value={quote.pe.toFixed(2)} />}
              {quote.pb != null && <DetailRow label="P/B" value={quote.pb.toFixed(2)} />}
              {quote.marketCap != null && (
                <DetailRow label="Market Cap" value={formatAmount(quote.marketCap)} />
              )}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actions}>
          <Button title="AI Analysis" onPress={() => {}} variant="primary" style={styles.actionBtnFull} />
          <Button title="Backtest" onPress={() => router.push(`/backtest/run?symbol=${symbol}`)} variant="secondary" style={styles.actionBtnFull} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="caption">{label}</Text>
      <MonoText size="sm" color={Colors.textPrimary}>{value}</MonoText>
    </View>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 1e8) return `${(vol / 1e8).toFixed(2)}B`;
  if (vol >= 1e4) return `${(vol / 1e4).toFixed(1)}W`;
  return String(vol);
}

function formatAmount(amt: number): string {
  if (amt >= 1e12) return `${(amt / 1e12).toFixed(2)}T`;
  if (amt >= 1e8) return `${(amt / 1e8).toFixed(2)}B`;
  if (amt >= 1e4) return `${(amt / 1e4).toFixed(1)}W`;
  return amt.toFixed(0);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    gap: 2,
  },
  stockName: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  priceBanner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  changeRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: 4,
  },
  chartSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  noChart: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  detailsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  detailsGrid: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  actionBtnFull: {
    flex: 1,
    height: 44,
  },
});
