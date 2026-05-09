'use client'
/**
 * P5.K1 — Per-adapter drill-down dashboard.
 */
import { useCallback, useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'

interface AdapterDrill {
  view: 'adapter'
  generatedAt: string
  windowDays: number
  adapter: string
  total: number
  successes: number
  errors: number
  p50: number
  p95: number
  p99: number
  latencyHistogram: { bucketMs: number; count: number }[]
  recentErrors: {
    occurredAt: string
    errorClass: string | null
    errorMessage: string | null
  }[]
}

export default function KernelHealthAdapterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [data, setData] = useState<AdapterDrill | null>(null)
  const [error, setError] = useState<'not_admin' | 'failed' | 'invalid' | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/kernel-health?view=adapter&windowDays=7&id=${encodeURIComponent(id)}`,
      )
      if (res.status === 404 || res.status === 401) {
        setError('not_admin')
        return
      }
      if (res.status === 400) {
        setError('invalid')
        return
      }
      if (!res.ok) {
        setError('failed')
        return
      }
      const json = (await res.json()) as { data?: AdapterDrill } | AdapterDrill
      const payload = 'data' in json && json.data ? json.data : (json as AdapterDrill)
      setData(payload)
      setError(null)
    } catch {
      setError('failed')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 30_000)
    return () => clearInterval(t)
  }, [fetchData])

  if (error === 'not_admin' || error === 'invalid') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-4xl font-semibold">404</h1>
          <p className="mt-2 text-muted-foreground">Page not found.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <nav className="mb-4 text-sm">
          <Link href="/admin/kernel-health" className="text-muted-foreground hover:underline">
            ← Back to overview
          </Link>
        </nav>
        <header className="mb-8">
          <h1 className="text-3xl font-semibold font-mono">{id}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Per-adapter drill-down. Last 7 days.
          </p>
        </header>

        {loading && !data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : error === 'failed' ? (
          <p className="text-destructive">Failed to load. Try refreshing.</p>
        ) : data && data.total === 0 ? (
          <p className="text-muted-foreground">
            No latency events for this adapter in the last {data.windowDays}{' '}
            days.
          </p>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
              <Card label="Total" value={data.total.toLocaleString()} />
              <Card
                label="Success rate"
                value={`${data.total === 0 ? '–' : ((data.successes / data.total) * 100).toFixed(1)}%`}
              />
              <Card
                label="p95 latency"
                value={`${data.p95.toFixed(0)} ms`}
              />
            </div>
            <Histogram histogram={data.latencyHistogram} />
            <RecentErrors errors={data.recentErrors} />
          </>
        ) : null}
      </div>
    </main>
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

function Histogram({
  histogram,
}: {
  histogram: { bucketMs: number; count: number }[]
}) {
  if (histogram.length === 0) return null
  const max = histogram.reduce((m, h) => Math.max(m, h.count), 0)
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Latency histogram</h2>
      <div className="space-y-1 rounded-lg border p-4">
        {histogram.map((h) => {
          const pct = max === 0 ? 0 : (h.count / max) * 100
          return (
            <div key={h.bucketMs} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2 text-xs">
              <span className="font-mono text-right text-muted-foreground">
                ≥{h.bucketMs} ms
              </span>
              <div className="h-3 rounded bg-muted/40">
                <div
                  className="h-3 rounded bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-right tabular-nums">
                {h.count.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RecentErrors({
  errors,
}: {
  errors: AdapterDrill['recentErrors']
}) {
  if (errors.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent errors</h2>
        <p className="text-sm text-muted-foreground">No recorded errors in window.</p>
      </section>
    )
  }
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">
        Recent errors ({errors.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Class</th>
              <th className="px-4 py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((e, i) => (
              <tr key={`${e.occurredAt}-${i}`} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">
                  {new Date(e.occurredAt).toISOString().slice(0, 19) + 'Z'}
                </td>
                <td className="px-4 py-2 font-mono">
                  {e.errorClass ?? '–'}
                </td>
                <td className="px-4 py-2">{e.errorMessage ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
