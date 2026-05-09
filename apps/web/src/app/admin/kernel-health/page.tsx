'use client'
/**
 * P5.K1 — Kernel-health top-level dashboard.
 *
 * Same auth-via-API pattern as /admin/funnel: this page renders the
 * shell, the GET /api/admin/kernel-health endpoint enforces auth and
 * returns the data. On 4xx (non-admin / not-signed-in) we render a
 * generic 404 so the surface is invisible to non-admins.
 *
 * Empty / no-data state: shows "No kernel events in the last <N>
 * days" rather than blank. Pre-launch this is the expected state.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface OverviewRow {
  adapter: string
  total: number
  successes: number
  errors: number
  errorRate: number
  p50: number
  p95: number
  p99: number
}

interface OverviewData {
  view: 'overview'
  generatedAt: string
  windowDays: number
  totalEvents: number
  currentQps: number
  perAdapter: OverviewRow[]
}

export default function KernelHealthPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<'not_admin' | 'failed' | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/kernel-health?view=overview&windowDays=7')
      if (res.status === 404 || res.status === 401) {
        setError('not_admin')
        return
      }
      if (!res.ok) {
        setError('failed')
        return
      }
      const json = (await res.json()) as { data?: OverviewData } | OverviewData
      const payload = 'data' in json && json.data ? json.data : (json as OverviewData)
      setData(payload)
      setError(null)
    } catch {
      setError('failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  if (error === 'not_admin') {
    return <NotFound />
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold">Kernel health</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Routing decisions, adapter latency, and rail-fee accumulation. Last
            7 days.
          </p>
          <nav className="mt-4 flex gap-4 text-sm">
            <Link href="/admin/kernel-health" className="font-semibold underline">
              Overview
            </Link>
            <Link href="/admin/kernel-health/rails" className="text-muted-foreground hover:underline">
              Rails &amp; fees
            </Link>
          </nav>
        </header>

        {loading && !data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : error === 'failed' ? (
          <p className="text-destructive">
            Failed to load. Try refreshing.
          </p>
        ) : data && data.totalEvents === 0 ? (
          <EmptyState windowDays={data.windowDays} />
        ) : data ? (
          <>
            <SummaryCards data={data} />
            <AdapterTable rows={data.perAdapter} />
          </>
        ) : null}
      </div>
    </main>
  )
}

function SummaryCards({ data }: { data: OverviewData }) {
  // QPS is computed over a 60s sliding window. Render one decimal so
  // sub-1-QPS systems still show signal (0.0 → 0.7 → 1.5 etc).
  const qps =
    data.currentQps >= 10
      ? data.currentQps.toFixed(0)
      : data.currentQps.toFixed(1)
  // Aggregate error rate over the dashboard window.
  const totalsAcrossAdapters = data.perAdapter.reduce(
    (acc, r) => ({ total: acc.total + r.total, errors: acc.errors + r.errors }),
    { total: 0, errors: 0 },
  )
  const aggregateErrorRate =
    totalsAcrossAdapters.total === 0
      ? 0
      : (totalsAcrossAdapters.errors / totalsAcrossAdapters.total) * 100

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
      <Card label="Current QPS (60s)" value={qps} />
      <Card
        label="Error rate"
        value={`${aggregateErrorRate.toFixed(2)}%`}
      />
      <Card label="Total events" value={data.totalEvents.toLocaleString()} />
      <Card
        label="Window"
        value={`${data.windowDays} day${data.windowDays === 1 ? '' : 's'}`}
      />
    </div>
  )
}

function AdapterTable({ rows }: { rows: OverviewRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground">
        No latency events in the window. Adapters with no requests won&apos;t
        appear here.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-4 py-2">Adapter</th>
            <th className="px-4 py-2 text-right">Total</th>
            <th className="px-4 py-2 text-right">Error rate</th>
            <th className="px-4 py-2 text-right">p50 (ms)</th>
            <th className="px-4 py-2 text-right">p95 (ms)</th>
            <th className="px-4 py-2 text-right">p99 (ms)</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const errorRatePct = r.errorRate * 100
            return (
              <tr key={r.adapter} className="border-t">
                <td className="px-4 py-2 font-mono">{r.adapter}</td>
                <td className="px-4 py-2 text-right">
                  {r.total.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {errorRatePct.toFixed(2)}%
                </td>
                <td className="px-4 py-2 text-right">{r.p50.toFixed(0)}</td>
                <td className="px-4 py-2 text-right">{r.p95.toFixed(0)}</td>
                <td className="px-4 py-2 text-right">{r.p99.toFixed(0)}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/kernel-health/adapter/${encodeURIComponent(r.adapter)}`}
                    className="text-primary hover:underline"
                  >
                    Drill down →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function EmptyState({ windowDays }: { windowDays: number }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h2 className="text-lg font-semibold">No kernel events yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        No events recorded in the last {windowDays} day
        {windowDays === 1 ? '' : 's'}. The kernel emits telemetry on every
        invocation; this surface fills in once production traffic is hitting
        the kernel.
      </p>
    </div>
  )
}

function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-semibold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found.</p>
      </div>
    </main>
  )
}
