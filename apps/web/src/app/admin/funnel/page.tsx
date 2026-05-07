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
  FunnelChart,
  Funnel,
  LabelList,
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
  medianMinutesToConvert: number | null
}
interface DailyStats {
  total: number
  activeDays: number
  minNonZero: number
  median: number
  max: number
  peakDay: string | null
  spikeRatio: number | null
}
interface HourBucket {
  hourUtc: number
  count: number
}
interface FunnelData {
  generatedAt: string
  windowDays: number
  events: Record<string, FunnelEventCounts>
  daily: FunnelDailyPoint[]
  dailyStats: Record<string, DailyStats>
  hourClusters: HourBucket[]
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

function formatMinutes(min: number | null): string {
  if (min === null || min <= 0) return '--'
  if (min < 1) return `${(min * 60).toFixed(0)}s`
  if (min < 60) return `${min.toFixed(1)}m`
  if (min < 1440) return `${(min / 60).toFixed(1)}h`
  return `${(min / 1440).toFixed(1)}d`
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

          {/* ─── 5-stage funnel chart with dropoff percentages ──────── */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">
              5-stage funnel
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Real recharts FunnelChart per spec D12 */}
              <div className="rounded-lg border border-gray-700 bg-[#161822] p-4 h-80">
                {response?.data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#161822',
                          border: '1px solid #2A2D3E',
                        }}
                        formatter={(value: number) => formatNumber(value)}
                      />
                      <Funnel
                        dataKey="value"
                        data={FUNNEL_STAGES.map((stage, i) => {
                          const conv = response.data!.conversions.find(
                            (c) =>
                              c.fromStage === FUNNEL_STAGES[i - 1] &&
                              c.toStage === stage,
                          )
                          const stageUniques =
                            i === 0
                              ? response.data!.events[stage]?.unique ?? 0
                              : conv?.toUniques ?? 0
                          return {
                            name: stage,
                            value: stageUniques,
                            fill: STAGE_COLORS[stage],
                          }
                        })}
                        isAnimationActive
                      >
                        <LabelList
                          position="right"
                          fill="#e5e7eb"
                          stroke="none"
                          dataKey="name"
                          fontSize={11}
                        />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 flex items-center justify-center h-full">
                    No funnel data yet.
                  </p>
                )}
              </div>

              {/* Per-transition dropoff detail to the right of the chart */}
              <div className="rounded-lg border border-gray-700 bg-[#161822] p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-200 mb-2">
                  Stage-to-stage dropoff
                </h3>
                {FUNNEL_STAGES.map((stage, i) => {
                  const conv = response?.data?.conversions.find(
                    (c) => c.fromStage === FUNNEL_STAGES[i - 1] && c.toStage === stage,
                  )
                  const stageUniques =
                    i === 0
                      ? response?.data?.events[stage]?.unique ?? null
                      : conv?.toUniques ?? null
                  return (
                    <div key={stage} className="text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-gray-300">
                          Stage {i + 1} · {stage}
                        </span>
                        <span className="tabular-nums text-gray-100 font-semibold">
                          {formatNumber(stageUniques)}
                        </span>
                      </div>
                      {i > 0 && conv && (
                        <div className="ml-2 mt-0.5 text-gray-500">
                          ↳ {formatPercent(conv.rate)} conv · median{' '}
                          {formatMinutes(conv.medianMinutesToConvert)}{' '}
                          time-to-convert
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ─── Anomaly section: spikes + dips + hour clustering ──── */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200">
              Anomalies (spikes, dips, timezone)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <AnomalyCard
                title="Daily spikes (max/median ≥ 2×)"
                empty="No spikes."
                rows={
                  response?.data
                    ? Object.entries(response.data.dailyStats)
                        .filter(
                          ([, s]) =>
                            s.spikeRatio !== null && s.spikeRatio >= 2,
                        )
                        .sort(
                          (a, b) =>
                            (b[1].spikeRatio ?? 0) - (a[1].spikeRatio ?? 0),
                        )
                        .map(([event, s]) => ({
                          left: event,
                          right: `${(s.spikeRatio ?? 0).toFixed(1)}× on ${s.peakDay ?? '--'}`,
                        }))
                    : []
                }
              />
              <AnomalyCard
                title="Day-coverage dips (< 50% active)"
                empty="No dips."
                rows={
                  response?.data
                    ? Object.entries(response.data.dailyStats)
                        .filter(
                          ([, s]) =>
                            s.total > 0 &&
                            response.data!.windowDays > 0 &&
                            s.activeDays < response.data!.windowDays / 2,
                        )
                        .sort((a, b) => a[1].activeDays - b[1].activeDays)
                        .map(([event, s]) => ({
                          left: event,
                          right: `${s.activeDays}/${response.data!.windowDays} days`,
                        }))
                    : []
                }
              />
              <HourClusterCard
                hourClusters={response?.data?.hourClusters ?? []}
              />
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

function AnomalyCard({
  title,
  rows,
  empty,
}: {
  title: string
  rows: Array<{ left: string; right: string }>
  empty: string
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-[#161822] p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.left}
              className="flex justify-between text-xs border-b border-gray-800/40 pb-1"
            >
              <code className="text-gray-300 font-mono">{r.left}</code>
              <span className="text-gray-100 tabular-nums">{r.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HourClusterCard({ hourClusters }: { hourClusters: HourBucket[] }) {
  if (hourClusters.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-[#161822] p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">
          Hour-of-day (UTC, gallery_viewed)
        </h3>
        <p className="text-xs text-gray-500">No top-of-funnel events in window.</p>
      </div>
    )
  }
  const total = hourClusters.reduce((a, b) => a + b.count, 0)
  const peak = hourClusters.reduce(
    (best, h) => (h.count > best.count ? h : best),
    hourClusters[0],
  )
  const peakShare = total > 0 ? peak.count / total : 0
  // Build a 24-bucket array filled with zeros for sparse data
  const fullDay = Array.from({ length: 24 }, (_, h) => {
    const bucket = hourClusters.find((c) => c.hourUtc === h)
    return { hourUtc: h, count: bucket?.count ?? 0 }
  })
  const max = peak.count || 1
  return (
    <div className="rounded-lg border border-gray-700 bg-[#161822] p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-2">
        Hour-of-day (UTC, gallery_viewed)
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        Peak{' '}
        <strong className="text-gray-100">
          {peak.hourUtc.toString().padStart(2, '0')}:00 UTC
        </strong>{' '}
        — {formatPercent(peakShare)} of total
        {peakShare >= 0.2 ? (
          <span className="text-amber-400"> · single timezone likely dominates</span>
        ) : null}
      </p>
      <div className="flex items-end gap-px h-16">
        {fullDay.map((b) => (
          <div
            key={b.hourUtc}
            title={`${b.hourUtc.toString().padStart(2, '0')}:00 UTC: ${b.count}`}
            className="flex-1 bg-blue-500/40"
            style={{ height: `${(b.count / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
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
