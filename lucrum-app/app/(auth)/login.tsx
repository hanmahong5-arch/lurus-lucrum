/**
 * Login Screen
 *
 * Zitadel OIDC login with PKCE flow.
 * Single button → system browser → redirect back.
 */

import { View, StyleSheet } from "react-native";
import { useAuthRequest } from "expo-auth-session";
import { router } from "expo-router";
import { Screen, Text, Button } from "@/components/common";
import {
  OIDC_DISCOVERY,
  OIDC_CONFIG,
  handleAuthResult,
} from "@/lib/auth/auth";
import { Colors, Spacing } from "@/constants/theme";
import { useState } from "react";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, , promptAsync] = useAuthRequest(
    OIDC_CONFIG,
    OIDC_DISCOVERY,
  );

  const handleLogin = async () => {
    if (!request) return;
    setLoading(true);
    setError(null);

    try {
      const result = await promptAsync();
      const success = await handleAuthResult(result, request.codeVerifier);

      if (success) {
        router.replace("/(tabs)/market");
      } else {
        setError("Login cancelled or failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        {/* Placeholder for logo - replace with actual asset */}
        <View style={styles.logoPlaceholder}>
          <Text variant="heading" style={styles.logoText}>
            Lucrum
          </Text>
        </View>
        <Text variant="heading" style={styles.title}>
          AI Quantitative Trading
        </Text>
        <Text variant="caption" style={styles.subtitle}>
          Intelligent strategy analysis & backtesting platform
        </Text>
      </View>

      <View style={styles.actions}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          title="Sign in with Lurus Account"
          onPress={handleLogin}
          loading={loading}
          disabled={!request}
        />

        <Text variant="caption" style={styles.terms}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  header: {
    alignItems: "center",
    marginTop: 80,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  logoText: {
    fontSize: 28,
    color: Colors.primary,
  },
  title: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    maxWidth: 280,
  },
  actions: {
    gap: Spacing.lg,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: Colors.statusBlock,
    borderRadius: 8,
    padding: Spacing.md,
  },
  errorText: {
    color: Colors.statusBlock,
    fontSize: 13,
    textAlign: "center",
  },
  terms: {
    textAlign: "center",
    fontSize: 11,
    color: Colors.textDisabled,
  },
});
