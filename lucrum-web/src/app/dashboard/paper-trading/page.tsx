/**
 * Redirect: /dashboard/paper-trading -> /dashboard/trading?tab=paper
 *
 * Backward compatibility redirect after navigation restructure.
 * Paper trading content is now accessible via the Trading center.
 */

import { redirect } from "next/navigation";

export default function PaperTradingRedirect() {
  redirect("/dashboard/trading?tab=paper");
}
