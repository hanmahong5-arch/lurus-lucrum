/**
 * Secure Token Storage
 *
 * Uses expo-secure-store (Android Keystore / iOS Keychain)
 * for sensitive auth tokens. Non-sensitive data uses MMKV.
 */

import * as SecureStore from "expo-secure-store";

const KEYS = {
  ACCESS_TOKEN: "gushen_access_token",
  REFRESH_TOKEN: "gushen_refresh_token",
  ID_TOKEN: "gushen_id_token",
  TOKEN_EXPIRY: "gushen_token_expiry",
} as const;

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const tokenStore = {
  async setTokens(
    accessToken: string,
    refreshToken: string,
    idToken?: string,
    expiresIn?: number,
  ): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken, SECURE_OPTIONS),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken, SECURE_OPTIONS),
      idToken
        ? SecureStore.setItemAsync(KEYS.ID_TOKEN, idToken, SECURE_OPTIONS)
        : Promise.resolve(),
      expiresIn
        ? SecureStore.setItemAsync(
            KEYS.TOKEN_EXPIRY,
            String(Date.now() + expiresIn * 1000),
            SECURE_OPTIONS,
          )
        : Promise.resolve(),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    // Check expiry first
    const expiry = await SecureStore.getItemAsync(KEYS.TOKEN_EXPIRY, SECURE_OPTIONS);
    if (expiry && Date.now() > Number(expiry)) {
      return null; // Expired — caller should refresh
    }
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN, SECURE_OPTIONS);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN, SECURE_OPTIONS);
  },

  async getIdToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ID_TOKEN, SECURE_OPTIONS);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN, SECURE_OPTIONS),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN, SECURE_OPTIONS),
      SecureStore.deleteItemAsync(KEYS.ID_TOKEN, SECURE_OPTIONS),
      SecureStore.deleteItemAsync(KEYS.TOKEN_EXPIRY, SECURE_OPTIONS),
    ]);
  },

  async hasValidToken(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  },

  async getTokenExpiry(): Promise<number | null> {
    const expiry = await SecureStore.getItemAsync(KEYS.TOKEN_EXPIRY, SECURE_OPTIONS);
    return expiry ? Number(expiry) : null;
  },

  async isTokenExpiringSoon(bufferMs = 300_000): Promise<boolean> {
    const expiry = await this.getTokenExpiry();
    if (!expiry) return true;
    return Date.now() + bufferMs > expiry;
  },
};
