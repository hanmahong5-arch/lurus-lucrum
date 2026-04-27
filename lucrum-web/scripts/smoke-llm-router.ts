#!/usr/bin/env bun
/**
 * Live smoke check for the LLM router against the configured gateway.
 *
 * Exercises all three task classes with a real round-trip and prints a JSON
 * report. Exits non-zero if any class fails.
 *
 * This is intentionally NOT a vitest test: the project's vitest config uses
 * happy-dom + faked timers, both of which break real network IO. A standalone
 * bun script is also more useful operationally — anyone can run it after a
 * deploy or token rotation without remembering vitest invocation.
 *
 * Usage:
 *   LLM_API_BASE=https://newapi.lurus.cn/v1 \
 *   LLM_API_KEY=<lucrum-router-token> \
 *     bun run scripts/smoke-llm-router.ts
 */

import { chatComplete, loadGatewayConfig } from '@/lib/llm';

interface SmokeResult {
  readonly taskClass: 'routine' | 'analytic' | 'reasoning';
  readonly model: string | null;
  readonly latencyMs: number;
  readonly totalTokens: number | null;
  readonly contentPreview: string;
  readonly fallbackUsed: boolean;
  readonly success: boolean;
  readonly error: string | null;
}

const cfg = loadGatewayConfig();
if (!cfg.hasKey) {
  console.error('LLM_API_KEY not set — refusing to smoke against an unauthenticated gateway.');
  process.exit(2);
}
console.log(`Gateway: ${cfg.baseURL} (key: ${cfg.apiKey.slice(0, 6)}…)`);

const cases: Array<{
  taskClass: SmokeResult['taskClass'];
  prompt: string;
  maxTokens: number;
}> = [
  { taskClass: 'routine', prompt: 'Reply with the single word OK and nothing else.', maxTokens: 32 },
  { taskClass: 'analytic', prompt: 'In one short sentence, what does alpha decay mean in quant finance?', maxTokens: 2048 },
  { taskClass: 'reasoning', prompt: 'Equal-weight 2 stocks: +5% and -3%. Compute the portfolio return. Reply with just the answer (e.g. "1%").', maxTokens: 8192 },
];

async function runOne(c: typeof cases[number]): Promise<SmokeResult> {
  const t0 = Date.now();
  try {
    const out = await chatComplete(c.taskClass, [{ role: 'user', content: c.prompt }], { maxTokens: c.maxTokens });
    return {
      taskClass: c.taskClass,
      model: out.model,
      latencyMs: Date.now() - t0,
      totalTokens: out.totalTokens,
      contentPreview: out.content.slice(0, 120),
      fallbackUsed: out.fallbackUsed,
      success: out.content.length > 0,
      error: null,
    };
  } catch (err) {
    return {
      taskClass: c.taskClass,
      model: null,
      latencyMs: Date.now() - t0,
      totalTokens: null,
      contentPreview: '',
      fallbackUsed: false,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const results: SmokeResult[] = [];
  for (const c of cases) {
    process.stdout.write(`[smoke] ${c.taskClass} → `);
    const r = await runOne(c);
    results.push(r);
    process.stdout.write(`${r.success ? 'OK' : 'FAIL'} (${r.latencyMs}ms, ${r.model ?? '—'}, ${r.totalTokens ?? '—'} tok)\n`);
    if (r.contentPreview) process.stdout.write(`         "${r.contentPreview}${r.contentPreview.length >= 120 ? '…' : ''}"\n`);
    if (r.error) process.stdout.write(`         ERROR: ${r.error}\n`);
  }

  console.log('\n=== summary ===');
  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.error(`\n${failed.length}/${results.length} task class(es) failed. See above.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} task classes round-trip OK.`);
}

void main();
