'use client'
/**
 * P4.7 — Launch-day war room dashboard.
 *
 * Single page, no auth UI of its own — auth is enforced by the
 * `/api/admin/launch-metrics` route. On non-200 we render a generic
 * 404 (matches `/admin`'s pattern) so the surface is invisible to
 * non-admins.
 *
 * Polls the metrics route every 30s. Each card surfaces null upstream
 * data as `--`; the route never throws so a single down upstream
 * (PostHog, HN, Sentry) doesn't blank the whole page.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

interface LaunchMetrics {
  generatedAt: string
  posthog: {
    galleryViewedLast15m: number
    galleryViewedLast1h: number
    galleryViewedLast24h: number
    templateDetailLast24h: number
    scaffoldSuccessLast24h: number
    scaffoldFailedLast24h: number
    cliInstallStartedLast15m: number
    cliInstallStartedLast1h: number
    cliInstallStartedLast24h: number
  } | null
  cliInstalls: { last15m: number; last1h: number; last24h: number } | null
  scaffolds: {
    successLast24h: number
    failedLast24h: number
    successRate: number | null
  } | null
  stripeConnections: { count: number; truncated: boolean } | null
  dbLatency: { p50Ms: number | null; p95Ms: number | null }
  hn: {
    itemId: number
    url: string
    title: string | null
    points: number | null
    descendants: number | null
    rank: number | null
  } | null
  sentryErrorsLastHour: number | null
}

const POLL_INTERVAL_MS = 30_000

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--'
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--'
  return `${(n * 100).toFixed(1)}%`
}

function formatMs(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--'
  return `${n} ms`
}

function Card({
  title,
  children,
  status,
}: {
  title: string
  children: React.ReactNode
  /** Badge color cue. Optional; defaults to neutral. */
  status?: 'ok' | 'warn' | 'crit' | 'unknown'
}) {
  const ringClass =
    status === 'ok'
      ? 'border-emerald-500/40'
      : status === 'warn'
        ? 'border-amber-500/40'
        : status === 'crit'
          ? 'border-red-500/40'
          : 'border-[#2A2D3E]'
  return (
    <div className={`bg-[#161822] border rounded-xl p-5 ${ringClass}`}>
      <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function BigNumber({
  value,
  sublabel,
}: {
  value: string
  sublabel?: string
}) {
  return (
    <div>
      <p className="text-3xl font-bold text-gray-100 tabular-nums">{value}</p>
      {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
    </div>
  )
}

function MiniRow({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-medium tabular-nums">{value}</span>
    </div>
  )
}

export default function LaunchDashboardPage() {
  const [metrics, setMetrics] = useState<LaunchMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  // Suppress overlapping polls (slow request + 30s tick).
  const inFlightRef = useRef(false)

  const fetchMetrics = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const res = await fetch('/api/admin/launch-metrics', {
        cache: 'no-store',
      })
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setError('not-found')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(`Failed to load metrics (${res.status})`)
        setLoading(false)
        return
      }
      // The route at /api/admin/launch-metrics returns the payload
      // FLAT (no { data: ... } wrap) — see api/admin/launch-metrics/
      // route.ts:149 `return successResponse(payload)` and the
      // corresponding tests asserting body.posthog (not body.data.posthog).
      // Reading json.data would silently set metrics to undefined and
      // collapse the dashboard's ternary chain to null, rendering only
      // the page header.
      const payload = (await res.json()) as LaunchMetrics
      setMetrics(payload)
      setLastRefresh(new Date())
      setError(null)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const id = setInterval(fetchMetrics, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchMetrics])

  // Fake-404 to hide the surface from non-admins / unauthenticated.
  if (error === 'not-found') {
    return (
      <div className="min-h-screen bg-[#0C0E14] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-7xl font-bold text-gray-700 mb-4">404</p>
          <p className="text-gray-500 mb-6">This page could not be found.</p>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    )
  }

  // Latency status cue — green <200ms p95, amber <1s, red beyond.
  const dbStatus = metrics?.dbLatency.p95Ms
    ? metrics.dbLatency.p95Ms < 200
      ? 'ok'
      : metrics.dbLatency.p95Ms < 1000
        ? 'warn'
        : 'crit'
    : 'unknown'

  // Sentry status cue — green at 0, amber 1-9, red ≥10/hour.
  const sentryStatus =
    metrics?.sentryErrorsLastHour == null
      ? 'unknown'
      : metrics.sentryErrorsLastHour === 0
        ? 'ok'
        : metrics.sentryErrorsLastHour < 10
          ? 'warn'
          : 'crit'

  // Scaffold success rate — green ≥95%, amber ≥80%, red below.
  const scaffoldStatus =
    metrics?.scaffolds?.successRate == null
      ? 'unknown'
      : metrics.scaffolds.successRate >= 0.95
        ? 'ok'
        : metrics.scaffolds.successRate >= 0.8
          ? 'warn'
          : 'crit'

  return (
    <div className="min-h-screen bg-[#0C0E14] text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">
              Launch Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Live launch-day metrics — refreshes every 30s
              {lastRefresh && (
                <span className="ml-2 text-gray-600">
                  Last update {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              ← Admin
            </Link>
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              {loading ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
        </div>

        {error && error !== 'not-found' && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && !metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5 animate-pulse"
              >
                <div className="h-4 w-24 bg-[#2A2D3E] rounded mb-4" />
                <div className="h-10 w-20 bg-[#2A2D3E] rounded" />
              </div>
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. PostHog funnel */}
            <Card title="PostHog funnel — gallery viewed">
              <BigNumber
                value={formatNumber(metrics.posthog?.galleryViewedLast15m)}
                sublabel="last 15 min"
              />
              <div className="mt-4 space-y-1">
                <MiniRow
                  label="Last hour"
                  value={formatNumber(metrics.posthog?.galleryViewedLast1h)}
                />
                <MiniRow
                  label="Last 24h"
                  value={formatNumber(metrics.posthog?.galleryViewedLast24h)}
                />
                <MiniRow
                  label="Template detail (24h)"
                  value={formatNumber(metrics.posthog?.templateDetailLast24h)}
                />
              </div>
            </Card>

            {/* 2. CLI installs */}
            <Card title="CLI installs">
              <BigNumber
                value={formatNumber(metrics.cliInstalls?.last24h)}
                sublabel="last 24h"
              />
              <div className="mt-4 space-y-1">
                <MiniRow
                  label="Last 15m"
                  value={formatNumber(metrics.cliInstalls?.last15m)}
                />
                <MiniRow
                  label="Last 1h"
                  value={formatNumber(metrics.cliInstalls?.last1h)}
                />
              </div>
            </Card>

            {/* 3. Scaffold success/fail ratio */}
            <Card title="Scaffold success rate" status={scaffoldStatus}>
              <BigNumber
                value={formatPercent(metrics.scaffolds?.successRate)}
                sublabel="last 24h"
              />
              <div className="mt-4 space-y-1">
                <MiniRow
                  label="Successes"
                  value={formatNumber(metrics.scaffolds?.successLast24h)}
                />
                <MiniRow
                  label="Failures"
                  value={formatNumber(metrics.scaffolds?.failedLast24h)}
                />
              </div>
            </Card>

            {/* 4. Stripe connections */}
            <Card title="Active Stripe Connect accounts">
              <BigNumber
                value={
                  metrics.stripeConnections == null
                    ? '--'
                    : `${formatNumber(metrics.stripeConnections.count)}${
                        metrics.stripeConnections.truncated ? '+' : ''
                      }`
                }
                sublabel={
                  metrics.stripeConnections?.truncated
                    ? 'charges_enabled = true (capped at 100; refresh page to re-query)'
                    : 'charges_enabled = true'
                }
              />
            </Card>

            {/* 5. DB latency */}
            <Card title="Database latency" status={dbStatus}>
              <BigNumber
                value={formatMs(metrics.dbLatency.p95Ms)}
                sublabel="p95 (last 5 min)"
              />
              <div className="mt-4 space-y-1">
                <MiniRow
                  label="p50"
                  value={formatMs(metrics.dbLatency.p50Ms)}
                />
              </div>
            </Card>

            {/* 6. HN post status */}
            <Card title="HN post">
              {metrics.hn ? (
                <>
                  <BigNumber
                    value={formatNumber(metrics.hn.points)}
                    sublabel={`points · rank ${
                      metrics.hn.rank ?? '—'
                    } · ${metrics.hn.descendants ?? 0} comments`}
                  />
                  <div className="mt-3">
                    <a
                      href={metrics.hn.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      {metrics.hn.title ?? metrics.hn.url}
                    </a>
                  </div>
                </>
              ) : (
                <BigNumber
                  value="--"
                  sublabel="set LAUNCH_HN_ITEM_ID after posting"
                />
              )}
            </Card>

            {/* 7. Sentry error count */}
            <Card title="Errors (last hour)" status={sentryStatus}>
              <BigNumber
                value={formatNumber(metrics.sentryErrorsLastHour)}
                sublabel="Sentry: level error+fatal"
              />
            </Card>
          </div>
        ) : null}

        {metrics?.generatedAt && (
          <p className="mt-6 text-xs text-gray-600">
            Server-generated at {new Date(metrics.generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
