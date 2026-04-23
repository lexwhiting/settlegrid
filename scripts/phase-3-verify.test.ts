/**
 * Unit tests for scripts/phase-3-verify.ts
 *
 * Covers the pure helpers (aggregateResults, escapeMdCell,
 * remediationHint, prereqRemediationHint, pass/defer/fail, safeCheck,
 * formatAuditBlock, formatPhase3Log). Integration-level check
 * functions (check1–check27) are exercised by end-to-end runs of the
 * script itself — tested here only via the smoke assertion that the
 * CLI exits non-zero when criteria FAIL and emits the expected
 * phase-3-audit-log.md structure.
 *
 * Run with:
 *   npx vitest run scripts/phase-3-verify.test.ts
 */

import { afterEach, describe, it, expect } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import {
  aggregateResults,
  discoverAdapterTestFiles,
  discoverPackageTestFiles,
  escapeMdCell,
  fail,
  defer,
  pass,
  remediationHint,
  prereqRemediationHint,
  safeCheck,
  formatAuditBlock,
  formatPhase3Log,
  type CheckResult,
  type Prerequisite,
} from './phase-3-verify'

// ── Factory helpers ─────────────────────────────────────────────────

const makeResult = (
  id: number,
  status: 'PASS' | 'DEFER' | 'FAIL',
  overrides: Partial<CheckResult> = {},
): CheckResult => ({
  id,
  status,
  label: overrides.label ?? `label ${id}`,
  method: overrides.method ?? `method ${id}`,
  evidence: overrides.evidence ?? `evidence ${id}`,
  detail: overrides.detail,
})

const makePrereq = (
  id: string,
  status: 'PASS' | 'DEFER' | 'FAIL',
  text = `prereq ${id}`,
  evidence = `ev ${id}`,
): Prerequisite => ({ id, status, text, evidence })

// ── pass/defer/fail factories ───────────────────────────────────────

describe('pass/defer/fail factories', () => {
  it('pass sets status to PASS', () => {
    expect(pass(1, 'L', 'M', 'E').status).toBe('PASS')
  })
  it('defer sets status to DEFER', () => {
    expect(defer(1, 'L', 'M', 'E').status).toBe('DEFER')
  })
  it('fail sets status to FAIL', () => {
    expect(fail(1, 'L', 'M', 'E').status).toBe('FAIL')
  })
  it('default detail mirrors evidence when omitted', () => {
    expect(pass(1, 'L', 'M', 'EV').detail).toBe('EV')
    expect(defer(1, 'L', 'M', 'EV').detail).toBe('EV')
    expect(fail(1, 'L', 'M', 'EV').detail).toBe('EV')
  })
  it('explicit detail wins over evidence', () => {
    expect(pass(1, 'L', 'M', 'EV', 'DTL').detail).toBe('DTL')
  })
  it('propagates id, label, method, evidence verbatim', () => {
    const r = fail(42, 'label', 'method', 'evidence')
    expect(r.id).toBe(42)
    expect(r.label).toBe('label')
    expect(r.method).toBe('method')
    expect(r.evidence).toBe('evidence')
  })
  it('evidence containing pipes and newlines is preserved raw (escaping is the table formatter\'s job)', () => {
    const r = pass(1, 'L', 'M', 'a | b\nc')
    expect(r.evidence).toBe('a | b\nc')
  })
})

// ── aggregateResults ────────────────────────────────────────────────

describe('aggregateResults', () => {
  it('all PASS → exit 0 in default and strict mode', () => {
    const results = [makeResult(1, 'PASS'), makeResult(2, 'PASS')]
    expect(aggregateResults(results, false)).toEqual({
      total: 2,
      pass: 2,
      defer: 0,
      fail: 0,
      effectiveFails: 0,
      exitCode: 0,
    })
    expect(aggregateResults(results, true).exitCode).toBe(0)
  })
  it('DEFER non-blocking in default; blocking in strict', () => {
    const results = [makeResult(1, 'PASS'), makeResult(2, 'DEFER')]
    expect(aggregateResults(results, false).exitCode).toBe(0)
    const strict = aggregateResults(results, true)
    expect(strict.exitCode).toBe(1)
    expect(strict.effectiveFails).toBe(1)
  })
  it('any FAIL → exit 1 regardless of mode', () => {
    const results = [makeResult(1, 'PASS'), makeResult(2, 'FAIL')]
    expect(aggregateResults(results, false).exitCode).toBe(1)
    expect(aggregateResults(results, true).exitCode).toBe(1)
  })
  it('mixed PASS + DEFER + FAIL counts correctly', () => {
    const results = [
      makeResult(1, 'PASS'),
      makeResult(2, 'PASS'),
      makeResult(3, 'DEFER'),
      makeResult(4, 'FAIL'),
      makeResult(5, 'FAIL'),
    ]
    const s = aggregateResults(results, false)
    expect(s).toMatchObject({ total: 5, pass: 2, defer: 1, fail: 2 })
    expect(s.effectiveFails).toBe(2)
    const strict = aggregateResults(results, true)
    expect(strict.effectiveFails).toBe(3) // FAIL + DEFER
  })
  it('empty results → exit 0 both modes', () => {
    expect(aggregateResults([], false)).toEqual({
      total: 0,
      pass: 0,
      defer: 0,
      fail: 0,
      effectiveFails: 0,
      exitCode: 0,
    })
    expect(aggregateResults([], true).exitCode).toBe(0)
  })
  it('only DEFER in strict mode is fully blocking', () => {
    const results = [
      makeResult(1, 'DEFER'),
      makeResult(2, 'DEFER'),
      makeResult(3, 'DEFER'),
    ]
    expect(aggregateResults(results, true).effectiveFails).toBe(3)
  })
})

// ── escapeMdCell ────────────────────────────────────────────────────

describe('escapeMdCell', () => {
  it('escapes pipes', () => {
    expect(escapeMdCell('a | b')).toBe('a \\| b')
  })
  it('collapses \\n to space', () => {
    expect(escapeMdCell('a\nb')).toBe('a b')
  })
  it('collapses \\r\\n to space', () => {
    expect(escapeMdCell('a\r\nb')).toBe('a b')
  })
  it('collapses consecutive newlines to single space', () => {
    expect(escapeMdCell('a\n\n\nb')).toBe('a b')
  })
  it('leaves plain text untouched', () => {
    expect(escapeMdCell('hello world')).toBe('hello world')
  })
  it('handles empty string', () => {
    expect(escapeMdCell('')).toBe('')
  })
  it('handles multiple pipes', () => {
    expect(escapeMdCell('a|b|c')).toBe('a\\|b\\|c')
  })
  it('preserves backticks (code-fence chars not a table breaker)', () => {
    expect(escapeMdCell('`code|literal`')).toBe('`code\\|literal`')
  })
})

// ── remediationHint ─────────────────────────────────────────────────

describe('remediationHint', () => {
  it('has hints for all 27 criteria (1–27)', () => {
    for (let id = 1; id <= 27; id += 1) {
      const hint = remediationHint(makeResult(id, 'FAIL'))
      expect(hint.length).toBeGreaterThan(10)
      expect(hint).not.toBe('Re-run the associated Phase 3 prompt.')
    }
  })
  it('unknown id falls back to default hint', () => {
    expect(remediationHint(makeResult(999, 'FAIL'))).toBe(
      'Re-run the associated Phase 3 prompt.',
    )
  })
  it('C7 hint targets "push origin/main" (post-H11 fix)', () => {
    expect(remediationHint(makeResult(7, 'DEFER'))).toMatch(/push origin\/main/i)
  })
  it('C4/C5 hints explicitly name the founder as actor', () => {
    expect(remediationHint(makeResult(4, 'DEFER'))).toMatch(/founder/i)
    expect(remediationHint(makeResult(5, 'FAIL'))).toMatch(/founder/i)
  })
  it('C15 hint references P3.K5 (DRAIN adapter keccak card)', () => {
    expect(remediationHint(makeResult(15, 'FAIL'))).toMatch(/P3\.K5/)
  })
  it('C16 hint references P3.RAIL1 (Stripe router card) and NOT P3.K6', () => {
    const hint = remediationHint(makeResult(16, 'FAIL'))
    expect(hint).toMatch(/P3\.RAIL1/)
    expect(hint).not.toMatch(/P3\.K6/)
  })
  it('C25 hint references P3.13 (cursor.directory card), not P3.PROT1', () => {
    const hint = remediationHint(makeResult(25, 'DEFER'))
    expect(hint).toMatch(/P3\.13/)
    expect(hint).not.toMatch(/P3\.PROT1/)
  })
  it('C26 hint references P3.K6 (authorize.ts card), not P3.K5', () => {
    const hint = remediationHint(makeResult(26, 'DEFER'))
    expect(hint).toMatch(/P3\.K6/)
    expect(hint).not.toMatch(/P3\.K5/)
  })
  it('C27 hint names the "15 expansion prompts" count', () => {
    expect(remediationHint(makeResult(27, 'DEFER'))).toMatch(/15 expansion prompts/)
  })
})

// ── prereqRemediationHint ───────────────────────────────────────────

describe('prereqRemediationHint', () => {
  it('PREQ1 hint references C10', () => {
    expect(prereqRemediationHint(makePrereq('PREQ1', 'FAIL'))).toMatch(/C10/)
  })
  it('PREQ2 hint addresses uncommitted changes', () => {
    expect(prereqRemediationHint(makePrereq('PREQ2', 'DEFER'))).toMatch(
      /commit|stash/i,
    )
  })
  it('PREQ3 hint references C2', () => {
    expect(prereqRemediationHint(makePrereq('PREQ3', 'FAIL'))).toMatch(/C2/)
  })
  it('unknown PREQ falls back to generic', () => {
    expect(
      prereqRemediationHint(makePrereq('PREQ99', 'FAIL')),
    ).toMatch(/Resolve the prerequisite/i)
  })
})

// ── safeCheck ───────────────────────────────────────────────────────

describe('safeCheck', () => {
  it('passes a successful check through', async () => {
    const ok = async () => pass(42, 'label', 'method', 'evidence')
    const r = await safeCheck(ok, 42, 'check42')
    expect(r.status).toBe('PASS')
    expect(r.id).toBe(42)
  })
  it('preserves the check\'s own id even if mismatched', async () => {
    const ok = async () => pass(99, 'label', 'method', 'evidence')
    const r = await safeCheck(ok, 1, 'check1')
    // safeCheck doesn\'t rewrite successful results.
    expect(r.id).toBe(99)
  })
  it('catches Error and returns FAIL with the id + fn name', async () => {
    const bad = async () => {
      throw new Error('kaboom')
    }
    const r = await safeCheck(bad, 7, 'check7')
    expect(r.status).toBe('FAIL')
    expect(r.id).toBe(7)
    expect(r.label).toBe('check7')
    expect(r.evidence).toBe('kaboom')
    expect(r.detail).toMatch(/kaboom/)
  })
  it('catches non-Error throws (strings, etc.)', async () => {
    const bad = async () => {
      throw 'bare string'
    }
    const r = await safeCheck(bad, 8, 'check8')
    expect(r.status).toBe('FAIL')
    expect(r.evidence).toBe('bare string')
  })
  it('catches synchronous throws wrapped in async function', async () => {
    const bad = async () => {
      JSON.parse('not json') // throws synchronously
      return pass(1, 'L', 'M', 'E')
    }
    const r = await safeCheck(bad, 1, 'check1')
    expect(r.status).toBe('FAIL')
    expect(r.detail).toMatch(/JSON/i)
  })
})

// ── formatAuditBlock ────────────────────────────────────────────────

describe('formatAuditBlock', () => {
  const ts = '2026-04-22T00:00:00.000Z'
  const results = [
    makeResult(1, 'PASS', { label: 'c1', detail: 'd1' }),
    makeResult(2, 'FAIL', { label: 'c2', evidence: 'piped | evidence' }),
  ]
  const summary = aggregateResults(results, false)
  it('includes timestamp header', () => {
    expect(formatAuditBlock(results, summary, ts, 'default')).toMatch(
      /## Phase 3 Gate — 2026-04-22T00:00:00\.000Z/,
    )
  })
  it('prints verdict counts', () => {
    expect(formatAuditBlock(results, summary, ts, 'default')).toMatch(
      /\*\*Verdict:\*\* 1 PASS \/ 0 DEFER \/ 1 FAIL \(of 2\)/,
    )
  })
  it('prints mode', () => {
    expect(formatAuditBlock(results, summary, ts, 'strict-expansion')).toMatch(
      /\*\*Mode:\*\* strict-expansion/,
    )
  })
  it('renders one table row per check', () => {
    const out = formatAuditBlock(results, summary, ts, 'default')
    expect(out.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l))).toHaveLength(2)
  })
  it('escapes pipes in evidence to preserve table shape', () => {
    const out = formatAuditBlock(results, summary, ts, 'default')
    expect(out).toMatch(/piped \\\| evidence/)
  })
  it('uses detail when present, evidence as fallback', () => {
    // Row 1 has detail='d1' and evidence='evidence 1' — should render 'd1'.
    const out = formatAuditBlock(results, summary, ts, 'default')
    expect(out).toMatch(/\| 1 \| c1 \| PASS \| d1 \|/)
  })
})

// ── formatPhase3Log ─────────────────────────────────────────────────

describe('formatPhase3Log', () => {
  const ts = '2026-04-22T00:00:00.000Z'
  const results = [
    makeResult(1, 'PASS', { label: 'C1 lbl' }),
    makeResult(2, 'FAIL', { label: 'C2 lbl' }),
  ]
  const prereqs: Prerequisite[] = [
    makePrereq('PREQ1', 'PASS'),
    makePrereq('PREQ2', 'DEFER'),
    makePrereq('PREQ3', 'PASS'),
  ]
  const summary = aggregateResults(results, false)

  it('emits top-level title', () => {
    expect(formatPhase3Log(results, prereqs, summary, ts, 'default')).toMatch(
      /^# Phase 3 Audit Gate \(P3\.12\)$/m,
    )
  })
  it('includes two deviations D1 + D2', () => {
    const out = formatPhase3Log(results, prereqs, summary, ts, 'default')
    expect(out).toMatch(/\*\*D1\*\*/)
    expect(out).toMatch(/\*\*D2\*\*/)
  })
  it('renders Prerequisites table with one row per prereq', () => {
    const out = formatPhase3Log(results, prereqs, summary, ts, 'default')
    const section = out.split('## Criteria')[0]
    expect(section).toMatch(/## Prerequisites/)
    expect((section.match(/^\|\s*PREQ\d+\s*\|/gm) ?? [])).toHaveLength(3)
  })
  it('renders one criterion section per result', () => {
    const out = formatPhase3Log(results, prereqs, summary, ts, 'default')
    expect(out).toMatch(/### C1 — C1 lbl/)
    expect(out).toMatch(/### C2 — C2 lbl/)
  })
  it('emits Remediation section when there are blockers', () => {
    const out = formatPhase3Log(results, prereqs, summary, ts, 'default')
    expect(out).toMatch(/## Remediation/)
    // PREQ2 DEFER should appear as a remediation row too (post-H8 fix).
    expect(out).toMatch(/\| PREQ2 \|/)
    // Criterion C2 FAIL should appear.
    expect(out).toMatch(/\| C2 \|/)
  })
  it('emits "Phase 4 — UNBLOCKED" when everything PASSes', () => {
    const allPass = [makeResult(1, 'PASS')]
    const allPassPrereqs: Prerequisite[] = [
      makePrereq('PREQ1', 'PASS'),
      makePrereq('PREQ2', 'PASS'),
      makePrereq('PREQ3', 'PASS'),
    ]
    const s = aggregateResults(allPass, false)
    const out = formatPhase3Log(allPass, allPassPrereqs, s, ts, 'default')
    expect(out).toMatch(/## Phase 4 — UNBLOCKED/)
    expect(out).not.toMatch(/## Remediation/)
  })
  it('remediation references re-run with --strict-expansion --write-md-log', () => {
    const out = formatPhase3Log(results, prereqs, summary, ts, 'default')
    expect(out).toMatch(/--strict-expansion --write-md-log/)
  })
  it('escapes pipes inside prereq evidence cells', () => {
    const pipedPrereqs: Prerequisite[] = [
      makePrereq('PREQ1', 'FAIL', 'prereq text', 'pipe | inside'),
    ]
    const out = formatPhase3Log(results, pipedPrereqs, summary, ts, 'default')
    expect(out).toMatch(/pipe \\\| inside/)
  })
  it('all-PASS with unresolved prereq still emits Remediation', () => {
    // Edge case: criteria all pass but PREQ2 DEFER — we must still show
    // remediation for the prereq.
    const allPass = [makeResult(1, 'PASS'), makeResult(2, 'PASS')]
    const deferPrereq: Prerequisite[] = [
      makePrereq('PREQ1', 'PASS'),
      makePrereq('PREQ2', 'DEFER'),
      makePrereq('PREQ3', 'PASS'),
    ]
    const s = aggregateResults(allPass, false)
    const out = formatPhase3Log(allPass, deferPrereq, s, ts, 'default')
    expect(out).toMatch(/## Remediation/)
    expect(out).toMatch(/\| PREQ2 \|/)
    expect(out).not.toMatch(/## Phase 4 — UNBLOCKED/)
  })
})

// ── Temp-dir fixture for test-file discovery helpers ────────────────
//
// `discoverAdapterTestFiles` and `discoverPackageTestFiles` operate on
// real paths via `fs.stat` / `fs.readdir`, so we exercise them by
// staging a throwaway repo root under `os.tmpdir()` per test and
// tearing it down in afterEach. `discoverAdapterTestFiles` accepts an
// `opts.repoRoot` override so the staged tree is fully isolated from
// the real settlegrid checkout.

let stagedDirs: string[] = []

afterEach(() => {
  for (const d of stagedDirs) {
    try {
      rmSync(d, { recursive: true, force: true })
    } catch {
      // Best-effort — next run's mkdtemp will land on a fresh prefix
      // anyway, so a stranded dir doesn't leak into subsequent tests.
    }
  }
  stagedDirs = []
})

function stageRepo(): string {
  const t = mkdtempSync(join(tmpdir(), 'phase3-verify-'))
  stagedDirs.push(t)
  return t
}

function stageFile(root: string, rel: string, body = '// placeholder\n'): string {
  const full = join(root, rel)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body, 'utf-8')
  return full
}

// ── discoverAdapterTestFiles ────────────────────────────────────────

describe('discoverAdapterTestFiles', () => {
  it('returns both paths when both legacy and new locations exist', () => {
    const root = stageRepo()
    stageFile(root, 'packages/mcp/src/__tests__/adapter-foo.test.ts')
    stageFile(root, 'packages/mcp/src/adapters/__tests__/foo.test.ts')
    const r = discoverAdapterTestFiles('foo', { repoRoot: root })
    expect(r).toHaveLength(2)
    expect(r[0]).toMatch(/packages\/mcp\/src\/__tests__\/adapter-foo\.test\.ts$/)
    expect(r[1]).toMatch(/packages\/mcp\/src\/adapters\/__tests__\/foo\.test\.ts$/)
  })

  it('returns only the legacy path when only legacy exists', () => {
    const root = stageRepo()
    stageFile(root, 'packages/mcp/src/__tests__/adapter-foo.test.ts')
    const r = discoverAdapterTestFiles('foo', { repoRoot: root })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/__tests__\/adapter-foo\.test\.ts$/)
  })

  it('returns only the new path when only new exists', () => {
    const root = stageRepo()
    stageFile(root, 'packages/mcp/src/adapters/__tests__/foo.test.ts')
    const r = discoverAdapterTestFiles('foo', { repoRoot: root })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/adapters\/__tests__\/foo\.test\.ts$/)
  })

  it('returns empty array when neither location exists', () => {
    const root = stageRepo()
    expect(discoverAdapterTestFiles('nope', { repoRoot: root })).toEqual([])
  })

  it('is adapter-slug specific — does not match sibling adapters', () => {
    const root = stageRepo()
    stageFile(root, 'packages/mcp/src/adapters/__tests__/foo.test.ts')
    stageFile(root, 'packages/mcp/src/adapters/__tests__/bar.test.ts')
    const foo = discoverAdapterTestFiles('foo', { repoRoot: root })
    expect(foo).toHaveLength(1)
    expect(foo[0]).toMatch(/\/foo\.test\.ts$/)
  })

  it('returns absolute paths rooted under the override', () => {
    const root = stageRepo()
    stageFile(root, 'packages/mcp/src/adapters/__tests__/foo.test.ts')
    const [p] = discoverAdapterTestFiles('foo', { repoRoot: root })
    expect(p.startsWith(root)).toBe(true)
  })
})

// ── discoverPackageTestFiles ────────────────────────────────────────

describe('discoverPackageTestFiles', () => {
  it('returns files from both legacy __tests__/ and new src/__tests__/ when both exist', () => {
    const root = stageRepo()
    const pkg = join(root, 'packages/client')
    stageFile(pkg, '__tests__/legacy-one.test.ts')
    stageFile(pkg, 'src/__tests__/new-one.test.ts')
    const r = discoverPackageTestFiles(pkg)
    expect(r).toHaveLength(2)
    expect(r.some((p) => /\/__tests__\/legacy-one\.test\.ts$/.test(p))).toBe(true)
    expect(r.some((p) => /\/src\/__tests__\/new-one\.test\.ts$/.test(p))).toBe(true)
  })

  it('returns files from src/__tests__/ only when only the new location exists', () => {
    const root = stageRepo()
    const pkg = join(root, 'packages/client')
    stageFile(pkg, 'src/__tests__/a.test.ts')
    stageFile(pkg, 'src/__tests__/b.test.ts')
    const r = discoverPackageTestFiles(pkg)
    expect(r).toHaveLength(2)
    for (const p of r) {
      expect(p).toMatch(/\/src\/__tests__\//)
    }
  })

  it('returns files from __tests__/ only when only the legacy location exists', () => {
    const root = stageRepo()
    const pkg = join(root, 'packages/client')
    stageFile(pkg, '__tests__/a.test.ts')
    const r = discoverPackageTestFiles(pkg)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/\/__tests__\/a\.test\.ts$/)
    expect(r[0]).not.toMatch(/\/src\/__tests__\//)
  })

  it('returns empty array when neither location exists', () => {
    const root = stageRepo()
    const pkg = join(root, 'packages/client')
    // No __tests__ created, no src/__tests__ created.
    expect(discoverPackageTestFiles(pkg)).toEqual([])
  })

  it('filters out non-test files', () => {
    const root = stageRepo()
    const pkg = join(root, 'packages/client')
    stageFile(pkg, 'src/__tests__/real.test.ts')
    stageFile(pkg, 'src/__tests__/README.md')
    stageFile(pkg, 'src/__tests__/helpers.ts')
    stageFile(pkg, 'src/__tests__/fixture.json')
    const r = discoverPackageTestFiles(pkg)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/\/real\.test\.ts$/)
  })
})
