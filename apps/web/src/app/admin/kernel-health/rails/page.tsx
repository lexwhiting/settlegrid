'use client'
/**
 * P5.K1 — Rail-fee accumulation dashboard.
 *
 * Aggregates kernel.invocation_settled events by rail. Shows total
 * settled count, gross volume, and platform fee accrual per rail.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface RailRow {
  rail: string
  settledCount: number
  amountCentsTotal: number
  takeCentsTotal: number
}

interface RailsData {
  view: 'rails'
  generatedAt: string
  windowDays: number
  perRail: RailRow[]
}

export default function KernelHealthRailsPage() {
  const [data, setData] = useState<RailsData | null>(null)
  const [error, setError] = useState<'not_admin' | 'failed' | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/kernel-health?view=rails&windowDays=7')
      if (res.status === 404 || res.status === 401) {
        setError('not_admin')
        return
      }
      if (!res.ok) {
        setError('failed')
        return
      }
      const json = (await res.json()) as { data?: RailsData } | RailsData
      const payload = 'data' in json && json.data ? json.data : (json as RailsData)
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
        <header className="mb-8">
          <h1 className="text-3xl font-semibold">Rails &amp; fees</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Settled-volume + platform-fee accrual by rail. Last 7 days.
          </p>
          <nav className="mt-4 flex gap-4 text-sm">
            <Link href="/admin/kernel-health" className="text-muted-foreground hover:underline">
              Overview
            </Link>
            <Link href="/admin/kernel-health/rails" className="font-semibold underline">
              Rails &amp; fees
            </Link>
          </nav>
        </header>

        {loading && !data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : error === 'failed' ? (
          <p className="text-destructive">Failed to load. Try refreshing.</p>
        ) : data && data.perRail.length === 0 ? (
          <p className="text-muted-foreground">
            No settled invocations in the last {data.windowDays} days.
          </p>
        ) : data ? (
          <RailsTable rows={data.perRail} />
        ) : null}
      </div>
    </main>
  )
}

function RailsTable({ rows }: { rows: RailRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-4 py-2">Rail</th>
            <th className="px-4 py-2 text-right">Settled count</th>
            <th className="px-4 py-2 text-right">Gross volume (USD)</th>
            <th className="px-4 py-2 text-right">Platform fee (USD)</th>
            <th className="px-4 py-2 text-right">Effective rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const grossUsd = r.amountCentsTotal / 100
            const takeUsd = r.takeCentsTotal / 100
            const rate =
              r.amountCentsTotal === 0
                ? 0
                : (r.takeCentsTotal / r.amountCentsTotal) * 100
            return (
              <tr key={r.rail} className="border-t">
                <td className="px-4 py-2 font-mono">{r.rail}</td>
                <td className="px-4 py-2 text-right">
                  {r.settledCount.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {grossUsd.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {takeUsd.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </td>
                <td className="px-4 py-2 text-right">{rate.toFixed(2)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
