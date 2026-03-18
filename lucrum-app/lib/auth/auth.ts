/**
 * Zitadel OIDC Authentication
 *
 * Uses expo-auth-session with PKCE for secure mobile auth flow.
 * Flow: App → Zitadel login page → redirect back → exchange code → store tokens
 */

import {
  makeRedirectUri,
  useAuthRequest,
  type AuthSessionResult,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { API_CONFIG } from "@/constants/api";
import { tokenStore } from "./token-store";
import { useAuthStore } from "@/lib/stores/auth-store";

// Required for expo-auth-session to complete the flow
WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = makeRedirectUri({
  scheme: "lucrum",
  path: "auth/callback",
});

export const OIDC_DISCOVERY = {
  authorizationEndpoint: `${API_CONFIG.ZITADEL_ISSUER}/oauth/v2/authorize`,
  tokenEndpoint: `${API_CONFIG.ZITADEL_ISSUER}/oauth/v2/token`,
  revocationEndpoint: `${API_CONFIG.ZITADEL_ISSUER}/oauth/v2/revoke`,
  userInfoEndpoint: `${API_CONFIG.ZITADEL_ISSUER}/oidc/v1/userinfo`,
  endSessionEndpoint: `${API_CONFIG.ZITADEL_ISSUER}/oidc/v1/end_session`,
};

export const OIDC_CONFIG = {
  clientId: API_CONFIG.ZITADEL_CLIENT_ID,
  redirectUri: REDIRECT_URI,
  scopes: ["openid", "profile", "email", "offline_access"],
  responseType: ResponseType.Code,
  usePKCE: true,
};

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<void> {
  const response = await fetch(OIDC_DISCOVERY.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: API_CONFIG.ZITADEL_CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  await tokenStore.setTokens(
    data.access_token,
    data.refresh_token,
    data.id_token,
    data.expires_in,
  );

  // Fetch user info and update store
  await fetchAndSetUserInfo(data.access_token);
}

/**
 * Fetch user profile from Zitadel userinfo endpoint
 */
async function fetchAndSetUserInfo(accessToken: string): Promise<void> {
  const response = await fetch(OIDC_DISCOVERY.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return;

  const userInfo = await response.json();
  useAuthStore.getState().setUser({
    id: userInfo.sub,
    name: userInfo.name ?? userInfo.preferred_username ?? "",
    email: userInfo.email ?? "",
    avatar: userInfo.picture,
  });
}

/**
 * Handle auth session result from useAuthRequest hook
 */
export async function handleAuthResult(
  result: AuthSessionResult,
  codeVerifier: string | undefined,
): Promise<boolean> {
  if (result.type !== "success" || !result.params?.code || !codeVerifier) {
    return false;
  }

  await exchangeCodeForTokens(result.params.code, codeVerifier);
  return true;
}

/**
 * Logout: revoke token + clear storage
 */
export async function logout(): Promise<void> {
  const token = await tokenStore.getAccessToken();

  if (token) {
    try {
      await fetch(OIDC_DISCOVERY.revocationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: API_CONFIG.ZITADEL_CLIENT_ID,
          token,
        }).toString(),
      });
    } catch {
      // Revocation failure is non-critical
    }
  }

  await tokenStore.clearTokens();
  useAuthStore.getState().logout();
}

export { useAuthRequest, REDIRECT_URI };
