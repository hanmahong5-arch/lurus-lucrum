/**
 * Redirect: /dashboard/insights -> /dashboard/analysis?tab=insights
 *
 * Backward compatibility redirect after navigation restructure.
 * The insights content is now a tab in the Analysis center.
 */

import { redirect } from "next/navigation";

export default function InsightsRedirect() {
  redirect("/dashboard/analysis?tab=insights");
}
