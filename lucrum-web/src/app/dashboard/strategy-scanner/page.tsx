/**
 * Redirect: /dashboard/strategy-scanner -> /dashboard/analysis
 *
 * Backward compatibility redirect after navigation restructure.
 * The scanner content is now the default tab in the Analysis center.
 */

import { redirect } from "next/navigation";

export default function StrategyScannerRedirect() {
  redirect("/dashboard/analysis");
}
