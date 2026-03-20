/**
 * Redirect: /dashboard/strategy-validation -> /dashboard/validation
 *
 * Backward compatibility redirect after navigation restructure.
 * The strategy validation content is now part of the unified Validation hub.
 */

import { redirect } from "next/navigation";

export default function StrategyValidationRedirect() {
  redirect("/dashboard/validation");
}
