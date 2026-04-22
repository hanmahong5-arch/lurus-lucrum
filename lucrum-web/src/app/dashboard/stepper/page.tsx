/**
 * /dashboard/stepper — L3 four-step custom selection wizard.
 *
 * Server component: loads pack list and factor metadata (name/category)
 * at request time so the client can render the factor-weight tuning
 * grid without a second round-trip.
 *
 * @module app/dashboard/stepper/page
 */

import { listPacks } from '@/lib/strategy-packs';
import { listFactors } from '@/lib/factors';
import {
  StepperClient,
  type FactorMeta,
} from '@/components/funnel/stepper-client';

export const dynamic = 'force-dynamic';

export default function StepperPage() {
  const packs = listPacks();
  const factors: ReadonlyArray<FactorMeta> = listFactors().map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
  }));

  return (
    <div className="min-h-screen bg-void text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-white">自定义选股</h1>
          <p className="text-sm text-neutral-400">
            四步向导：股票池 → 基础风格 → 精调 → 运行。每个因子权重、硬过滤、组合参数都能单独调。
          </p>
        </header>
        <StepperClient packs={[...packs]} factors={factors} />
      </div>
    </div>
  );
}
