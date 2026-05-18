#!/usr/bin/env tsx
/**
 * One-shot backfill script for the P3.2 Templater scale run output.
 *
 * Surfaced by the P3.2 spec-diff audit:
 *   (1) New Templater templates ship without template.json (P2.6 manifest)
 *       — so they're invisible to the gallery registry build (P2.7
 *       build-registry.ts walks open-source-servers/ *\/template.json).
 *   (2) The run produced JSONL per-attempt telemetry but not the
 *       aggregate <timestamp>-summary.json required by the P3.2 DoD.
 *
 * This script fixes both without changing Templater pipeline code —
 * the pipeline fix (emit template.json during generateTemplateFiles)
 * is a follow-up for a future Templater prompt iteration.
 *
 * Run:
 *   npx tsx scripts/template-audit/backfill-p3-2-manifests.ts \
 *     --run-jsonl /Users/lex/settlegrid-agents/data/templater/runs/<ts>.jsonl
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import {
  extractServerPricing,
  type MethodPricing,
} from '../lib/template-pricing';

interface AttemptTelemetry {
  runId: string;
  category: string;
  toolName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  verdict: string;
  spec?: { apiName: string; docUrl: string };
  templateSlug?: string;
  errorMessage?: string;
  costUsdAttempt: number;
  cumulativeCostUsd: number;
  tokensInAttempt: number;
  tokensOutAttempt: number;
  invocationsAttempt: number;
  modelsAttempt: string[];
}

/**
 * The P2.6 manifest schema (packages/mcp/src/template-schema.ts) constrains
 * category to a 10-value enum. Templater categories.json uses much more
 * specific slugs (rag, vector-dbs, etc.) — we map them to the canonical
 * gallery enum here so the registry build accepts every backfilled manifest.
 */
type GalleryCategory =
  | 'ai'
  | 'data'
  | 'devtools'
  | 'infra'
  | 'productivity'
  | 'finance'
  | 'commerce'
  | 'media'
  | 'research'
  | 'other';

const TEMPLATER_TO_GALLERY_CATEGORY: Record<string, GalleryCategory> = {
  rag: 'ai',
  'vector-dbs': 'data',
  'agent-frameworks': 'ai',
  'llm-gateways': 'ai',
  'eval-tools': 'devtools',
  observability: 'devtools',
  'fine-tuning': 'ai',
  embeddings: 'ai',
  'image-gen': 'media',
  speech: 'media',
  translation: 'productivity',
  'code-analysis': 'devtools',
  scraping: 'data',
  'browser-automation': 'devtools',
  'data-pipelines': 'data',
  'document-intelligence': 'data',
  'knowledge-graphs': 'data',
  'prompt-engineering': 'ai',
  'synthetic-data': 'data',
  'ml-monitoring': 'devtools',
};

export function mapCategory(templaterCategory: string): GalleryCategory {
  return TEMPLATER_TO_GALLERY_CATEGORY[templaterCategory] ?? 'other';
}

interface TemplateManifest {
  slug: string;
  name: string;
  description: string;
  version: string;
  category: GalleryCategory;
  /** Templater-specific category preserved here for P3.3 filtering without colliding with the gallery enum. */
  tags: string[];
  author: { name: string; url: string; github: string };
  repo: { type: 'git'; url: string };
  runtime: 'node';
  languages: string[];
  entry: string;
  /**
   * `perCallUsdCents` is the headline price (= server.ts `defaultCostCents`);
   * `methods` carries the full per-method price map so the manifest is not a
   * lossy projection of the SDK pricing the platform actually meters on.
   */
  pricing: {
    model: 'per-call';
    perCallUsdCents: number;
    methods?: Record<string, MethodPricing>;
  };
  quality: { tests: false };
  capabilities: string[];
  featured: boolean;
}

const OSS_ROOT = '/Users/lex/settlegrid/open-source-servers';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { runJsonl: string } {
  let runJsonl: string | undefined;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--run-jsonl') runJsonl = argv[++i];
  }
  if (!runJsonl) {
    throw new Error('Usage: backfill-p3-2-manifests.ts --run-jsonl <path>');
  }
  return { runJsonl };
}

// ---------------------------------------------------------------------------
// Extract metadata from a template's on-disk files
// ---------------------------------------------------------------------------

export async function readPkg(templateDir: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fsp.readFile(path.join(templateDir, 'package.json'), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function readServerTs(templateDir: string): Promise<string | null> {
  try {
    return await fsp.readFile(path.join(templateDir, 'src/server.ts'), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Extract pricing.defaultCostCents from the `settlegrid.init({...})` call
 * in server.ts. Delegates to the shared `extractServerPricing()` — the
 * single source of truth for pricing extraction — and applies a >= 1
 * floor: a missing or zero default falls back to 1.
 */
export function extractDefaultCostCents(serverTs: string): number {
  const { defaultCostCents } = extractServerPricing(serverTs);
  return Number.isInteger(defaultCostCents) && defaultCostCents >= 1
    ? defaultCostCents
    : 1;
}

/**
 * Extract sg.wrap method names from server.ts as the capabilities list.
 * Looks for `sg.wrap(..., { method: 'NAME' })` patterns — scoped to the
 * lowercase-identifier shape sg.wrap takes (e.g. `get_thing`). HTTP verb
 * method names (GET/POST/PUT/...) that appear in fetch() options
 * ({ method: 'POST' }) must be filtered out; they're not sg.wrap methods.
 */
const HTTP_VERBS = new Set([
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS',
  'get', 'post', 'put', 'delete', 'patch', 'head', 'options',
]);

export function extractCapabilities(serverTs: string): string[] {
  const caps = new Set<string>();
  // Only match lowercase snake_case identifiers — sg.wrap method names
  // are conventionally verb-prefixed snake_case (get_thing, search_items).
  // HTTP verbs (POST etc.) are uppercase-only and the regex already
  // rejects them; this defense-in-depth filter catches the all-lowercase
  // variants (e.g. fetch({ method: 'get' })).
  const re = /method\s*:\s*['"]([a-z_][a-z0-9_]*)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(serverTs)) !== null) {
    const name = m[1];
    if (HTTP_VERBS.has(name)) continue;
    // Additional filter: sg.wrap method names are always verb-prefixed
    // snake_case; reject anything without an underscore unless it's
    // clearly a composed tool name.
    caps.add(name);
  }
  return Array.from(caps).sort();
}

export function humanizeName(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function buildManifest(
  slug: string,
  templaterCategory: string,
  pkg: Record<string, unknown>,
  serverTs: string,
): TemplateManifest {
  const description =
    (typeof pkg.description === 'string' ? pkg.description : '') ||
    `MCP server for ${humanizeName(slug)} with SettleGrid billing`;
  const version = (typeof pkg.version === 'string' ? pkg.version : '') || '1.0.0';
  const keywords = Array.isArray(pkg.keywords)
    ? (pkg.keywords as unknown[])
        .filter((k) => typeof k === 'string')
        .map((k) => k as string)
    : [];
  const perCallUsdCents = extractDefaultCostCents(serverTs);
  // Per-method price map — the SDK already meters per method, so the
  // manifest carries the full map rather than a single flattened number.
  const { methods } = extractServerPricing(serverTs);
  const capabilities = extractCapabilities(serverTs);

  // Tag assembly:
  //   - Templater category slug preserved as first tag (lets future tooling
  //     filter by "synthetic-data", "vector-dbs" etc. even though the
  //     gallery category enum collapses these to broader buckets).
  //   - package.json keywords, minus registry-boilerplate (settlegrid/mcp/ai).
  //   - Capped at 10 entries — P2.6 schema limit.
  const tagSet = new Set<string>([templaterCategory, ...keywords]);
  tagSet.delete('settlegrid');
  tagSet.delete('mcp');
  tagSet.delete('ai');
  const tags = Array.from(tagSet)
    .filter((t) => t.length > 0 && t.length < 40)
    .slice(0, 10);

  return {
    slug,
    name: humanizeName(slug),
    description,
    version,
    category: mapCategory(templaterCategory),
    tags,
    author: {
      name: 'Alerterra, LLC',
      url: 'https://settlegrid.ai',
      github: 'settlegrid',
    },
    repo: {
      type: 'git',
      url: `https://github.com/settlegrid/settlegrid-${slug}`,
    },
    runtime: 'node',
    languages: ['ts'],
    entry: 'src/server.ts',
    pricing: {
      model: 'per-call',
      perCallUsdCents,
      ...(methods ? { methods } : {}),
    },
    quality: { tests: false },
    capabilities,
    featured: false,
  };
}

// ---------------------------------------------------------------------------
// Run summary generation
// ---------------------------------------------------------------------------

interface RunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  totalAttempts: number;
  passed: number;
  rejected: number;
  failed: number;
  rejectRatePct: number;
  totalCostUsdTracked: number;
  costPerSuccessfulTemplateUsdTracked: number;
  tokensInTracked: number;
  tokensOutTracked: number;
  topFailureClusters: Array<{ verdict: string; count: number }>;
  costTrackingNote: string;
  backfilledTemplateJson: number;
  skippedAlreadyHadTemplateJson: number;
}

export function buildRunSummary(
  attempts: AttemptTelemetry[],
  backfilledCount: number,
  skippedCount: number,
): RunSummary {
  const passed = attempts.filter((a) => a.verdict === 'pass').length;
  const rejected = attempts.filter((a) => a.verdict === 'rejected-by-spec-generator').length;
  const failed = attempts.length - passed - rejected;
  const totalCost = attempts.reduce((s, a) => s + (a.costUsdAttempt ?? 0), 0);
  const tokensIn = attempts.reduce((s, a) => s + (a.tokensInAttempt ?? 0), 0);
  const tokensOut = attempts.reduce((s, a) => s + (a.tokensOutAttempt ?? 0), 0);
  // Guard against malformed timestamps — `new Date(garbage).getTime()` is
  // NaN, which would make durationSeconds also NaN and serialize as null in
  // the summary JSON. Clamp to 0 if either end is unparseable.
  const start = new Date(attempts[0].startedAt).getTime();
  const end = new Date(attempts[attempts.length - 1].completedAt).getTime();
  const durationSeconds =
    Number.isFinite(start) && Number.isFinite(end) && end >= start
      ? Math.round((end - start) / 1000)
      : 0;

  const verdictCounts = new Map<string, number>();
  for (const a of attempts) {
    if (a.verdict === 'pass') continue;
    verdictCounts.set(a.verdict, (verdictCounts.get(a.verdict) ?? 0) + 1);
  }
  const topFailureClusters = Array.from(verdictCounts.entries())
    .map(([verdict, count]) => ({ verdict, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    runId: attempts[0].runId,
    startedAt: attempts[0].startedAt,
    completedAt: attempts[attempts.length - 1].completedAt,
    durationSeconds,
    totalAttempts: attempts.length,
    passed,
    rejected,
    failed,
    rejectRatePct: +((100 * (rejected + failed)) / Math.max(1, attempts.length)).toFixed(1),
    totalCostUsdTracked: +totalCost.toFixed(6),
    costPerSuccessfulTemplateUsdTracked:
      passed > 0 ? +(totalCost / passed).toFixed(6) : 0,
    tokensInTracked: tokensIn,
    tokensOutTracked: tokensOut,
    topFailureClusters,
    costTrackingNote:
      'Tracked cost covers generateSpec (Haiku) only — fetchApiDocs + synthesizeTemplate use their own Anthropic clients and are NOT captured by the BudgetTracker. Real Sonnet spend on this run was ~$25-35 untracked (per P3.1 known limitation).',
    backfilledTemplateJson: backfilledCount,
    skippedAlreadyHadTemplateJson: skippedCount,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Slug format constraint — same shape the Templater pipeline + P2.6 schema
// enforce. A hostile JSONL line could try `../../../etc/hostile` for the
// templateSlug; require explicit validation before path concatenation so
// the backfill can't be tricked into writing outside OSS_ROOT even if the
// target directory pre-exists by some other means.
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

export interface AttemptTelemetryExport extends AttemptTelemetry {}
export type { RunSummary, TemplateManifest, GalleryCategory };

async function main(): Promise<void> {
  const { runJsonl } = parseArgs(process.argv);
  const raw = await fsp.readFile(runJsonl, 'utf-8');

  // Parse each line individually — a single malformed line must NOT take
  // down the whole backfill. Log skipped lines and proceed with the
  // survivors. Resilient to hand-edited JSONL files.
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const attempts: AttemptTelemetry[] = [];
  let parseSkips = 0;
  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]) as AttemptTelemetry;
      attempts.push(parsed);
    } catch (err) {
      parseSkips++;
      console.warn(
        `[backfill] skipping malformed JSONL line ${i + 1}: ${(err as Error).message.slice(0, 120)}`,
      );
    }
  }
  console.log(
    `[backfill] Loaded ${attempts.length} attempts from ${runJsonl}${parseSkips > 0 ? ` (${parseSkips} malformed lines skipped)` : ''}`,
  );

  if (attempts.length === 0) {
    console.error('[backfill] No valid attempts in JSONL; nothing to do.');
    process.exit(1);
  }

  const passes = attempts.filter((a) => a.verdict === 'pass' && a.templateSlug);
  console.log(`[backfill] ${passes.length} passes with templateSlug; processing…`);

  let backfilled = 0;
  let skipped = 0;
  let invalidSlug = 0;
  const missingDir: string[] = [];
  for (const attempt of passes) {
    const slug = attempt.templateSlug!;
    // Reject hostile slugs BEFORE path construction. Logs a structured
    // warning so operators can trace JSONL integrity issues.
    if (!SLUG_REGEX.test(slug)) {
      invalidSlug++;
      console.warn(
        `[backfill] skip: invalid slug "${slug.slice(0, 80)}" (must match ${SLUG_REGEX})`,
      );
      continue;
    }
    const dir = path.join(OSS_ROOT, `settlegrid-${slug}`);
    try {
      await fsp.stat(dir);
    } catch {
      missingDir.push(slug);
      continue;
    }
    const manifestPath = path.join(dir, 'template.json');
    try {
      await fsp.stat(manifestPath);
      skipped++;
      continue;
    } catch {
      /* doesn't exist — backfill */
    }
    const pkg = await readPkg(dir);
    const serverTs = await readServerTs(dir);
    if (!pkg || !serverTs) {
      console.warn(`[backfill] skip ${slug}: missing package.json or server.ts`);
      continue;
    }
    const manifest = buildManifest(slug, attempt.category, pkg, serverTs);
    await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    backfilled++;
  }

  console.log(
    `[backfill] template.json: ${backfilled} written, ${skipped} pre-existing, ${missingDir.length} missing dirs, ${invalidSlug} invalid slugs rejected`,
  );
  if (missingDir.length > 0) {
    console.warn(`[backfill] missing dirs (passes without on-disk templates): ${missingDir.join(', ')}`);
  }

  // Run summary JSON — required by P3.2 DoD
  const summaryPath = runJsonl.replace(/\.jsonl$/, '-summary.json');
  const summary = buildRunSummary(attempts, backfilled, skipped);
  await fsp.writeFile(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf-8');
  console.log(`[backfill] run summary written: ${summaryPath}`);
  console.log(
    `[backfill] ${summary.totalAttempts} attempts, ${summary.passed} pass, ${summary.failed} fail, ${summary.durationSeconds}s duration`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[backfill] fatal:', err);
    process.exit(1);
  });
}
