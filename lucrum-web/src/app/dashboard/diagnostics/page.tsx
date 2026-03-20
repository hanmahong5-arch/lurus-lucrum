/**
 * Redirect: /dashboard/diagnostics -> /dashboard/analysis?tab=diagnostics
 *
 * Backward compatibility redirect after navigation restructure.
 * The diagnostics content is now a tab in the Analysis center.
 */

import { redirect } from "next/navigation";

export default function DiagnosticsRedirect() {
  redirect("/dashboard/analysis?tab=diagnostics");
}
