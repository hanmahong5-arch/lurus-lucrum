/**
 * Redirect: /backtest-agent -> /dashboard/validation?tab=ai
 *
 * Backward compatibility redirect after navigation restructure.
 * The AI backtest agent is now a tab in the Validation hub.
 */

import { redirect } from "next/navigation";

export default function BacktestAgentRedirect() {
  redirect("/dashboard/validation?tab=ai");
}
