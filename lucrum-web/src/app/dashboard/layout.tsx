// Force dynamic rendering for all dashboard pages to avoid prerender errors
// from React Query hooks (useQuery requires a QueryClientProvider at runtime).
export const dynamic = "force-dynamic";

import { QueryProvider } from "@/components/providers/query-provider";
import { StoreHydrationGate } from "@/components/providers/store-hydration-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <StoreHydrationGate>{children}</StoreHydrationGate>
    </QueryProvider>
  );
}
