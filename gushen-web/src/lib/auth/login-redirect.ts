/**
 * Login Redirect Utility
 *
 * Handles redirection to Lurus API SSO login endpoint.
 */

/**
 * Redirects the user to the Lurus API OAuth login page.
 * After successful login, the user will be redirected back to the specified return URL.
 *
 * @param returnUrl - Optional URL to return to after login. Defaults to current page.
 */
export function redirectToLurusLogin(returnUrl?: string): void {
  if (typeof window === 'undefined') {
    console.warn('redirectToLurusLogin called on server side');
    return;
  }

  const currentURL = returnUrl || window.location.href;
  const LURUS_API_URL = process.env.NEXT_PUBLIC_LURUS_API_URL || "https://api.lurus.cn";
  const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || "gushen";

  const loginURL = `${LURUS_API_URL}/api/v2/${tenantSlug}/auth/login?redirect_url=${encodeURIComponent(currentURL)}`;

  window.location.href = loginURL;
}
