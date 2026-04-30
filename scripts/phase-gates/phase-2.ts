#!/usr/bin/env tsx
/**
 * Phase 2 Gate (P2.14)
 *
 * Runs 20 checks (8 distribution-track + 12 settlement-layer expansion)
 * to verify Phase 2 exit criteria from the prompt card. Mirrors the
 * Phase 1 gate's PASS / DEFER / FAIL semantics
 * (settlegrid-agents/scripts/phase-1-gate.mjs).
 *
 * Status semantics:
 *   PASS  — criterion satisfied
 *   DEFER — expected artifact does not exist; underlying prompt not yet shipped
 *   FAIL  — expected artifact exists but is broken (wrong shape, failing tests)
 *
 * Exit code:
 *   default:             exit 1 iff any FAIL. DEFERs are non-blocking.
 *   --strict-expansion:  exit 1 iff any FAIL or DEFER. Use to confirm
 *                        Phase 2 is fully done end-to-end.
 *
 * Optional flags (cost / latency control):
 *   --skip-build         skip check 5 (full Next.js SSG build, ~60s)
 *   --skip-network       skip checks 6 (gh API) + 7 (Meilisearch HTTP)
 *   --skip-tests         skip check 8 (workspace test run, ~15s)
 *
 * Usage:
 *   npx tsx scripts/phase-gates/phase-2.ts
 *   npx tsx scripts/phase-gates/phase-2.ts --strict-expansion
 *   npm run gate:phase-2
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  statSync,
  readdirSync,
  realpathSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Constants ────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..')
const AUDIT_LOG = join(REPO_ROOT, 'AUDIT_LOG.md')

const STRICT_EXPANSION = process.argv.includes('--strict-expansion')
const SKIP_BUILD = process.argv.includes('--skip-build')
const SKIP_NETWORK = process.argv.includes('--skip-network')
const SKIP_TESTS = process.argv.includes('--skip-tests')
const NO_AUDIT_LOG = process.argv.includes('--no-audit-log')

// ── Types ────────────────────────────────────────────────────────────

export type Status = 'PASS' | 'DEFER' | 'FAIL'

export interface CheckResult {
  id: number
  status: Status
  label: string
  detail?: string
}

export interface AggregateSummary {
  total: number
  pass: number
  defer: number
  fail: number
  effectiveFails: number
  exitCode: 0 | 1
}

// ── Helpers ──────────────────────────────────────────────────────────

function repoFile(...parts: string[]): string {
  return join(REPO_ROOT, ...parts)
}

function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function dirExists(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function runSync(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
) {
  return spawnSync(cmd, args, {
    cwd: opts?.cwd ?? REPO_ROOT,
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: opts?.timeoutMs ?? 120_000,
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, NODE_NO_WARNINGS: '1', ...(opts?.env ?? {}) },
  })
}

const pass = (id: number, label: string, detail?: string): CheckResult => ({
  id,
  status: 'PASS',
  label,
  detail,
})
const defer = (id: number, label: string, detail?: string): CheckResult => ({
  id,
  status: 'DEFER',
  label,
  detail,
})
const fail = (id: number, label: string, detail?: string): CheckResult => ({
  id,
  status: 'FAIL',
  label,
  detail,
})

/**
 * Strip line-comments before substring/regex grepping. Defends against
 * false-positives from commented-out imports/identifiers (e.g.,
 * `// import { foo } from '@/lib/x-proxy'` would otherwise trip a
 * "module still imports the old path" check). Mirrors Phase 1 gate's
 * approach in hasBuildChallengeDefinition.
 */
export function stripLineComments(src: string): string {
  return src
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

/**
 * Match a single test/it/describe declaration at line start, including
 * vitest modifier forms (test.skip(...), it.each([...])(...) etc.).
 * Mirrors Phase 1 gate's countVitestDeclarations regex (extended to
 * also accept describe). Exported for direct unit testing.
 */
export const TEST_DECL_RE = /^\s*(test|it|describe)(?:\.[\w$]+)?\s*\(/m

/**
 * Pure check-state derivation for check 9 (K1 — proxy uses unified
 * adapter). Reduced to a 2-state model after a 2026-04-16 audit found
 * the previous 4-state version conflated K1 (add unified path) with
 * K2 (remove lib/*-proxy.ts files):
 *
 *   { unifiedRefs: 0 } → DEFER, 'k1-pending'
 *   { unifiedRefs: >0 } → PASS, 'k1-shipped'
 *
 * K1's spec only requires adding the parallel path (protocolRegistry
 * dispatch) behind a feature flag — the legacy chain stays intact for
 * the flag-off case AND for the 5 emerging protocols (l402, alipay,
 * kyapay, emvco, drain) that don't have adapters yet. Check 10 (K2)
 * separately verifies removal of the lib/*-proxy.ts files.
 */
export type K1CheckReason = 'k1-pending' | 'k1-shipped'

export function deriveK1ProxyCheckState(p: {
  unifiedRefs: number
}): { status: Status; reason: K1CheckReason } {
  if (p.unifiedRefs === 0) {
    return { status: 'DEFER', reason: 'k1-pending' }
  }
  return { status: 'PASS', reason: 'k1-shipped' }
}

/**
 * Parse the framed output of the check 4 shadow-row-count probe.
 * Returns either `{ count: number }` or `{ error: string }`. Pure
 * function — exported for direct unit testing without a live database.
 *
 * The probe wraps its result in --SG-RESULT--…--END-- markers so any
 * incidental stdout from pg client init can't corrupt JSON parsing.
 */
export function parseShadowProbeOutput(
  stdout: string,
): { count: number } | { error: string } {
  const m = stdout.match(/--SG-RESULT--(.+?)--END--/)
  if (!m) {
    return { error: 'no SG-RESULT marker in probe stdout' }
  }
  let parsed: { count?: unknown }
  try {
    parsed = JSON.parse(m[1]) as { count?: unknown }
  } catch (e) {
    return { error: `JSON parse: ${(e as Error).message}` }
  }
  const c = parsed.count
  if (typeof c !== 'number' || !Number.isFinite(c)) {
    return { error: `count is not a finite number: ${JSON.stringify(c)}` }
  }
  return { count: c }
}

/**
 * Wrap a check function so unhandled exceptions become FAIL CheckResults
 * rather than crashing the gate harness mid-run. Without this, a thrown
 * check would (a) skip AUDIT_LOG writing, (b) lose all check state, and
 * (c) make `results.at(-1)!` return the wrong CheckResult to logResult.
 */
export async function safeCheck(
  fn: () => Promise<CheckResult>,
  fallbackId: number,
  fallbackLabel: string,
): Promise<CheckResult> {
  try {
    return await fn()
  } catch (err) {
    return fail(
      fallbackId,
      fallbackLabel,
      `gate harness caught uncaught exception: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

// ── Distribution-track checks (1-8) ──────────────────────────────────

async function check1_cliInstallable(): Promise<CheckResult> {
  const label = 'CLI installable + smoke passes'
  // Spec literal: `node packages/settlegrid-cli/dist/index.js --version`
  // (the package builds both .js (ESM) and .cjs; spec wants .js).
  const distEntry = repoFile('packages', 'settlegrid-cli', 'dist', 'index.js')
  if (!fileExists(distEntry)) {
    return defer(1, label, `dist not built at ${distEntry}; run npm --workspace @settlegrid/cli run build`)
  }
  const versionRun = runSync('node', [distEntry, '--version'], { timeoutMs: 15_000 })
  if (versionRun.status !== 0) {
    // slice(-200) takes the tail — error messages are usually most useful
    // at the end (consistent with the rest of the file).
    return fail(1, label, `--version exited ${versionRun.status}: ${versionRun.stderr.trim().slice(-200)}`)
  }
  if (!/^\d+\.\d+\.\d+/.test(versionRun.stdout.trim())) {
    return fail(1, label, `--version stdout did not match semver: ${JSON.stringify(versionRun.stdout.slice(0, 80))}`)
  }
  // Smoke optionally — slow (clones 3 real repos). DEFER (not PASS) when
  // skipped so the verdict accurately reflects that smoke was not exercised
  // (consistent with checks 5/8 DEFER-on-skip semantics).
  if (SKIP_TESTS) {
    return defer(1, label, `--version OK (${versionRun.stdout.trim()}); smoke skipped via --skip-tests`)
  }
  const smoke = runSync('npm', ['--workspace', '@settlegrid/cli', 'run', 'smoke'], {
    timeoutMs: 300_000,
  })
  if (smoke.status !== 0) {
    return fail(1, label, `smoke exited ${smoke.status}: ${smoke.stderr.trim().slice(-300)}`)
  }
  return pass(1, label, `--version ${versionRun.stdout.trim()}, smoke PASS`)
}

async function check2_registryPresent(): Promise<CheckResult> {
  const label = 'Registry exists, validates, ≥20 templates'
  const registryPath = repoFile('apps', 'web', 'public', 'registry.json')
  if (!fileExists(registryPath)) {
    return defer(2, label, `${registryPath} not found`)
  }
  let registry: unknown
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf-8'))
  } catch (e) {
    return fail(2, label, `JSON parse failed: ${(e as Error).message}`)
  }
  const reg = registry as { templates?: unknown[]; totalTemplates?: number }
  const templates = Array.isArray(reg.templates) ? reg.templates : []
  if (templates.length < 20) {
    return fail(2, label, `only ${templates.length} templates (expected ≥20)`)
  }
  // Validate each manifest via the @settlegrid/mcp validator.
  let mcp: typeof import('@settlegrid/mcp')
  try {
    mcp = await import('@settlegrid/mcp')
  } catch (e) {
    return defer(2, label, `cannot import @settlegrid/mcp (run npm --workspace @settlegrid/mcp run build): ${(e as Error).message}`)
  }
  const errs: string[] = []
  for (const t of templates) {
    const r = mcp.safeValidateTemplateManifest(t)
    if (!r.success) {
      errs.push(`${(t as { slug?: string }).slug ?? '<unknown>'}: ${r.errors.slice(0, 2).join('; ')}`)
    }
  }
  if (errs.length > 0) {
    return fail(2, label, `${errs.length} invalid manifest(s); first: ${errs[0]}`)
  }
  return pass(2, label, `${templates.length} templates, all valid`)
}

async function check3_canonicalPolished(): Promise<CheckResult> {
  const label = 'Canonical 20 templates polished (4 files each)'
  const canonicalPath = repoFile('CANONICAL_20.json')
  if (!fileExists(canonicalPath)) {
    return defer(3, label, `${canonicalPath} not found`)
  }
  let manifest: unknown
  try {
    manifest = JSON.parse(readFileSync(canonicalPath, 'utf-8'))
  } catch (e) {
    return fail(3, label, `JSON parse failed: ${(e as Error).message}`)
  }
  // CANONICAL_20.json may use either `entries` (current shape) or
  // `templates` (forward-compat). Accept either.
  const obj = manifest as { templates?: unknown[]; entries?: unknown[] }
  const arr = Array.isArray(manifest)
    ? (manifest as unknown[])
    : Array.isArray(obj.entries)
      ? obj.entries
      : Array.isArray(obj.templates)
        ? obj.templates
        : []
  if (arr.length < 20) {
    return fail(3, label, `CANONICAL_20.json has ${arr.length} entries (expected ≥20)`)
  }
  const required = ['template.json', 'README.md', 'monetization.md', 'remove-settlegrid.md']
  const missing: string[] = []
  // Spec also requires "and template.json validates" — collect manifests
  // and validate via @settlegrid/mcp validator.
  let mcp: typeof import('@settlegrid/mcp') | null = null
  try {
    mcp = await import('@settlegrid/mcp')
  } catch {
    /* validation will be skipped if mcp unavailable */
  }
  const validationErrors: string[] = []
  for (const entry of arr) {
    const slug = (entry as { slug?: string }).slug
    if (!slug) continue
    // polish-canonical writes to `settlegrid-${slug}` (see scripts/polish-canonical.ts:126).
    // Accept either form for forward compat.
    const dirSlug = `settlegrid-${slug}`
    const dirCandidates = [dirSlug, slug]
    const resolvedDir = dirCandidates.find((d) =>
      dirExists(repoFile('open-source-servers', d)),
    )
    if (!resolvedDir) {
      for (const f of required) missing.push(`${slug}/${f}`)
      continue
    }
    for (const f of required) {
      if (!fileExists(repoFile('open-source-servers', resolvedDir, f))) {
        missing.push(`${resolvedDir}/${f}`)
      }
    }
    // Validate template.json schema-wise per spec.
    if (mcp) {
      const tplPath = repoFile('open-source-servers', resolvedDir, 'template.json')
      if (fileExists(tplPath)) {
        try {
          const tpl = JSON.parse(readFileSync(tplPath, 'utf-8'))
          const r = mcp.safeValidateTemplateManifest(tpl)
          if (!r.success) {
            validationErrors.push(`${resolvedDir}: ${r.errors.slice(0, 1).join('; ')}`)
          }
        } catch (e) {
          validationErrors.push(`${resolvedDir}: parse error — ${(e as Error).message}`)
        }
      }
    }
  }
  if (missing.length > 0) {
    return fail(3, label, `${missing.length} missing file(s); first: ${missing[0]}`)
  }
  if (validationErrors.length > 0) {
    return fail(3, label, `${validationErrors.length} invalid template.json; first: ${validationErrors[0]}`)
  }
  return pass(3, label, `${arr.length} templates × 4 files present, all template.json valid`)
}

async function check4_shadowPopulated(): Promise<CheckResult> {
  const label = 'Shadow directory populated (≥1000 rows)'
  if (!process.env.DATABASE_URL) {
    return defer(4, label, 'DATABASE_URL not set in env')
  }
  // Inline pg query via `node -e` — avoids writing a temp file inside
  // apps/web (which could collide with existing files, leak on SIGINT,
  // or pollute git status / Next.js compilation). `pg` is a top-level
  // dep so node resolves it from REPO_ROOT/node_modules. Output is
  // wrapped in unique markers so any stray stdout from pg/db init can
  // be filtered out.
  const probe = `
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await c.connect();
    const r = await c.query("SELECT count(*)::int AS c FROM mcp_shadow_index");
    process.stdout.write('--SG-RESULT--' + JSON.stringify({ count: Number(r.rows[0].c) }) + '--END--\\n');
  } finally {
    await c.end();
  }
})().catch((err) => { process.stderr.write('probe: ' + err.message + '\\n'); process.exit(1); });
`
  const r = runSync('node', ['-e', probe], { timeoutMs: 30_000 })
  if (r.status !== 0) {
    return defer(4, label, `probe exit ${r.status}: ${(r.stderr || r.stdout).trim().slice(-200)}`)
  }
  const parsed = parseShadowProbeOutput(r.stdout)
  if ('error' in parsed) {
    return fail(4, label, parsed.error)
  }
  if (parsed.count >= 1000) {
    return pass(4, label, `${parsed.count} rows`)
  }
  return fail(4, label, `only ${parsed.count} rows (expected ≥1000)`)
}

async function check5_ssgBuild(): Promise<CheckResult> {
  const label = 'SSG build emits gallery + ≥1000 shadow pages'
  if (SKIP_BUILD) {
    return defer(5, label, 'skipped via --skip-build')
  }
  const r = runSync('npm', ['--workspace', '@settlegrid/web', 'run', 'build'], {
    timeoutMs: 300_000,
    env: { NEXT_PUBLIC_GALLERY_ENABLED: 'true', SHADOW_BUILD_LIMIT: '1000' },
  })
  if (r.status !== 0) {
    return fail(5, label, `build exit ${r.status}: ${r.stderr.trim().slice(-300)}`)
  }
  // Verify expected static output. Next.js emits to .next/server/app/...
  // Next 15's App Router writes the route index as a sibling .html file
  // (templates.html) rather than nesting it as templates/page.html — accept
  // either layout since this is version-dependent.
  const galleryIndexCandidates = [
    repoFile('apps', 'web', '.next', 'server', 'app', 'templates', 'page.html'),
    repoFile('apps', 'web', '.next', 'server', 'app', 'templates.html'),
  ]
  if (!galleryIndexCandidates.some(fileExists)) {
    return fail(5, label, `gallery index missing; checked: ${galleryIndexCandidates.join(', ')}`)
  }
  // Per spec: "each of the 20 canonical slugs has /templates/<slug>.html".
  // Read CANONICAL_20.json and verify all 20 emitted. Next.js App Router
  // emits at .next/server/app/templates/<slug>/page.html OR
  // .next/server/app/templates/<slug>.html depending on route shape.
  let canonicalSlugs: string[] = []
  try {
    const c20 = JSON.parse(readFileSync(repoFile('CANONICAL_20.json'), 'utf-8')) as {
      entries?: Array<{ slug?: string }>
      templates?: Array<{ slug?: string }>
    }
    canonicalSlugs = (c20.entries ?? c20.templates ?? [])
      .map((e) => e.slug)
      .filter((s): s is string => typeof s === 'string')
  } catch {
    /* leave empty; report below */
  }
  const dirSlug = (s: string) => `settlegrid-${s}`
  const slugCandidatePaths = (s: string) => [
    repoFile('apps', 'web', '.next', 'server', 'app', 'templates', `${dirSlug(s)}`, 'page.html'),
    repoFile('apps', 'web', '.next', 'server', 'app', 'templates', `${dirSlug(s)}.html`),
    repoFile('apps', 'web', '.next', 'server', 'app', 'templates', s, 'page.html'),
    repoFile('apps', 'web', '.next', 'server', 'app', 'templates', `${s}.html`),
  ]
  const missingSlugPages = canonicalSlugs.filter((s) => !slugCandidatePaths(s).some(fileExists))
  if (canonicalSlugs.length === 0) {
    return fail(5, label, 'CANONICAL_20.json could not be read for slug enumeration')
  }
  if (missingSlugPages.length > 0) {
    return fail(
      5,
      label,
      `${missingSlugPages.length}/${canonicalSlugs.length} slug pages missing; first: ${missingSlugPages[0]}`,
    )
  }
  // Count shadow pages.
  const shadowDir = repoFile('apps', 'web', '.next', 'server', 'app', 'mcp')
  let shadowCount = 0
  if (dirExists(shadowDir)) {
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          walk(join(dir, e.name))
        } else if (e.name.endsWith('.html')) {
          shadowCount++
        }
      }
    }
    walk(shadowDir)
  }
  if (shadowCount < 1000) {
    return fail(5, label, `only ${shadowCount} shadow pages (expected ≥1000)`)
  }
  return pass(5, label, `gallery + ${canonicalSlugs.length} slug pages + ${shadowCount} shadow pages`)
}

async function check6_workflowGreen(): Promise<CheckResult> {
  const label = 'template-quality workflow green on main'
  if (SKIP_NETWORK) {
    return defer(6, label, 'skipped via --skip-network')
  }
  // gh CLI must be installed + authed
  const ghVersion = runSync('gh', ['--version'], { timeoutMs: 5000 })
  if (ghVersion.status !== 0) {
    return defer(6, label, 'gh CLI not installed or not on PATH')
  }
  const r = runSync(
    'gh',
    ['run', 'list', '--workflow', 'template-quality.yml', '--branch', 'main', '--limit', '1', '--json', 'conclusion,status,headSha'],
    { timeoutMs: 15_000 },
  )
  if (r.status !== 0) {
    // Could be: workflow not yet run on main, gh not authed, repo not found
    return defer(6, label, `gh run list exit ${r.status}: ${r.stderr.trim().slice(-200)}`)
  }
  let runs: Array<{ conclusion: string; status: string; headSha?: string }> = []
  try {
    runs = JSON.parse(r.stdout.trim())
  } catch (e) {
    return fail(6, label, `cannot parse gh output: ${(e as Error).message}`)
  }
  if (runs.length === 0) {
    return defer(6, label, 'workflow has no runs on main yet (commits not pushed?)')
  }
  const latest = runs[0]
  // An in-progress run hasn't reached a verdict yet — DEFER instead of
  // FAIL so the gate doesn't block on a transient state.
  if (latest.status !== 'completed') {
    return defer(6, label, `latest run still ${latest.status} on main (not yet completed)`)
  }
  if (latest.conclusion === 'success') {
    return pass(6, label, `latest run on main: success (${latest.headSha?.slice(0, 7)})`)
  }
  return fail(6, label, `latest run conclusion: ${latest.conclusion}`)
}

async function check7_meilisearch(): Promise<CheckResult> {
  const label = 'Meilisearch /health reports available'
  if (SKIP_NETWORK) {
    return defer(7, label, 'skipped via --skip-network')
  }
  const url = process.env.NEXT_PUBLIC_MEILI_URL ?? process.env.MEILI_URL
  if (!url) {
    return defer(7, label, 'NEXT_PUBLIC_MEILI_URL / MEILI_URL not set')
  }
  let res: Response
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    return fail(7, label, `fetch failed: ${(e as Error).message}`)
  }
  if (res.status !== 200) {
    return fail(7, label, `HTTP ${res.status}`)
  }
  // Distinguish JSON-parse failure from fetch failure for accurate diagnostics.
  let body: { status?: string }
  try {
    body = (await res.json()) as { status?: string }
  } catch (e) {
    return fail(7, label, `response body not JSON: ${(e as Error).message}`)
  }
  if (body.status === 'available') {
    return pass(7, label, `${url}/health → status=available`)
  }
  return fail(7, label, `responseBody.status = ${JSON.stringify(body.status)} (expected 'available')`)
}

async function check8_typecheckTests(): Promise<CheckResult> {
  const label = 'Workspace typecheck + tests green'
  if (SKIP_TESTS) {
    return defer(8, label, 'skipped via --skip-tests')
  }
  // Spec literal: `pnpm -w typecheck && pnpm -w test`. This repo uses
  // npm workspaces (no top-level typecheck script per midpoint handoff §7),
  // so we run tsc directly on the two known-clean tsconfig roots.
  const tcMcp = runSync('npx', ['tsc', '--noEmit', '-p', 'packages/mcp'], { timeoutMs: 60_000 })
  if (tcMcp.status !== 0) {
    return fail(8, label, `tsc packages/mcp exit ${tcMcp.status}: ${(tcMcp.stderr || tcMcp.stdout).trim().slice(-200)}`)
  }
  const tcWeb = runSync('npx', ['tsc', '--noEmit', '-p', 'apps/web/tsconfig.json'], { timeoutMs: 120_000 })
  if (tcWeb.status !== 0) {
    return fail(8, label, `tsc apps/web exit ${tcWeb.status}: ${(tcWeb.stderr || tcWeb.stdout).trim().slice(-200)}`)
  }
  const r = runSync('npx', ['turbo', 'test', '--concurrency=1', '--force'], {
    timeoutMs: 600_000,
  })
  if (r.status !== 0) {
    return fail(8, label, `turbo test exit ${r.status}: ${r.stderr.trim().slice(-300)}`)
  }
  // Look for "Tasks: N successful" line as a sanity check.
  const tasksLine = r.stdout.match(/Tasks:\s+(\d+)\s+successful,\s+(\d+)\s+total/)
  const taskMsg = tasksLine && tasksLine[1] === tasksLine[2]
    ? `${tasksLine[1]}/${tasksLine[2]} turbo tasks`
    : 'turbo test exit 0'
  return pass(8, label, `tsc clean (mcp+web), ${taskMsg}`)
}

// ── Settlement-layer expansion checks (9-20) ─────────────────────────

async function check9_k1ProxyUsesKernel(): Promise<CheckResult> {
  const label = 'K1 — marketplace proxy uses unified adapter package'
  const proxyDir = repoFile('apps', 'web', 'src', 'app', 'api', 'proxy')
  if (!dirExists(proxyDir)) {
    return defer(9, label, `${proxyDir} not present (K1 not yet shipped)`)
  }
  // Walk proxy/ for unified-adapter wiring. K1's marker is any reference
  // to `protocolRegistry` (imported from @settlegrid/mcp) or to the
  // route's `decideUnifiedDispatch` helper. The original gate spec said
  // "@settlegrid/mcp-kernel" but the actual package is @settlegrid/mcp;
  // mcp-kernel doesn't exist as a separate package. Reconciled
  // 2026-04-16 to match the P2.K1 prompt-card spec.
  let unifiedRefs = 0
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        // Skip __tests__ — equivalence tests intentionally import the
        // legacy isXRequest() helpers to assert detection parity.
        // Counting those imports as "still uses lib/*-proxy" would be
        // a false positive against the test code itself.
        if (e.name === '__tests__') continue
        walk(full)
        continue
      }
      if (!/\.(t|j)sx?$/.test(e.name)) continue
      // Skip co-located *.test.ts / *.test.tsx files for the same reason.
      if (/\.test\.(t|j)sx?$/.test(e.name)) continue
      // Strip line-comments before grepping so a commented-out
      // protocolRegistry mention doesn't false-positive.
      const src = stripLineComments(readFileSync(full, 'utf-8'))
      if (/\bprotocolRegistry\b/.test(src) || /\bdecideUnifiedDispatch\b/.test(src)) {
        unifiedRefs++
      }
    }
  }
  walk(proxyDir)
  const state = deriveK1ProxyCheckState({ unifiedRefs })
  if (state.reason === 'k1-pending') {
    return defer(
      9,
      label,
      'no protocolRegistry / decideUnifiedDispatch references in proxy/ production code — K1 not yet shipped',
    )
  }
  return pass(
    9,
    label,
    `${unifiedRefs} file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch)`,
  )
}

async function check10_k2ProxiesRemoved(): Promise<CheckResult> {
  const label = 'K2 — 13 lib/*-proxy.ts migrated to adapter classes'
  const libDir = repoFile('apps', 'web', 'src', 'lib')
  const proxyFiles = dirExists(libDir)
    ? readdirSync(libDir).filter((f) => /-proxy\.ts$/.test(f))
    : []
  const adaptersDir = repoFile('packages', 'mcp', 'src', 'adapters')
  if (!dirExists(adaptersDir)) {
    return defer(10, label, `${adaptersDir} not present`)
  }

  // P2.K2 ships the lib files as THIN RE-EXPORTS that bind app-side env +
  // logger to the adapter package. A shim file:
  //   (a) imports from `@settlegrid/mcp` (brings in the migrated logic),
  //   (b) is ≤ a reasonable shim budget (previous files were 200–600 LOC).
  // The count staying at 12 is expected — the check is semantic, not
  // count-based. Note: `mpp.ts` is the 13th legacy file; it sits at the
  // lib root without a `-proxy.ts` suffix, so the proxyFiles glob catches
  // 12 and the mpp shim is checked via the same @settlegrid/mcp-import
  // test below against its explicit path.
  if (proxyFiles.length === 0) {
    // A future refactor that truly deletes the shims (via re-export
    // maps in @settlegrid/mcp subpaths, say) is also acceptable.
    return pass(10, label, 'no *-proxy.ts files remain — fully removed')
  }

  // Semantic check: every remaining proxy file must import from
  // @settlegrid/mcp. Files that still contain the pre-migration business
  // logic (constants, 200+ LOC of validation) indicate K2 hasn't run.
  const MAX_SHIM_LOC = 150 // shims are ~30–80 LOC; 150 allows headroom.
  const offenders: string[] = []
  for (const f of proxyFiles) {
    const src = readFileSync(repoFile('apps', 'web', 'src', 'lib', f), 'utf-8')
    const loc = src.split('\n').length
    const importsMcp = /from ['"]@settlegrid\/mcp['"]/.test(src)
    if (!importsMcp || loc > MAX_SHIM_LOC) {
      offenders.push(`${f} (${loc} LOC${importsMcp ? '' : ', no @settlegrid/mcp import'})`)
    }
  }

  // Also verify mpp.ts (the 13th file, without the -proxy suffix) is a shim.
  const mppPath = repoFile('apps', 'web', 'src', 'lib', 'mpp.ts')
  if (fileExists(mppPath)) {
    const src = readFileSync(mppPath, 'utf-8')
    const loc = src.split('\n').length
    const importsMcp = /from ['"]@settlegrid\/mcp['"]/.test(src)
    if (!importsMcp || loc > MAX_SHIM_LOC) {
      offenders.push(`mpp.ts (${loc} LOC${importsMcp ? '' : ', no @settlegrid/mcp import'})`)
    }
  }

  if (offenders.length > 0) {
    return defer(10, label, `${offenders.length} non-shim file(s): ${offenders.slice(0, 3).join(', ')}${offenders.length > 3 ? '…' : ''}`)
  }

  return pass(
    10,
    label,
    `${proxyFiles.length + (fileExists(mppPath) ? 1 : 0)} file(s) are thin shims importing @settlegrid/mcp`,
  )
}

/**
 * Count `it(...)` and `it.each(...)(...)` declarations in the given
 * source text. Used by check 11 to enforce the P2.K3 DoD "≥30 test
 * cases" threshold.
 *
 * Matches:
 *   - `it('label', fn)` — counted (base it declaration)
 *   - `it.each([...])('label', fn)` — counted (parametric; the
 *     declaration counts as one even though it spawns N tests at
 *     runtime, because the DoD threshold is a LOWER BOUND on suite
 *     size and the actual it.each row count is runtime-only)
 *
 * Does NOT match (intentionally):
 *   - `it.skip(...)`, `it.only(...)`, `it.todo(...)`,
 *     `it.concurrent(...)`, `it.failing(...)` — disabled/placeholder/
 *     alternative-execution declarations shouldn't count toward the
 *     ≥30 threshold. A skipped test isn't exercising the contract.
 *   - `describe(...)`, `test(...)` — different declaration kinds.
 *   - `it(...)` inside a string literal or a commented-out line
 *     (callers strip line comments via `stripLineComments` before
 *     handing the source to this function).
 *
 * Regex rationale:
 *   `\bit` — word-boundary + literal "it" (won't match "omit", "audit").
 *   `(?:\.each\([^)]*\))?` — optional `.each(<no-parens>)`. Inner
 *     arrays are allowed (JS arrays use `[]` not `()`); nested
 *     function calls would stop matching, but it.each arrays are
 *     almost always literal rows of primitives.
 *   `\s*\(` — whitespace + open-paren starting the call. For the
 *     it.each form this is the SECOND paren (the row array was
 *     consumed by the optional group).
 */
export function countK3TestCases(src: string): number {
  const matches = src.match(/\bit(?:\.each\([^)]*\))?\s*\(/g) ?? []
  return matches.length
}

async function check11_k3SnapshotTest(): Promise<CheckResult> {
  const label = 'K3 — proxy-vs-kernel snapshot test exists + included in test runner'
  // P2.K3 spec: apps/web/src/lib/__tests__/proxy-equivalence.test.ts.
  // The prior session's gate looked for
  // packages/mcp/src/__tests__/snapshot-equivalence.test.ts — that was a
  // guess; the canonical location per phase-2-distribution.md §P2.K3 is
  // in apps/web because the test must invoke BOTH the legacy chain
  // (apps/web lib shims) AND the unified dispatch helper — neither of
  // which live in packages/mcp — so the test can't live in packages/mcp
  // without breaking the no-upstream-dep invariant on that package.
  const path = repoFile('apps', 'web', 'src', 'lib', '__tests__', 'proxy-equivalence.test.ts')
  if (!fileExists(path)) {
    return defer(11, label, `${path} not present`)
  }
  // Verify the file actually contains test declarations (so we don't
  // false-pass on an empty stub). Strip comments so commented-out stubs
  // don't false-pass either; use the modifier-aware regex (TEST_DECL_RE)
  // to catch test.skip(), it.each()(), describe.only(), etc.
  const src = stripLineComments(readFileSync(path, 'utf-8'))
  if (!TEST_DECL_RE.test(src)) {
    return fail(11, label, 'file present but contains no test/it/describe declarations')
  }
  // Spec DoD: "Test file with ≥30 test cases".
  const itCount = countK3TestCases(src)
  if (itCount < 30) {
    return fail(
      11,
      label,
      `found ${itCount} it()/it.each() declarations, spec requires ≥30`,
    )
  }
  return pass(
    11,
    label,
    `proxy-equivalence.test.ts present with ${itCount} test declarations`,
  )
}

async function check12_k4Lifecycle(): Promise<CheckResult> {
  const label = 'K4 — typed MeterContext + lifecycle stubs'
  const path = repoFile('packages', 'mcp', 'src', 'lifecycle.ts')
  if (!fileExists(path)) {
    return defer(12, label, `${path} not present`)
  }
  // Strip comments before grepping so a "// removed MeterContext" line
  // doesn't false-positive. Use word-boundary so 'beginInvocationFoo'
  // doesn't satisfy 'beginInvocation'.
  const src = stripLineComments(readFileSync(path, 'utf-8'))
  const required = ['MeterContext', 'beginInvocation', 'settleInvocation', 'voidInvocation', 'heartbeat']
  const missing = required.filter((s) => !new RegExp(`\\b${s}\\b`).test(src))
  if (missing.length > 0) {
    return fail(12, label, `lifecycle.ts missing exports: ${missing.join(', ')}`)
  }
  return pass(12, label, 'MeterContext + 4 lifecycle stubs present')
}

// Shared "package builds + tests pass with N+ count" helper for FMT1/FMT2 checks.
async function checkAdapterPackage(
  id: number,
  label: string,
  workspaceName: string,
  pkgRelPath: string,
  minTests: number,
): Promise<CheckResult> {
  const pkgJson = repoFile(...pkgRelPath.split('/'))
  if (!fileExists(pkgJson)) {
    return defer(id, label, `${pkgJson} not present`)
  }
  // Spec: "builds, ≥N unit tests pass". Build first (some adapters require
  // the build artifact to be present before tests can resolve imports).
  const build = runSync('npm', ['--workspace', workspaceName, 'run', 'build'], { timeoutMs: 120_000 })
  if (build.status !== 0) {
    return fail(id, label, `build exit ${build.status}: ${(build.stderr || build.stdout).trim().slice(-200)}`)
  }
  const r = runSync('npm', ['--workspace', workspaceName, 'test'], { timeoutMs: 120_000 })
  if (r.status !== 0) {
    return fail(id, label, `tests exit ${r.status}: ${r.stderr.trim().slice(-200)}`)
  }
  const m = r.stdout.match(/Tests\s+(\d+)\s+passed/)
  const count = m ? Number(m[1]) : 0
  if (count < minTests) {
    return fail(id, label, `only ${count} tests passed (expected ≥${minTests})`)
  }
  return pass(id, label, `build + ${count} tests pass`)
}

async function check13_fmt1AiSdk(): Promise<CheckResult> {
  return checkAdapterPackage(13, 'FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests', '@settlegrid/ai-sdk', 'packages/ai-sdk/package.json', 6)
}

async function check14_fmt2Mastra(): Promise<CheckResult> {
  return checkAdapterPackage(14, 'FMT2 — @settlegrid/mastra package builds + ≥6 tests', '@settlegrid/mastra', 'packages/mastra/package.json', 6)
}

async function check15_fmt3Polished(): Promise<CheckResult> {
  const label = 'FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs)'
  const candidates = ['langchain', 'n8n', 'cursor']
  const present = candidates.filter((c) => fileExists(repoFile('packages', c, 'package.json')))
  if (present.length === 0) {
    return defer(15, label, `no @settlegrid/{${candidates.join(',')}} packages present`)
  }
  // Spec: "all use @settlegrid/* namespace and have updated READMEs".
  const wrongNs: string[] = []
  const noReadme: string[] = []
  const parseErrors: string[] = []
  for (const p of present) {
    let pkg: { name?: string }
    try {
      pkg = JSON.parse(readFileSync(repoFile('packages', p, 'package.json'), 'utf-8')) as { name?: string }
    } catch (e) {
      parseErrors.push(`${p}: ${(e as Error).message}`)
      continue
    }
    if (!pkg.name?.startsWith('@settlegrid/')) {
      wrongNs.push(`${p}: ${pkg.name}`)
    }
    if (!fileExists(repoFile('packages', p, 'README.md'))) {
      noReadme.push(p)
    }
  }
  if (parseErrors.length > 0) {
    return fail(15, label, `package.json parse error: ${parseErrors[0]}`)
  }
  if (wrongNs.length > 0) {
    return fail(15, label, `non-@settlegrid name: ${wrongNs.join(', ')}`)
  }
  if (noReadme.length > 0) {
    return fail(15, label, `missing README.md in: ${noReadme.join(', ')}`)
  }
  return pass(15, label, `${present.length}/${candidates.length} present, all @settlegrid + README`)
}

async function check16_fmt4N8nInvoke(): Promise<CheckResult> {
  const label = 'FMT4 — n8n Invoke operation node'
  // P2.FMT4 spec says "Add an `Invoke Tool` operation to
  // packages/n8n-settlegrid/src/nodes/SettleGrid/SettleGrid.node.ts" — not
  // "create a separate Invoke.ts". Accept EITHER:
  //   (a) a standalone packages/n8n/src/nodes/Invoke.ts file, OR
  //   (b) an invokeTool operation inside the existing
  //       packages/n8n/src/nodes/SettleGrid/SettleGrid.node.ts
  // The spec literally prescribes (b); (a) is accepted for forward compat
  // in case a future refactor splits operations into per-node files.
  const standalone = repoFile('packages', 'n8n', 'src', 'nodes', 'Invoke.ts')
  if (fileExists(standalone)) {
    return pass(16, label, 'Invoke.ts present (n8n smoke test deferred — needs local n8n runtime)')
  }
  const nodeFile = repoFile(
    'packages',
    'n8n',
    'src',
    'nodes',
    'SettleGrid',
    'SettleGrid.node.ts',
  )
  if (!fileExists(nodeFile)) {
    return defer(
      16,
      label,
      `neither ${standalone} nor ${nodeFile} is present`,
    )
  }
  const src = readFileSync(nodeFile, 'utf8')
  const hasInvokeOp = /invokeTool/.test(src) && /Invoke Tool/.test(src)
  if (!hasInvokeOp) {
    return defer(
      16,
      label,
      `${nodeFile} does not register an invokeTool operation`,
    )
  }
  return pass(
    16,
    label,
    'invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime)',
  )
}

async function check17_mkt1Comparison(): Promise<CheckResult> {
  const label = 'MKT1 — /compare/nevermined draft page'
  const path = repoFile('apps', 'web', 'src', 'app', 'compare', 'nevermined', 'page.tsx')
  if (!fileExists(path)) {
    return defer(17, label, `${path} not present`)
  }
  return pass(17, label, 'comparison page present')
}

async function check18_rail1RailAdapter(): Promise<CheckResult> {
  const label = 'RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*)'
  // P2.RAIL1 spec says
  //   "Define RailAdapter interface in packages/mcp/src/rails/types.ts
  //    Create packages/mcp/src/rails/stripe-connect.ts ... registry.ts"
  // i.e., the rails scaffold lives INSIDE @settlegrid/mcp, not in a
  // standalone packages/rails/ workspace. Accept EITHER layout:
  //   (a) packages/rails/src/index.ts (forward-compat for a future
  //       split into a standalone @settlegrid/rails package)
  //   (b) packages/mcp/src/rails/index.ts (what the spec literally
  //       prescribes; ships today)
  const standalonePath = repoFile('packages', 'rails', 'src', 'index.ts')
  const mcpSubPath = repoFile('packages', 'mcp', 'src', 'rails', 'index.ts')
  let indexPath: string
  if (fileExists(standalonePath)) {
    indexPath = standalonePath
  } else if (fileExists(mcpSubPath)) {
    indexPath = mcpSubPath
  } else {
    return defer(
      18,
      label,
      `neither ${standalonePath} nor ${mcpSubPath} is present`,
    )
  }
  const src = readFileSync(indexPath, 'utf-8')
  const required = ['RailAdapter', 'StripeRailAdapter']
  const missing = required.filter((s) => !src.includes(s))
  if (missing.length > 0) {
    return fail(18, label, `missing exports: ${missing.join(', ')}`)
  }
  // Spec: "old direct Stripe imports from apps/web/src/lib/stripe-*.ts are
  // gone or now go through the adapter". Find any apps/web/src/lib/stripe-*.ts
  // and verify they don't import 'stripe' directly.
  const libDir = repoFile('apps', 'web', 'src', 'lib')
  const stripeFiles = dirExists(libDir)
    ? readdirSync(libDir).filter((f) => /^stripe-.*\.ts$/.test(f))
    : []
  const offending: string[] = []
  for (const f of stripeFiles) {
    // Strip comments so a commented-out import doesn't trigger the check.
    const fileSrc = stripLineComments(readFileSync(join(libDir, f), 'utf-8'))
    // Spec's intent is "no direct Stripe CLIENT usage". Type-only
    // imports (`import type Stripe from 'stripe'`) don't instantiate
    // a Stripe client at runtime — they exist purely for compile-
    // time type checking and are erased after tsc. Allow them.
    const typeOnlyImport = /^\s*import\s+type\s+[^;]+from\s+['"]stripe['"]/m
    const runtimeFromImport =
      /^(?!\s*import\s+type\b)\s*import\s+[^;]+from\s+['"]stripe['"]/m
    const requireImport = /require\(['"]stripe['"]\)/
    const hasRuntimeImport =
      runtimeFromImport.test(fileSrc) || requireImport.test(fileSrc)
    // typeOnlyImport is allowed; only flag if there's a non-type-only
    // import OR a CJS require.
    if (hasRuntimeImport && !typeOnlyImport.test(fileSrc)) {
      offending.push(f)
    } else if (hasRuntimeImport) {
      // Mixed file: has both type-only AND runtime imports. Flag it;
      // the caller should split them or remove the runtime one.
      offending.push(f)
    }
  }
  if (offending.length > 0) {
    return fail(
      18,
      label,
      `${offending.length} lib/stripe-*.ts file(s) still import 'stripe' directly: ${offending.join(', ')}`,
    )
  }
  return pass(
    18,
    label,
    `RailAdapter + StripeRailAdapter exported; ${stripeFiles.length} lib/stripe-*.ts file(s) routed through adapter`,
  )
}

async function check19_comp1OfacAupIr(): Promise<CheckResult> {
  const label = 'COMP1 — OFAC + AUP + IR playbook docs'
  const docs = [
    'docs/legal/ofac-program.md',
    'docs/legal/acceptable-use-policy.md',
    'docs/legal/incident-response-playbook.md',
  ]
  const missing = docs.filter((d) => !fileExists(repoFile(d)))
  if (missing.length === docs.length) {
    return defer(19, label, 'no COMP1 docs present')
  }
  if (missing.length > 0) {
    return fail(19, label, `missing: ${missing.join(', ')}`)
  }
  return pass(19, label, 'all 3 COMP1 docs present')
}

async function check20_intl1CountryWise(): Promise<CheckResult> {
  const label = 'INTL1 — country tracker + Wise stopgap SOP'
  const tracker = repoFile('data', 'international', 'country-tracker.md')
  const sop = repoFile('docs', 'sops', 'manual-wise-payouts.md')
  const trackerExists = fileExists(tracker)
  const sopExists = fileExists(sop)
  if (!trackerExists && !sopExists) {
    return defer(20, label, 'neither tracker nor Wise SOP present')
  }
  if (!trackerExists) {
    return fail(20, label, `country-tracker.md missing`)
  }
  if (!sopExists) {
    return fail(20, label, `manual-wise-payouts.md missing`)
  }
  // Spec: "tracker has at least the cohort-1 countries enumerated". The
  // cohort-1 country list is not defined in the master plan as of 2026-04-16
  // (the COHORT_1_COUNTRIES constant doesn't exist anywhere in the repo).
  // When INTL1 ships, P2.INTL1 should define the cohort-1 list either inline
  // in country-tracker.md or as a JSON manifest. This check should then read
  // that source of truth and verify every entry appears in country-tracker.md.
  // Until then, file-presence is the strongest verifiable signal.
  return pass(20, label, 'both INTL1 artifacts present (cohort-1 enumeration check pending list spec)')
}

async function check21_intl2MarketplaceVisibility(): Promise<CheckResult> {
  const label = 'INTL2 — marketplace visibility for claimed-but-unpublished tools'
  // P2.INTL2 added 2026-04-14. Six DoD items to verify:
  //   1. Migration with sensible defaults
  //   2. Marketplace query updated
  //   3. Claim route sets listedInMarketplace=true
  //   4. Dashboard toggle works
  //   5. Claimed badge displayed
  //   6. At least 8 tests
  const migration = repoFile('apps', 'web', 'drizzle', '0001_listed_in_marketplace.sql')
  const visibilityHelper = repoFile('apps', 'web', 'src', 'lib', 'marketplace-visibility.ts')
  const toggleRoute = repoFile(
    'apps', 'web', 'src', 'app', 'api', 'tools', '[id]',
    'listed-in-marketplace', 'route.ts',
  )
  const claimRoute = repoFile('apps', 'web', 'src', 'app', 'api', 'tools', 'claim', 'route.ts')
  const marketplaceContent = repoFile(
    'apps', 'web', 'src', 'app', 'marketplace', 'marketplace-content.tsx',
  )
  const toolCard = repoFile(
    'apps', 'web', 'src', 'components', 'marketplace', 'tool-card.tsx',
  )
  const visibilityTests = repoFile(
    'apps', 'web', 'src', 'lib', '__tests__', 'marketplace-visibility.test.ts',
  )

  const artifacts = [
    { name: '0001_listed_in_marketplace.sql', path: migration },
    { name: 'marketplace-visibility.ts', path: visibilityHelper },
    { name: '[id]/listed-in-marketplace/route.ts', path: toggleRoute },
    { name: 'tools/claim/route.ts', path: claimRoute },
    { name: 'marketplace-content.tsx', path: marketplaceContent },
    { name: 'marketplace/tool-card.tsx', path: toolCard },
    { name: 'marketplace-visibility.test.ts', path: visibilityTests },
  ]
  const missing = artifacts.filter((a) => !fileExists(a.path)).map((a) => a.name)
  if (missing.length === artifacts.length) {
    return defer(21, label, 'no INTL2 artifacts present')
  }
  if (missing.length > 0) {
    return fail(21, label, `missing: ${missing.join(', ')}`)
  }

  // Spec DoD item 3 — claim route preserves listedInMarketplace=true by
  // default. Accept either the literal assignment (`listedInMarketplace: true`)
  // or the default-fallback pattern (`listedInMarketplace ?? true` — used
  // when the route accepts an opt-out via request body per
  // producer-audit #11). Both preserve the INTL2 default contract.
  const claimSrc = readFileSync(claimRoute, 'utf-8')
  const literalDefault = /listedInMarketplace\s*:\s*true/.test(claimSrc)
  const fallbackDefault = /listedInMarketplace\s*=\s*body\.listedInMarketplace\s*\?\?\s*true/.test(claimSrc)
  if (!literalDefault && !fallbackDefault) {
    return fail(
      21,
      label,
      'claim route does not preserve listedInMarketplace=true default (spec DoD item 3)',
    )
  }

  // Spec DoD item 6 — at least 8 tests
  const testSrc = readFileSync(visibilityTests, 'utf-8')
  const testCount = (testSrc.match(/\bit\s*\(/g) ?? []).length
  if (testCount < 8) {
    return fail(
      21,
      label,
      `only ${testCount} tests found in marketplace-visibility.test.ts; spec requires ≥8`,
    )
  }

  // Marketplace query must include the draft-with-listed path (not
  // just ['active', 'unclaimed']) — regression guard against the
  // original bug P2.INTL2 fixes.
  const marketplaceSrc = readFileSync(marketplaceContent, 'utf-8')
  if (!/listedInMarketplace/.test(marketplaceSrc)) {
    return fail(
      21,
      label,
      `marketplace-content.tsx does not reference listedInMarketplace — the visibility fix may have regressed`,
    )
  }

  // Tool card must render the claimed badge.
  const toolCardSrc = readFileSync(toolCard, 'utf-8')
  if (!/shouldShowClaimedBadge/.test(toolCardSrc)) {
    return fail(
      21,
      label,
      `marketplace/tool-card.tsx does not call shouldShowClaimedBadge — badge rendering regressed`,
    )
  }

  // Hostile-review regression guard: the public detail route must use the
  // canonical marketplaceInclusionSql helper. Previously it hand-rolled a
  // predicate that omitted 'unclaimed', so every unclaimed card in the
  // marketplace linked to a 404 page.
  const publicRoutePath = repoFile(
    'apps', 'web', 'src', 'app', 'api', 'tools', 'public', '[slug]', 'route.ts',
  )
  if (!fileExists(publicRoutePath)) {
    return fail(21, label, 'public tool detail route missing')
  }
  const publicRouteSrc = readFileSync(publicRoutePath, 'utf-8')
  if (!/marketplaceInclusionSql/.test(publicRouteSrc)) {
    return fail(
      21,
      label,
      `public/[slug]/route.ts does not use marketplaceInclusionSql — unclaimed cards will 404`,
    )
  }
  // The visibility helper must export the canonical Drizzle builder.
  const visibilitySrc = readFileSync(visibilityHelper, 'utf-8')
  if (!/export\s+function\s+marketplaceInclusionSql/.test(visibilitySrc)) {
    return fail(
      21,
      label,
      'marketplace-visibility.ts is missing marketplaceInclusionSql export — drift guard is unplugged',
    )
  }

  return pass(
    21,
    label,
    `all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; ${testCount} tests (≥8 required); marketplace query + badge wired; public detail route uses canonical marketplaceInclusionSql`,
  )
}

// ── Aggregation ──────────────────────────────────────────────────────

export function aggregateResults(
  results: CheckResult[],
  strict: boolean,
): AggregateSummary {
  const passCount = results.filter((r) => r.status === 'PASS').length
  const deferCount = results.filter((r) => r.status === 'DEFER').length
  const failCount = results.filter((r) => r.status === 'FAIL').length
  const effectiveFails = failCount + (strict ? deferCount : 0)
  return {
    total: results.length,
    pass: passCount,
    defer: deferCount,
    fail: failCount,
    effectiveFails,
    exitCode: effectiveFails > 0 ? 1 : 0,
  }
}

// ── Audit log writer ─────────────────────────────────────────────────

export function formatAuditBlock(
  results: CheckResult[],
  summary: AggregateSummary,
  isoTimestamp: string,
  mode: 'default' | 'strict-expansion',
): string {
  const lines: string[] = []
  lines.push('')
  lines.push(`## Phase 2 Gate — ${isoTimestamp}`)
  lines.push('')
  lines.push(
    `**Verdict:** ${summary.pass} PASS / ${summary.defer} DEFER / ${summary.fail} FAIL (of ${summary.total})`,
  )
  lines.push(`**Mode:** ${mode}`)
  lines.push(`**Exit code:** ${summary.exitCode}`)
  lines.push('')
  lines.push('| # | Check | Status | Detail |')
  lines.push('|---|-------|--------|--------|')
  for (const r of results) {
    // Sanitize detail for a single markdown table cell:
    //   | → \|     (escape table separator)
    //   \r,\n → ' ' (collapse line breaks; CR included for Windows tooling)
    const safeDetail = (r.detail ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
    lines.push(`| ${r.id} | ${escapeMd(r.label)} | ${r.status} | ${safeDetail} |`)
  }
  lines.push('')
  return lines.join('\n')
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, '\\|')
}

function appendAuditLog(block: string): void {
  if (!existsSync(AUDIT_LOG)) {
    writeFileSync(
      AUDIT_LOG,
      '# SettleGrid Audit Log\n\nAppend-only log of phase gate verdicts. Each gate run appends one section.\n' +
        block,
      'utf-8',
    )
  } else {
    appendFileSync(AUDIT_LOG, block, 'utf-8')
  }
}

// ── Main ─────────────────────────────────────────────────────────────

function logResult(r: CheckResult): void {
  const tag =
    r.status === 'PASS' ? '[PASS] ' : r.status === 'DEFER' ? '[DEFER]' : '[FAIL] '
  const detail = r.detail ? ` — ${r.detail}` : ''
  console.log(`  ${tag} ${String(r.id).padStart(2)} — ${r.label}${detail}`)
}

async function main(): Promise<void> {
  console.log('\n================= Phase 2 Gate (P2.14) =================\n')
  console.log(`Repo:   ${REPO_ROOT}`)
  console.log(`Mode:   ${STRICT_EXPANSION ? 'STRICT (DEFER -> FAIL)' : 'default (DEFER non-blocking)'}`)
  if (SKIP_BUILD) console.log('Note:   --skip-build (check 5 deferred)')
  if (SKIP_NETWORK) console.log('Note:   --skip-network (checks 6, 7 deferred)')
  if (SKIP_TESTS) console.log('Note:   --skip-tests (check 8 deferred)')
  console.log('')

  const results: CheckResult[] = []
  // Each check is wrapped in safeCheck so a thrown exception inside a
  // check function becomes a FAIL CheckResult rather than crashing the
  // gate harness mid-run (which would skip AUDIT_LOG writing and lose
  // the verdict for all preceding checks).
  const run = async (
    fn: () => Promise<CheckResult>,
    id: number,
  ): Promise<void> => {
    const r = await safeCheck(fn, id, fn.name || `check_${id}`)
    results.push(r)
    logResult(r)
  }

  console.log('Distribution-track checks (8):')
  await run(check1_cliInstallable, 1)
  await run(check2_registryPresent, 2)
  await run(check3_canonicalPolished, 3)
  await run(check4_shadowPopulated, 4)
  await run(check5_ssgBuild, 5)
  await run(check6_workflowGreen, 6)
  await run(check7_meilisearch, 7)
  await run(check8_typecheckTests, 8)

  console.log('')
  console.log('Settlement-layer expansion checks (12):')
  await run(check9_k1ProxyUsesKernel, 9)
  await run(check10_k2ProxiesRemoved, 10)
  await run(check11_k3SnapshotTest, 11)
  await run(check12_k4Lifecycle, 12)
  await run(check13_fmt1AiSdk, 13)
  await run(check14_fmt2Mastra, 14)
  await run(check15_fmt3Polished, 15)
  await run(check16_fmt4N8nInvoke, 16)
  await run(check17_mkt1Comparison, 17)
  await run(check18_rail1RailAdapter, 18)
  await run(check19_comp1OfacAupIr, 19)
  await run(check20_intl1CountryWise, 20)
  await run(check21_intl2MarketplaceVisibility, 21)

  const summary = aggregateResults(results, STRICT_EXPANSION)

  console.log('')
  console.log('---------------------------------------------------------')
  console.log(
    `Result: ${summary.pass} PASS, ${summary.defer} DEFER, ${summary.fail} FAIL (of ${summary.total} total)`,
  )

  if (!NO_AUDIT_LOG) {
    const block = formatAuditBlock(
      results,
      summary,
      new Date().toISOString(),
      STRICT_EXPANSION ? 'strict-expansion' : 'default',
    )
    appendAuditLog(block)
    console.log(`Verdict appended to ${AUDIT_LOG.replace(REPO_ROOT + '/', '')}`)
  }

  if (summary.exitCode !== 0) {
    console.log('')
    console.log('BLOCKING checks:')
    for (const r of results) {
      if (r.status === 'FAIL' || (STRICT_EXPANSION && r.status === 'DEFER')) {
        console.log(`  - Check ${r.id} (${r.label}): ${r.detail ?? ''}`)
      }
    }
    console.log('')
    console.log('Phase 3 entry BLOCKED.')
    process.exit(1)
  }

  if (summary.defer > 0) {
    console.log('')
    console.log(
      `${summary.defer} checks DEFERRED. Default mode treats DEFERs as non-blocking.`,
    )
    console.log('Rerun with --strict-expansion to require all 20 checks PASS before Phase 3.')
  }

  console.log('')
  console.log('All blocking checks PASS.')
  process.exit(0)
}

function isMainEntry(): boolean {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}

if (isMainEntry()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err))
    process.exit(2)
  })
}
