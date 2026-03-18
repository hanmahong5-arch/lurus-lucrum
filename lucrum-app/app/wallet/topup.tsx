/**
 * Top Up Page (Modal)
 *
 * Amount selection -> payment method -> open payment URL in browser -> poll order status.
 */

import { useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, MonoText, Button } from "@/components/common";
import { Skeleton } from "@/components/common/Skeleton";
import { useTopupInfo, useCreateTopup } from "@/lib/hooks";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const AMOUNT_OPTIONS = [10, 50, 100, 200, 500, 1000];

export default function TopupPage() {
  const router = useRouter();
  const { data: topupInfo, isLoading } = useTopupInfo();
  const createTopup = useCreateTopup();

  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [selectedMethod, setSelectedMethod] = useState<string>("");

  // Auto-select first payment method
  if (!selectedMethod && topupInfo?.payment_methods?.length && topupInfo.payment_methods[0]) {
    setSelectedMethod(topupInfo.payment_methods[0].id);
  }

  const handleTopup = async () => {
    if (!selectedAmount || !selectedMethod) {
      Alert.alert("Error", "Please select amount and payment method");
      return;
    }

    try {
      const result = await createTopup.mutateAsync({
        amount_cny: selectedAmount,
        payment_method: selectedMethod,
        return_url: "lucrum://wallet",
      });

      if (result.pay_url) {
        await WebBrowser.openBrowserAsync(result.pay_url);
        // After returning from browser, go back to wallet page to see updated balance
        router.back();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed";
      Alert.alert("Error", message);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Ionicons name="close" size={24} color={Colors.textPrimary} onPress={() => router.back()} />
        <Text style={styles.title}>Top Up</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Amount Selection */}
      <Text variant="label" style={styles.sectionTitle}>Select Amount (CNY)</Text>
      <View style={styles.amountGrid}>
        {AMOUNT_OPTIONS.map((amount) => (
          <Pressable
            key={amount}
            style={[
              styles.amountItem,
              selectedAmount === amount && styles.amountItemActive,
            ]}
            onPress={() => setSelectedAmount(amount)}
          >
            <MonoText
              size="base"
              color={selectedAmount === amount ? Colors.void : Colors.textPrimary}
            >
              {amount}
            </MonoText>
          </Pressable>
        ))}
      </View>

      {/* Payment Method */}
      <Text variant="label" style={styles.sectionTitle}>Payment Method</Text>
      {isLoading ? (
        <View style={styles.methodSkeleton}>
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={48} />
        </View>
      ) : (
        <View style={styles.methodList}>
          {topupInfo?.payment_methods.map((method) => (
            <Pressable
              key={method.id}
              style={[
                styles.methodItem,
                selectedMethod === method.id && styles.methodItemActive,
              ]}
              onPress={() => setSelectedMethod(method.id)}
            >
              <Text style={styles.methodName}>{method.name}</Text>
              {selectedMethod === method.id && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Submit */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text variant="label">Total</Text>
          <MonoText size="lg" color={Colors.accent}>
            {selectedAmount.toFixed(2)} CNY
          </MonoText>
        </View>
        <Button
          title={createTopup.isPending ? "Processing..." : "Pay Now"}
          onPress={handleTopup}
          variant="primary"
          style={styles.payBtn}
          disabled={createTopup.isPending || !selectedMethod}
        />
      </View>
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
  sectionTitle: {
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  amountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  amountItem: {
    width: "30%",
    flexGrow: 1,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  amountItemActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  methodSkeleton: {
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  methodList: {
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  methodItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  methodItemActive: {
    borderColor: Colors.accent,
  },
  methodName: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  footer: {
    marginTop: "auto",
    gap: Spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payBtn: {
    height: 48,
  },
});
