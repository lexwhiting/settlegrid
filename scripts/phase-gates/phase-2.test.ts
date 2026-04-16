import { describe, it, expect } from 'vitest'
import { aggregateResults, formatAuditBlock, type CheckResult } from './phase-2'

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
})
