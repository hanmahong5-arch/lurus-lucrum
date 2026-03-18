/**
 * Referral Program Page
 *
 * Shows referral code, share link, and referral stats.
 */

import { View, StyleSheet, Share, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Card } from "@/components/common";
import { Skeleton } from "@/components/common/Skeleton";
import { useReferral } from "@/lib/hooks";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function ReferralPage() {
  const router = useRouter();
  const { data: referral, isLoading } = useReferral();

  const handleCopyCode = async () => {
    if (!referral?.aff_code) return;
    await Clipboard.setStringAsync(referral.aff_code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", "Referral code copied to clipboard");
  };

  const handleShare = async () => {
    if (!referral?.referral_url) return;
    await Share.share({
      message: `Join me on Lucrum! Use my referral link: ${referral.referral_url}`,
      url: referral.referral_url,
    });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} onPress={() => router.back()} />
        <Text style={styles.title}>Referral Program</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.skeleton}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="100%" height={60} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={80} style={{ marginTop: 16 }} />
        </View>
      ) : referral ? (
        <>
          {/* Referral Code */}
          <Card style={styles.codeCard}>
            <Text variant="label">Your Referral Code</Text>
            <Pressable style={styles.codeRow} onPress={handleCopyCode}>
              <MonoText size="xl" color={Colors.accent}>
                {referral.aff_code}
              </MonoText>
              <Ionicons name="copy-outline" size={20} color={Colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={Colors.accent} />
              <Text style={styles.shareBtnText}>Share Link</Text>
            </Pressable>
          </Card>

          {/* Stats */}
          <Card style={styles.statsCard}>
            <Text variant="label" style={styles.statsTitle}>Your Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MonoText size="lg" color={Colors.textPrimary}>
                  {referral.stats.total_referrals}
                </MonoText>
                <Text variant="caption">Total Referrals</Text>
              </View>
              <View style={styles.statItem}>
                <MonoText size="lg" color={Colors.accent}>
                  {referral.stats.total_rewarded_lb.toFixed(1)}
                </MonoText>
                <Text variant="caption">LB Earned</Text>
              </View>
            </View>
          </Card>

          {/* How it works */}
          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>How it works</Text>
            <View style={styles.infoList}>
              <InfoItem text="Share your referral code with friends" />
              <InfoItem text="They sign up using your code" />
              <InfoItem text="You earn 5% of their subscription for the first 6 months" />
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function InfoItem({ text }: { text: string }) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
      <Text variant="caption" style={styles.infoText}>{text}</Text>
    </View>
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
  skeleton: {
    gap: Spacing.md,
  },
  codeCard: {
    marginBottom: Spacing.lg,
    gap: 12,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceElevated,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  shareBtnText: {
    color: Colors.accent,
    fontWeight: "600",
    fontSize: 14,
  },
  statsCard: {
    marginBottom: Spacing.lg,
  },
  statsTitle: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing["2xl"],
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  infoCard: {
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  infoList: {
    gap: Spacing.sm,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
  },
});
