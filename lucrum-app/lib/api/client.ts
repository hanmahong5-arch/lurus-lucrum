/**
 * API Client with auth interceptors
 *
 * Centralized HTTP client for all API calls.
 * Handles token injection, refresh, and error normalization.
 */

import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { API_CONFIG } from "@/constants/api";
import { tokenStore } from "@/lib/auth/token-store";
import { ensureValidToken } from "@/lib/auth/token-manager";
import { useAuthStore } from "@/lib/stores/auth-store";

// Structured API error
export interface ApiError {
  code: string;
  message: string;
  status: number;
  detail?: unknown;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly apiError: ApiError,
  ) {
    super(apiError.message);
    this.name = "ApiRequestError";
  }

  get status() {
    return this.apiError.status;
  }

  get code() {
    return this.apiError.code;
  }
}

function createClient(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: API_CONFIG.REQUEST_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  // Request interceptor: ensure valid token and inject it
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await ensureValidToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor: handle 401 refresh + error normalization
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;

      // Token expired → attempt refresh
      if (error.response?.status === 401 && originalRequest && !("_retry" in originalRequest)) {
        Object.assign(originalRequest, { _retry: true });

        try {
          const newToken = await refreshToken();
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return instance(originalRequest);
          }
        } catch {
          // Refresh failed → force logout
          useAuthStore.getState().logout();
        }
      }

      // Normalize error
      const apiError: ApiError = {
        code: (error.response?.data as Record<string, unknown>)?.code as string ?? "NETWORK_ERROR",
        message:
          (error.response?.data as Record<string, unknown>)?.message as string ??
          error.message ??
          "Network request failed",
        status: error.response?.status ?? 0,
        detail: (error.response?.data as Record<string, unknown>)?.detail,
      };

      return Promise.reject(new ApiRequestError(apiError));
    },
  );

  return instance;
}

async function refreshToken(): Promise<string | null> {
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

    const { access_token, refresh_token } = response.data;
    await tokenStore.setTokens(access_token, refresh_token);
    return access_token;
  } catch {
    await tokenStore.clearTokens();
    return null;
  }
}

/** Client for lucrum-web API routes */
export const lucrumApi = createClient(API_CONFIG.LUCRUM_API_URL);

/** Client for lurus-api (AI gateway) */
export const lurusApi = createClient(API_CONFIG.LURUS_API_URL);

/** Client for lurus-platform public API (account, billing, wallet, subscription) */
export const platformApi = createClient(API_CONFIG.PLATFORM_API_URL);
