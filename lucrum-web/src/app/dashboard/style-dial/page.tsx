/**
 * /dashboard/style-dial — L2 three-axis risk style dial.
 *
 * Server component: no data loading. Hands off to the client surface,
 * which owns all dial/universe state and streams from the synthesizer.
 *
 * @module app/dashboard/style-dial/page
 */

import { StyleDialClient } from '@/components/funnel/style-dial-client';

export const dynamic = 'force-dynamic';

export default function StyleDialPage() {
  return (
    <div className="min-h-screen bg-void text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-white">风格调节</h1>
          <p className="text-sm text-neutral-400">
            三滑块：收益·集中·时长。滑动体感试出最合适的风格，服务器按滑块合成策略包并选股。
          </p>
        </header>
        <StyleDialClient />
      </div>
    </div>
  );
}
