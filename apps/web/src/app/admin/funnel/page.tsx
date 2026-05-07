'use client'
/**
 * P5.1 — Admin funnel-analysis dashboard.
 *
 * Renders the 5-stage P4.1 funnel with conversion rates between
 * stages, a 30-day daily-counts line chart, and three supplementary
 * tables (top templates, top error codes, geographic breakdown).
 *
 * Same-pattern auth as `/admin/launch-dashboard`: enforced server-side
 * by `/api/admin/funnel`. On non-200 we render a generic 404 so the
 * surface is invisible to non-admins.
 *
 * Empty / not-configured state: shows a "PostHog read keys not yet
 * configured" hint rather than a confusing zero-state. This matches
 * the deferred-launch reality — the dashboard ships now; the data
 * fills in once `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` are
 * set in Vercel and a launch event has fired traffic.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface FunnelEventCounts {
  total: number
  unique: number
}
interface FunnelDailyPoint {
  day: string
  event: string
  count: number
}
interface FunnelConversion {
  fromStage: string
  toStage: string
  fromUniques: number
  toUniques: number
  rate: number | null
  medianSecondsToConvert: number | null
}
interface FunnelData {
  generatedAt: string
  windowDays: number
  events: Record<string, FunnelEventCounts>
  daily: FunnelDailyPoint[]
  conversions: FunnelConversion[]
  topTemplates: Array<{ slug: string; successes: number }>
  topErrors: Array<{ code: string; failures: number }>
  geoBreakdown: Array<{ country: string; events: number }>
}
interface FunnelResponse {
  data: FunnelData | null
  reason?: 'not_configured' | 'upstream_error'
  generatedAt: string
}

const FUNNEL_STAGES = [
  'gallery_viewed',
  'template_detail_viewed',
  'cli_install_started',
  'scaffold_success',
  'first_billed_call',
] as const

const POLL_INTERVAL_MS = 60_000 * 5 // 5 min — matches API cache

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--'
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPercent(rate: number | null): string {
  if (rate === null) return '--'
  return `${(rate * 100).toFixed(1)}%`
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '--'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}

/**
 * Reshape `daily` rows into recharts series:
 *   [{ day: '2026-04-01', gallery_viewed: 12, template_detail_viewed: 4, ... }, ...]
 */
function shapeDailyForChart(
  daily: FunnelDailyPoint[],
): Array<Record<string, number | string>> {
  const byDay = new Map<string, Record<string, number | string>>()
  for (const point of daily) {
    if (!byDay.has(point.day)) byDay.set(point.day, { day: point.day })
    const row = byDay.get(point.day)!
    row[point.event] = point.count
  }
  return Array.from(byDay.values()).sort((a, b) =>
    String(a.day).localeCompare(String(b.day)),
  )
}

const STAGE_COLORS: Record<string, string> = {
  gallery_viewed: '#60a5fa',
  template_detail_viewed: '#a78bfa',
  cli_install_started: '#34d399',
  scaffold_success: '#fbbf24',
  scaffold_failed: '#f87171',
  first_billed_call: '#f472b6',
  shadow_directory_viewed: '#94a3b8',
  sdk_first_init: '#22d3ee',
}

export default function FunnelDashboardPage() {
  const [response, setResponse] = useState<FunnelResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/funnel', { credentials: 'include' })
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        // Hide the surface behind a generic 404. Same pattern as
        // /admin/launch-dashboard.
        setError('not_found')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        setLoading(false)
        return
      }
      const data = (await res.json()) as FunnelResponse
      setResponse(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'fetch_failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchData])

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-[#0C0E14] text-gray-300 flex items-center justify-center">
        <p>404</p>
      </div>
    )
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <main className="flex-1 px-6 py-10 pt-14">
        <div className="max-w-6xl mx-auto space-y-10">
          <header>
            <h1 className="text-3xl font-bold text-gray-100 mb-2">
              Funnel analysis · P5.1
            </h1>
            <p className="text-sm text-gray-400">
              5-stage launch funnel over the last{' '}
              {response?.data?.windowDays ?? 30} days. Generated{' '}
              {response?.generatedAt
                ? new Date(response.generatedAt).toLocaleString()
                : '—'}
              . Cached 5 min server-side.
            </p>
          </header>

          {loading && !response && (
            <p className="text-sm text-gray-500">Loading…</p>
          )}

          {response?.reason === 'not_configured' && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
              <strong>PostHog read keys not yet configured.</strong> Set{' '}
              <code className="font-mono text-xs">
                POSTHOG_PERSONAL_API_KEY
              </code>{' '}
              and{' '}
              <code className="font-mono text-xs">POSTHOG_PROJECT_ID</code> in
              Vercel env vars. The dashboard renders this hint until they are
              set + a launch event has fired traffic.
            </div>
          )}

          {response?.reason === 'upstream_error' && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
              PostHog query failed upstream. See server logs.
            </div>
          )}

          {/* ─── 5-stage funnel ─────────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">
              5-stage funnel
            </h2>
            <div className="space-y-2">
              {FUNNEL_STAGES.map((stage, i) => {
                const conv = response?.data?.conversions.find(
                  (c) => c.fromStage === FUNNEL_STAGES[i - 1] && c.toStage === stage,
                )
                const stageUniques =
                  i === 0
                    ? response?.data?.events[stage]?.unique ?? null
                    : conv?.toUniques ?? null
                return (
                  <div key={stage}>
                    {i > 0 && conv && (
                      <div className="ml-6 my-1 text-xs text-gray-500">
                        ↓ {formatPercent(conv.rate)} conversion · median time:{' '}
                        {formatDuration(conv.medianSecondsToConvert)}
                      </div>
                    )}
                    <div
                      className="rounded-md border border-gray-700 bg-[#161822] px-4 py-3 flex items-center justify-between"
                      style={{
                        borderLeftColor: STAGE_COLORS[stage],
                        borderLeftWidth: 4,
                      }}
                    >
                      <span className="font-mono text-sm text-gray-200">
                        Stage {i + 1} · {stage}
                      </span>
                      <span className="text-lg font-semibold text-gray-100 tabular-nums">
                        {formatNumber(stageUniques)} users
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ─── Daily breakdown ────────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">
              Daily counts (last {response?.data?.windowDays ?? 30} days)
            </h2>
            <div className="rounded-lg border border-gray-700 bg-[#161822] p-4 h-72">
              {response?.data && response.data.daily.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={shapeDailyForChart(response.data.daily)}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#2A2D3E" strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161822',
                        border: '1px solid #2A2D3E',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {Object.keys(STAGE_COLORS).map((event) => (
                      <Line
                        key={event}
                        type="monotone"
                        dataKey={event}
                        stroke={STAGE_COLORS[event]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500 flex items-center justify-center h-full">
                  No daily data yet.
                </p>
              )}
            </div>
          </section>

          {/* ─── Supplementary tables ───────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SimpleTable
              title="Top templates (scaffold_success)"
              empty="No scaffold successes yet."
              rows={
                response?.data?.topTemplates.map((t) => [t.slug, t.successes]) ?? []
              }
              headers={['Template', 'Successes']}
            />
            <SimpleTable
              title="Top errors (scaffold_failed)"
              empty="No scaffold failures yet."
              rows={
                response?.data?.topErrors.map((e) => [e.code, e.failures]) ?? []
              }
              headers={['Error code', 'Failures']}
            />
            <SimpleTable
              title="Geo breakdown"
              empty="No country-tagged events yet."
              rows={
                response?.data?.geoBreakdown.map((g) => [g.country, g.events]) ?? []
              }
              headers={['Country', 'Events']}
            />
          </section>
        </div>
      </main>
    </div>
  )
}

function SimpleTable({
  title,
  rows,
  headers,
  empty,
}: {
  title: string
  rows: Array<[string, number]>
  headers: [string, string]
  empty: string
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-[#161822] p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="py-1 text-xs text-gray-400 font-medium">
                {headers[0]}
              </th>
              <th className="py-1 text-xs text-gray-400 font-medium text-right">
                {headers[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-gray-800/40">
                <td className="py-1.5 text-gray-200 font-mono text-xs">{k}</td>
                <td className="py-1.5 text-gray-100 text-right tabular-nums">
                  {formatNumber(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
