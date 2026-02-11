/**
 * Login Redirect Utility
 *
 * Handles redirection to Lurus API SSO login endpoint.
 * Flow: gushen → lurus-api OAuth → Zitadel → lurus-api callback → gushen /auth/callback → dashboard
 */

const LURUS_API_URL = process.env.NEXT_PUBLIC_LURUS_API_URL || "https://api.lurus.cn";
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || "lurus";

/**
 * Build the full callback URL for post-OAuth redirect.
 * lurus-api will redirect here after Zitadel authentication completes.
 *
 * @param finalDestination - The page to go to after SSO completes (e.g. "/dashboard")
 */
function buildCallbackUrl(finalDestination: string): string {
  const origin = window.location.origin;
  const callbackPath = "/auth/callback";
  const params = new URLSearchParams({ callbackUrl: finalDestination });
  return `${origin}${callbackPath}?${params.toString()}`;
}

/**
 * Redirects the user to the Lurus API OAuth login page.
 * After Zitadel login, the user will be redirected to /auth/callback,
 * which then navigates to the final destination.
 *
 * @param finalDestination - Page to go after login. Defaults to "/dashboard".
 */
export function redirectToLurusLogin(finalDestination?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const dest = finalDestination || "/dashboard";
  const callbackUrl = buildCallbackUrl(dest);
  const loginURL = `${LURUS_API_URL}/api/v2/${TENANT_SLUG}/auth/login?redirect_url=${encodeURIComponent(callbackUrl)}`;

  window.location.href = loginURL;
}
