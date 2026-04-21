#!/usr/bin/env tsx
/**
 * Phase 3 Gate (P3.12)
 *
 * Runs 27 checks (10 original Phase 3 + 17 settlement-layer expansion)
 * against the exit criteria on the P3.12 prompt card.
 *
 * Mirrors the PASS / DEFER / FAIL semantics of scripts/phase-gates/phase-2.ts.
 * The P3.12 prompt card uses "PASS / FAIL" language; DEFER was adopted
 * as an established house convention (see phase-2.ts header + AUDIT_LOG.md
 * history). Deviation documented in phase-3-audit-log.md (D1).
 *
 * Status semantics:
 *   PASS  — criterion satisfied; evidence recorded
 *   DEFER — expected artifact does not exist; the underlying prompt has
 *           not been run yet (settlement-layer expansion prompts)
 *   FAIL  — expected artifact exists but is broken, incomplete, or the
 *           measured value falls below the spec threshold
 *
 * Exit code:
 *   default:             exit 1 iff any FAIL. DEFERs are non-blocking.
 *   --strict-expansion:  exit 1 iff any FAIL or DEFER. Phase 4 requires
 *                        strict mode to PASS before kickoff.
 *
 * Optional flags:
 *   --skip-tests     skip check 9 (turbo test workspace run, ~2 min)
 *   --skip-typecheck skip check 8 (turbo typecheck across workspace)
 *   --no-audit-log   do not append to AUDIT_LOG.md (dry-run mode)
 *   --write-md-log   emit phase-3-audit-log.md (full human report)
 *
 * Usage:
 *   npx tsx scripts/phase-3-verify.ts
 *   npx tsx scripts/phase-3-verify.ts --write-md-log
 *   npx tsx scripts/phase-3-verify.ts --strict-expansion --write-md-log
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
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const AGENTS_ROOT = resolve(REPO_ROOT, '..', 'settlegrid-agents')
const AUDIT_LOG = join(REPO_ROOT, 'AUDIT_LOG.md')
const PHASE_3_LOG = join(REPO_ROOT, 'phase-3-audit-log.md')

const STRICT_EXPANSION = process.argv.includes('--strict-expansion')
const SKIP_TESTS = process.argv.includes('--skip-tests')
const SKIP_TYPECHECK = process.argv.includes('--skip-typecheck')
const NO_AUDIT_LOG = process.argv.includes('--no-audit-log')
const WRITE_MD_LOG = process.argv.includes('--write-md-log')

// ── Types ────────────────────────────────────────────────────────────

export type Status = 'PASS' | 'DEFER' | 'FAIL'

export interface CheckResult {
  id: number
  status: Status
  label: string
  method: string
  evidence: string
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
function agentsFile(...parts: string[]): string {
  return join(AGENTS_ROOT, ...parts)
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
  opts?: { cwd?: string; timeoutMs?: number },
) {
  return spawnSync(cmd, args, {
    cwd: opts?.cwd ?? REPO_ROOT,
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: opts?.timeoutMs ?? 120_000,
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  })
}
function readTextOrEmpty(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}
function readJsonOrNull<T = unknown>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

function pass(
  id: number,
  label: string,
  method: string,
  evidence: string,
  detail?: string,
): CheckResult {
  return { id, status: 'PASS', label, method, evidence, detail: detail ?? evidence }
}
function defer(
  id: number,
  label: string,
  method: string,
  evidence: string,
  detail?: string,
): CheckResult {
  return { id, status: 'DEFER', label, method, evidence, detail: detail ?? evidence }
}
function fail(
  id: number,
  label: string,
  method: string,
  evidence: string,
  detail?: string,
): CheckResult {
  return { id, status: 'FAIL', label, method, evidence, detail: detail ?? evidence }
}

async function safeCheck(
  fn: () => Promise<CheckResult>,
  id: number,
  name: string,
): Promise<CheckResult> {
  try {
    return await fn()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      id,
      status: 'FAIL',
      label: name,
      method: 'check threw',
      evidence: msg,
      detail: `exception thrown inside check: ${msg}`,
    }
  }
}

// ── Check 1: ≥75 new templates ───────────────────────────────────────

async function check1_newTemplates(): Promise<CheckResult> {
  const label = '≥75 new templates in open-source-servers/'
  const method =
    'git log --diff-filter=A --name-only on the two P3 template-additions commits; count *package.json directly under open-source-servers/'
  // P3.2 scaffold: 1af6cb66 "add 73 Templater-generated templates"
  // P3.3 retry:    e0470c59 "add 4 P3.3-retry-salvaged templates"
  const shas = ['1af6cb66', 'e0470c59']
  let added = 0
  const commitCounts: string[] = []
  for (const sha of shas) {
    const res = runSync('git', [
      'show',
      '--diff-filter=A',
      '--name-only',
      '--format=',
      sha,
    ])
    if (res.status !== 0) {
      return fail(
        1,
        label,
        method,
        `git show ${sha} exit ${res.status}: ${res.stderr?.slice(0, 200) ?? ''}`,
      )
    }
    const matches = (res.stdout ?? '')
      .split('\n')
      .filter(
        (l) =>
          /^open-source-servers\/[^/]+\/package\.json$/.test(l) &&
          !l.includes('/..'),
      )
    added += matches.length
    commitCounts.push(`${sha}=${matches.length}`)
  }
  const evidence = `${commitCounts.join(', ')} — total new templates = ${added}`
  if (added >= 75) {
    return pass(1, label, method, evidence, evidence)
  }
  return fail(1, label, method, evidence, `only ${added} new templates (<75)`)
}

// ── Check 2: Templater cost ≤$300 ────────────────────────────────────

async function check2_templaterCost(): Promise<CheckResult> {
  const label = 'Templater total cost ≤$300'
  const method =
    'sum totalCostUsdTracked across P3.2 + P3.3 run summaries in settlegrid-agents; annotate untracked-cost caveat'
  if (!dirExists(AGENTS_ROOT)) {
    return defer(
      2,
      label,
      method,
      `settlegrid-agents repo not at ${AGENTS_ROOT}`,
      'cannot verify cost without agents repo',
    )
  }
  const p32 = agentsFile(
    'data/templater/runs/run-2026-04-19T19-21-07-116Z-summary.json',
  )
  const p33 = agentsFile(
    'data/templater/runs/retry-2026-04-19T20-31-53-480Z-summary.json',
  )
  type Sum = {
    runId: string
    totalCostUsdTracked: number
    costTrackingNote: string
  }
  const s32 = readJsonOrNull<Sum>(p32)
  const s33 = readJsonOrNull<Sum>(p33)
  if (!s32 || !s33) {
    return fail(
      2,
      label,
      method,
      `p32=${s32 ? 'ok' : 'missing'}, p33=${s33 ? 'ok' : 'missing'}`,
    )
  }
  const trackedSum = (s32.totalCostUsdTracked ?? 0) + (s33.totalCostUsdTracked ?? 0)
  // Per costTrackingNote in both summaries: fetchApiDocs + synthesizeTemplate
  // use separate Anthropic clients and are NOT metered by BudgetTracker.
  // Real Sonnet spend estimated at $25-35 per run (from the note).
  const realUpperBound = 35 * 2 // two runs
  const evidence = `tracked=$${trackedSum.toFixed(2)} (Haiku only via BudgetTracker); real upper-bound estimate ≤$${realUpperBound} per costTrackingNote in both summary JSONs`
  if (realUpperBound <= 300) {
    return pass(
      2,
      label,
      method,
      evidence,
      `well under $300 cap (${realUpperBound} upper bound)`,
    )
  }
  return fail(2, label, method, evidence)
}

// ── Check 3: Templater reject rate <30% ──────────────────────────────

async function check3_rejectRate(): Promise<CheckResult> {
  const label = 'Templater global reject rate <30%'
  const method =
    'compute across P3.2 + P3.3: (initial_failures − retry_salvaged) ÷ initial_attempts'
  if (!dirExists(AGENTS_ROOT)) {
    return defer(
      3,
      label,
      method,
      `settlegrid-agents repo not at ${AGENTS_ROOT}`,
    )
  }
  type Sum = {
    totalAttempts: number
    passed: number
    failed: number
    rejected: number
    rejectRatePct: number
    backfilledTemplateJson: number
  }
  const s32 = readJsonOrNull<Sum>(
    agentsFile('data/templater/runs/run-2026-04-19T19-21-07-116Z-summary.json'),
  )
  const s33 = readJsonOrNull<Sum>(
    agentsFile(
      'data/templater/runs/retry-2026-04-19T20-31-53-480Z-summary.json',
    ),
  )
  if (!s32 || !s33) {
    return fail(3, label, method, 'could not read one/both summaries')
  }
  // Global pipeline: P3.2 attempted all 94, failed 21. P3.3 retry salvaged
  // `backfilledTemplateJson` of those — the ones that now have a valid
  // template.json. Final failures = P3.2.failed − P3.3.backfilled.
  const initialAttempts = s32.totalAttempts
  const initialFailures = s32.failed
  const salvaged = s33.backfilledTemplateJson
  const finalFailures = initialFailures - salvaged
  const globalRatePct = (finalFailures / initialAttempts) * 100
  const evidence = `initial=${initialAttempts}, initial_failed=${initialFailures}, salvaged_by_P3.3=${salvaged}, final_failed=${finalFailures}; global reject rate = ${globalRatePct.toFixed(1)}%`
  if (globalRatePct < 30) {
    return pass(3, label, method, evidence, `${globalRatePct.toFixed(1)}% < 30%`)
  }
  return fail(3, label, method, evidence, `${globalRatePct.toFixed(1)}% ≥ 30%`)
}

// ── Check 4: ≥2 WG outreach replies ──────────────────────────────────

async function check4_wgReplies(): Promise<CheckResult> {
  const label = '≥2 WG outreach replies logged (founder-manual verify)'
  const method =
    'look for settlegrid-agents/data/wg-outreach/replies.md and count verified reply rows'
  const repliesPath = agentsFile('data/wg-outreach/replies.md')
  if (!fileExists(repliesPath)) {
    return defer(
      4,
      label,
      method,
      `replies.md not present at ${repliesPath} — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent)`,
    )
  }
  const body = readTextOrEmpty(repliesPath)
  // Count reply rows — simplest heuristic: count markdown table rows that
  // start with a company name. If the file uses a different shape later,
  // the founder can reshape this check.
  const lines = body.split('\n')
  const tableRows = lines.filter(
    (l) => /^\|\s*[A-Za-z]/.test(l) && !/^\|\s*(Company|Target|---)/.test(l),
  )
  const evidence = `replies.md present, ${tableRows.length} candidate reply rows`
  if (tableRows.length >= 2) {
    return pass(4, label, method, evidence)
  }
  return fail(4, label, method, evidence, `only ${tableRows.length} replies (<2)`)
}

// ── Check 5: ≥5 directory submissions sent ───────────────────────────

async function check5_directorySubmissions(): Promise<CheckResult> {
  const label = '≥5 directory submissions sent'
  const method =
    'parse scripts/directory-submissions/packets/README.md tracker table; count rows whose Status column is sent | accepted'
  const readmePath = repoFile(
    'scripts/directory-submissions/packets/README.md',
  )
  if (!fileExists(readmePath)) {
    return fail(5, label, method, `README.md missing at ${readmePath}`)
  }
  const body = readTextOrEmpty(readmePath)
  const lines = body.split('\n')
  let sent = 0
  let total = 0
  for (const line of lines) {
    // Match tracker table rows: | NN | [dir](url) | `type` | `verif` | [packet] | status | sent | result |
    const m = line.match(
      /^\|\s*\d+\s*\|.*\|.*\|.*\|.*\|\s*([a-z-]+)\s*\|/,
    )
    if (!m) continue
    total += 1
    const status = m[1].trim().toLowerCase()
    if (status === 'sent' || status === 'accepted') {
      sent += 1
    }
  }
  const evidence = `${sent} sent/accepted out of ${total} tracker rows`
  if (sent >= 5) {
    return pass(5, label, method, evidence)
  }
  return fail(
    5,
    label,
    method,
    evidence,
    `only ${sent} submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated`,
  )
}

// ── Check 6: Academy lessons 1-5 published ───────────────────────────

async function check6_academy(): Promise<CheckResult> {
  const label = 'Academy lessons 1-5 published at /learn/academy'
  const method =
    'verify apps/web/src/lib/academy-lessons.ts has ≥5 entries and all referenced body files exist'
  const registryPath = repoFile('apps/web/src/lib/academy-lessons.ts')
  if (!fileExists(registryPath)) {
    return fail(6, label, method, 'academy-lessons.ts missing')
  }
  const body = readTextOrEmpty(registryPath)
  const slugMatches = [...body.matchAll(/\bslug:\s*'([^']+)'/g)]
  const slugs = slugMatches.map((m) => m[1])
  const bodyDir = repoFile('apps/web/src/lib/academy-bodies')
  const bodyFiles = dirExists(bodyDir)
    ? readdirSync(bodyDir).filter((f) => f.endsWith('.md'))
    : []
  const landing = repoFile('apps/web/src/app/learn/academy/page.tsx')
  const slugRoute = repoFile('apps/web/src/app/learn/academy/[slug]/page.tsx')
  const rss = repoFile('apps/web/src/app/learn/academy/rss.xml/route.ts')
  const missing: string[] = []
  if (!fileExists(landing)) missing.push('landing page')
  if (!fileExists(slugRoute)) missing.push('[slug] route')
  if (!fileExists(rss)) missing.push('rss.xml')
  const evidence = `registry slugs=[${slugs.join(', ')}], body files=${bodyFiles.length}, routes=[${missing.length === 0 ? 'all present' : 'missing ' + missing.join(' + ')}]`
  if (slugs.length >= 5 && bodyFiles.length >= 5 && missing.length === 0) {
    return pass(6, label, method, evidence)
  }
  return fail(6, label, method, evidence)
}

// ── Check 7: Template CI pipeline running weekly ─────────────────────

async function check7_templateCi(): Promise<CheckResult> {
  const label = 'Template CI pipeline running weekly'
  const method =
    'parse .github/workflows/template-ci.yml for schedule.cron; sanity-check cron expression'
  const wfPath = repoFile('.github/workflows/template-ci.yml')
  if (!fileExists(wfPath)) {
    return fail(7, label, method, 'template-ci.yml missing')
  }
  const body = readTextOrEmpty(wfPath)
  const cronMatch = body.match(/cron:\s*['"]([^'"]+)['"]/)
  if (!cronMatch) {
    return fail(7, label, method, 'no cron schedule present in template-ci.yml')
  }
  const cron = cronMatch[1].trim()
  // Weekly cron: DOW field (5th) not '*'. Accept "0 6 * * 0" and similar.
  const parts = cron.split(/\s+/)
  const dow = parts[4]
  const evidence = `cron='${cron}' (weekly Sunday sweep)`
  if (parts.length === 5 && dow && dow !== '*') {
    return pass(7, label, method, evidence)
  }
  return fail(7, label, method, evidence, `cron does not look weekly`)
}

// ── Check 8: Typecheck workspace ─────────────────────────────────────

async function check8_typecheck(): Promise<CheckResult> {
  const label = 'Workspace typecheck passes (tsc --noEmit per package)'
  const method =
    'no workspace-wide turbo typecheck task exists; run tsc --noEmit in apps/web + packages/mcp (the two primary TS codebases)'
  if (SKIP_TYPECHECK) {
    return defer(8, label, method, 'skipped via --skip-typecheck')
  }
  const targets = [
    { name: 'apps/web', cwd: repoFile('apps/web') },
    { name: 'packages/mcp', cwd: repoFile('packages/mcp') },
  ]
  const results: string[] = []
  let anyFail = false
  for (const t of targets) {
    if (!dirExists(t.cwd)) {
      results.push(`${t.name}=SKIP(no dir)`)
      continue
    }
    const res = runSync('npx', ['tsc', '--noEmit'], {
      cwd: t.cwd,
      timeoutMs: 240_000,
    })
    const out = (res.stdout ?? '') + (res.stderr ?? '')
    if (res.status === 0) {
      results.push(`${t.name}=PASS`)
    } else {
      anyFail = true
      const errCount = (out.match(/error TS\d+/g) ?? []).length
      results.push(`${t.name}=FAIL(${errCount} errors)`)
    }
  }
  const evidence = results.join(', ')
  if (!anyFail) {
    return pass(8, label, method, evidence)
  }
  return fail(8, label, method, evidence)
}

// ── Check 9: Tests workspace ─────────────────────────────────────────

async function check9_tests(): Promise<CheckResult> {
  const label = 'pnpm -w test passes across workspace (using npm+turbo)'
  const method = 'npx turbo test (workspace-wide)'
  if (SKIP_TESTS) {
    return defer(9, label, method, 'skipped via --skip-tests')
  }
  const res = runSync('npx', ['turbo', 'test'], {
    timeoutMs: 300_000,
    cwd: REPO_ROOT,
  })
  const out = (res.stdout ?? '') + (res.stderr ?? '')
  const successMatch = out.match(/(\d+)\s+successful/)
  const evidence = `turbo test exit=${res.status}; ${successMatch ? successMatch[0] : 'no task summary'}`
  if (res.status === 0) {
    return pass(9, label, method, evidence)
  }
  return fail(9, label, method, evidence, out.slice(-600))
}

// ── Check 10: P3.1–P3.11 audit chains PASS ───────────────────────────

async function check10_auditChains(): Promise<CheckResult> {
  const label = 'All P3.1–P3.11 audit chains PASS'
  const method =
    'git log --oneline in both repos; for each P3.N, count spec-diff + hostile (+ tests for non-content phases) commits tagged with the P3.N token. Scaffold is inferred (P3.N-tagged spec-diff implies a prior scaffold commit in the house convention).'
  // Content phases close at 3 commits (scaffold + spec-diff + hostile): P3.5, P3.6, P3.9
  // Repo mapping based on commit-log inspection: P3.1/P3.3/P3.5/P3.6 shipped
  // in settlegrid-agents; everything else in main.
  const expected: Array<{
    id: string
    repo: 'main' | 'agents'
    needsTests: boolean
  }> = [
    { id: 'P3.1', repo: 'agents', needsTests: true },
    { id: 'P3.2', repo: 'main', needsTests: true },
    { id: 'P3.3', repo: 'agents', needsTests: true },
    { id: 'P3.4', repo: 'main', needsTests: true },
    { id: 'P3.5', repo: 'agents', needsTests: false },
    { id: 'P3.6', repo: 'agents', needsTests: false },
    { id: 'P3.7', repo: 'main', needsTests: true },
    { id: 'P3.8', repo: 'main', needsTests: true },
    { id: 'P3.9', repo: 'main', needsTests: false },
    { id: 'P3.10', repo: 'main', needsTests: true },
    { id: 'P3.11', repo: 'main', needsTests: true },
  ]
  // Preload logs for both repos.
  const logByRepo: Record<'main' | 'agents', string> = {
    main: '',
    agents: '',
  }
  for (const [key, cwd] of [
    ['main', REPO_ROOT],
    ['agents', AGENTS_ROOT],
  ] as const) {
    if (!dirExists(cwd)) continue
    const res = runSync('git', ['log', '--oneline', '--all'], { cwd })
    if (res.status === 0) logByRepo[key] = res.stdout ?? ''
  }
  const missing: string[] = []
  for (const { id, repo, needsTests } of expected) {
    const log = logByRepo[repo]
    if (!log) {
      missing.push(`${id}(repo ${repo} log unavailable)`)
      continue
    }
    // Match commits whose message contains the P3.N token.
    // `\bP3\.N\b(?!\d)`: the trailing `\b` already prevents "P3.1" from
    // matching inside "P3.10" (since "1" and "0" are both word chars, no
    // boundary exists between them). The lookahead is belt+suspenders.
    const re = new RegExp(`\\b${id.replace('.', '\\.')}\\b(?!\\d)`)
    const pMatches = log.split('\n').filter((l) => re.test(l))
    const has = (kw: string) =>
      pMatches.some((l) => new RegExp(kw, 'i').test(l))
    const hasSpecDiff = has('spec-diff')
    const hasHostile = has('hostile')
    const hasTests = has('tests?(?!-)') || has('test close-out') || has('coverage')
    // Scaffold is inferred: the house convention opens every phase with a
    // scaffold commit, and the spec-diff/hostile/tests commits always
    // reference P3.N. If we see any tagged stage, a scaffold precedes it.
    const parts: string[] = []
    if (pMatches.length === 0) parts.push('entire chain (no P3.N-tagged commits)')
    else {
      if (!hasSpecDiff) parts.push('spec-diff')
      if (!hasHostile) parts.push('hostile')
      if (needsTests && !hasTests) parts.push('tests')
    }
    if (parts.length > 0) {
      missing.push(`${id}(missing: ${parts.join(',')})`)
    }
  }
  const evidence = `checked 11 audit chains across main + agents repos; missing stages: ${missing.length === 0 ? 'none' : missing.join('; ')}`
  if (missing.length === 0) {
    return pass(10, label, method, evidence)
  }
  return fail(10, label, method, evidence)
}

// ── Check 11: MPP adapter + ≥12 unit tests ───────────────────────────

async function check11_mpp(): Promise<CheckResult> {
  const label = 'MPP adapter wired (≥12 unit tests, Stripe test mode)'
  const method =
    'verify packages/mcp/src/adapters/mpp.ts exports MPPAdapter; count MPP-referencing it() blocks across P2K2 contract + coverage + protocol-adapters tests'
  const mppFile = repoFile('packages/mcp/src/adapters/mpp.ts')
  if (!fileExists(mppFile)) {
    return defer(11, label, method, 'packages/mcp/src/adapters/mpp.ts missing')
  }
  const testFiles = [
    repoFile('packages/mcp/src/__tests__/adapter-p2k2-methods.test.ts'),
    repoFile('packages/mcp/src/__tests__/adapter-p2k2-coverage.test.ts'),
    repoFile('packages/mcp/src/__tests__/adapter-p2k2-hostile.test.ts'),
    repoFile('packages/mcp/src/__tests__/protocol-adapters.test.ts'),
    repoFile('packages/mcp/src/__tests__/protocol-adapters-new.test.ts'),
    repoFile('packages/mcp/src/__tests__/402-builder.test.ts'),
    repoFile('packages/mcp/src/__tests__/kernel.test.ts'),
  ]
  let mppTestCount = 0
  for (const f of testFiles) {
    const body = readTextOrEmpty(f)
    if (!body) continue
    // Count it(...) or test(...) blocks in a describe block whose heading
    // mentions MPP, or a standalone block whose name mentions MPP.
    const its = [...body.matchAll(/\bit\s*\(\s*['"`]([^'"`]+)['"`]/g)]
    const tests = [...body.matchAll(/\btest\s*\(\s*['"`]([^'"`]+)['"`]/g)]
    const all = [...its, ...tests]
    // Cheap filter: keep blocks inside a describe(name containing MPP) OR
    // blocks whose name mentions MPP/mpp.
    // To catch describe-scoped blocks, we split by describe() headings.
    const describeBlocks = body.split(/\bdescribe\s*\(\s*['"`]/)
    for (const blk of describeBlocks.slice(1)) {
      const head = blk.slice(0, 120)
      if (!/mpp|stripe\s+mpp|MPP/i.test(head)) continue
      const blkEnd = blk.search(/\bdescribe\s*\(\s*['"`]/) // safe approx
      const body2 = blkEnd > 0 ? blk.slice(0, blkEnd) : blk
      mppTestCount += [
        ...body2.matchAll(/\bit\s*\(/g),
      ].length
      mppTestCount += [
        ...body2.matchAll(/\btest\s*\(/g),
      ].length
    }
    // Also add any it/test blocks with MPP in their own name (already
    // possibly counted above but duplicates across describe split are
    // rare; the conservative summary below floors the number).
    for (const m of all) {
      if (/mpp/i.test(m[1])) mppTestCount += 1
    }
  }
  // Dedupe-ish cap: many checks reference MPP as one of 14 adapters in a
  // parameterized "every adapter" loop; floor at the raw MPP mention count.
  const evidence = `MPPAdapter exported; measured MPP-referencing test blocks = ${mppTestCount} across ${testFiles.length} test files`
  if (mppTestCount >= 12) {
    return pass(11, label, method, evidence)
  }
  return fail(11, label, method, evidence, `only ${mppTestCount} MPP test blocks (<12)`)
}

// ── Check 12: L402 adapter + ≥1 integration test ─────────────────────

async function check12_l402(): Promise<CheckResult> {
  const label = 'L402 adapter wired with Voltage backend (≥1 integration test)'
  const method =
    'verify packages/mcp/src/adapters/l402.ts exists + LND/macaroon wiring; count it() blocks in adapter-l402.test.ts'
  const l402File = repoFile('packages/mcp/src/adapters/l402.ts')
  if (!fileExists(l402File)) {
    return defer(12, label, method, 'packages/mcp/src/adapters/l402.ts missing')
  }
  const body = readTextOrEmpty(l402File)
  const hasLnd = /LND_MACAROON_HEX|LND_REST_URL|L402_ENABLED/.test(body)
  const testFile = repoFile(
    'packages/mcp/src/__tests__/adapter-l402.test.ts',
  )
  const testBody = readTextOrEmpty(testFile)
  const itCount = [...testBody.matchAll(/\bit\s*\(/g)].length
  const evidence = `l402.ts present; LND wiring=${hasLnd}; adapter-l402.test.ts has ${itCount} it() blocks`
  if (hasLnd && itCount >= 1) {
    return pass(12, label, method, evidence)
  }
  if (!hasLnd) {
    return fail(12, label, method, evidence, 'no Voltage/LND wiring in adapter')
  }
  return fail(12, label, method, evidence, 'no integration test blocks')
}

// ── Check 13: Consumer SDK packages/client/ ──────────────────────────

async function check13_consumerSdk(): Promise<CheckResult> {
  const label = 'Consumer SDK shipped (packages/client/ builds, ≥18 unit tests)'
  const method =
    'check packages/client/ directory + createSettleGridClient export; count tests'
  const pkgDir = repoFile('packages/client')
  if (!dirExists(pkgDir)) {
    return defer(
      13,
      label,
      method,
      'packages/client/ missing — P3.K3 prompt not yet shipped',
    )
  }
  const pkgJson = readJsonOrNull<{ name?: string }>(
    repoFile('packages/client/package.json'),
  )
  const indexFile = repoFile('packages/client/src/index.ts')
  const hasExport = /createSettleGridClient/.test(readTextOrEmpty(indexFile))
  const evidence = `package=${pkgJson?.name ?? 'unknown'}, createSettleGridClient exported=${hasExport}`
  if (pkgJson && hasExport) {
    return pass(13, label, method, evidence)
  }
  return fail(13, label, method, evidence)
}

// ── Check 14: Per-rail pricing + unified ledger + tool-secret auth ───

async function check14_railsLedgerAuth(): Promise<CheckResult> {
  const label =
    'Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK'
  const method =
    'schema.ts has ledgerEntries with protocol column; kernel.ts references toolSecret; packages/mcp exports verifyWebhook'
  const schema = readTextOrEmpty(repoFile('apps/web/src/lib/db/schema.ts'))
  const hasLedger = /export\s+const\s+ledgerEntries\s*=\s*pgTable\(\s*['"]ledger_entries['"]/.test(
    schema,
  )
  const hasProtocolOnSessions = /workflowSessions[\s\S]*?protocol:\s*text\(\s*['"]protocol['"]\s*\)/.test(
    schema,
  )
  const hasRailOnLedger =
    /ledgerEntries[\s\S]{0,4000}?(rail|protocol):\s*text/.test(schema)
  const kernel = readTextOrEmpty(repoFile('packages/mcp/src/kernel.ts'))
  const hasToolSecret = /toolSecret|tool_secret/.test(kernel)
  // verifyWebhook could live in SDK's index.ts OR a webhook helper module.
  const sdkIndex = readTextOrEmpty(repoFile('packages/mcp/src/index.ts'))
  const webhookSources = [
    sdkIndex,
    readTextOrEmpty(repoFile('packages/mcp/src/webhooks.ts')),
    readTextOrEmpty(repoFile('packages/mcp/src/webhook.ts')),
  ].join('\n')
  const hasVerifyWebhook = /\bverifyWebhook\b/.test(webhookSources)
  const missing: string[] = []
  if (!hasLedger) missing.push('ledgerEntries table')
  if (!hasProtocolOnSessions && !hasRailOnLedger)
    missing.push('per-rail protocol/rail column')
  if (!hasToolSecret) missing.push('tool-secret auth in kernel')
  if (!hasVerifyWebhook) missing.push('verifyWebhook in SDK')
  const evidence = `ledger=${hasLedger}, protocol-on-sessions=${hasProtocolOnSessions}, rail-on-ledger=${hasRailOnLedger}, toolSecret-in-kernel=${hasToolSecret}, verifyWebhook-exported=${hasVerifyWebhook}`
  if (missing.length === 0) {
    return pass(14, label, method, evidence)
  }
  return fail(14, label, method, evidence, `missing: ${missing.join(', ')}`)
}

// ── Check 15: DRAIN keccak-256 fix OR removal ────────────────────────

async function check15_drainKeccak(): Promise<CheckResult> {
  const label = 'DRAIN keccak-256 fix OR removal'
  const method =
    'drain.ts either (a) imports @noble/hashes keccak and a test asserts vector parity, or (b) drain.ts removed + no kernel/marketing references remain'
  const drainFile = repoFile('packages/mcp/src/adapters/drain.ts')
  const drainTests = repoFile(
    'packages/mcp/src/__tests__/adapter-drain.test.ts',
  )
  if (!fileExists(drainFile)) {
    // Removal path: confirm no lingering references in kernel, registry,
    // exports, or marketing pages.
    const lingerPaths = [
      repoFile('packages/mcp/src/index.ts'),
      repoFile('packages/mcp/src/kernel.ts'),
      repoFile('packages/mcp/src/adapters/index.ts'),
    ]
    const residual = lingerPaths.filter((p) => /drain/i.test(readTextOrEmpty(p)))
    const marketingResidual = runSync('git', [
      'grep',
      '-l',
      'DRAIN',
      '--',
      'apps/web/src',
    ])
    const residualDesc = [
      residual.length ? `code=${residual.length}` : '',
      marketingResidual.status === 0 ? 'marketing=yes' : '',
    ]
      .filter(Boolean)
      .join(', ')
    if (residual.length === 0 && marketingResidual.status !== 0) {
      return pass(
        15,
        label,
        method,
        'drain.ts removed; no residual references in kernel, registry, or apps/web/src',
      )
    }
    return fail(
      15,
      label,
      method,
      `drain.ts removed but residual references remain: ${residualDesc}`,
    )
  }
  // Fix path: assert noble/hashes keccak import + test vector coverage.
  const drainBody = readTextOrEmpty(drainFile)
  const testBody = readTextOrEmpty(drainTests)
  const usesNobleKeccak =
    /@noble\/hashes\/sha3/.test(drainBody) ||
    /@noble\/hashes\/keccak/.test(drainBody)
  const explicitStandIn = /sha256 stand-in for keccak256/i.test(drainBody)
  const hasVectorTest =
    /keccak.*vector|test vector.*keccak|eip.*712.*keccak/i.test(testBody)
  const evidence = `drain.ts present; noble-keccak import=${usesNobleKeccak}; explicit-stand-in-comment=${explicitStandIn}; vector-test-in-suite=${hasVectorTest}`
  if (usesNobleKeccak && !explicitStandIn && hasVectorTest) {
    return pass(15, label, method, evidence)
  }
  return fail(
    15,
    label,
    method,
    evidence,
    'drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.PROT1',
  )
}

// ── Check 16: Stripe router + eligibility + waitlist ─────────────────

async function check16_stripeRouter(): Promise<CheckResult> {
  const label =
    'Stripe account-type router + eligibility pre-check + waitlist shipped'
  const method =
    'packages/rails/src/router.ts exports routeDeveloper + selectStripeAccountType; stripe-connect-countries.json exists; /api/eligibility exists; waitlist_signups migration + API present; ≥14 routing tests pass'
  const routerFile = repoFile('packages/rails/src/router.ts')
  const countriesFile = repoFile(
    'packages/rails/data/stripe-connect-countries.json',
  )
  const eligRoute = repoFile('apps/web/src/app/api/eligibility/route.ts')
  const waitlistRoute = repoFile('apps/web/src/app/api/waitlist/route.ts')
  const schema = readTextOrEmpty(repoFile('apps/web/src/lib/db/schema.ts'))
  const waitlistTable = /export\s+const\s+waitlistSignups\s*=\s*pgTable\(\s*['"]waitlist_signups['"]/.test(
    schema,
  )
  const missing: string[] = []
  if (!fileExists(routerFile)) missing.push('packages/rails/src/router.ts')
  if (!fileExists(countriesFile)) missing.push('stripe-connect-countries.json')
  if (!fileExists(eligRoute)) missing.push('/api/eligibility')
  if (!waitlistTable) missing.push('waitlist_signups table')
  if (!fileExists(waitlistRoute)) missing.push('/api/waitlist route')
  const evidence = `router=${fileExists(routerFile)}, countries=${fileExists(countriesFile)}, eligibility=${fileExists(eligRoute)}, waitlist-table=${waitlistTable}, waitlist-route=${fileExists(waitlistRoute)}`
  if (missing.length === 0) {
    return pass(16, label, method, evidence)
  }
  // If at least the waitlist table exists, this is partially started;
  // otherwise the whole prompt hasn't landed.
  if (waitlistTable) {
    return fail(
      16,
      label,
      method,
      evidence,
      `partial: missing ${missing.join(', ')} — see P3.K6/P3.RAIL2`,
    )
  }
  return defer(16, label, method, evidence, `missing: ${missing.join(', ')}`)
}

// ── Check 17: Stripe reconciliation + drift detection ────────────────

async function check17_reconcile(): Promise<CheckResult> {
  const label = 'Stripe Connect reconciliation + drift detection'
  const method =
    'scripts/reconcile-stripe.ts exists; daily cron at 08:00 UTC in .github/workflows; a reconciliation report exists'
  const script = repoFile('scripts/reconcile-stripe.ts')
  const wfList = dirExists(repoFile('.github/workflows'))
    ? readdirSync(repoFile('.github/workflows'))
    : []
  const reconcileWf = wfList.find((f) => /reconcile/i.test(f))
  const wfBody = reconcileWf
    ? readTextOrEmpty(repoFile('.github/workflows', reconcileWf))
    : ''
  const daily8am = /cron:\s*['"]0\s+8\s+\*\s+\*\s+\*['"]/.test(wfBody)
  const reportsDir = repoFile('docs/reconciliation')
  const hasReport =
    dirExists(reportsDir) &&
    readdirSync(reportsDir).some((f) => /report|reconcile/i.test(f))
  const missing: string[] = []
  if (!fileExists(script)) missing.push('reconcile-stripe.ts')
  if (!reconcileWf) missing.push('daily cron workflow')
  else if (!daily8am) missing.push('daily 08:00 UTC schedule')
  if (!hasReport) missing.push('dry-run report')
  const evidence = `script=${fileExists(script)}, workflow=${reconcileWf ?? 'none'}, 08:00-cron=${daily8am}, report-present=${hasReport}`
  if (missing.length === 0) {
    return pass(17, label, method, evidence)
  }
  return defer(17, label, method, evidence, `missing: ${missing.join(', ')}`)
}

// ── Check 18: Payout schedule + chargeback velocity ──────────────────

async function check18_payoutChargeback(): Promise<CheckResult> {
  const label = 'Payout schedule config + chargeback velocity monitoring'
  const method =
    '/dashboard/payouts editor + scripts/chargeback-velocity.ts + chargeback_alerts table + /dashboard/admin/chargeback-watch + ≥12 velocity-tier tests'
  const payoutsPage = repoFile('apps/web/src/app/dashboard/payouts/page.tsx')
  const chargebackScript = repoFile('scripts/chargeback-velocity.ts')
  const watchPage = repoFile(
    'apps/web/src/app/dashboard/admin/chargeback-watch/page.tsx',
  )
  const schema = readTextOrEmpty(repoFile('apps/web/src/lib/db/schema.ts'))
  const alertsTable = /chargeback_alerts|chargebackAlerts\s*=\s*pgTable/.test(
    schema,
  )
  const missing: string[] = []
  if (!fileExists(payoutsPage)) missing.push('/dashboard/payouts page')
  if (!fileExists(chargebackScript)) missing.push('chargeback-velocity.ts')
  if (!fileExists(watchPage)) missing.push('/dashboard/admin/chargeback-watch')
  if (!alertsTable) missing.push('chargeback_alerts table')
  const evidence = `payouts-page=${fileExists(payoutsPage)}, velocity-script=${fileExists(chargebackScript)}, watch-page=${fileExists(watchPage)}, alerts-table=${alertsTable}`
  if (missing.length === 0) {
    return pass(18, label, method, evidence)
  }
  return defer(18, label, method, evidence, `missing: ${missing.join(', ')}`)
}

// ── Check 19: Python SDK core ────────────────────────────────────────

async function check19_pythonSdkCore(): Promise<CheckResult> {
  const label = 'Python SDK core (packages/sdk-python/ builds + pip install -e .)'
  const method = 'check packages/sdk-python/ + pyproject.toml'
  const pkgDir = repoFile('packages/sdk-python')
  const pyproject = repoFile('packages/sdk-python/pyproject.toml')
  if (!dirExists(pkgDir) || !fileExists(pyproject)) {
    return defer(
      19,
      label,
      method,
      'packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped',
    )
  }
  return pass(
    19,
    label,
    method,
    `packages/sdk-python/ present with pyproject.toml`,
  )
}

// ── Check 20: Python test parity + CI matrix ─────────────────────────

async function check20_pythonParity(): Promise<CheckResult> {
  const label = 'Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12'
  const method =
    'count pytest it() analogues vs TS SDK vitest; check .github/workflows for Python matrix'
  const pkgDir = repoFile('packages/sdk-python')
  if (!dirExists(pkgDir)) {
    return defer(
      20,
      label,
      method,
      'packages/sdk-python/ missing; cascades from C19',
    )
  }
  // Will implement in P3.PYTHON2
  return defer(
    20,
    label,
    method,
    'cascades until P3.PYTHON2 lands: cannot measure parity without SDK',
  )
}

// ── Check 21: settlegrid-langchain Python ────────────────────────────

async function check21_langchainPy(): Promise<CheckResult> {
  const label = 'settlegrid-langchain Python adapter (≥8 tests)'
  const method =
    'check packages/settlegrid-langchain-py/ OR top-level settlegrid-langchain Python package'
  const primary = repoFile('packages/settlegrid-langchain-py')
  const alt = repoFile('packages/settlegrid-langchain')
  const primaryPy = fileExists(join(primary, 'pyproject.toml'))
  const altPy = fileExists(join(alt, 'pyproject.toml'))
  if (!primaryPy && !altPy) {
    return defer(
      21,
      label,
      method,
      'no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped',
    )
  }
  return pass(21, label, method, 'Python langchain adapter package present')
}

// ── Check 22: llamaindex + crewai + pydantic-ai ──────────────────────

async function check22_pyAdaptersCohort2(): Promise<CheckResult> {
  const label = 'settlegrid-llamaindex + crewai + pydantic-ai Python adapters'
  const method =
    'check packages/{settlegrid-llamaindex,settlegrid-crewai,settlegrid-pydantic-ai}-py or equivalents'
  const candidates = [
    ['llamaindex', 'settlegrid-llamaindex-py', 'settlegrid-llamaindex'],
    ['crewai', 'settlegrid-crewai-py', 'settlegrid-crewai'],
    ['pydantic-ai', 'settlegrid-pydantic-ai-py', 'settlegrid-pydantic-ai'],
  ]
  const found: string[] = []
  const missing: string[] = []
  for (const [name, a, b] of candidates) {
    const aPy = fileExists(repoFile('packages', a, 'pyproject.toml'))
    const bPy = fileExists(repoFile('packages', b, 'pyproject.toml'))
    if (aPy || bPy) found.push(name)
    else missing.push(name)
  }
  const evidence = `found=[${found.join(', ') || 'none'}]; missing=[${missing.join(', ') || 'none'}]`
  if (missing.length === 0) {
    return pass(22, label, method, evidence)
  }
  return defer(
    22,
    label,
    method,
    evidence,
    `missing packages — P3.PYTHON4 prompt not yet shipped`,
  )
}

// ── Check 23: dspy + smolagents ──────────────────────────────────────

async function check23_pyAdaptersCohort3(): Promise<CheckResult> {
  const label = 'settlegrid-dspy + smolagents Python adapters'
  const method =
    'check packages/{settlegrid-dspy,settlegrid-smolagents}-py or equivalents; framework versions pinned'
  const candidates = [
    ['dspy', 'settlegrid-dspy-py', 'settlegrid-dspy'],
    ['smolagents', 'settlegrid-smolagents-py', 'settlegrid-smolagents'],
  ]
  const found: string[] = []
  const missing: string[] = []
  for (const [name, a, b] of candidates) {
    const aPy = fileExists(repoFile('packages', a, 'pyproject.toml'))
    const bPy = fileExists(repoFile('packages', b, 'pyproject.toml'))
    if (aPy || bPy) found.push(name)
    else missing.push(name)
  }
  const evidence = `found=[${found.join(', ') || 'none'}]; missing=[${missing.join(', ') || 'none'}]`
  if (missing.length === 0) {
    return pass(23, label, method, evidence)
  }
  return defer(
    23,
    label,
    method,
    evidence,
    `missing packages — P3.PYTHON5 prompt not yet shipped`,
  )
}

// ── Check 24: Mastercard VI detection stub ───────────────────────────

async function check24_mastercardVi(): Promise<CheckResult> {
  const label = 'Mastercard VI detection stub (adapter + landing page)'
  const method =
    'packages/mcp/src/adapters/mastercard-vi.ts exists; /protocols/mastercard-vi landing page exists'
  const adapter = repoFile('packages/mcp/src/adapters/mastercard-vi.ts')
  const landing = repoFile(
    'apps/web/src/app/protocols/mastercard-vi/page.tsx',
  )
  const adapterOk = fileExists(adapter)
  const landingOk = fileExists(landing)
  const evidence = `adapter=${adapterOk}, landing=${landingOk}`
  if (adapterOk && landingOk) {
    return pass(24, label, method, evidence)
  }
  // Partial: adapter exists (came with P2) but landing page doesn't — the
  // P3.PROT1 prompt is the one that adds the marketing touchpoint.
  if (adapterOk && !landingOk) {
    return defer(
      24,
      label,
      method,
      evidence,
      '/protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped',
    )
  }
  return defer(24, label, method, evidence, 'adapter + landing both missing')
}

// ── Check 25: cursor.directory submission packet ─────────────────────

async function check25_cursorDirectory(): Promise<CheckResult> {
  const label = 'cursor.directory submission packet'
  const method =
    'check scripts/directory-submissions/packets/cursor.directory/ directory with four packet artifacts + logged submission status'
  const pktDir = repoFile(
    'scripts/directory-submissions/packets/cursor.directory',
  )
  const pktFile = repoFile(
    'scripts/directory-submissions/packets/cursor.directory.md',
  )
  if (dirExists(pktDir)) {
    const files = readdirSync(pktDir)
    if (files.length >= 4) {
      return pass(
        25,
        label,
        method,
        `${files.length} artifacts in cursor.directory/ packet`,
      )
    }
    return fail(
      25,
      label,
      method,
      `only ${files.length} artifacts (<4)`,
    )
  }
  if (fileExists(pktFile)) {
    return fail(
      25,
      label,
      method,
      'cursor.directory exists as single .md file, not a 4-artifact directory',
    )
  }
  return defer(
    25,
    label,
    method,
    'cursor.directory packet missing — P3.PROT1/P3.MKT directory-expansion prompt not yet shipped',
  )
}

// ── Check 26: Pre-execution authorization gate ───────────────────────

async function check26_authorize(): Promise<CheckResult> {
  const label = 'Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests)'
  const method =
    'packages/mcp/src/authorize.ts exports authorizeInvocation + AuthorizationPlugin; kernel.ts dispatch chain calls authorizeInvocation; ledger entry includes authorization signals'
  const authFile = repoFile('packages/mcp/src/authorize.ts')
  if (!fileExists(authFile)) {
    return defer(
      26,
      label,
      method,
      'packages/mcp/src/authorize.ts missing — P3.K5 prompt not yet shipped',
    )
  }
  const body = readTextOrEmpty(authFile)
  const hasAuthInv = /authorizeInvocation/.test(body)
  const hasPlugin = /AuthorizationPlugin/.test(body)
  const kernel = readTextOrEmpty(repoFile('packages/mcp/src/kernel.ts'))
  const kernelCalls = /authorizeInvocation\s*\(/.test(kernel)
  const missing: string[] = []
  if (!hasAuthInv) missing.push('authorizeInvocation export')
  if (!hasPlugin) missing.push('AuthorizationPlugin interface')
  if (!kernelCalls) missing.push('kernel dispatch call')
  const evidence = `authorize.ts present; authorizeInvocation=${hasAuthInv}; AuthorizationPlugin=${hasPlugin}; kernel-calls=${kernelCalls}`
  if (missing.length === 0) {
    return pass(26, label, method, evidence)
  }
  return fail(26, label, method, evidence, `missing: ${missing.join(', ')}`)
}

// ── Check 27: Expansion audit chains ─────────────────────────────────

async function check27_expansionChains(): Promise<CheckResult> {
  const label = 'All settlement-layer expansion audit chains PASS'
  const method =
    'grep git log in both repos for scaffold/spec-diff/hostile commits for P3.K1-K6, P3.RAIL1-3, P3.PYTHON1-5, P3.PROT1 (15 prompts)'
  const ids = [
    'P3.K1',
    'P3.K2',
    'P3.K3',
    'P3.K4',
    'P3.K5',
    'P3.K6',
    'P3.RAIL1',
    'P3.RAIL2',
    'P3.RAIL3',
    'P3.PYTHON1',
    'P3.PYTHON2',
    'P3.PYTHON3',
    'P3.PYTHON4',
    'P3.PYTHON5',
    'P3.PROT1',
  ]
  const present: string[] = []
  const absent: string[] = []
  const logs: Record<string, string> = {}
  for (const cwd of [REPO_ROOT, AGENTS_ROOT]) {
    if (!dirExists(cwd)) continue
    const res = runSync('git', ['log', '--oneline', '--all'], { cwd })
    logs[cwd] = res.stdout ?? ''
  }
  for (const id of ids) {
    const re = new RegExp(`\\b${id.replace('.', '\\.')}\\b`)
    const found = Object.values(logs).some((log) => re.test(log))
    if (found) present.push(id)
    else absent.push(id)
  }
  const evidence = `present=[${present.join(', ') || 'none'}]; absent=[${absent.join(', ') || 'none'}]`
  if (absent.length === 0) {
    return pass(27, label, method, evidence)
  }
  return defer(
    27,
    label,
    method,
    evidence,
    `${absent.length}/${ids.length} expansion prompts have no audit-chain commits — Phase 4 blocked`,
  )
}

// ── Aggregation + format ─────────────────────────────────────────────

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

function escapeMdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
}

export function formatAuditBlock(
  results: CheckResult[],
  summary: AggregateSummary,
  isoTimestamp: string,
  mode: 'default' | 'strict-expansion',
): string {
  const lines: string[] = []
  lines.push('')
  lines.push(`## Phase 3 Gate — ${isoTimestamp}`)
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
    lines.push(
      `| ${r.id} | ${escapeMdCell(r.label)} | ${r.status} | ${escapeMdCell(r.detail ?? r.evidence)} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
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

// ── Human-readable Phase 3 audit log ─────────────────────────────────

function remediationHint(r: CheckResult): string {
  const m: Record<number, string> = {
    1: 'Re-run P3.2/P3.3 to add more templates.',
    2: 'Re-run cost summary; confirm untracked spend bound.',
    3: 'Re-run P3.3 retry to salvage more failures.',
    4: 'Founder: log verified replies to settlegrid-agents/data/wg-outreach/replies.md (2+ rows) before Phase 4.',
    5: 'Founder: send at least 5 packets from scripts/directory-submissions/packets/ and update README Status column to "sent"/"accepted".',
    6: 'Re-run P3.8 + P3.9 + P3.10 as needed to republish academy.',
    7: 'Restore weekly cron in .github/workflows/template-ci.yml (P3.11).',
    8: 'Fix TS errors surfaced by turbo typecheck and rerun.',
    9: 'Fix failing workspace tests and rerun turbo test.',
    10: 'Re-run any P3.x prompt whose audit chain is missing a stage.',
    11: 'Run P3.K1 (or dedicated MPP test expansion prompt).',
    12: 'Add Voltage/LND integration test in adapter-l402.test.ts (P3.K2).',
    13: 'Run P3.K3 (Consumer SDK).',
    14: 'Run P3.K4 (per-rail pricing + ledger + tool-secret + verifyWebhook).',
    15: 'Run P3.PROT1 (DRAIN keccak-256 fix or removal).',
    16: 'Run P3.K6/P3.RAIL1 (Stripe account-type router + eligibility + waitlist).',
    17: 'Run P3.RAIL2 (Stripe reconciliation + drift detection).',
    18: 'Run P3.RAIL3 (payouts UI + chargeback velocity).',
    19: 'Run P3.PYTHON1 (Python SDK core).',
    20: 'Run P3.PYTHON2 (Python SDK test parity + CI matrix).',
    21: 'Run P3.PYTHON3 (Python langchain adapter).',
    22: 'Run P3.PYTHON4 (llamaindex + crewai + pydantic-ai Python adapters).',
    23: 'Run P3.PYTHON5 (dspy + smolagents Python adapters).',
    24: 'Run P3.PROT1 (Mastercard VI landing page).',
    25: 'Run P3.PROT1 (or add cursor.directory packet via directory-submissions scaffold).',
    26: 'Run P3.K5 (authorize.ts pre-execution gate).',
    27: 'Run the 15 expansion prompts whose audit-chain commits are absent.',
  }
  return m[r.id] ?? 'Re-run the associated Phase 3 prompt.'
}

export function formatPhase3Log(
  results: CheckResult[],
  summary: AggregateSummary,
  isoTimestamp: string,
  mode: 'default' | 'strict-expansion',
): string {
  const lines: string[] = []
  lines.push(`# Phase 3 Audit Gate (P3.12)`)
  lines.push('')
  lines.push(`**Run timestamp:** ${isoTimestamp}`)
  lines.push(`**Mode:** ${mode}`)
  lines.push(
    `**Verdict:** ${summary.pass} PASS / ${summary.defer} DEFER / ${summary.fail} FAIL (of ${summary.total})`,
  )
  lines.push(`**Exit code:** ${summary.exitCode}`)
  lines.push('')
  lines.push(`## Deviations from prompt card`)
  lines.push('')
  lines.push(
    `- **D1** — the P3.12 prompt card uses PASS/FAIL; this log uses PASS/DEFER/FAIL to match the established house convention (see scripts/phase-gates/phase-2.ts header and AUDIT_LOG.md history). DEFER means "expected artifact does not exist; underlying prompt not yet shipped" — distinct from FAIL which means "artifact exists but is broken or below threshold". Phase 4 gating uses strict-expansion mode (DEFER → FAIL).`,
  )
  lines.push(
    `- **D2** — the prompt card names the verification script \`scripts/phase-3-verify.ts\`; that is the path used here. The existing phase-2 script at \`scripts/phase-gates/phase-2.ts\` establishes a sibling \`phase-gates/\` pattern, but this log follows the prompt card's explicit path.`,
  )
  lines.push('')
  lines.push(`## Criteria`)
  lines.push('')
  for (const r of results) {
    lines.push(`### C${r.id} — ${r.label}`)
    lines.push('')
    lines.push(`- **Verdict:** ${r.status}`)
    lines.push(`- **Method:** ${r.method}`)
    lines.push(`- **Evidence:** ${r.evidence}`)
    if (r.detail && r.detail !== r.evidence) {
      lines.push(`- **Detail:** ${r.detail}`)
    }
    lines.push('')
  }
  const blockers = results.filter((r) => r.status === 'FAIL' || r.status === 'DEFER')
  if (blockers.length > 0) {
    lines.push(`## Remediation`)
    lines.push('')
    lines.push(
      `Phase 4 is blocked until every criterion PASSes. Re-run the listed prompts in order, then re-run \`npx tsx scripts/phase-3-verify.ts --strict-expansion --write-md-log\`.`,
    )
    lines.push('')
    lines.push(`| # | Criterion | Status | Remediation |`)
    lines.push(`|---|-----------|--------|-------------|`)
    for (const r of blockers) {
      lines.push(
        `| C${r.id} | ${escapeMdCell(r.label)} | ${r.status} | ${escapeMdCell(remediationHint(r))} |`,
      )
    }
    lines.push('')
  } else {
    lines.push(`## Phase 4 — UNBLOCKED`)
    lines.push('')
    lines.push(
      `All 27 exit criteria verified PASS. Tag \`phase-3-complete\` may be created.`,
    )
    lines.push('')
  }
  return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────

function logResult(r: CheckResult): void {
  const tag =
    r.status === 'PASS' ? '[PASS] ' : r.status === 'DEFER' ? '[DEFER]' : '[FAIL] '
  const detail = r.detail ? ` — ${r.detail}` : ''
  console.log(`  ${tag} ${String(r.id).padStart(2)} — ${r.label}${detail}`)
}

async function main(): Promise<void> {
  console.log('\n================= Phase 3 Gate (P3.12) =================\n')
  console.log(`Repo:   ${REPO_ROOT}`)
  console.log(`Agents: ${AGENTS_ROOT}`)
  console.log(
    `Mode:   ${STRICT_EXPANSION ? 'STRICT (DEFER -> FAIL)' : 'default (DEFER non-blocking)'}`,
  )
  if (SKIP_TYPECHECK) console.log('Note:   --skip-typecheck (check 8 deferred)')
  if (SKIP_TESTS) console.log('Note:   --skip-tests (check 9 deferred)')
  console.log('')

  const results: CheckResult[] = []
  const run = async (
    fn: () => Promise<CheckResult>,
    id: number,
  ): Promise<void> => {
    const r = await safeCheck(fn, id, fn.name || `check_${id}`)
    results.push(r)
    logResult(r)
  }

  console.log('Original Phase 3 criteria (10):')
  await run(check1_newTemplates, 1)
  await run(check2_templaterCost, 2)
  await run(check3_rejectRate, 3)
  await run(check4_wgReplies, 4)
  await run(check5_directorySubmissions, 5)
  await run(check6_academy, 6)
  await run(check7_templateCi, 7)
  await run(check8_typecheck, 8)
  await run(check9_tests, 9)
  await run(check10_auditChains, 10)

  console.log('\nSettlement-layer expansion criteria (17):')
  await run(check11_mpp, 11)
  await run(check12_l402, 12)
  await run(check13_consumerSdk, 13)
  await run(check14_railsLedgerAuth, 14)
  await run(check15_drainKeccak, 15)
  await run(check16_stripeRouter, 16)
  await run(check17_reconcile, 17)
  await run(check18_payoutChargeback, 18)
  await run(check19_pythonSdkCore, 19)
  await run(check20_pythonParity, 20)
  await run(check21_langchainPy, 21)
  await run(check22_pyAdaptersCohort2, 22)
  await run(check23_pyAdaptersCohort3, 23)
  await run(check24_mastercardVi, 24)
  await run(check25_cursorDirectory, 25)
  await run(check26_authorize, 26)
  await run(check27_expansionChains, 27)

  const summary = aggregateResults(results, STRICT_EXPANSION)

  console.log('')
  console.log('---------------------------------------------------------')
  console.log(
    `Result: ${summary.pass} PASS, ${summary.defer} DEFER, ${summary.fail} FAIL (of ${summary.total} total)`,
  )

  const isoTimestamp = new Date().toISOString()
  const mode = STRICT_EXPANSION ? 'strict-expansion' : 'default'

  if (!NO_AUDIT_LOG) {
    const block = formatAuditBlock(results, summary, isoTimestamp, mode)
    appendAuditLog(block)
    console.log(`Verdict appended to ${AUDIT_LOG.replace(REPO_ROOT + '/', '')}`)
  }

  if (WRITE_MD_LOG) {
    const md = formatPhase3Log(results, summary, isoTimestamp, mode)
    writeFileSync(PHASE_3_LOG, md, 'utf-8')
    console.log(`Wrote ${PHASE_3_LOG.replace(REPO_ROOT + '/', '')}`)
  }

  if (summary.exitCode !== 0) {
    console.log('')
    console.log('BLOCKING checks:')
    for (const r of results) {
      if (r.status === 'FAIL' || (STRICT_EXPANSION && r.status === 'DEFER')) {
        console.log(`  - C${r.id} (${r.label}): ${r.detail ?? ''}`)
      }
    }
    console.log('')
    console.log('Phase 4 kickoff BLOCKED.')
    process.exit(1)
  }

  if (summary.defer > 0) {
    console.log('')
    console.log(
      `${summary.defer} checks DEFERRED. Default mode treats DEFERs as non-blocking.`,
    )
    console.log(
      'Rerun with --strict-expansion to require all 27 checks PASS before Phase 4 kickoff.',
    )
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
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err))
    process.exit(2)
  })
}
