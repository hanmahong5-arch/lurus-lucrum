/**
 * Redirect: /dashboard/referral -> /dashboard/settings?tab=referral
 *
 * Backward compatibility redirect after navigation restructure.
 * Referral content is now a tab in the Settings page.
 */

import { redirect } from "next/navigation";

export default function ReferralRedirect() {
  redirect("/dashboard/settings?tab=referral");
}
