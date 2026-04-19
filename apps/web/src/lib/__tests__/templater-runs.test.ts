import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fsp } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  loadAllRuns,
  cumulativeSpend,
  aggregateFailureModes,
  fleetTotals,
  isValidSnapshot,
  type TemplaterRunSnapshot,
} from '@/lib/templater-runs'

function makeSnapshot(
  overrides: Partial<TemplaterRunSnapshot> = {},
): TemplaterRunSnapshot {
  return {
    runId: 'run-test',
    startedAt: '2026-04-19T10:00:00.000Z',
    completedAt: '2026-04-19T10:05:00.000Z',
    durationSeconds: 300,
    totalAttempts: 10,
    passed: 7,
    rejected: 0,
    failed: 3,
    rejectRatePct: 30,
    totalCostUsdTracked: 1.5,
    costPerSuccessfulTemplateUsdTracked: 0.2143,
    tokensInTracked: 10000,
    tokensOutTracked: 5000,
    topFailureClusters: [
      { verdict: 'fetch-docs-failed', count: 2 },
      { verdict: 'synthesize-failed', count: 1 },
    ],
    ...overrides,
  }
}

describe('isValidSnapshot', () => {
  it('accepts a full valid snapshot', () => {
    expect(isValidSnapshot(makeSnapshot())).toBe(true)
  })

  it('accepts a snapshot with empty topFailureClusters', () => {
    expect(isValidSnapshot(makeSnapshot({ topFailureClusters: [] }))).toBe(true)
  })

  it('rejects null', () => {
    expect(isValidSnapshot(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isValidSnapshot(undefined)).toBe(false)
  })

  it('rejects a non-object', () => {
    expect(isValidSnapshot('hello')).toBe(false)
    expect(isValidSnapshot(42)).toBe(false)
  })

  it('rejects when runId is missing', () => {
    const s = makeSnapshot()
    // @ts-expect-error — intentional malformed shape
    delete s.runId
    expect(isValidSnapshot(s)).toBe(false)
  })

  it('rejects when totalAttempts is a string', () => {
    expect(
      isValidSnapshot({
        ...makeSnapshot(),
        totalAttempts: '10',
      }),
    ).toBe(false)
  })

  it('rejects when topFailureClusters is not an array', () => {
    expect(
      isValidSnapshot({ ...makeSnapshot(), topFailureClusters: {} }),
    ).toBe(false)
  })

  it('rejects a cluster entry missing count', () => {
    expect(
      isValidSnapshot({
        ...makeSnapshot(),
        topFailureClusters: [{ verdict: 'x' }],
      }),
    ).toBe(false)
  })

  // --- hostile regressions --------------------------------------------
  // Attacker / upstream bug lands NaN or Infinity in a numeric field.
  // Plain `typeof v === 'number'` accepts both. UI would display `$NaN`
  // throughout the cards + chart. Must reject.

  it('rejects NaN totalCostUsdTracked', () => {
    expect(
      isValidSnapshot({ ...makeSnapshot(), totalCostUsdTracked: Number.NaN }),
    ).toBe(false)
  })

  it('rejects Infinity durationSeconds', () => {
    expect(
      isValidSnapshot({
        ...makeSnapshot(),
        durationSeconds: Number.POSITIVE_INFINITY,
      }),
    ).toBe(false)
  })

  it('rejects -Infinity in cluster count', () => {
    expect(
      isValidSnapshot({
        ...makeSnapshot(),
        topFailureClusters: [
          { verdict: 'x', count: Number.NEGATIVE_INFINITY },
        ],
      }),
    ).toBe(false)
  })

  it('rejects NaN rejectRatePct', () => {
    expect(
      isValidSnapshot({ ...makeSnapshot(), rejectRatePct: Number.NaN }),
    ).toBe(false)
  })
})

describe('loadAllRuns', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'templater-runs-test-'))
  })

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty list for non-existent directory', async () => {
    const r = await loadAllRuns(path.join(tmpDir, 'does-not-exist'))
    expect(r.runs).toHaveLength(0)
    expect(r.errors).toHaveLength(0)
  })

  it('returns empty list for empty directory', async () => {
    const r = await loadAllRuns(tmpDir)
    expect(r.runs).toHaveLength(0)
    expect(r.errors).toHaveLength(0)
  })

  it('loads a single valid snapshot', async () => {
    const snap = makeSnapshot({ runId: 'run-a' })
    await fsp.writeFile(
      path.join(tmpDir, 'run-a.json'),
      JSON.stringify(snap),
      'utf-8',
    )
    const r = await loadAllRuns(tmpDir)
    expect(r.runs).toHaveLength(1)
    expect(r.runs[0].runId).toBe('run-a')
    expect(r.errors).toHaveLength(0)
  })

  it('sorts newest-first by startedAt', async () => {
    const older = makeSnapshot({
      runId: 'run-older',
      startedAt: '2026-01-01T00:00:00.000Z',
    })
    const newer = makeSnapshot({
      runId: 'run-newer',
      startedAt: '2026-06-01T00:00:00.000Z',
    })
    await fsp.writeFile(path.join(tmpDir, 'older.json'), JSON.stringify(older))
    await fsp.writeFile(path.join(tmpDir, 'newer.json'), JSON.stringify(newer))
    const r = await loadAllRuns(tmpDir)
    expect(r.runs.map((x) => x.runId)).toEqual(['run-newer', 'run-older'])
  })

  it('isolates malformed JSON from valid snapshots', async () => {
    const good = makeSnapshot({ runId: 'good' })
    await fsp.writeFile(path.join(tmpDir, 'good.json'), JSON.stringify(good))
    await fsp.writeFile(path.join(tmpDir, 'bad.json'), '{ not json')
    const r = await loadAllRuns(tmpDir)
    expect(r.runs).toHaveLength(1)
    expect(r.runs[0].runId).toBe('good')
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].file).toBe('bad.json')
    expect(r.errors[0].reason).toMatch(/JSON parse/)
  })

  it('isolates schema failures (parses but missing fields)', async () => {
    await fsp.writeFile(
      path.join(tmpDir, 'wrong-shape.json'),
      JSON.stringify({ runId: 'x' }),
    )
    await fsp.writeFile(
      path.join(tmpDir, 'valid.json'),
      JSON.stringify(makeSnapshot()),
    )
    const r = await loadAllRuns(tmpDir)
    expect(r.runs).toHaveLength(1)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].reason).toBe('schema validation failed')
  })

  it('ignores non-JSON files silently', async () => {
    await fsp.writeFile(path.join(tmpDir, 'README.md'), '# readme')
    await fsp.writeFile(
      path.join(tmpDir, 'valid.json'),
      JSON.stringify(makeSnapshot()),
    )
    const r = await loadAllRuns(tmpDir)
    expect(r.runs).toHaveLength(1)
    expect(r.errors).toHaveLength(0)
  })

  // --- hostile requirement (b) -------------------------------------------
  // Spec requires: "malformed snapshot JSON doesn't crash the page".
  // The stronger guarantee we deliver: a single bad file does NOT take
  // down the other runs. The dashboard degrades gracefully, surfacing
  // which files failed in the errors channel while rendering the rest.

  it('does not throw when every file in the directory is malformed', async () => {
    await fsp.writeFile(path.join(tmpDir, 'a.json'), 'not json')
    await fsp.writeFile(path.join(tmpDir, 'b.json'), '{ "partial": ')
    await fsp.writeFile(
      path.join(tmpDir, 'c.json'),
      JSON.stringify({ someOtherShape: true }),
    )
    const r = await loadAllRuns(tmpDir)
    expect(r.runs).toHaveLength(0)
    expect(r.errors).toHaveLength(3)
    // All three failures should surface — file names preserved for the
    // UI to display the "could not load" banner.
    expect(new Set(r.errors.map((e) => e.file))).toEqual(
      new Set(['a.json', 'b.json', 'c.json']),
    )
  })

  it('returns good + bad files side-by-side rather than failing on first bad file', async () => {
    await fsp.writeFile(
      path.join(tmpDir, '1-good.json'),
      JSON.stringify(makeSnapshot({ runId: 'a' })),
    )
    await fsp.writeFile(path.join(tmpDir, '2-bad.json'), '{ not parseable')
    await fsp.writeFile(
      path.join(tmpDir, '3-good.json'),
      JSON.stringify(makeSnapshot({ runId: 'b' })),
    )
    const r = await loadAllRuns(tmpDir)
    expect(r.runs).toHaveLength(2)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].file).toBe('2-bad.json')
  })

  // ENOENT is swallowed (treated as "no runs yet" so the page still
  // renders during initial setup), but other filesystem errors MUST
  // propagate so the route's error.tsx boundary can render a proper
  // failure page — matching the hostile spec's error-boundary contract.
  it('rethrows when target path exists but is not a directory', async () => {
    const filePath = path.join(tmpDir, 'not-a-dir.json')
    await fsp.writeFile(filePath, 'hello')
    await expect(loadAllRuns(filePath)).rejects.toThrow()
  })
})

describe('cumulativeSpend', () => {
  it('returns empty array for no runs', () => {
    expect(cumulativeSpend([])).toEqual([])
  })

  it('produces monotonically non-decreasing cumulative cost', () => {
    const runs: TemplaterRunSnapshot[] = [
      makeSnapshot({
        runId: 'run-1',
        startedAt: '2026-01-01T00:00:00.000Z',
        totalCostUsdTracked: 1,
        passed: 5,
      }),
      makeSnapshot({
        runId: 'run-2',
        startedAt: '2026-02-01T00:00:00.000Z',
        totalCostUsdTracked: 2.5,
        passed: 7,
      }),
      makeSnapshot({
        runId: 'run-3',
        startedAt: '2026-03-01T00:00:00.000Z',
        totalCostUsdTracked: 0,
        passed: 3,
      }),
    ]
    const pts = cumulativeSpend(runs)
    expect(pts.map((p) => p.cumulativeCostUsd)).toEqual([1, 3.5, 3.5])
    expect(pts.map((p) => p.cumulativeTemplatesProduced)).toEqual([5, 12, 15])
  })

  it('orders chronologically regardless of input order', () => {
    const reversed: TemplaterRunSnapshot[] = [
      makeSnapshot({
        runId: 'run-newer',
        startedAt: '2026-02-01T00:00:00.000Z',
        totalCostUsdTracked: 2,
      }),
      makeSnapshot({
        runId: 'run-older',
        startedAt: '2026-01-01T00:00:00.000Z',
        totalCostUsdTracked: 1,
      }),
    ]
    const pts = cumulativeSpend(reversed)
    expect(pts.map((p) => p.runId)).toEqual(['run-older', 'run-newer'])
  })

  it('does not mutate input array', () => {
    const runs: TemplaterRunSnapshot[] = [
      makeSnapshot({ startedAt: '2026-02-01T00:00:00.000Z' }),
      makeSnapshot({ startedAt: '2026-01-01T00:00:00.000Z' }),
    ]
    const snapshot = runs.map((r) => r.startedAt)
    cumulativeSpend(runs)
    expect(runs.map((r) => r.startedAt)).toEqual(snapshot)
  })
})

describe('aggregateFailureModes', () => {
  it('returns empty array for no runs', () => {
    expect(aggregateFailureModes([])).toEqual([])
  })

  it('returns empty array when runs have no failures', () => {
    expect(
      aggregateFailureModes([makeSnapshot({ topFailureClusters: [] })]),
    ).toEqual([])
  })

  it('rolls up clusters across runs by verdict', () => {
    const runs: TemplaterRunSnapshot[] = [
      makeSnapshot({
        topFailureClusters: [
          { verdict: 'fetch-docs-failed', count: 5 },
          { verdict: 'synthesize-failed', count: 2 },
        ],
      }),
      makeSnapshot({
        topFailureClusters: [
          { verdict: 'fetch-docs-failed', count: 3 },
          { verdict: 'tsc-failed', count: 1 },
        ],
      }),
    ]
    const agg = aggregateFailureModes(runs)
    expect(agg).toHaveLength(3)
    expect(agg[0]).toMatchObject({ verdict: 'fetch-docs-failed', count: 8 })
    expect(agg[1]).toMatchObject({ verdict: 'synthesize-failed', count: 2 })
    expect(agg[2]).toMatchObject({ verdict: 'tsc-failed', count: 1 })
  })

  it('share sums to ~1.0 when there are failures', () => {
    const runs: TemplaterRunSnapshot[] = [
      makeSnapshot({
        topFailureClusters: [
          { verdict: 'a', count: 3 },
          { verdict: 'b', count: 1 },
        ],
      }),
    ]
    const agg = aggregateFailureModes(runs)
    const sum = agg.reduce((n, r) => n + r.share, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })

  it('share is 0 when there are no failures', () => {
    const runs: TemplaterRunSnapshot[] = [
      makeSnapshot({ topFailureClusters: [] }),
    ]
    expect(aggregateFailureModes(runs)).toEqual([])
  })

  it('sorts by count desc, then verdict asc for determinism', () => {
    const runs: TemplaterRunSnapshot[] = [
      makeSnapshot({
        topFailureClusters: [
          { verdict: 'zebra', count: 2 },
          { verdict: 'apple', count: 2 },
          { verdict: 'banana', count: 5 },
        ],
      }),
    ]
    const agg = aggregateFailureModes(runs)
    expect(agg.map((r) => r.verdict)).toEqual(['banana', 'apple', 'zebra'])
  })
})

describe('fleetTotals', () => {
  it('returns zeros for no runs', () => {
    const t = fleetTotals([])
    expect(t).toEqual({
      runs: 0,
      templatesProduced: 0,
      attempts: 0,
      totalCostUsd: 0,
      avgCostPerTemplateUsd: 0,
      avgRejectRatePct: 0,
    })
  })

  it('aggregates across multiple runs', () => {
    const runs: TemplaterRunSnapshot[] = [
      makeSnapshot({
        totalAttempts: 10,
        passed: 7,
        totalCostUsdTracked: 1,
        rejectRatePct: 30,
      }),
      makeSnapshot({
        totalAttempts: 20,
        passed: 10,
        totalCostUsdTracked: 3,
        rejectRatePct: 50,
      }),
    ]
    const t = fleetTotals(runs)
    expect(t.runs).toBe(2)
    expect(t.templatesProduced).toBe(17)
    expect(t.attempts).toBe(30)
    expect(t.totalCostUsd).toBe(4)
    expect(t.avgCostPerTemplateUsd).toBeCloseTo(4 / 17, 4)
    expect(t.avgRejectRatePct).toBe(40)
  })

  it('avgCostPerTemplateUsd is 0 when zero templates produced (prevents div-by-zero)', () => {
    const runs: TemplaterRunSnapshot[] = [
      makeSnapshot({ passed: 0, totalCostUsdTracked: 1 }),
    ]
    const t = fleetTotals(runs)
    expect(t.avgCostPerTemplateUsd).toBe(0)
  })
})
