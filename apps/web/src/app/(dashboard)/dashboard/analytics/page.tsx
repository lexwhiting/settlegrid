'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/dashboard/stat-card'
import { BarChart } from '@/components/charts/bar-chart'
import { AreaChart } from '@/components/charts/area-chart'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  totalRevenueCents: number
  totalInvocations: number
  toolCount: number
  recentInvocations: Array<{ hour: string; count: number; revenueCents: number }>
}

interface BasicMethodBreakdownItem {
  method: string
  count: number
  totalRevenueCents: number
  avgLatencyMs: number
  errorRate: number
}

interface BasicTopConsumer {
  consumerId: string
  totalSpendCents: number
  invocationCount: number
}

interface BasicAnalyticsData {
  methodBreakdown: BasicMethodBreakdownItem[]
  topConsumers: BasicTopConsumer[]
  hourlyDistribution: Array<{ hour: number; count: number }>
  latencyPercentiles: { p50: number; p95: number; p99: number }
  errorRate: number
  revenueTrend: Array<{ date: string; revenueCents: number }>
}

// Advanced types

interface RevenueTrendPoint {
  date: string
  revenueCents: number
  invocations: number
  previousRevenueCents: number
  previousInvocations: number
}

interface CohortMetrics {
  totalConsumers: number
  newConsumers: number
  returningConsumers: number
  retentionRate: number
  avgRevenuePerConsumer: number
}

interface LatencyBreakdown {
  toolId: string
  toolName: string
  p50: number
  p95: number
  p99: number
  sampleSize: number
}

interface ErrorTrendPoint {
  date: string
  totalCount: number
  errorCount: number
  errorRate: number
}

interface TopConsumerRow {
  consumerId: string
  totalSpendCents: number
  invocationCount: number
  avgCostCents: number
  firstSeen: string
  lastSeen: string
}

interface MethodRow {
  method: string
  count: number
  totalRevenueCents: number
  avgLatencyMs: number
  errorRate: number
  avgCostCents: number
}

interface HourlyHeatmapPoint {
  dayOfWeek: number
  hour: number
  count: number
}

interface CostEfficiencyPoint {
  date: string
  revenueCents: number
  invocations: number
  revenuePerInvocationCents: number
}

interface ReferralRow {
  referralCode: string
  invocations: number
  revenueCents: number
  uniqueConsumers: number
}

interface AdvancedAnalyticsData {
  revenueTrend: RevenueTrendPoint[]
  cohortMetrics: CohortMetrics
  latencyByTool: LatencyBreakdown[]
  errorTrend: ErrorTrendPoint[]
  topConsumers: TopConsumerRow[]
  methodBreakdown: MethodRow[]
  hourlyHeatmap: HourlyHeatmapPoint[]
  costEfficiency: CostEfficiencyPoint[]
  referralAttribution: ReferralRow[]
  periodDays: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

type Period = '7' | '30' | '90'

// ─── Heatmap Component ───────────────────────────────────────────────────────

function UsageHeatmap({ data }: { data: HourlyHeatmapPoint[] }) {
  const maxCount = Math.max(1, ...data.map((d) => d.count))

  // Build a lookup: [day][hour] = count
  const grid = new Map<string, number>()
  for (const d of data) {
    grid.set(`${d.dayOfWeek}-${d.hour}`, d.count)
  }

  function intensity(count: number): string {
    if (count === 0) return 'bg-gray-100 dark:bg-[#1A1D2B]'
    const ratio = count / maxCount
    if (ratio < 0.25) return 'bg-amber-100 dark:bg-amber-900/30'
    if (ratio < 0.5) return 'bg-amber-200 dark:bg-amber-800/40'
    if (ratio < 0.75) return 'bg-amber-300 dark:bg-amber-700/50'
    return 'bg-amber-400 dark:bg-amber-600/60'
  }

  return (
    <div role="img" aria-label="Usage heatmap by day of week and hour of day">
      {/* Hour labels */}
      <div className="flex gap-[2px] mb-1 ml-10">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center text-[9px] text-gray-400">
            {h % 6 === 0 ? `${h}h` : ''}
          </div>
        ))}
      </div>
      {/* Grid rows */}
      {Array.from({ length: 7 }, (_, dayIdx) => {
        const day = dayIdx + 1 // isodow: 1=Mon
        return (
          <div key={day} className="flex items-center gap-[2px] mb-[2px]">
            <span className="w-10 text-right text-[10px] text-gray-400 pr-2">{DAY_NAMES[dayIdx]}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const count = grid.get(`${day}-${h}`) ?? 0
              return (
                <div
                  key={h}
                  className={`flex-1 h-4 rounded-[2px] ${intensity(count)} transition-colors`}
                  title={`${DAY_NAMES[dayIdx]} ${h}:00 - ${count} calls`}
                />
              )
            })}
          </div>
        )
      })}
      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 ml-10">
        <span className="text-[10px] text-gray-400">Less</span>
        <div className="w-3 h-3 rounded-[2px] bg-gray-100 dark:bg-[#1A1D2B]" />
        <div className="w-3 h-3 rounded-[2px] bg-amber-100 dark:bg-amber-900/30" />
        <div className="w-3 h-3 rounded-[2px] bg-amber-200 dark:bg-amber-800/40" />
        <div className="w-3 h-3 rounded-[2px] bg-amber-300 dark:bg-amber-700/50" />
        <div className="w-3 h-3 rounded-[2px] bg-amber-400 dark:bg-amber-600/60" />
        <span className="text-[10px] text-gray-400">More</span>
      </div>
    </div>
  )
}

// ─── Upgrade Gate Component ──────────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Analytics' },
      ]} />

      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Advanced Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Deep insights into revenue, consumers, performance, and growth.
        </p>
      </div>

      {/* Preview cards (blurred/muted) */}
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 opacity-40 blur-[2px] pointer-events-none select-none" aria-hidden="true">
          <StatCard title="Consumer Retention" value="--%" subtitle="Returning consumers" />
          <StatCard title="Avg Revenue / Consumer" value="$--" subtitle="Per consumer" />
          <StatCard title="New Consumers" value="--" subtitle="This period" />
          <StatCard title="Revenue / Invocation" value="$--" subtitle="Avg cost per call" />
        </div>

        {/* Upgrade overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white dark:bg-[#161822] border border-gray-200 dark:border-[#2A2D3E] rounded-xl p-8 shadow-xl max-w-lg mx-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Unlock Advanced Analytics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The Scale plan includes advanced analytics with period-over-period comparisons, consumer cohort analysis, per-tool latency percentiles, error trend tracking, usage heatmaps, cost efficiency metrics, and referral attribution.
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 text-left space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Revenue trends with previous period comparison
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Consumer retention and cohort analysis
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Latency p50/p95/p99 per tool
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Error spike detection and daily error trends
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Peak usage heatmaps and referral attribution
              </li>
            </ul>
            <div className="flex items-center justify-center gap-3">
              <Link href="/pricing">
                <Button>Upgrade to Scale - $79/mo</Button>
              </Link>
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Additional blurred preview sections */}
      <div className="opacity-30 blur-[2px] pointer-events-none select-none space-y-6" aria-hidden="true">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend with Period Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-gray-50 dark:bg-[#161822] rounded-lg" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Consumer Cohort Analysis</CardTitle></CardHeader>
            <CardContent><div className="h-32 bg-gray-50 dark:bg-[#161822] rounded-lg" /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Peak Usage Heatmap</CardTitle></CardHeader>
            <CardContent><div className="h-32 bg-gray-50 dark:bg-[#161822] rounded-lg" /></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Referral Attribution</CardTitle></CardHeader>
          <CardContent><div className="h-24 bg-gray-50 dark:bg-[#161822] rounded-lg" /></CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [basicAnalytics, setBasicAnalytics] = useState<BasicAnalyticsData | null>(null)
  const [advanced, setAdvanced] = useState<AdvancedAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tierGated, setTierGated] = useState(false)
  const [period, setPeriod] = useState<Period>('30')

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    setError('')
    setTierGated(false)
    try {
      const [statsRes, analyticsRes, advancedRes] = await Promise.all([
        fetch('/api/dashboard/developer/stats'),
        fetch('/api/dashboard/developer/stats/analytics'),
        fetch(`/api/dashboard/developer/stats/advanced?period=${p}`),
      ])

      if (!statsRes.ok || !analyticsRes.ok) {
        setError('Failed to load analytics data')
        return
      }

      const statsJson = await statsRes.json() as StatsData
      const analyticsJson = await analyticsRes.json() as BasicAnalyticsData
      setStats(statsJson)
      setBasicAnalytics(analyticsJson)

      if (advancedRes.status === 403) {
        setTierGated(true)
      } else if (advancedRes.ok) {
        const advancedJson = await advancedRes.json() as AdvancedAnalyticsData
        setAdvanced(advancedJson)
      }
    } catch {
      setError('Network error loading analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [fetchData, period])

  // If tier-gated, show the upgrade gate
  if (!loading && tierGated) {
    return <UpgradeGate />
  }

  const totalInvocations = stats?.totalInvocations ?? 0
  const totalRevenue = stats?.totalRevenueCents ?? 0
  const toolCount = stats?.toolCount ?? 0
  const errorRate = basicAnalytics?.errorRate ?? 0

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Analytics' },
        ]} />
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Advanced Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Loading analytics data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 14 }, (_, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-t"
                  style={{ height: `${20 + ((i * 17) % 60)}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Analytics' },
      ]} />

      {/* Header with period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Advanced Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Deep insights into revenue, consumers, performance, and growth.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#252836] rounded-lg p-1">
          {(['7', '30', '90'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-white dark:bg-[#161822] text-indigo dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* ── Overview Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCents(totalRevenue)}
          subtitle="All time"
        />
        <StatCard
          title="Consumer Retention"
          value={`${advanced?.cohortMetrics.retentionRate ?? 0}%`}
          subtitle={`${advanced?.cohortMetrics.returningConsumers ?? 0} returning of ${advanced?.cohortMetrics.totalConsumers ?? 0}`}
        />
        <StatCard
          title="Avg Revenue / Consumer"
          value={formatCents(advanced?.cohortMetrics.avgRevenuePerConsumer ?? 0)}
          subtitle={`${period}d period`}
        />
        <StatCard
          title="Error Rate"
          value={`${errorRate}%`}
          subtitle="Across all tools"
          variant={errorRate > 5 ? 'danger' : 'default'}
        />
      </div>

      {/* ── Consumer Cohort Cards ───────────────────────────────────────── */}
      {advanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-indigo dark:text-gray-100">{formatNumber(advanced.cohortMetrics.totalConsumers)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active Consumers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatNumber(advanced.cohortMetrics.newConsumers)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">New Consumers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(advanced.cohortMetrics.returningConsumers)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Returning Consumers</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Revenue Trend with Period Comparison ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue Trend</CardTitle>
          <CardDescription>Daily revenue with previous period comparison (dashed line).</CardDescription>
        </CardHeader>
        <CardContent>
          {(advanced?.revenueTrend ?? []).length > 0 ? (
            <AreaChart
              data={advanced!.revenueTrend.map((r) => ({
                date: r.date,
                revenueCents: r.revenueCents,
                previousRevenueCents: r.previousRevenueCents,
              })) as unknown as Record<string, string | number>[]}
              xKey="date"
              yKey="revenueCents"
              yKeyPrevious="previousRevenueCents"
              height={240}
              color="#E5A336"
              ariaLabel={`Revenue trend over the last ${period} days with previous period comparison`}
              formatValue={(v) => formatCents(v)}
              formatXAxis={formatDate}
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No revenue data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Error Trend ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Error Rate Trend</CardTitle>
          <CardDescription>Daily error rate across all tools. Spikes indicate potential issues.</CardDescription>
        </CardHeader>
        <CardContent>
          {(advanced?.errorTrend ?? []).length > 0 ? (
            <AreaChart
              data={advanced!.errorTrend.map((e) => ({
                date: e.date,
                errorRate: e.errorRate,
              })) as unknown as Record<string, string | number>[]}
              xKey="date"
              yKey="errorRate"
              height={180}
              color="#EF4444"
              ariaLabel={`Error rate trend over the last ${period} days`}
              formatValue={(v) => `${v}%`}
              formatXAxis={formatDate}
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No error data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Cost Efficiency ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue per Invocation</CardTitle>
          <CardDescription>Average revenue earned per API call over time.</CardDescription>
        </CardHeader>
        <CardContent>
          {(advanced?.costEfficiency ?? []).length > 0 ? (
            <AreaChart
              data={advanced!.costEfficiency.map((c) => ({
                date: c.date,
                revenuePerCall: c.revenuePerInvocationCents,
              })) as unknown as Record<string, string | number>[]}
              xKey="date"
              yKey="revenuePerCall"
              height={180}
              color="#22C55E"
              ariaLabel="Revenue per invocation trend"
              formatValue={(v) => formatCents(v)}
              formatXAxis={formatDate}
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Two-column: Heatmap + Latency ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Usage Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Peak Usage Heatmap</CardTitle>
            <CardDescription>Invocation volume by day of week and hour (UTC).</CardDescription>
          </CardHeader>
          <CardContent>
            {(advanced?.hourlyHeatmap ?? []).length > 0 ? (
              <UsageHeatmap data={advanced!.hourlyHeatmap} />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No usage data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Latency Percentiles per Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latency by Tool</CardTitle>
            <CardDescription>p50, p95, p99 response times per tool.</CardDescription>
          </CardHeader>
          <CardContent>
            {(advanced?.latencyByTool ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" aria-label="Latency percentiles per tool">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                      <th scope="col" className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Tool</th>
                      <th scope="col" className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">p50</th>
                      <th scope="col" className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">p95</th>
                      <th scope="col" className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">p99</th>
                      <th scope="col" className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanced!.latencyByTool.map((t) => (
                      <tr key={t.toolId} className="border-b border-gray-100 dark:border-[#252836]">
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-indigo dark:text-gray-100 text-xs">{t.toolName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">{t.p50}ms</td>
                        <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">{t.p95}ms</td>
                        <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">{t.p99}ms</td>
                        <td className="py-2.5 px-3 text-right text-gray-500 dark:text-gray-400">{formatNumber(t.sampleSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No latency data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Method Breakdown ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Method Breakdown</CardTitle>
          <CardDescription>Performance and revenue by API method ({period}d period).</CardDescription>
        </CardHeader>
        <CardContent>
          {(advanced?.methodBreakdown ?? basicAnalytics?.methodBreakdown ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Method usage breakdown">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Method</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Calls</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Avg Latency</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Error Rate</th>
                    {advanced && <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Avg Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {(advanced?.methodBreakdown ?? []).map((m) => (
                    <tr key={m.method} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <code className="font-medium text-indigo dark:text-gray-100 bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{m.method}</code>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{formatNumber(m.count)}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(m.totalRevenueCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{m.avgLatencyMs}ms</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{m.errorRate}%</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{formatCents(m.avgCostCents)}</td>
                    </tr>
                  ))}
                  {!advanced && (basicAnalytics?.methodBreakdown ?? []).map((m) => (
                    <tr key={m.method} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <code className="font-medium text-indigo dark:text-gray-100 bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{m.method}</code>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{formatNumber(m.count)}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(m.totalRevenueCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{m.avgLatencyMs}ms</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{m.errorRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No method data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Top Consumers ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Consumers by Spend</CardTitle>
          <CardDescription>Your highest-value consumers with activity details ({period}d period).</CardDescription>
        </CardHeader>
        <CardContent>
          {(advanced?.topConsumers ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Top consumers by spend">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Consumer</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Total Spend</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Calls</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Avg Cost</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">First Seen</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {advanced!.topConsumers.map((c) => (
                    <tr key={c.consumerId} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs text-gray-600 dark:text-gray-400">
                          {c.consumerId.slice(0, 12)}...
                        </code>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(c.totalSpendCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{formatNumber(c.invocationCount)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{formatCents(c.avgCostCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{formatDate(c.firstSeen)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{formatDate(c.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No consumer data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Invocation Volume ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invocation Volume</CardTitle>
          <CardDescription>Daily invocation count ({period}d period).</CardDescription>
        </CardHeader>
        <CardContent>
          {(advanced?.revenueTrend ?? []).length > 0 ? (
            <BarChart
              data={advanced!.revenueTrend.map((r) => ({
                date: r.date,
                invocations: r.invocations,
              })) as unknown as Record<string, string | number>[]}
              xKey="date"
              yKey="invocations"
              height={180}
              ariaLabel={`Daily invocation volume over the last ${period} days`}
              formatValue={(v) => formatNumber(v)}
              formatXAxis={formatDate}
            />
          ) : (stats?.recentInvocations ?? []).length > 0 ? (
            <BarChart
              data={stats!.recentInvocations.map((r) => ({
                date: new Date(r.hour).toLocaleTimeString('en-US', { hour: 'numeric' }),
                invocations: r.count,
              }))}
              xKey="date"
              yKey="invocations"
              height={180}
              ariaLabel="Hourly API invocations over the last 24 hours"
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No invocation data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Referral Attribution ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Referral Attribution</CardTitle>
          <CardDescription>Revenue and traffic attributed to referral codes ({period}d period).</CardDescription>
        </CardHeader>
        <CardContent>
          {(advanced?.referralAttribution ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Referral code attribution">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Referral Code</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Invocations</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Unique Consumers</th>
                  </tr>
                </thead>
                <tbody>
                  {advanced!.referralAttribution.map((r) => (
                    <tr key={r.referralCode} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs text-gray-600 dark:text-gray-400">
                          {r.referralCode === 'direct' ? '(direct traffic)' : r.referralCode}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{formatNumber(r.invocations)}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(r.revenueCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{formatNumber(r.uniqueConsumers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No referral data yet. Referral codes will appear here when consumers use them.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Latency Percentiles (overall) ──────────────────────────────────── */}
      {basicAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overall Latency Percentiles</CardTitle>
            <CardDescription>Aggregate response time across all tools (all time).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-indigo dark:text-gray-100">{basicAnalytics.latencyPercentiles.p50}ms</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">p50 (median)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo dark:text-gray-100">{basicAnalytics.latencyPercentiles.p95}ms</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">p95</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo dark:text-gray-100">{basicAnalytics.latencyPercentiles.p99}ms</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">p99</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Summary Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Invocations"
          value={formatNumber(totalInvocations)}
          subtitle="All time"
        />
        <StatCard
          title="Active Tools"
          value={formatNumber(toolCount)}
          subtitle="Published tools"
        />
        <StatCard
          title="New Consumers"
          value={formatNumber(advanced?.cohortMetrics.newConsumers ?? 0)}
          subtitle={`Last ${period} days`}
        />
      </div>
    </div>
  )
}
