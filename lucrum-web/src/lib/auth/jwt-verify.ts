/**
 * Zitadel JWT Verification
 *
 * Verifies Zitadel-issued JWTs using JWKS (RS256/ES256).
 * Used as fallback when NextAuth session is not available
 * (e.g., mobile app sending Bearer token directly).
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const ZITADEL_ISSUER = process.env.ZITADEL_ISSUER ?? "https://auth.lurus.cn";
const JWKS_URI = `${ZITADEL_ISSUER}/oauth/v2/keys`;

const jwks = createRemoteJWKSet(new URL(JWKS_URI));

export interface ZitadelClaims extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

/**
 * Verify a Zitadel JWT and return claims, or null if invalid.
 */
export async function verifyZitadelJWT(token: string): Promise<ZitadelClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ZITADEL_ISSUER,
    });

    if (!payload.sub) return null;

    return payload as ZitadelClaims;
  } catch {
    return null;
  }
}
