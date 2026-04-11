/**
 * CANONICAL_50 audit orchestrator (P1.6)
 *
 * Walks open-source-servers/, scores every template on the deterministic
 * rubric in ./rubric.mjs, runs the P1.4 quality gates on the top candidates
 * via a tsx subprocess, applies a disk-cached Claude Sonnet tiebreaker at
 * the 50-template boundary, and writes:
 *
 *   - CANONICAL_50.json                                   (top 50 + scores)
 *   - docs/audit-failures/canonical-50-rejected.json      (other 972 + reasons)
 *
 * Deterministic: same input → same output (modulo the `generatedAt` field).
 * Re-runnable: Claude calls are cached to scripts/audit/.cache/, so a
 * second run costs $0 and produces byte-identical output except for the
 * timestamp.
 */

import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import * as url from 'node:url';
import {
  scoreQualityGates,
  scoreNonGateDimensions,
  classifyTemplate,
  RUBRIC_VERSION,
} from './rubric.mjs';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'open-source-servers');
const RUBRIC_PATH = path.join(__dirname, 'rubric.mjs');
const CACHE_DIR = path.join(__dirname, '.cache');
const CANONICAL_OUT = path.join(REPO_ROOT, 'CANONICAL_50.json');
const REJECTED_OUT = path.join(
  REPO_ROOT,
  'docs',
  'audit-failures',
  'canonical-50-rejected.json',
);
const RUN_GATES_HELPER = path.join(__dirname, 'run-gates.mts');

// Tunables
const PRE_GATE_TOP_N = 150; // run quality gates on the top N by pre-gate score
const FINAL_TOP_N = 50; // number of templates in CANONICAL_50.json
const CLAUDE_MODEL = 'claude-sonnet-4-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MAX_TOKENS = 512;

// ---------------------------------------------------------------------------
// Template I/O
// ---------------------------------------------------------------------------

/**
 * Read the per-template material that the rubric needs. Returns null on
 * unreadable templates so the walker can skip them without crashing.
 */
async function readTemplate(dir) {
  const slug = path.basename(dir);
  const readPath = async (rel) => {
    try {
      return await readFile(path.join(dir, rel), 'utf-8');
    } catch {
      return null;
    }
  };

  const [pkgRaw, readme, serverSource, dockerfile, vercelJson] = await Promise.all([
    readPath('package.json'),
    readPath('README.md'),
    readPath('src/server.ts'),
    readPath('Dockerfile'),
    readPath('vercel.json'),
  ]);

  let pkgJson = null;
  if (pkgRaw) {
    try {
      pkgJson = JSON.parse(pkgRaw);
    } catch {
      pkgJson = null;
    }
  }

  return { dir, slug, pkgJson, readme, serverSource, dockerfile, vercelJson };
}

async function listTemplateDirs() {
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith('settlegrid-'))
    .map((e) => path.join(TEMPLATES_DIR, e.name))
    .sort(); // stable ordering
}

// ---------------------------------------------------------------------------
// Pre-gate scoring (dimensions 1–3, 5–8)
// ---------------------------------------------------------------------------

function categorize(templates) {
  const counts = {};
  for (const t of templates) {
    t.category = classifyTemplate(t.pkgJson || {});
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return counts;
}

function preGateScore(template, categoryCounts) {
  const result = scoreNonGateDimensions({
    readme: template.readme,
    serverSource: template.serverSource,
    pkgJson: template.pkgJson,
    dockerfile: template.dockerfile,
    vercelJson: template.vercelJson,
    category: template.category,
    categoryCounts,
  });
  return {
    ...result,
    slug: template.slug,
    dir: template.dir,
    category: template.category,
  };
}

// ---------------------------------------------------------------------------
// Quality gate runner (spawns run-gates.mts via tsx)
// ---------------------------------------------------------------------------

/**
 * Pipe a batch of template directories into the tsx helper and collect
 * per-template gate results.
 *
 * @param {string[]} dirs
 * @returns {Promise<Map<string, { tscPass: boolean; smokePass: boolean; securityPass: boolean } | null>>}
 */
async function runGatesBatch(dirs) {
  if (dirs.length === 0) return new Map();

  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', RUN_GATES_HELPER], {
      cwd: REPO_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const results = new Map();
    let stdoutBuf = '';
    let stderrBuf = '';

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      let idx;
      while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
        const line = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          results.set(parsed.dir, parsed.result ?? null);
          // Live progress marker so a 10-minute run is observable
          process.stdout.write(
            `  gates: ${results.size}/${dirs.length}\r`,
          );
        } catch (err) {
          // Log malformed line but keep going
          process.stderr.write(`[run-gates parse error] ${line}\n`);
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      // Mirror to our stderr so errors are visible
      process.stderr.write(chunk);
    });

    child.on('error', (err) => {
      reject(new Error(`run-gates spawn error: ${err.message}`));
    });

    child.on('exit', (code) => {
      process.stdout.write('\n');
      if (code === 0) {
        resolve(results);
      } else {
        reject(new Error(`run-gates exited with code ${code}\n${stderrBuf}`));
      }
    });

    // Pipe the directory list to the child then close stdin
    for (const d of dirs) {
      child.stdin.write(d + '\n');
    }
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Claude Sonnet tiebreaker (with disk cache)
// ---------------------------------------------------------------------------

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

function cacheKeyFor(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}

/**
 * Ask Claude Sonnet to rank a batch of 5 templates by gallery-launch
 * quality. Temperature 0 for determinism. Cached to disk.
 *
 * @param {Array<{ slug: string; readmeFirst1000: string; score: number }>} batch
 * @returns {Promise<string[]>} ordered slugs (best → worst)
 */
async function claudeRankBatch(batch) {
  await ensureCacheDir();
  const key = cacheKeyFor({ model: CLAUDE_MODEL, batch });
  const cachePath = path.join(CACHE_DIR, `${key}.json`);

  if (existsSync(cachePath)) {
    const cached = JSON.parse(await readFile(cachePath, 'utf-8'));
    if (Array.isArray(cached.ranking)) {
      process.stdout.write(`  claude: cache HIT ${key.slice(0, 8)}\n`);
      return cached.ranking;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const prompt = [
    'You are ranking 5 SettleGrid MCP server templates for inclusion in a',
    'public gallery launch. All 5 already pass automated quality gates and',
    'tie at the same rubric score. Pick the 5 best candidates in order,',
    'prioritising: novelty of upstream API, README clarity, absence of',
    'dead/placeholder content, and broad usefulness.',
    '',
    'Respond with ONLY a single JSON array of slug strings, ordered best to',
    'worst. No prose, no markdown fences, no comments.',
    '',
    'Candidates:',
    ...batch.map(
      (t, i) =>
        `${i + 1}. slug: ${t.slug}\n   rubric_score: ${t.score}\n   readme_start:\n${t.readmeFirst1000}\n`,
    ),
  ].join('\n');

  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  const text =
    Array.isArray(data?.content) && data.content[0]?.type === 'text'
      ? data.content[0].text
      : '';

  // Extract the JSON array from the response. Tolerate stray whitespace or
  // a markdown code fence.
  const arrMatch = text.match(/\[[\s\S]*?\]/);
  if (!arrMatch) {
    throw new Error(`Claude response had no JSON array: ${text.slice(0, 200)}`);
  }
  const ranking = JSON.parse(arrMatch[0]);
  if (!Array.isArray(ranking) || !ranking.every((x) => typeof x === 'string')) {
    throw new Error(`Claude ranking is not a string array: ${text.slice(0, 200)}`);
  }

  await writeFile(
    cachePath,
    JSON.stringify({ ranking, model: CLAUDE_MODEL, candidateCount: batch.length }, null, 2),
  );

  const usage = data.usage || {};
  process.stdout.write(
    `  claude: cached ${key.slice(0, 8)} (in=${usage.input_tokens ?? '?'} out=${usage.output_tokens ?? '?'})\n`,
  );
  return ranking;
}

// ---------------------------------------------------------------------------
// Rubric hash — identifies the rubric version that produced these outputs
// ---------------------------------------------------------------------------

async function computeRubricHash() {
  const source = await readFile(RUBRIC_PATH, 'utf-8');
  return (
    'sha256:' + createHash('sha256').update(source).digest('hex').slice(0, 16)
  );
}

// ---------------------------------------------------------------------------
// Tiebreak boundary resolver
// ---------------------------------------------------------------------------

/**
 * If the 50th and 51st templates tie on score, we need to resolve the
 * ambiguity. Gather all templates that share the boundary score with the
 * 50th, split into batches of 5, ask Claude to rank each batch, then pick
 * the top K from the boundary cohort such that the final list has exactly
 * FINAL_TOP_N entries.
 *
 * Inputs are ALREADY sorted by descending totalScore.
 */
async function resolveBoundaryTies(ranked) {
  if (ranked.length <= FINAL_TOP_N) return ranked;
  const boundaryScore = ranked[FINAL_TOP_N - 1].totalScore;
  // Everyone strictly above the boundary is in for free.
  const definite = ranked.filter((r) => r.totalScore > boundaryScore);
  // Everyone at the boundary score competes for the remaining slots.
  const cohort = ranked.filter((r) => r.totalScore === boundaryScore);
  const remainingSlots = FINAL_TOP_N - definite.length;

  if (cohort.length <= remainingSlots) {
    // No contention — boundary cohort fits entirely.
    return [...definite, ...cohort, ...ranked.filter((r) => r.totalScore < boundaryScore)].slice(
      0,
      ranked.length,
    );
  }

  process.stdout.write(
    `  tiebreak: ${cohort.length} templates tie at score ${boundaryScore}, need ${remainingSlots}\n`,
  );

  // Batch the cohort into groups of 5 and ask Claude to rank within each batch.
  // Then merge the per-batch rankings by taking the first element of each
  // batch round-robin until remainingSlots are filled.
  const BATCH_SIZE = 5;
  const batches = [];
  for (let i = 0; i < cohort.length; i += BATCH_SIZE) {
    batches.push(cohort.slice(i, i + BATCH_SIZE));
  }

  // Rank each batch via Claude (cached).
  const perBatchRankings = [];
  for (const batch of batches) {
    const payload = batch.map((t) => ({
      slug: t.slug,
      score: t.totalScore,
      readmeFirst1000: (t.readme || '').slice(0, 1000),
    }));
    const ranking = await claudeRankBatch(payload);
    // Reorder the batch according to Claude's ranking, falling back to the
    // input order for any slugs Claude didn't mention.
    const bySlug = new Map(batch.map((b) => [b.slug, b]));
    const ordered = [];
    for (const slug of ranking) {
      const t = bySlug.get(slug);
      if (t) {
        ordered.push(t);
        bySlug.delete(slug);
      }
    }
    // Append any unmentioned templates at the end of the batch in their
    // original order.
    for (const t of batch) {
      if (bySlug.has(t.slug)) ordered.push(t);
    }
    perBatchRankings.push(ordered);
  }

  // Merge per-batch rankings round-robin to fill remainingSlots.
  // Round-robin preserves per-batch rank order without any batch
  // dominating the final cohort.
  const winners = [];
  let i = 0;
  while (winners.length < remainingSlots) {
    let progressed = false;
    for (const ranking of perBatchRankings) {
      if (i < ranking.length && winners.length < remainingSlots) {
        winners.push(ranking[i]);
        progressed = true;
      }
    }
    if (!progressed) break;
    i += 1;
  }
  const winnerSlugs = new Set(winners.map((w) => w.slug));
  const losers = cohort.filter((c) => !winnerSlugs.has(c.slug));
  const belowBoundary = ranked.filter((r) => r.totalScore < boundaryScore);

  return [...definite, ...winners, ...losers, ...belowBoundary];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[canonical-50] starting');
  const startedAt = Date.now();

  // Phase 1: walk open-source-servers/ and read each template
  console.log('[canonical-50] walking templates...');
  const dirs = await listTemplateDirs();
  console.log(`  found ${dirs.length} template directories`);

  // Read in parallel (bounded concurrency = 32 via chunking)
  const templates = [];
  const BATCH = 32;
  for (let i = 0; i < dirs.length; i += BATCH) {
    const batch = dirs.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((d) => readTemplate(d)));
    templates.push(...results);
  }
  console.log(`  read ${templates.length} templates`);

  // Phase 2: categorize + compute novelty buckets
  console.log('[canonical-50] categorizing...');
  const categoryCounts = categorize(templates);
  const distinctCategories = Object.keys(categoryCounts);
  console.log(
    `  ${distinctCategories.length} categories: `
      + Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([k, v]) => `${k}=${v}`)
          .join(', '),
  );

  // Phase 3: pre-gate scoring
  console.log('[canonical-50] pre-gate scoring...');
  const preGated = templates.map((t) => preGateScore(t, categoryCounts));
  preGated.sort((a, b) => b.total - a.total);
  console.log(
    `  pre-gate avg=${(preGated.reduce((a, b) => a + b.total, 0) / preGated.length).toFixed(1)} `
      + `top=${preGated[0].total} bottom=${preGated[preGated.length - 1].total}`,
  );

  // Phase 4: run quality gates on the top PRE_GATE_TOP_N candidates
  const gateCandidates = preGated.slice(0, PRE_GATE_TOP_N);
  console.log(
    `[canonical-50] running quality gates on top ${gateCandidates.length}...`,
  );
  const gatesStart = Date.now();
  const gateResults = await runGatesBatch(gateCandidates.map((c) => c.dir));
  const gatesMs = Date.now() - gatesStart;
  console.log(
    `  gates: ${gateResults.size}/${gateCandidates.length} results in ${(gatesMs / 1000).toFixed(1)}s`,
  );

  // Phase 5: fold gate scores into the total
  const finalScored = preGated.map((p) => {
    const g = gateResults.get(p.dir);
    // Non-candidates (templates outside top PRE_GATE_TOP_N) get 0 for gates.
    // They won't end up in the top 50 because their pre-gate score is too low.
    const gateScoreObj = g ? scoreQualityGates(g) : { score: 0, reasons: ['not run'] };
    return {
      slug: p.slug,
      dir: p.dir,
      category: p.category,
      breakdown: {
        readme: p.breakdown.readme,
        tools: p.breakdown.tools,
        schema: p.breakdown.schema,
        gates: gateScoreObj.score,
        deps: p.breakdown.deps,
        docker: p.breakdown.docker,
        category: p.breakdown.category,
        novelty: p.breakdown.novelty,
      },
      totalScore: p.total + gateScoreObj.score,
      reasons: [...p.reasons, ...gateScoreObj.reasons],
      gateRun: g != null,
    };
  });

  finalScored.sort((a, b) => {
    // Primary: total score
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // Secondary: slug alphabetically (deterministic tiebreak pre-Claude)
    return a.slug.localeCompare(b.slug);
  });

  // Phase 6: Claude tiebreaker at the 50-boundary (if needed)
  // Attach readme text to the candidates so the tiebreaker can see them
  const templatesBySlug = new Map(templates.map((t) => [t.slug, t]));
  for (const entry of finalScored) {
    entry.readme = templatesBySlug.get(entry.slug)?.readme || '';
  }
  console.log('[canonical-50] resolving boundary ties...');
  const resolved = await resolveBoundaryTies(finalScored);
  // Strip readme field from the final output
  for (const entry of resolved) delete entry.readme;

  const top50 = resolved.slice(0, FINAL_TOP_N);
  const rejected = resolved.slice(FINAL_TOP_N);

  // Sanity: final top-50 must be exactly FINAL_TOP_N
  if (top50.length !== FINAL_TOP_N) {
    throw new Error(
      `expected ${FINAL_TOP_N} templates in top, got ${top50.length}`,
    );
  }

  // Phase 7: write outputs
  const rubricHash = await computeRubricHash();

  const canonicalPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    rubricHash,
    rubricVersion: RUBRIC_VERSION,
    templates: top50.map((t) => ({
      slug: t.slug,
      score: t.totalScore,
      breakdown: t.breakdown,
      categoryTag: t.category,
    })),
    rejected: rejected.length,
    top50Sum: top50.reduce((a, b) => a + b.totalScore, 0),
    top50Avg: Number((top50.reduce((a, b) => a + b.totalScore, 0) / top50.length).toFixed(2)),
    distinctCategoriesInTop50: new Set(top50.map((t) => t.category)).size,
  };

  const rejectedPayload = {
    version: 1,
    generatedAt: canonicalPayload.generatedAt,
    rubricHash,
    rubricVersion: RUBRIC_VERSION,
    templates: Object.fromEntries(
      rejected.map((t) => [
        t.slug,
        {
          score: t.totalScore,
          category: t.category,
          breakdown: t.breakdown,
          gateRun: t.gateRun,
          reasons: t.reasons.slice(0, 20),
        },
      ]),
    ),
  };

  await writeFile(CANONICAL_OUT, JSON.stringify(canonicalPayload, null, 2) + '\n');
  await mkdir(path.dirname(REJECTED_OUT), { recursive: true });
  await writeFile(REJECTED_OUT, JSON.stringify(rejectedPayload, null, 2) + '\n');

  console.log(
    `[canonical-50] wrote ${CANONICAL_OUT} (${top50.length} templates, sum=${canonicalPayload.top50Sum}, avg=${canonicalPayload.top50Avg})`,
  );
  console.log(`[canonical-50] wrote ${REJECTED_OUT} (${rejected.length} rejected)`);
  console.log(
    `[canonical-50] done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );

  // DoD checks
  const checks = [
    ['exactly 50 entries', top50.length === 50],
    ['sum ≥ 3500', canonicalPayload.top50Sum >= 3500],
    ['≥ 10 distinct categories', canonicalPayload.distinctCategoriesInTop50 >= 10],
    ['rejected count 972', rejected.length === 972],
  ];
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  }
  if (!checks.every(([, ok]) => ok)) {
    console.error('[canonical-50] DoD checks FAILED');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[canonical-50] fatal:', err instanceof Error ? err.stack : err);
  process.exit(2);
});
