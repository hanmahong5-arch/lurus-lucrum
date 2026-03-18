/**
 * Auth State Store (Zustand)
 *
 * Manages authentication state in memory.
 * Tokens are in SecureStore; this store holds user info + auth status.
 */

import { create } from "zustand";
import { tokenStore } from "@/lib/auth/token-store";
import { API_CONFIG } from "@/constants/api";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),

  logout: () => {
    tokenStore.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    try {
      const hasToken = await tokenStore.hasValidToken();
      if (hasToken) {
        // Token exists but we need user info — fetch from userinfo endpoint
        const token = await tokenStore.getAccessToken();
        if (token) {
          const response = await fetch(
            `${API_CONFIG.ZITADEL_ISSUER}/oidc/v1/userinfo`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (response.ok) {
            const userInfo = await response.json();
            set({
              user: {
                id: userInfo.sub,
                name: userInfo.name ?? userInfo.preferred_username ?? "",
                email: userInfo.email ?? "",
                avatar: userInfo.picture,
              },
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }
        }
      }
      set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
