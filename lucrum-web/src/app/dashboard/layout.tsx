// Force dynamic rendering for all dashboard pages to avoid prerender errors
// from React Query hooks (useQuery requires a QueryClientProvider at runtime).
export const dynamic = "force-dynamic";

import { QueryProvider } from "@/components/providers/query-provider";
import { StoreHydrationGate } from "@/components/providers/store-hydration-gate";
import { StoreRehydrator } from "@/components/providers/store-rehydrator";
import { NetworkStatusBanner } from "@/components/ui/network-status-banner";
import { WelcomeFlowGate } from "@/components/onboarding/welcome-flow-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <StoreRehydrator />
      <NetworkStatusBanner />
      <StoreHydrationGate>
        <WelcomeFlowGate />
        <DashboardShell>{children}</DashboardShell>
      </StoreHydrationGate>
    </QueryProvider>
  );
}
