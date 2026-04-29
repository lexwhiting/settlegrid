#!/usr/bin/env tsx
/**
 * Template Audit CLI.
 *
 * Usage:
 *   npx tsx scripts/template-audit/audit.ts [options]
 *
 * Options:
 *   --root <path>         open-source-servers root (default: /Users/lex/settlegrid/open-source-servers)
 *   --out <path>          Output dir (default: docs/template-audit/<runId>)
 *   --sample <N>          Only audit the first N templates (after filter)
 *   --only <slugs>        Comma-separated slug list to restrict to
 *   --skip-determinism    Skip the second audit run used for determinism check
 *   --help                Show this help
 */

import * as path from 'node:path';
import { ALL_RULES } from './rules/index.js';
import { runAudit } from './orchestrator.js';
import { runMetaAudit, compareDeterminism } from './meta-audit.js';
import { buildCorpusReport, writeReports } from './reporter.js';

interface CliOptions {
  root: string;
  out?: string;
  sample?: number;
  only?: string[];
  skipDeterminism: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    root: '/Users/lex/settlegrid/open-source-servers',
    skipDeterminism: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log(
        `Usage: tsx audit.ts [--root PATH] [--out PATH] [--sample N] [--only a,b,c] [--skip-determinism]`,
      );
      process.exit(0);
    }
    if (a === '--root') opts.root = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--sample') opts.sample = Number.parseInt(argv[++i], 10);
    else if (a === '--only') opts.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--skip-determinism') opts.skipDeterminism = true;
    else {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    }
  }
  if (opts.sample !== undefined && (!Number.isInteger(opts.sample) || opts.sample <= 0)) {
    throw new Error(`--sample must be a positive integer, got "${argv[argv.indexOf('--sample') + 1]}"`);
  }
  return opts;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const opts = parseArgs(argv);
  const startedAt = new Date();
  const runId = `run-${startedAt.toISOString().replace(/[:.]/g, '-')}`;
  const outputDir =
    opts.out ?? path.join('/Users/lex/settlegrid/docs/template-audit', runId);

  console.log(`[audit] Starting ${runId}`);
  console.log(`[audit]   root:      ${opts.root}`);
  console.log(`[audit]   rules:     ${ALL_RULES.length}`);
  console.log(`[audit]   output:    ${outputDir}`);
  if (opts.sample) console.log(`[audit]   sample:    ${opts.sample}`);
  if (opts.only) console.log(`[audit]   only:      ${opts.only.join(', ')}`);

  // Step 1 — meta-audit (rule fixtures + id uniqueness) BEFORE touching corpus.
  console.log(`[audit] Phase 1/4: meta-audit (rule fixtures + id uniqueness)`);
  const preflight = await runMetaAudit({ rules: ALL_RULES });
  if (!preflight.passed) {
    console.error(`[audit] META-AUDIT FAILED — aborting before corpus scan.`);
    for (const check of preflight.ruleFixtureChecks) {
      if (!check.knownGoodPassed || !check.knownBadRejected) {
        console.error(
          `  - ${check.ruleId}: goodPassed=${check.knownGoodPassed} badRejected=${check.knownBadRejected}${check.details ? ` — ${check.details}` : ''}`,
        );
      }
    }
    process.exit(2);
  }
  console.log(`[audit]   ${preflight.ruleFixtureChecks.length} rules validated against own fixtures`);

  // Step 2 — main corpus audit.
  console.log(`[audit] Phase 2/4: corpus audit`);
  let progressCount = 0;
  const progressInterval = Math.max(1, Math.floor((opts.sample ?? 1022) / 20));
  const { results, corpus, ruleActivations } = await runAudit({
    root: opts.root,
    rules: ALL_RULES,
    onlySlugs: opts.only,
    limit: opts.sample,
    onProgress: (slug, res) => {
      progressCount++;
      if (progressCount % progressInterval === 0) {
        console.log(`[audit]   ${progressCount} done (latest: ${slug} → ${res.verdict})`);
      }
    },
  });
  console.log(
    `[audit]   ${results.length} templates audited; ${corpus.canonicalSlugs.size} CANONICAL_20`,
  );

  // Step 3 — determinism check (optional, skipped via --skip-determinism).
  let determinism = { passed: true, diffCount: 0, diffs: [] as string[] };
  if (!opts.skipDeterminism) {
    console.log(`[audit] Phase 3/4: determinism (second run)`);
    const second = await runAudit({
      root: opts.root,
      rules: ALL_RULES,
      onlySlugs: opts.only,
      limit: opts.sample,
    });
    determinism = compareDeterminism(results, second.results);
    console.log(
      `[audit]   determinism: ${determinism.passed ? 'PASS' : 'FAIL'} (${determinism.diffCount} diff(s))`,
    );
  } else {
    console.log(`[audit] Phase 3/4: determinism SKIPPED`);
  }

  // Step 4 — post-audit meta (invariants + dead rules).
  console.log(`[audit] Phase 4/4: post-audit meta`);
  const metaAudit = await runMetaAudit({
    rules: ALL_RULES,
    corpusResult: { results, ruleActivations },
  });
  metaAudit.determinism = {
    runTwicePassed: determinism.passed,
    diffCount: determinism.diffCount,
  };

  // Compose + write the report.
  const completedAt = new Date();
  const report = buildCorpusReport({
    runId,
    startedAt,
    completedAt,
    totalTemplates: results.length,
    results,
    ruleActivations,
    metaAudit,
  });
  const { jsonPath, markdownPath, csvPath } = await writeReports(report, outputDir);

  // Summary log.
  console.log('');
  console.log(`[audit] Done in ${((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}s`);
  console.log(`[audit] Verdict distribution:`);
  for (const v of ['KEEP', 'REVIEW', 'REMOVE'] as const) {
    const count = report.verdictCounts[v];
    const pct = ((count / Math.max(1, results.length)) * 100).toFixed(1);
    console.log(`[audit]   ${v.padEnd(7)} ${count.toString().padStart(5)} (${pct}%)`);
  }
  console.log(`[audit] Reports:`);
  console.log(`[audit]   ${markdownPath}`);
  console.log(`[audit]   ${jsonPath}`);
  console.log(`[audit]   ${csvPath}`);
  if (!metaAudit.passed) {
    console.error(`[audit] WARNING: meta-audit invariants failed — see report for details.`);
    process.exit(3);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[audit] fatal:', err);
    process.exit(1);
  });
}
