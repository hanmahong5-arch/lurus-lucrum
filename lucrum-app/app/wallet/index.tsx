/**
 * Wallet Detail Page
 *
 * Balance overview, recent transactions, and top-up entry.
 */

import { View, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Card, Button } from "@/components/common";
import { Skeleton } from "@/components/common/Skeleton";
import { useWallet, useWalletTransactions } from "@/lib/hooks";
import type { WalletTransaction } from "@shared/types";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const TX_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  topup: { label: "Top Up", icon: "arrow-down-circle", color: Colors.profit },
  subscription: { label: "Subscription", icon: "card", color: Colors.loss },
  checkin_reward: { label: "Check-in", icon: "gift", color: Colors.accent },
  referral_reward: { label: "Referral", icon: "people", color: Colors.ai },
  bonus: { label: "Bonus", icon: "star", color: Colors.accent },
  refund: { label: "Refund", icon: "return-down-back", color: Colors.profit },
  redemption: { label: "Redeem", icon: "ticket", color: Colors.accent },
};

function TransactionItem({ tx }: { tx: WalletTransaction }) {
  const typeInfo = TX_TYPE_LABELS[tx.type] ?? { label: tx.type, icon: "swap-horizontal", color: Colors.textSecondary };
  const isPositive = tx.amount > 0;

  return (
    <View style={styles.txItem}>
      <View style={styles.txLeft}>
        <View style={[styles.txIcon, { backgroundColor: `${typeInfo.color}20` }]}>
          <Ionicons name={typeInfo.icon as keyof typeof Ionicons.glyphMap} size={16} color={typeInfo.color} />
        </View>
        <View>
          <Text style={styles.txLabel}>{typeInfo.label}</Text>
          <Text variant="caption">{tx.description}</Text>
        </View>
      </View>
      <View style={styles.txRight}>
        <MonoText size="sm" color={isPositive ? Colors.profit : Colors.loss}>
          {isPositive ? "+" : ""}{tx.amount.toFixed(2)}
        </MonoText>
        <Text variant="caption">{tx.created_at.slice(0, 10)}</Text>
      </View>
    </View>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: txData, isLoading: txLoading } = useWalletTransactions(1);

  return (
    <Screen>
      <View style={styles.header}>
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} onPress={() => router.back()} />
        <Text style={styles.title}>Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Balance Card */}
      {walletLoading ? (
        <Card style={styles.balanceCard}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="60%" height={28} style={{ marginTop: 8 }} />
        </Card>
      ) : wallet ? (
        <Card style={styles.balanceCard}>
          <Text variant="label">Total Balance</Text>
          <MonoText size="xl" color={Colors.accent}>
            {wallet.balance.toFixed(2)} LB
          </MonoText>
          <View style={styles.balanceRow}>
            {wallet.frozen > 0 && (
              <Text variant="caption">Frozen: {wallet.frozen.toFixed(2)}</Text>
            )}
            <Text variant="caption">Lifetime Topup: {wallet.lifetime_topup.toFixed(2)}</Text>
          </View>
          <Button
            title="Top Up"
            onPress={() => router.push("/wallet/topup")}
            variant="primary"
            style={styles.topupBtn}
          />
        </Card>
      ) : null}

      {/* Transactions */}
      <Text variant="label" style={styles.sectionTitle}>Recent Transactions</Text>
      {txLoading ? (
        <View style={styles.txSkeleton}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={48} style={{ marginBottom: 8 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={txData?.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <TransactionItem tx={item} />}
          ListEmptyComponent={
            <Text variant="caption" style={styles.emptyText}>No transactions yet</Text>
          }
          scrollEnabled={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  balanceCard: {
    marginBottom: Spacing["2xl"],
    gap: 8,
  },
  balanceRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  topupBtn: {
    marginTop: Spacing.sm,
    height: 40,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  txSkeleton: {
    paddingHorizontal: 4,
  },
  txItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  txLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  txLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  txRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  emptyText: {
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
