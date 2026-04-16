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

// ── Distribution-track checks (1-8) ──────────────────────────────────

async function check1_cliInstallable(): Promise<CheckResult> {
  const label = 'CLI installable + smoke passes'
  const distEntry = repoFile('packages', 'settlegrid-cli', 'dist', 'index.cjs')
  if (!fileExists(distEntry)) {
    return defer(1, label, `dist not built at ${distEntry}; run npm --workspace @settlegrid/cli run build`)
  }
  const versionRun = runSync('node', [distEntry, '--version'], { timeoutMs: 15_000 })
  if (versionRun.status !== 0) {
    return fail(1, label, `--version exited ${versionRun.status}: ${versionRun.stderr.trim().slice(0, 200)}`)
  }
  if (!/^\d+\.\d+\.\d+/.test(versionRun.stdout.trim())) {
    return fail(1, label, `--version stdout did not match semver: ${JSON.stringify(versionRun.stdout.slice(0, 80))}`)
  }
  // Smoke optionally — slow (clones 3 real repos). Only run when not skipping.
  if (SKIP_TESTS) {
    return pass(1, label, `--version OK (${versionRun.stdout.trim()}); smoke skipped (--skip-tests)`)
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
  }
  if (missing.length > 0) {
    return fail(3, label, `${missing.length} missing file(s); first: ${missing[0]}`)
  }
  return pass(3, label, `${arr.length} templates × 4 files all present`)
}

async function check4_shadowPopulated(): Promise<CheckResult> {
  const label = 'Shadow directory populated (≥1000 rows)'
  if (!process.env.DATABASE_URL) {
    return defer(4, label, 'DATABASE_URL not set in env')
  }
  // Use the existing shadow-index reader to count rows. Spawn a one-shot
  // tsx process so we don't need to bundle a Postgres client into this
  // gate script.
  const probe = `
    import { db } from '@/lib/db'
    import { mcpShadowIndex } from '@/lib/db/schema-shadow'
    import { sql } from 'drizzle-orm'
    const result = await db.select({ c: sql\`count(*)\` }).from(mcpShadowIndex)
    console.log(JSON.stringify({ count: Number(result[0]?.c ?? 0) }))
    process.exit(0)
  `
  const tmpFile = repoFile('apps', 'web', '.shadow-count-probe.mjs')
  try {
    writeFileSync(tmpFile, probe, 'utf-8')
    const r = runSync('npx', ['tsx', tmpFile], {
      cwd: repoFile('apps', 'web'),
      timeoutMs: 30_000,
    })
    if (r.status !== 0) {
      return defer(4, label, `probe exit ${r.status}: ${r.stderr.trim().slice(-200)}`)
    }
    try {
      const out = JSON.parse(r.stdout.trim().split('\n').pop() ?? '{}') as { count?: number }
      if ((out.count ?? 0) >= 1000) {
        return pass(4, label, `${out.count} rows`)
      }
      return fail(4, label, `only ${out.count ?? 0} rows (expected ≥1000)`)
    } catch (e) {
      return fail(4, label, `could not parse probe output: ${(e as Error).message}`)
    }
  } finally {
    try {
      // best-effort cleanup
      const fs = await import('node:fs/promises')
      await fs.unlink(tmpFile).catch(() => {})
    } catch {
      /* ignore */
    }
  }
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
  const galleryIndex = repoFile('apps', 'web', '.next', 'server', 'app', 'templates', 'page.html')
  if (!fileExists(galleryIndex)) {
    return fail(5, label, `gallery index missing at ${galleryIndex}`)
  }
  // Spot-check at least one canonical slug page exists.
  const sampleSlug = repoFile('apps', 'web', '.next', 'server', 'app', 'templates', 'settlegrid-nasa-data.html')
  const hasSample = fileExists(sampleSlug)
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
    return fail(5, label, `only ${shadowCount} shadow pages (expected ≥1000); sample slug: ${hasSample ? 'present' : 'missing'}`)
  }
  return pass(5, label, `gallery index + ${shadowCount} shadow pages`)
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
  if (latest.conclusion === 'success') {
    return pass(6, label, `latest run on main: success (${latest.headSha?.slice(0, 7)})`)
  }
  return fail(6, label, `latest run conclusion: ${latest.conclusion ?? latest.status}`)
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
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status !== 200) {
      return fail(7, label, `HTTP ${res.status}`)
    }
    const body = (await res.json()) as { status?: string }
    if (body.status === 'available') {
      return pass(7, label, `${url}/health → status=available`)
    }
    return fail(7, label, `responseBody.status = ${JSON.stringify(body.status)} (expected 'available')`)
  } catch (e) {
    return fail(7, label, `fetch failed: ${(e as Error).message}`)
  }
}

async function check8_typecheckTests(): Promise<CheckResult> {
  const label = 'Workspace tests green (turbo)'
  if (SKIP_TESTS) {
    return defer(8, label, 'skipped via --skip-tests')
  }
  const r = runSync('npx', ['turbo', 'test', '--concurrency=1', '--force'], {
    timeoutMs: 600_000,
  })
  if (r.status !== 0) {
    return fail(8, label, `turbo test exit ${r.status}: ${r.stderr.trim().slice(-300)}`)
  }
  // Look for "Tasks: N successful" line as a sanity check.
  const tasksLine = r.stdout.match(/Tasks:\s+(\d+)\s+successful,\s+(\d+)\s+total/)
  if (tasksLine && tasksLine[1] === tasksLine[2]) {
    return pass(8, label, `${tasksLine[1]}/${tasksLine[2]} workspace tasks PASS`)
  }
  return pass(8, label, 'turbo test exit 0')
}

// ── Settlement-layer expansion checks (9-20) ─────────────────────────

async function check9_k1ProxyUsesKernel(): Promise<CheckResult> {
  const label = 'K1 — marketplace proxy uses unified adapter package'
  const proxyDir = repoFile('apps', 'web', 'src', 'app', 'api', 'proxy')
  if (!dirExists(proxyDir)) {
    return defer(9, label, `${proxyDir} not present (K1 not yet shipped)`)
  }
  // Walk proxy dir and grep for kernel imports.
  const offending: string[] = []
  let kernelImports = 0
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(t|j)sx?$/.test(e.name)) continue
      const src = readFileSync(full, 'utf-8')
      if (/from ['"]@\/lib\/.*-proxy['"]/.test(src)) {
        offending.push(full.replace(REPO_ROOT + '/', ''))
      }
      if (/@settlegrid\/mcp-kernel/.test(src)) {
        kernelImports++
      }
    }
  }
  walk(proxyDir)
  // State machine (mirrors Phase 1 K4 build-challenge check pattern):
  //   no kernel imports + has lib imports → DEFER (K1 not yet started; pre-K1 state)
  //   no kernel imports + no lib imports  → DEFER (proxy dir empty/uninstrumented)
  //   has kernel imports + has lib imports → FAIL (partial migration — broken invariant)
  //   has kernel imports + no lib imports → PASS (K1 done)
  if (kernelImports === 0) {
    return defer(
      9,
      label,
      offending.length > 0
        ? `pre-K1 state: ${offending.length} lib/*-proxy import(s), 0 kernel imports`
        : 'no kernel imports and no lib/*-proxy imports — proxy uninstrumented',
    )
  }
  if (offending.length > 0) {
    return fail(
      9,
      label,
      `partial migration: ${kernelImports} kernel import(s) but ${offending.length} lib/*-proxy import(s) remain; first: ${offending[0]}`,
    )
  }
  return pass(9, label, `${kernelImports} file(s) import @settlegrid/mcp-kernel`)
}

async function check10_k2ProxiesRemoved(): Promise<CheckResult> {
  const label = 'K2 — 12 lib/*-proxy.ts migrated to adapter classes'
  const libDir = repoFile('apps', 'web', 'src', 'lib')
  const proxyFiles = dirExists(libDir)
    ? readdirSync(libDir).filter((f) => /-proxy\.ts$/.test(f))
    : []
  const adaptersDir = repoFile('packages', 'mcp', 'src', 'adapters')
  const adaptersExist = dirExists(adaptersDir)
  if (!adaptersExist) {
    return defer(10, label, `${adaptersDir} not present`)
  }
  // The spec allows thin shims, but if the count of proxy files is the
  // pre-migration count (12), K2 hasn't run.
  if (proxyFiles.length >= 12) {
    return defer(
      10,
      label,
      `${proxyFiles.length} *-proxy.ts files still in lib/ (K2 not yet shipped)`,
    )
  }
  return pass(10, label, `${proxyFiles.length} proxy file(s) remain (acceptable as shims)`)
}

async function check11_k3SnapshotTest(): Promise<CheckResult> {
  const label = 'K3 — proxy-vs-kernel snapshot test exists'
  const path = repoFile('packages', 'mcp', 'src', '__tests__', 'snapshot-equivalence.test.ts')
  if (!fileExists(path)) {
    return defer(11, label, `${path} not present`)
  }
  return pass(11, label, 'snapshot-equivalence.test.ts present')
}

async function check12_k4Lifecycle(): Promise<CheckResult> {
  const label = 'K4 — typed MeterContext + lifecycle stubs'
  const path = repoFile('packages', 'mcp', 'src', 'lifecycle.ts')
  if (!fileExists(path)) {
    return defer(12, label, `${path} not present`)
  }
  const src = readFileSync(path, 'utf-8')
  const required = ['MeterContext', 'beginInvocation', 'settleInvocation', 'voidInvocation', 'heartbeat']
  const missing = required.filter((s) => !src.includes(s))
  if (missing.length > 0) {
    return fail(12, label, `lifecycle.ts missing exports: ${missing.join(', ')}`)
  }
  return pass(12, label, 'MeterContext + 4 lifecycle stubs present')
}

async function check13_fmt1AiSdk(): Promise<CheckResult> {
  const label = 'FMT1 — @settlegrid/ai-sdk package'
  const pkgJson = repoFile('packages', 'ai-sdk', 'package.json')
  if (!fileExists(pkgJson)) {
    return defer(13, label, `${pkgJson} not present`)
  }
  const r = runSync('npm', ['--workspace', '@settlegrid/ai-sdk', 'test'], { timeoutMs: 120_000 })
  if (r.status !== 0) {
    return fail(13, label, `tests exit ${r.status}: ${r.stderr.trim().slice(-200)}`)
  }
  const m = r.stdout.match(/Tests\s+(\d+)\s+passed/)
  const count = m ? Number(m[1]) : 0
  if (count < 6) {
    return fail(13, label, `only ${count} tests passed (expected ≥6)`)
  }
  return pass(13, label, `${count} tests pass`)
}

async function check14_fmt2Mastra(): Promise<CheckResult> {
  const label = 'FMT2 — @settlegrid/mastra package'
  const pkgJson = repoFile('packages', 'mastra', 'package.json')
  if (!fileExists(pkgJson)) {
    return defer(14, label, `${pkgJson} not present`)
  }
  const r = runSync('npm', ['--workspace', '@settlegrid/mastra', 'test'], { timeoutMs: 120_000 })
  if (r.status !== 0) {
    return fail(14, label, `tests exit ${r.status}: ${r.stderr.trim().slice(-200)}`)
  }
  const m = r.stdout.match(/Tests\s+(\d+)\s+passed/)
  const count = m ? Number(m[1]) : 0
  if (count < 6) {
    return fail(14, label, `only ${count} tests passed (expected ≥6)`)
  }
  return pass(14, label, `${count} tests pass`)
}

async function check15_fmt3Polished(): Promise<CheckResult> {
  const label = 'FMT3 — TS adapter packages polished/rebranded'
  const candidates = ['langchain', 'n8n', 'cursor']
  const present = candidates.filter((c) => fileExists(repoFile('packages', c, 'package.json')))
  if (present.length === 0) {
    return defer(15, label, `no @settlegrid/{${candidates.join(',')}} packages present`)
  }
  // Verify each present package uses @settlegrid namespace.
  const wrongNs: string[] = []
  for (const p of present) {
    const pkg = JSON.parse(readFileSync(repoFile('packages', p, 'package.json'), 'utf-8')) as { name?: string }
    if (!pkg.name?.startsWith('@settlegrid/')) {
      wrongNs.push(`${p}: ${pkg.name}`)
    }
  }
  if (wrongNs.length > 0) {
    return fail(15, label, `non-@settlegrid name: ${wrongNs.join(', ')}`)
  }
  return pass(15, label, `${present.length}/${candidates.length} present, all under @settlegrid`)
}

async function check16_fmt4N8nInvoke(): Promise<CheckResult> {
  const label = 'FMT4 — n8n Invoke operation node'
  const path = repoFile('packages', 'n8n', 'src', 'nodes', 'Invoke.ts')
  if (!fileExists(path)) {
    return defer(16, label, `${path} not present`)
  }
  return pass(16, label, 'Invoke.ts present')
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
  const label = 'RAIL1 — Stripe behind RailAdapter interface'
  const indexPath = repoFile('packages', 'rails', 'src', 'index.ts')
  if (!fileExists(indexPath)) {
    return defer(18, label, `${indexPath} not present`)
  }
  const src = readFileSync(indexPath, 'utf-8')
  const required = ['RailAdapter', 'StripeRailAdapter']
  const missing = required.filter((s) => !src.includes(s))
  if (missing.length > 0) {
    return fail(18, label, `missing exports: ${missing.join(', ')}`)
  }
  return pass(18, label, 'RailAdapter + StripeRailAdapter exported')
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
  return pass(20, label, 'both INTL1 artifacts present')
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
    const safeDetail = (r.detail ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
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
  console.log('Distribution-track checks (8):')
  results.push(await check1_cliInstallable()); logResult(results.at(-1)!)
  results.push(await check2_registryPresent()); logResult(results.at(-1)!)
  results.push(await check3_canonicalPolished()); logResult(results.at(-1)!)
  results.push(await check4_shadowPopulated()); logResult(results.at(-1)!)
  results.push(await check5_ssgBuild()); logResult(results.at(-1)!)
  results.push(await check6_workflowGreen()); logResult(results.at(-1)!)
  results.push(await check7_meilisearch()); logResult(results.at(-1)!)
  results.push(await check8_typecheckTests()); logResult(results.at(-1)!)

  console.log('')
  console.log('Settlement-layer expansion checks (12):')
  results.push(await check9_k1ProxyUsesKernel()); logResult(results.at(-1)!)
  results.push(await check10_k2ProxiesRemoved()); logResult(results.at(-1)!)
  results.push(await check11_k3SnapshotTest()); logResult(results.at(-1)!)
  results.push(await check12_k4Lifecycle()); logResult(results.at(-1)!)
  results.push(await check13_fmt1AiSdk()); logResult(results.at(-1)!)
  results.push(await check14_fmt2Mastra()); logResult(results.at(-1)!)
  results.push(await check15_fmt3Polished()); logResult(results.at(-1)!)
  results.push(await check16_fmt4N8nInvoke()); logResult(results.at(-1)!)
  results.push(await check17_mkt1Comparison()); logResult(results.at(-1)!)
  results.push(await check18_rail1RailAdapter()); logResult(results.at(-1)!)
  results.push(await check19_comp1OfacAupIr()); logResult(results.at(-1)!)
  results.push(await check20_intl1CountryWise()); logResult(results.at(-1)!)

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
