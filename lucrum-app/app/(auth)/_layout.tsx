/**
 * Auth group layout - no navigation chrome
 */

import { Stack } from "expo-router";
import { Colors } from "@/constants/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.void },
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
