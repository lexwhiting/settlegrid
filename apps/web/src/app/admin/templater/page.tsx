import { forbidden, unauthorized } from 'next/navigation'
import Link from 'next/link'
import { requireDeveloper } from '@/lib/middleware/auth'
import {
  loadAllRuns,
  cumulativeSpend,
  aggregateFailureModes,
  fleetTotals,
  TEMPLATER_RUNS_DIR,
} from '@/lib/templater-runs'
import { TemplaterRunCard } from '@/components/admin/TemplaterRunCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

export const dynamic = 'force-dynamic'

/**
 * Spec requires unauthenticated requests receive 401, not 200/404.
 * Next 15's unauthorized() + forbidden() helpers throw navigation
 * interrupts caught by the matching boundaries (unauthorized.tsx /
 * forbidden.tsx in this route folder).
 */
async function requireAdmin(): Promise<void> {
  let auth
  try {
    auth = await requireDeveloper()
  } catch {
    unauthorized()
  }
  if (!ADMIN_EMAILS.includes(auth.email)) {
    forbidden()
  }
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xl font-bold text-gray-100 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Card>
  )
}

export default async function TemplaterAdminPage() {
  await requireAdmin()
  const { runs, errors } = await loadAllRuns(TEMPLATER_RUNS_DIR)
  const totals = fleetTotals(runs)
  const spend = cumulativeSpend(runs)
  const failureModes = aggregateFailureModes(runs)
  const maxCumulative = Math.max(
    ...spend.map((p) => p.cumulativeCostUsd),
    0.01,
  )

  return (
    <div className="min-h-screen bg-[#0C0E14] text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Templater Runs</h1>
            <p className="text-sm text-gray-500 mt-1">
              Scale-run telemetry synced from the agents repo
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Admin
          </Link>
        </div>

        {errors.length > 0 && (
          <Card className="mb-6 border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm font-medium text-amber-400 mb-2">
              {errors.length} snapshot file{errors.length === 1 ? '' : 's'} could not be loaded
            </p>
            <ul className="text-xs text-amber-200/80 space-y-1 font-mono">
              {errors.map((e) => (
                <li key={e.file}>
                  {e.file}: {e.reason}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {runs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-gray-400 mb-2">No run snapshots yet.</p>
            <p className="text-xs text-gray-500">
              Run{' '}
              <code className="font-mono bg-[#0C0E14] px-1.5 py-0.5 rounded">
                npx tsx scripts/sync-templater-runs.ts
              </code>{' '}
              to pull summaries from the agents repo.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <SummaryStat label="Runs" value={formatNumber(totals.runs)} />
              <SummaryStat
                label="Templates produced"
                value={formatNumber(totals.templatesProduced)}
              />
              <SummaryStat
                label="Total attempts"
                value={formatNumber(totals.attempts)}
              />
              <SummaryStat
                label="Tracked spend"
                value={formatCost(totals.totalCostUsd)}
              />
              <SummaryStat
                label="$ / template (avg)"
                value={formatCost(totals.avgCostPerTemplateUsd)}
              />
              <SummaryStat
                label="Avg reject rate"
                value={`${totals.avgRejectRatePct.toFixed(1)}%`}
              />
            </div>

            {spend.length > 0 && (
              <Card className="p-5 mb-8">
                <h3 className="text-sm font-medium text-gray-400 mb-4">
                  Cumulative spend ({spend.length} run{spend.length === 1 ? '' : 's'})
                </h3>
                <div
                  className="flex items-end gap-2 h-32"
                  aria-label="Cumulative spend bar chart"
                >
                  {spend.map((p) => {
                    const heightPct = Math.max(
                      (p.cumulativeCostUsd / maxCumulative) * 100,
                      2,
                    )
                    return (
                      <div
                        key={p.runId}
                        className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
                        title={`${p.runId}\n${formatCost(p.cumulativeCostUsd)} cumulative · ${p.cumulativeTemplatesProduced} templates`}
                      >
                        <span className="text-[10px] text-gray-500 tabular-nums">
                          {formatCost(p.cumulativeCostUsd)}
                        </span>
                        <div
                          className="w-full rounded-t bg-amber-500/80 transition-all duration-300 min-h-[2px]"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[9px] text-gray-600 truncate max-w-full">
                          {p.startedAt.slice(5, 10)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-gray-600 italic mt-3">
                  Spend reflects tracked Haiku costs only; Sonnet spend is not currently instrumented (see per-run notes).
                </p>
              </Card>
            )}

            {failureModes.length > 0 && (
              <Card className="p-5 mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-medium text-gray-400">
                    Aggregate failure modes (across all runs)
                  </h3>
                  <Badge variant="destructive">
                    {failureModes.reduce((n, f) => n + f.count, 0)} total
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {failureModes.map((f) => (
                    <li key={f.verdict} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-300 font-mono text-xs min-w-[14rem] truncate">
                        {f.verdict}
                      </span>
                      <div className="flex-1 h-2 bg-[#2A2D3E] rounded overflow-hidden">
                        <div
                          className="h-full bg-red-500/60"
                          style={{ width: `${f.share * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-400 tabular-nums text-xs shrink-0 min-w-[4rem] text-right">
                        {f.count} ({(f.share * 100).toFixed(0)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-200 mb-4">
                Runs (newest first)
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {runs.map((run) => (
                  <TemplaterRunCard key={run.runId} run={run} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
