/**
 * Token Lifecycle Manager
 *
 * Centralized token refresh with:
 * - Periodic check (60s interval)
 * - AppState listener (refresh on app resume)
 * - Singleton lock to prevent concurrent refreshes
 * - ensureValidToken() for pre-request validation
 */

import { AppState, type AppStateStatus } from "react-native";
import axios from "axios";
import { API_CONFIG } from "@/constants/api";
import { tokenStore } from "./token-store";
import { useAuthStore } from "@/lib/stores/auth-store";

const REFRESH_CHECK_INTERVAL = 60_000;
const EXPIRY_BUFFER_MS = 300_000; // 5 minutes

let refreshPromise: Promise<string | null> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = await tokenStore.getRefreshToken();
  if (!refresh) return null;

  try {
    const response = await axios.post(
      `${API_CONFIG.ZITADEL_ISSUER}/oauth/v2/token`,
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: API_CONFIG.ZITADEL_CLIENT_ID,
        refresh_token: refresh,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: API_CONFIG.REQUEST_TIMEOUT,
      },
    );

    const { access_token, refresh_token, expires_in } = response.data;
    await tokenStore.setTokens(access_token, refresh_token, undefined, expires_in);
    return access_token;
  } catch {
    await tokenStore.clearTokens();
    useAuthStore.getState().logout();
    return null;
  }
}

async function refreshIfNeeded(): Promise<void> {
  const expiringSoon = await tokenStore.isTokenExpiringSoon(EXPIRY_BUFFER_MS);
  if (!expiringSoon) return;

  const hasRefresh = await tokenStore.getRefreshToken();
  if (!hasRefresh) return;

  await ensureValidToken();
}

function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === "active") {
    refreshIfNeeded();
  }
}

/**
 * Ensure a valid access token is available.
 * If expiring soon, refresh with singleton lock to prevent races.
 * Returns the current valid token or null if refresh fails.
 */
export async function ensureValidToken(): Promise<string | null> {
  const expiringSoon = await tokenStore.isTokenExpiringSoon(EXPIRY_BUFFER_MS);
  if (!expiringSoon) {
    return tokenStore.getAccessToken();
  }

  // Singleton lock: reuse in-flight refresh
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export const tokenManager = {
  start(): void {
    if (intervalId) return;

    intervalId = setInterval(refreshIfNeeded, REFRESH_CHECK_INTERVAL);
    appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

    // Initial check
    refreshIfNeeded();
  },

  stop(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
  },
};
