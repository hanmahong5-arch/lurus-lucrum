/**
 * Profile Tab - Account overview, VIP, wallet, subscription, check-in, settings
 */

import { View, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, Card, Button } from "@/components/common";
import { Skeleton } from "@/components/common/Skeleton";
import { WalletCard } from "@/components/profile/WalletCard";
import { CheckinCard } from "@/components/profile/CheckinCard";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAccountOverview } from "@/lib/hooks/use-account";
import { useSubscription } from "@/lib/hooks/use-billing";
import { logout } from "@/lib/auth/auth";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const VIP_COLORS: Record<number, string> = {
  0: Colors.textMuted,
  1: "#C0C0C0", // silver
  2: "#FFD700", // gold
  3: "#B9F2FF", // diamond
};

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: overview, isLoading: overviewLoading } = useAccountOverview();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  };

  const displayName = overview?.account.displayName ?? user?.name ?? "User";
  const vipLevel = overview?.vip.level ?? 0;
  const vipName = overview?.vip.levelName ?? "Free";
  const vipColor = VIP_COLORS[vipLevel] ?? Colors.textMuted;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={Colors.textMuted} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text variant="caption">{user?.email ?? ""}</Text>
            {overview && (
              <View style={[styles.vipBadge, { borderColor: vipColor }]}>
                <Ionicons name="diamond" size={12} color={vipColor} />
                <Text style={[styles.vipText, { color: vipColor }]}>{vipName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Check-in Card */}
        <CheckinCard />

        {/* Wallet Card */}
        <WalletCard
          overview={overview}
          isLoading={overviewLoading}
          vipColor={vipColor}
          onTopup={() => router.push("/wallet/topup")}
        />

        {/* Subscription Card */}
        <Card style={styles.subCard}>
          <View style={styles.subHeader}>
            <View>
              {subLoading ? (
                <>
                  <Skeleton width={120} height={16} />
                  <Skeleton width={180} height={12} style={{ marginTop: 4 }} />
                </>
              ) : (
                <>
                  <Text style={styles.subTitle}>
                    {subscription
                      ? overview?.subscription?.plan ?? "Active Plan"
                      : "Free Plan"}
                  </Text>
                  <Text variant="caption">
                    {subscription?.expires_at
                      ? `Expires: ${subscription.expires_at.slice(0, 10)}`
                      : "Upgrade for unlimited backtests"}
                  </Text>
                </>
              )}
            </View>
            <View style={[
              styles.subBadge,
              subscription?.status === "active" && styles.subBadgeActive,
            ]}>
              <Text style={[
                styles.subBadgeText,
                subscription?.status === "active" && styles.subBadgeTextActive,
              ]}>
                {subscription?.status?.toUpperCase() ?? "FREE"}
              </Text>
            </View>
          </View>

          {!subscription && (
            <Button
              title="Upgrade Plan"
              onPress={() => router.push("/subscription")}
              variant="primary"
              style={styles.upgradeBtn}
            />
          )}
        </Card>

        {/* Menu Sections */}
        <View style={styles.menuSection}>
          <Text variant="label" style={styles.menuSectionTitle}>Account</Text>
          <MenuItem icon="wallet-outline" label="Wallet & Billing" onPress={() => router.push("/wallet")} />
          <MenuItem icon="gift-outline" label="Referral Program" onPress={() => router.push("/referral")} />
          <MenuItem icon="key-outline" label="API Keys" />
        </View>

        <View style={styles.menuSection}>
          <Text variant="label" style={styles.menuSectionTitle}>Preferences</Text>
          <MenuItem icon="notifications-outline" label="Notifications" />
          <MenuItem icon="language-outline" label="Language" value="English" />
          <MenuItem icon="color-palette-outline" label="Theme" value="Dark" />
        </View>

        <View style={styles.menuSection}>
          <Text variant="label" style={styles.menuSectionTitle}>Support</Text>
          <MenuItem icon="help-circle-outline" label="Help Center" />
          <MenuItem icon="document-text-outline" label="Terms of Service" />
          <MenuItem icon="shield-checkmark-outline" label="Privacy Policy" />
          <MenuItem icon="information-circle-outline" label="About" value="v1.0.0" />
        </View>

        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="ghost"
          style={styles.logoutBtn}
        />

        <View style={styles.spacer} />
      </ScrollView>
    </Screen>
  );
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={20} color={Colors.textSecondary} />
        <Text style={styles.menuItemLabel}>{label}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {value && <Text variant="caption">{value}</Text>}
        <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    gap: 4,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  vipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  subCard: {
    marginBottom: Spacing["2xl"],
  },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  subBadgeActive: {
    backgroundColor: `${Colors.profit}20`,
  },
  subBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  subBadgeTextActive: {
    color: Colors.profit,
  },
  upgradeBtn: {
    height: 40,
  },
  menuSection: {
    marginBottom: Spacing.xl,
  },
  menuSectionTitle: {
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  menuItemLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  logoutBtn: {
    marginTop: Spacing.lg,
  },
  spacer: {
    height: 40,
  },
});
