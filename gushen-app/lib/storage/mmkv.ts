/**
 * MMKV Storage Adapter
 *
 * High-performance key-value storage for non-sensitive data.
 * Replaces localStorage from web. ~30x faster than AsyncStorage.
 */

import { MMKV } from "react-native-mmkv";
import type { StateStorage } from "zustand/middleware";

export const storage = new MMKV({
  id: "gushen-app-storage",
  encryptionKey: "gushen-mmkv-key",
});

/**
 * Zustand persistence adapter for MMKV
 * Usage: persist(store, { storage: zustandMMKVStorage })
 */
export const zustandMMKVStorage: StateStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};

/**
 * Typed helpers for common cache operations
 */
export const cache = {
  getString: (key: string): string | undefined => storage.getString(key),

  setString: (key: string, value: string): void => {
    storage.set(key, value);
  },

  getObject: <T>(key: string): T | undefined => {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },

  setObject: <T>(key: string, value: T): void => {
    storage.set(key, JSON.stringify(value));
  },

  /**
   * Get with TTL check. Returns undefined if expired.
   */
  getWithTTL: <T>(key: string): T | undefined => {
    const raw = storage.getString(`${key}:data`);
    const expiry = storage.getString(`${key}:expiry`);
    if (!raw || !expiry) return undefined;
    if (Date.now() > Number(expiry)) {
      storage.delete(`${key}:data`);
      storage.delete(`${key}:expiry`);
      return undefined;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },

  /**
   * Set with TTL (in seconds)
   */
  setWithTTL: <T>(key: string, value: T, ttlSeconds: number): void => {
    storage.set(`${key}:data`, JSON.stringify(value));
    storage.set(`${key}:expiry`, String(Date.now() + ttlSeconds * 1000));
  },

  delete: (key: string): void => {
    storage.delete(key);
  },

  clear: (): void => {
    storage.clearAll();
  },
};
