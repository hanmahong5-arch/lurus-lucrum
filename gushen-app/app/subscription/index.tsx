/**
 * Subscription Management Page
 *
 * Current plan, available plans, upgrade/cancel actions.
 */

import { View, StyleSheet, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Card, Button } from "@/components/common";
import { Skeleton } from "@/components/common/Skeleton";
import {
  useSubscription,
  usePlans,
  useSubscriptionCheckout,
  useCancelSubscription,
} from "@/lib/hooks";
import type { ProductPlan } from "@shared/types";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  isLoading,
}: {
  plan: ProductPlan;
  isCurrent: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  return (
    <Card style={StyleSheet.flatten([styles.planCard, isCurrent ? styles.planCardActive : undefined])}>
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{plan.name}</Text>
        {isCurrent && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>CURRENT</Text>
          </View>
        )}
      </View>
      <View style={styles.planPrice}>
        <MonoText size="xl" color={Colors.accent}>
          {plan.price_cny > 0 ? `${plan.price_cny.toFixed(0)}` : "Free"}
        </MonoText>
        {plan.price_cny > 0 && (
          <Text variant="caption"> CNY / {plan.billing_cycle}</Text>
        )}
      </View>
      {!isCurrent && plan.price_cny > 0 && (
        <Button
          title={isLoading ? "Processing..." : "Subscribe"}
          onPress={onSelect}
          variant="primary"
          style={styles.planBtn}
          disabled={isLoading}
        />
      )}
    </Card>
  );
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const checkout = useSubscriptionCheckout();
  const cancel = useCancelSubscription();

  const handleSubscribe = async (plan: ProductPlan) => {
    try {
      const result = await checkout.mutateAsync({
        product_id: "lurus-gushen",
        plan_id: plan.id,
        payment_method: "wallet",
      });

      if (result.pay_url) {
        await WebBrowser.openBrowserAsync(result.pay_url);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      Alert.alert("Error", message);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Subscription",
      "Your subscription will remain active until the end of the current period.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => cancel.mutate(),
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} onPress={() => router.back()} />
        <Text style={styles.title}>Subscription</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Current Subscription */}
      {subLoading ? (
        <Card style={styles.currentCard}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
        </Card>
      ) : subscription ? (
        <Card style={styles.currentCard}>
          <View style={styles.currentRow}>
            <View>
              <Text style={styles.currentPlan}>
                {plans?.find((p) => p.id === subscription.plan_id)?.name ?? "Active Plan"}
              </Text>
              <Text variant="caption">
                Status: {subscription.status} | Auto-renew: {subscription.auto_renew ? "On" : "Off"}
              </Text>
              {subscription.expires_at && (
                <Text variant="caption">
                  Expires: {subscription.expires_at.slice(0, 10)}
                </Text>
              )}
            </View>
          </View>
          {subscription.status === "active" && (
            <Button
              title="Cancel Subscription"
              onPress={handleCancel}
              variant="ghost"
              style={styles.cancelBtn}
              disabled={cancel.isPending}
            />
          )}
        </Card>
      ) : (
        <Card style={styles.currentCard}>
          <Text style={styles.currentPlan}>Free Plan</Text>
          <Text variant="caption">Upgrade to unlock more features</Text>
        </Card>
      )}

      {/* Available Plans */}
      <Text variant="label" style={styles.sectionTitle}>Available Plans</Text>
      {plansLoading ? (
        <View style={styles.plansSkeleton}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={100} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={plans ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <PlanCard
              plan={item}
              isCurrent={subscription?.plan_id === item.id}
              onSelect={() => handleSubscribe(item)}
              isLoading={checkout.isPending}
            />
          )}
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
  currentCard: {
    marginBottom: Spacing["2xl"],
    gap: 8,
  },
  currentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  currentPlan: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cancelBtn: {
    marginTop: Spacing.sm,
    height: 36,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  plansSkeleton: {
    gap: Spacing.md,
  },
  planCard: {
    marginBottom: Spacing.md,
    gap: 8,
  },
  planCardActive: {
    borderColor: Colors.accent,
    borderWidth: 1,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  currentBadge: {
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  planPrice: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  planBtn: {
    height: 36,
    marginTop: Spacing.xs,
  },
});
