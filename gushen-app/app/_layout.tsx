/**
 * Root Layout
 *
 * Initializes providers, fonts, auth state, and splash screen.
 * Routes to (auth) or (tabs) based on authentication status.
 */

import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { QueryProvider } from "@/lib/providers/query-provider";
import { useAuthStore } from "@/lib/stores/auth-store";
import { tokenManager } from "@/lib/auth/token-manager";
import { Colors } from "@/constants/theme";

// Keep splash visible while loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    tokenManager.start();
    return () => tokenManager.stop();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryProvider>
          <StatusBar style="light" backgroundColor={Colors.void} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.void },
              animation: "fade",
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="backtest/[id]"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="backtest/run"
              options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="stock/[symbol]"
              options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="wallet/index"
              options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="wallet/topup"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="subscription/index"
              options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="referral/index"
              options={{ animation: "slide_from_right" }}
            />
          </Stack>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.void,
  },
});
