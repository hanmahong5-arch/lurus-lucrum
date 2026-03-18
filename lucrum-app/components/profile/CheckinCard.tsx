/**
 * Daily Check-in Card
 *
 * Shows check-in status with streak counter and haptics feedback.
 */

import { View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Text, MonoText, Card, Button } from "@/components/common";
import { Skeleton } from "@/components/common/Skeleton";
import { useCheckinStatus, useDoCheckin } from "@/lib/hooks";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export function CheckinCard() {
  const { data: status, isLoading } = useCheckinStatus();
  const checkin = useDoCheckin();

  const handleCheckin = async () => {
    try {
      await checkin.mutateAsync();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (isLoading) {
    return (
      <Card style={styles.card}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="30%" height={20} style={{ marginTop: 8 }} />
      </Card>
    );
  }

  if (!status) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <View style={styles.labelRow}>
            <Ionicons name="flame" size={16} color={Colors.accent} />
            <Text variant="label">Daily Check-in</Text>
          </View>
          <View style={styles.streakRow}>
            <MonoText size="lg" color={Colors.accent}>{status.streak}</MonoText>
            <Text variant="caption" style={styles.streakLabel}>day streak</Text>
          </View>
          {status.reward_amount > 0 && (
            <Text variant="caption">
              +{status.reward_amount} LB reward
            </Text>
          )}
        </View>
        <Button
          title={status.checked_in_today ? "Checked" : "Check In"}
          onPress={handleCheckin}
          variant={status.checked_in_today ? "ghost" : "primary"}
          style={styles.btn}
          disabled={status.checked_in_today || checkin.isPending}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    gap: 4,
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  streakLabel: {
    marginBottom: 2,
  },
  btn: {
    height: 36,
    minWidth: 90,
    borderRadius: BorderRadius.md,
  },
});
