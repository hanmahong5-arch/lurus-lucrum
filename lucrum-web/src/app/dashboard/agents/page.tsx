/**
 * Redirect: /dashboard/agents -> /dashboard/advisor?tab=agents
 *
 * Backward compatibility redirect after navigation restructure.
 * Agent management is now a tab in the AI Advisor hub.
 */

import { redirect } from "next/navigation";

export default function AgentsRedirect() {
  redirect("/dashboard/advisor?tab=agents");
}
