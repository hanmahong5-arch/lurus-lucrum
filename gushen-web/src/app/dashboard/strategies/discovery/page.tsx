/**
 * Strategy Discovery Page
 *
 * Route: /dashboard/strategies/discovery
 * Layout: Dashboard card grid
 *
 * Renders the strategy discovery page where users can browse
 * popular GitHub-crawled strategies with filtering and search.
 *
 * Story 3.2: Discovery Page & Filter
 */

import { DiscoveryPageContent } from "@/components/discovery/discovery-page-content";

export const metadata = {
  title: "Strategy Discovery | GuShen",
  description: "Browse popular trading strategies from the community",
};

export default function DiscoveryPage() {
  return (
    <main className="min-h-screen bg-void p-4 md:p-6 lg:p-8">
      <DiscoveryPageContent />
    </main>
  );
}