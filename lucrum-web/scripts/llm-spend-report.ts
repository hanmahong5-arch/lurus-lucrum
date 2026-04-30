#!/usr/bin/env bun
/**
 * Read `kind:"llm.call"` JSONL lines from stdin and print a spend / health
 * report grouped by caller (default), taskClass, or model.
 *
 * Pure logic lives in `src/lib/llm/spend-report.ts` so it can be unit-tested
 * without an actual cluster. This file only does IO + argv parsing.
 *
 * Examples:
 *
 *   # spend by caller, last 1h on R6
 *   ssh root@100.122.83.20 "kubectl -n lucrum logs deploy/lucrum-web --since=1h" | \
 *     bun run scripts/llm-spend-report.ts
 *
 *   # group by graph node + show only advisor.* callers
 *   ... | bun run scripts/llm-spend-report.ts --group caller --filter advisor.
 *
 *   # JSON output for piping into another tool
 *   ... | bun run scripts/llm-spend-report.ts --json
 *
 * The `scripts/llm-spend-report.sh` wrapper bundles the ssh+kubectl part so
 * you don't have to remember the cluster IP / namespace / deploy name.
 */

import {
  aggregate,
  formatReport,
  parseTelemetryLine,
  type AggregateOptions,
  type FormatOptions,
  type GroupBy,
} from '@/lib/llm/spend-report';
import type { LlmCallTelemetry, TaskClass } from '@/lib/llm/types';

interface CliOptions {
  readonly groupBy: GroupBy;
  readonly format: 'table' | 'json';
  readonly limit: number | null;
  readonly callerSubstring: string | undefined;
  readonly taskClassFilter: ReadonlyArray<TaskClass> | undefined;
}

function parseArgs(argv: ReadonlyArray<string>): CliOptions {
  let groupBy: GroupBy = 'caller';
  let format: 'table' | 'json' = 'table';
  let limit: number | null = 20;
  let callerSubstring: string | undefined;
  let taskClassFilter: ReadonlyArray<TaskClass> | undefined;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--group':
      case '-g':
        if (!next) throw new Error('--group requires a value');
        if (!['caller', 'taskClass', 'modelActual', 'modelRequested'].includes(next)) {
          throw new Error(`invalid --group: ${next}`);
        }
        groupBy = next as GroupBy;
        i += 1;
        break;
      case '--json':
        format = 'json';
        break;
      case '--limit':
        if (!next) throw new Error('--limit requires a value');
        limit = next === '0' ? null : Number.parseInt(next, 10);
        if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
          throw new Error(`invalid --limit: ${next}`);
        }
        i += 1;
        break;
      case '--filter':
      case '-f':
        if (!next) throw new Error('--filter requires a value');
        callerSubstring = next;
        i += 1;
        break;
      case '--class':
        if (!next) throw new Error('--class requires a value');
        taskClassFilter = next.split(',').map((s) => s.trim()) as ReadonlyArray<TaskClass>;
        i += 1;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      // eslint-disable-next-line no-fallthrough
      default:
        throw new Error(`unknown arg: ${arg}`);
    }
  }
  return { groupBy, format, limit, callerSubstring, taskClassFilter };
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: bun run scripts/llm-spend-report.ts [opts]  (reads JSONL from stdin)',
      '',
      'Options:',
      '  --group <field>   bucket by caller (default) | taskClass | modelActual | modelRequested',
      '  --filter <str>    only include events whose caller contains <str>',
      '  --class <list>    comma-separated task class allowlist (routine,analytic,reasoning)',
      '  --limit <n>       max rows in table output (default 20; 0 = all)',
      '  --json            emit raw JSON instead of table',
      '  --help            this message',
      '',
    ].join('\n'),
  );
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  // Bun's web Streams are happy here; node's process.stdin works too via
  // async iteration of Uint8Arrays.
  for await (const chunk of process.stdin as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function main(): Promise<void> {
  let cli: CliOptions;
  try {
    cli = parseArgs(process.argv);
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n\n`);
    printHelp();
    process.exit(2);
  }

  const text = await readStdin();
  if (text.length === 0) {
    process.stderr.write('error: stdin is empty (pipe in `kubectl logs ...` output)\n');
    process.exit(2);
  }

  const events: LlmCallTelemetry[] = [];
  let dropped = 0;
  for (const line of text.split('\n')) {
    if (line.length === 0) continue;
    const parsed = parseTelemetryLine(line);
    if (parsed) events.push(parsed);
    else dropped += 1;
  }

  const aggOpts: AggregateOptions = {
    groupBy: cli.groupBy,
    callerSubstring: cli.callerSubstring,
    taskClassFilter: cli.taskClassFilter,
  };
  const report = { ...aggregate(events, aggOpts), droppedNonTelemetryLines: dropped };

  const fmtOpts: FormatOptions = { format: cli.format, limit: cli.limit };
  process.stdout.write(formatReport(report, fmtOpts) + '\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
