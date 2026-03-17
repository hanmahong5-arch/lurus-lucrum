/**
 * Entry redirect — routes to tabs or auth based on state
 */

import { Redirect } from "expo-router";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Loading } from "@/components/common";

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return <Loading fullScreen message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/market" />;
  }

  return <Redirect href="/(auth)/login" />;
}
