/**
 * Templater run-snapshot loader + aggregation helpers.
 *
 * Data flow: settlegrid-agents/data/templater/runs/<ts>-summary.json
 * is synced into apps/web/src/data/templater-runs/ by
 * scripts/sync-templater-runs.ts (committed to git for deterministic
 * deploys — the admin dashboard never reads FS paths outside the web
 * bundle).
 */

import { promises as fsp } from 'node:fs'
import path from 'node:path'

/**
 * Shape of a single Templater run summary JSON.
 * Must match the emitter in agents/templater/scale-run.ts + retry-rejected.ts.
 */
export interface TemplaterRunSnapshot {
  runId: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  totalAttempts: number
  passed: number
  rejected: number
  failed: number
  rejectRatePct: number
  totalCostUsdTracked: number
  costPerSuccessfulTemplateUsdTracked: number
  tokensInTracked: number
  tokensOutTracked: number
  topFailureClusters: Array<{ verdict: string; count: number }>
  costTrackingNote?: string
  backfilledTemplateJson?: number
  skippedAlreadyHadTemplateJson?: number
}

/**
 * Strict structural validation.
 * Dashboards that 500 when a single snapshot is malformed are brittle;
 * the loader isolates bad snapshots and reports them separately so the
 * rest of the dashboard keeps rendering.
 *
 * Numeric fields are validated with Number.isFinite — `typeof n === 'number'`
 * accepts NaN and Infinity, which would render as `$NaN` in the UI.
 */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function isValidSnapshot(x: unknown): x is TemplaterRunSnapshot {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.runId === 'string' &&
    typeof o.startedAt === 'string' &&
    typeof o.completedAt === 'string' &&
    isFiniteNumber(o.durationSeconds) &&
    isFiniteNumber(o.totalAttempts) &&
    isFiniteNumber(o.passed) &&
    isFiniteNumber(o.rejected) &&
    isFiniteNumber(o.failed) &&
    isFiniteNumber(o.rejectRatePct) &&
    isFiniteNumber(o.totalCostUsdTracked) &&
    isFiniteNumber(o.costPerSuccessfulTemplateUsdTracked) &&
    isFiniteNumber(o.tokensInTracked) &&
    isFiniteNumber(o.tokensOutTracked) &&
    Array.isArray(o.topFailureClusters) &&
    o.topFailureClusters.every(
      (c) =>
        c &&
        typeof c === 'object' &&
        typeof (c as Record<string, unknown>).verdict === 'string' &&
        isFiniteNumber((c as Record<string, unknown>).count),
    )
  )
}

export interface LoadResult {
  /** Parsed + validated snapshots, sorted newest-first by startedAt. */
  runs: TemplaterRunSnapshot[]
  /** Per-file parse/validation failures (file name + reason). Never throws. */
  errors: Array<{ file: string; reason: string }>
}

/**
 * Load all templater run snapshots from a directory.
 * A bad JSON file becomes an entry in `errors` — it does NOT crash
 * the loader. An absent directory is treated as "no runs yet" so the
 * dashboard degrades gracefully when the sync script has not been run.
 */
export async function loadAllRuns(dir: string): Promise<LoadResult> {
  const errors: LoadResult['errors'] = []
  let files: string[]
  try {
    files = await fsp.readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { runs: [], errors: [] }
    }
    throw err
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort()
  const runs: TemplaterRunSnapshot[] = []
  for (const file of jsonFiles) {
    const full = path.join(dir, file)
    let raw: string
    try {
      raw = await fsp.readFile(full, 'utf-8')
    } catch (err) {
      errors.push({ file, reason: (err as Error).message })
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      errors.push({ file, reason: `JSON parse: ${(err as Error).message}` })
      continue
    }
    if (!isValidSnapshot(parsed)) {
      errors.push({ file, reason: 'schema validation failed' })
      continue
    }
    runs.push(parsed)
  }

  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return { runs, errors }
}

export interface CumulativePoint {
  /** ISO datetime of the run that produced this cumulative step. */
  startedAt: string
  /** Short runId for hover labels. */
  runId: string
  /** Sum of totalCostUsdTracked across all runs up through this point. */
  cumulativeCostUsd: number
  /** Sum of passed templates up through this point. */
  cumulativeTemplatesProduced: number
}

/**
 * Build a cumulative-spend timeline across all runs.
 * Returns points in chronological (oldest-first) order so charts can
 * plot directly. Safe on empty input.
 */
export function cumulativeSpend(
  runs: TemplaterRunSnapshot[],
): CumulativePoint[] {
  const ordered = [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  let cost = 0
  let produced = 0
  return ordered.map((r) => {
    cost += r.totalCostUsdTracked
    produced += r.passed
    return {
      startedAt: r.startedAt,
      runId: r.runId,
      cumulativeCostUsd: Number(cost.toFixed(4)),
      cumulativeTemplatesProduced: produced,
    }
  })
}

export interface FailureModeAgg {
  verdict: string
  count: number
  /** Count as a fraction of total failed+rejected across all runs. */
  share: number
}

/**
 * Roll up topFailureClusters from every run into a single ranked list.
 * Used for the "where is the pipeline breaking" section of the dashboard.
 * `share` is 0 when there are no failures (empty input, all-pass runs).
 */
export function aggregateFailureModes(
  runs: TemplaterRunSnapshot[],
): FailureModeAgg[] {
  const byVerdict = new Map<string, number>()
  let totalFailures = 0
  for (const r of runs) {
    for (const c of r.topFailureClusters) {
      byVerdict.set(c.verdict, (byVerdict.get(c.verdict) ?? 0) + c.count)
      totalFailures += c.count
    }
  }
  const entries = Array.from(byVerdict.entries())
    .map(([verdict, count]) => ({
      verdict,
      count,
      share: totalFailures > 0 ? count / totalFailures : 0,
    }))
    .sort((a, b) => b.count - a.count || a.verdict.localeCompare(b.verdict))
  return entries
}

/**
 * Fleet-wide totals — drives the page header strip.
 */
export interface FleetTotals {
  runs: number
  templatesProduced: number
  attempts: number
  totalCostUsd: number
  avgCostPerTemplateUsd: number
  avgRejectRatePct: number
}

export function fleetTotals(runs: TemplaterRunSnapshot[]): FleetTotals {
  if (runs.length === 0) {
    return {
      runs: 0,
      templatesProduced: 0,
      attempts: 0,
      totalCostUsd: 0,
      avgCostPerTemplateUsd: 0,
      avgRejectRatePct: 0,
    }
  }
  const templatesProduced = runs.reduce((n, r) => n + r.passed, 0)
  const attempts = runs.reduce((n, r) => n + r.totalAttempts, 0)
  const totalCostUsd = runs.reduce((n, r) => n + r.totalCostUsdTracked, 0)
  const avgRejectRatePct =
    runs.reduce((n, r) => n + r.rejectRatePct, 0) / runs.length
  return {
    runs: runs.length,
    templatesProduced,
    attempts,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    avgCostPerTemplateUsd:
      templatesProduced > 0
        ? Number((totalCostUsd / templatesProduced).toFixed(4))
        : 0,
    avgRejectRatePct: Number(avgRejectRatePct.toFixed(2)),
  }
}

export const TEMPLATER_RUNS_DIR = path.join(
  process.cwd(),
  'src',
  'data',
  'templater-runs',
)
