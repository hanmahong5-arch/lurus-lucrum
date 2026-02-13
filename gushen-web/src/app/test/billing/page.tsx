/**
 * Billing API Integration Test Page (Server Wrapper)
 *
 * Forces dynamic rendering to avoid prerender errors from QueryClient.
 */

export const dynamic = "force-dynamic";

import BillingTestContent from "./billing-test-content";

export default function BillingTestPage() {
  return <BillingTestContent />;
}
