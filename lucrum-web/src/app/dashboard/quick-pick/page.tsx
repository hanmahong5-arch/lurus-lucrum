/**
 * /dashboard/quick-pick — L1 one-click stock picker.
 *
 * Server component: loads the pack list at request time and hands it to
 * the client. No middleware dependencies; respects existing dashboard
 * auth via the parent layout.
 *
 * @module app/dashboard/quick-pick/page
 */

import { listPacks } from '@/lib/strategy-packs';
import { QuickPickClient } from '@/components/funnel/quick-pick-client';

export const dynamic = 'force-dynamic';

export default function QuickPickPage() {
  const packs = listPacks();
  return (
    <div className="min-h-screen bg-void text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-white">一键选股</h1>
          <p className="text-sm text-neutral-400">
            选一个风格，选一个股票池，点一下就得到 10 只股票与推荐理由。
          </p>
        </header>
        <QuickPickClient packs={[...packs]} />
      </div>
    </div>
  );
}
