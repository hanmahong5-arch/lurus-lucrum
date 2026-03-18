/**
 * Wallet Summary Card
 *
 * Displays balance, frozen amount, VIP points with top-up button.
 */

import { View, StyleSheet } from "react-native";
import { Text, MonoText, Card, Button } from "@/components/common";
import { Skeleton } from "@/components/common/Skeleton";
import type { AccountOverview } from "@shared/types";
import { Colors, Spacing } from "@/constants/theme";

interface WalletCardProps {
  overview: AccountOverview | undefined;
  isLoading: boolean;
  vipColor: string;
  onTopup: () => void;
}

export function WalletCard({ overview, isLoading, vipColor, onTopup }: WalletCardProps) {
  if (isLoading) {
    return (
      <View style={styles.skeleton}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={20} style={{ marginTop: 8 }} />
        <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
      </View>
    );
  }

  if (!overview) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text variant="label">Balance</Text>
          <MonoText size="lg" color={Colors.accent}>
            {overview.wallet.balance.toFixed(2)}
          </MonoText>
        </View>
        {overview.wallet.frozen > 0 && (
          <View style={styles.item}>
            <Text variant="label">Frozen</Text>
            <MonoText size="sm" color={Colors.textMuted}>
              {overview.wallet.frozen.toFixed(2)}
            </MonoText>
          </View>
        )}
        <View style={styles.item}>
          <Text variant="label">VIP Points</Text>
          <MonoText size="sm" color={vipColor}>
            {overview.vip.points}
          </MonoText>
        </View>
      </View>
      <Button title="Top Up" onPress={onTopup} variant="secondary" style={styles.btn} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
  },
  skeleton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  item: {
    gap: 4,
  },
  btn: {
    height: 36,
  },
});
