/**
 * Redirect: /dashboard/account -> /dashboard/settings?tab=account
 *
 * Backward compatibility redirect after navigation restructure.
 * Account management is now a tab in the Settings page.
 */

import { redirect } from "next/navigation";

export default function AccountRedirect() {
  redirect("/dashboard/settings?tab=account");
}
