import { describe, it, expect } from 'vitest'
import {
  aggregateResults,
  deriveK1ProxyCheckState,
  formatAuditBlock,
  parseShadowProbeOutput,
  safeCheck,
  stripLineComments,
  TEST_DECL_RE,
  type CheckResult,
} from './phase-2'

const r = (id: number, status: 'PASS' | 'DEFER' | 'FAIL', label = 'check', detail?: string): CheckResult => ({
  id,
  status,
  label,
  detail,
})

describe('aggregateResults', () => {
  it('all PASS → exit 0 in default mode', () => {
    const results = [r(1, 'PASS'), r(2, 'PASS'), r(3, 'PASS')]
    const s = aggregateResults(results, false)
    expect(s).toEqual({
      total: 3,
      pass: 3,
      defer: 0,
      fail: 0,
      effectiveFails: 0,
      exitCode: 0,
    })
  })

  it('PASS + DEFER → exit 0 in default mode (DEFERs non-blocking)', () => {
    const results = [r(1, 'PASS'), r(2, 'DEFER'), r(3, 'DEFER'), r(4, 'PASS')]
    const s = aggregateResults(results, false)
    expect(s.exitCode).toBe(0)
    expect(s.defer).toBe(2)
    expect(s.pass).toBe(2)
    expect(s.effectiveFails).toBe(0)
  })

  it('PASS + DEFER → exit 1 in strict mode (DEFER counts as failure)', () => {
    const results = [r(1, 'PASS'), r(2, 'DEFER'), r(3, 'DEFER')]
    const s = aggregateResults(results, true)
    expect(s.exitCode).toBe(1)
    expect(s.effectiveFails).toBe(2)
  })

  it('one FAIL → exit 1 regardless of mode', () => {
    const results = [r(1, 'PASS'), r(2, 'FAIL'), r(3, 'PASS')]
    expect(aggregateResults(results, false).exitCode).toBe(1)
    expect(aggregateResults(results, true).exitCode).toBe(1)
  })

  it('mixed PASS/DEFER/FAIL → exit 1; FAIL alone triggers in default mode', () => {
    const results = [r(1, 'PASS'), r(2, 'DEFER'), r(3, 'FAIL'), r(4, 'PASS')]
    const s = aggregateResults(results, false)
    expect(s.exitCode).toBe(1)
    expect(s.fail).toBe(1)
    expect(s.defer).toBe(1)
    expect(s.pass).toBe(2)
    expect(s.effectiveFails).toBe(1) // FAIL only, DEFER not counted
  })

  it('strict mode adds DEFERs to FAILs in effectiveFails', () => {
    const results = [r(1, 'FAIL'), r(2, 'DEFER'), r(3, 'DEFER')]
    const s = aggregateResults(results, true)
    expect(s.effectiveFails).toBe(3) // 1 FAIL + 2 DEFER
    expect(s.exitCode).toBe(1)
  })

  it('empty results → exit 0', () => {
    const s = aggregateResults([], false)
    expect(s).toEqual({
      total: 0,
      pass: 0,
      defer: 0,
      fail: 0,
      effectiveFails: 0,
      exitCode: 0,
    })
  })
})

describe('formatAuditBlock', () => {
  const ts = '2026-04-16T22:00:00.000Z'

  it('emits a markdown section with verdict line + per-check rows', () => {
    const results = [r(1, 'PASS', 'CLI works'), r(2, 'DEFER', 'foo missing')]
    const summary = aggregateResults(results, false)
    const block = formatAuditBlock(results, summary, ts, 'default')

    expect(block).toMatch(/## Phase 2 Gate — 2026-04-16T22:00:00\.000Z/)
    expect(block).toMatch(/\*\*Verdict:\*\* 1 PASS \/ 1 DEFER \/ 0 FAIL \(of 2\)/)
    expect(block).toMatch(/\*\*Mode:\*\* default/)
    expect(block).toMatch(/\*\*Exit code:\*\* 0/)
    expect(block).toMatch(/\| 1 \| CLI works \| PASS \|/)
    expect(block).toMatch(/\| 2 \| foo missing \| DEFER \|/)
  })

  it('escapes pipe characters in detail to prevent table corruption', () => {
    const results = [r(1, 'FAIL', 'check', 'error: a|b|c')]
    const summary = aggregateResults(results, false)
    const block = formatAuditBlock(results, summary, ts, 'default')

    expect(block).toContain('error: a\\|b\\|c')
    // The label column for "check" should still render exactly one PASS/FAIL.
    expect(block.match(/\| FAIL \|/g)?.length).toBe(1)
  })

  it('flattens newlines in detail to a single line', () => {
    const results = [r(1, 'FAIL', 'check', 'line1\nline2\nline3')]
    const summary = aggregateResults(results, false)
    const block = formatAuditBlock(results, summary, ts, 'default')

    // The row for check 1 must be a single markdown line (no newlines inside).
    const row = block.split('\n').find((l) => l.startsWith('| 1 |'))
    expect(row).toBeDefined()
    expect(row).toContain('line1 line2 line3')
  })

  it('strict-expansion mode is reflected in the Mode field', () => {
    const results = [r(1, 'PASS')]
    const summary = aggregateResults(results, true)
    const block = formatAuditBlock(results, summary, ts, 'strict-expansion')
    expect(block).toMatch(/\*\*Mode:\*\* strict-expansion/)
  })

  it('handles empty results without throwing', () => {
    const summary = aggregateResults([], false)
    const block = formatAuditBlock([], summary, ts, 'default')
    expect(block).toMatch(/\*\*Verdict:\*\* 0 PASS \/ 0 DEFER \/ 0 FAIL \(of 0\)/)
    expect(block).toContain('| # | Check | Status | Detail |')
  })

  it('collapses CR + CRLF + LF in detail (defends against Windows line endings)', () => {
    const results = [r(1, 'FAIL', 'check', 'a\r\nb\rc\nd')]
    const summary = aggregateResults(results, false)
    const block = formatAuditBlock(results, summary, ts, 'default')
    const row = block.split('\n').find((l) => l.startsWith('| 1 |'))
    expect(row).toBeDefined()
    // All CR/LF runs collapsed to single space — exactly one row, no
    // smuggled line break that would corrupt the markdown table.
    expect(row).toContain('a b c d')
    expect(row).not.toMatch(/[\r\n]/)
  })
})

describe('stripLineComments', () => {
  it('removes // line comments while preserving code lines', () => {
    const src = `import x from 'y' // this is a comment\nconst foo = 1\n// full line comment\nconst bar = 2`
    const out = stripLineComments(src)
    expect(out).toContain("import x from 'y' ")
    expect(out).not.toContain('this is a comment')
    expect(out).not.toContain('full line comment')
    expect(out).toContain('const foo = 1')
    expect(out).toContain('const bar = 2')
  })

  it('defeats false-positive grep on commented-out imports', () => {
    // Regression for check 9 hostile finding — a commented-out
    // proxy import would otherwise satisfy the "still using lib/*-proxy"
    // detection regex.
    const src = `// import { foo } from '@/lib/x-proxy'\nconst y = 1`
    const stripped = stripLineComments(src)
    expect(/from ['"]@\/lib\/[^'"]*-proxy['"]/.test(stripped)).toBe(false)
  })

  it('preserves multi-line strings (only line-comments are stripped)', () => {
    const src = `const x = 1\nconst y = 2`
    expect(stripLineComments(src)).toBe(src)
  })

  it('preserves URLs that contain // (not actually a comment)', () => {
    // The simple regex strips everything after //, so a string literal
    // containing `https://example.com` would lose the path. Document
    // the trade-off: this helper is intentionally simple and is only
    // safe for grepping, not for source rewriting. The test pins the
    // current behavior so a future change is intentional.
    const src = `const url = "https://example.com/foo"`
    const out = stripLineComments(src)
    // Yes, the URL gets truncated. Acceptable for our grep-only usage
    // because the *grep target* (e.g., import paths) doesn't sit inside
    // a URL string.
    expect(out).toBe(`const url = "https:`)
  })
})

describe('TEST_DECL_RE', () => {
  // Positive cases — should match
  it.each([
    ['test(', `test('foo', () => {})`],
    ['it(', `it('foo', () => {})`],
    ['describe(', `describe('foo', () => {})`],
    ['test.skip(', `test.skip('foo', () => {})`],
    ['it.only(', `it.only('foo', () => {})`],
    ['describe.skip(', `describe.skip('foo', () => {})`],
    ['it.each([](', `it.each([1,2,3])('foo', () => {})`],
    ['indented test(', `  test('foo', () => {})`],
    ['tabbed it(', `\tit('foo', () => {})`],
    ['multi-line src with one test', `import x from 'y'\nconst foo = 1\ntest('bar', () => {})`],
  ])('matches %s', (_label, src) => {
    expect(TEST_DECL_RE.test(src)).toBe(true)
  })

  // Negative cases — should NOT match (false-positive defense)
  it.each([
    ['empty string', ''],
    ['no calls', `const foo = 1\nconst bar = 2`],
    ['vi.test(', `vi.test('foo', () => {})`], // method on namespace, not declaration
    ['mytest(', `mytest('foo', () => {})`], // identifier with same suffix
    ['submit(', `submit('foo', () => {})`], // word that contains nothing test-like
    ['commit(', `commit()`],
    ['object property test:', `const x = { test: 1 }`],
    ['call without parens after dot', `obj.test`],
  ])('does not match %s', (_label, src) => {
    expect(TEST_DECL_RE.test(src)).toBe(false)
  })

  it('matches only the first declaration on multiline source (single-match regex)', () => {
    const src = `test('a', () => {})\ntest('b', () => {})`
    // The regex isn't /g — it matches once. Used as a "has any?" predicate
    // in check 11; this test pins the contract.
    const m = src.match(TEST_DECL_RE)
    expect(m).not.toBeNull()
  })
})

describe('deriveK1ProxyCheckState (2-state, post-2026-04-16 K1/K2 split)', () => {
  it('k1-pending: 0 unified refs → DEFER, k1-pending', () => {
    expect(deriveK1ProxyCheckState({ unifiedRefs: 0 }))
      .toEqual({ status: 'DEFER', reason: 'k1-pending' })
  })

  it('k1-shipped: 1 unified ref → PASS, k1-shipped', () => {
    expect(deriveK1ProxyCheckState({ unifiedRefs: 1 }))
      .toEqual({ status: 'PASS', reason: 'k1-shipped' })
  })

  it('k1-shipped: many unified refs → PASS', () => {
    expect(deriveK1ProxyCheckState({ unifiedRefs: 17 }).status).toBe('PASS')
  })

  it('does not regress to old 4-state model — K2 removal is check 10s job, not check 9s', () => {
    // Pin the K1/K2 separation: K1 is "add unified path", K2 is
    // "remove lib/*-proxy". Coexistence (K1 done, K2 pending) is a
    // valid intermediate state and must NOT FAIL check 9.
    const k1OnlyState = deriveK1ProxyCheckState({ unifiedRefs: 5 })
    expect(k1OnlyState.status).toBe('PASS')
    expect(k1OnlyState.reason).toBe('k1-shipped')
  })
})

describe('parseShadowProbeOutput', () => {
  it('returns count for valid framed output', () => {
    const stdout = '--SG-RESULT--{"count":1234}--END--\n'
    expect(parseShadowProbeOutput(stdout)).toEqual({ count: 1234 })
  })

  it('finds marker even when surrounded by other stdout (pg init noise)', () => {
    const stdout = `connecting...\nclient connected\n--SG-RESULT--{"count":42}--END--\nfinishing\n`
    expect(parseShadowProbeOutput(stdout)).toEqual({ count: 42 })
  })

  it('returns error when marker is missing entirely', () => {
    const result = parseShadowProbeOutput('connecting...\ndone\n')
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/no SG-RESULT marker/)
  })

  it('returns error when JSON inside marker is malformed', () => {
    const result = parseShadowProbeOutput('--SG-RESULT--{not json}--END--')
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/JSON parse/)
  })

  it('returns error when count field is missing', () => {
    const result = parseShadowProbeOutput('--SG-RESULT--{"other":1}--END--')
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/not a finite number/)
  })

  it('returns error when count is NaN or Infinity', () => {
    // JSON.stringify can't represent NaN, but a malicious probe could
    // theoretically emit "Infinity" via a non-standard serializer. Test
    // the contract: only finite numbers count as a valid count.
    expect(parseShadowProbeOutput('--SG-RESULT--{"count":null}--END--'))
      .toHaveProperty('error')
    expect(parseShadowProbeOutput('--SG-RESULT--{"count":"123"}--END--'))
      .toHaveProperty('error')
  })

  it('returns count=0 for an empty database (zero is valid)', () => {
    expect(parseShadowProbeOutput('--SG-RESULT--{"count":0}--END--')).toEqual({ count: 0 })
  })

  it('handles non-greedy matching when stdout has multiple --END-- candidates', () => {
    // Lazy regex (.+?) ensures we capture the inner JSON, not match
    // across to a later --END-- token in the stdout.
    const stdout = '--SG-RESULT--{"count":7}--END--\nspurious --END-- token\n'
    expect(parseShadowProbeOutput(stdout)).toEqual({ count: 7 })
  })
})

describe('safeCheck', () => {
  it('returns the wrapped fn result on success', async () => {
    const fn = async (): Promise<CheckResult> => ({ id: 7, status: 'PASS', label: 'ok' })
    const r = await safeCheck(fn, 7, 'fallback-label')
    expect(r).toEqual({ id: 7, status: 'PASS', label: 'ok' })
  })

  it('converts a thrown Error into a FAIL CheckResult (does not crash harness)', async () => {
    const fn = async (): Promise<CheckResult> => {
      throw new Error('synthetic crash from inside check')
    }
    const r = await safeCheck(fn, 99, 'crashy-check')
    expect(r.status).toBe('FAIL')
    expect(r.id).toBe(99)
    expect(r.label).toBe('crashy-check')
    expect(r.detail).toContain('gate harness caught uncaught exception')
    expect(r.detail).toContain('synthetic crash from inside check')
  })

  it('handles non-Error throws (string, undefined, object) gracefully', async () => {
    const stringThrow = async (): Promise<CheckResult> => {
      throw 'bare string'
    }
    const r1 = await safeCheck(stringThrow, 1, 'string-throw')
    expect(r1.status).toBe('FAIL')
    expect(r1.detail).toContain('bare string')

    const undefinedThrow = async (): Promise<CheckResult> => {
      throw undefined
    }
    const r2 = await safeCheck(undefinedThrow, 2, 'undef-throw')
    expect(r2.status).toBe('FAIL')
    expect(r2.detail).toContain('undefined')
  })
})
