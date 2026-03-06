// Force dynamic rendering for all dashboard pages to avoid prerender errors
// from React Query hooks (useQuery requires a QueryClientProvider at runtime).
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
