'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { BarChart } from '@/components/charts/bar-chart'
import { AreaChart } from '@/components/charts/area-chart'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

interface StatsData {
  totalRevenueCents: number
  totalInvocations: number
  toolCount: number
  recentInvocations: Array<{ hour: string; count: number; revenueCents: number }>
}

interface MethodBreakdownItem {
  method: string
  count: number
  totalRevenueCents: number
  avgLatencyMs: number
  errorRate: number
}

interface TopConsumer {
  consumerId: string
  totalSpendCents: number
  invocationCount: number
}

interface RevenueTrendItem {
  date: string
  revenueCents: number
}

interface AnalyticsData {
  methodBreakdown: MethodBreakdownItem[]
  topConsumers: TopConsumer[]
  hourlyDistribution: Array<{ hour: number; count: number }>
  latencyPercentiles: { p50: number; p95: number; p99: number }
  errorRate: number
  revenueTrend: RevenueTrendItem[]
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        fetch('/api/dashboard/developer/stats'),
        fetch('/api/dashboard/developer/stats/analytics'),
      ])
      if (!statsRes.ok || !analyticsRes.ok) {
        setError('Failed to load analytics data')
        return
      }
      const statsJson = await statsRes.json()
      const analyticsJson = await analyticsRes.json()
      setStats(statsJson)
      setAnalytics(analyticsJson)
    } catch {
      setError('Network error loading analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalInvocations = stats?.totalInvocations ?? 0
  const totalRevenue = stats?.totalRevenueCents ?? 0
  const toolCount = stats?.toolCount ?? 0
  const errorRate = analytics?.errorRate ?? 0

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Analytics' },
        ]} />
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Developer Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your tools&apos; performance, revenue, and consumer activity.</p>
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Analytics' },
      ]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Developer Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your tools&apos; performance, revenue, and consumer activity.</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Invocations"
          value={totalInvocations.toLocaleString()}
          subtitle="All time"
        />
        <StatCard
          title="Total Revenue"
          value={formatCents(totalRevenue)}
          subtitle="All time"
        />
        <StatCard
          title="Active Tools"
          value={toolCount.toLocaleString()}
          subtitle="Published tools"
        />
        <StatCard
          title="Error Rate"
          value={`${errorRate}%`}
          subtitle="Across all tools"
        />
      </div>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue Trend</CardTitle>
          <CardDescription>Daily revenue over the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {(analytics?.revenueTrend ?? []).length > 0 ? (
            <AreaChart
              data={analytics!.revenueTrend as unknown as Record<string, string | number>[]}
              xKey="date"
              yKey="revenueCents"
              height={200}
              color="#E5A336"
              ariaLabel="Daily revenue trend over the last 30 days"
              formatValue={(v) => formatCents(v)}
              formatXAxis={(v) =>
                new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No revenue data yet. Revenue will appear here once consumers start using your tools.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity (hourly) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity (24h)</CardTitle>
          <CardDescription>Invocations per hour over the last 24 hours.</CardDescription>
        </CardHeader>
        <CardContent>
          {(stats?.recentInvocations ?? []).length > 0 ? (
            <BarChart
              data={stats!.recentInvocations.map((r) => ({
                date: new Date(r.hour).toLocaleTimeString('en-US', { hour: 'numeric' }),
                invocations: r.count,
              }))}
              xKey="date"
              yKey="invocations"
              height={160}
              ariaLabel="Hourly API invocations over the last 24 hours"
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No invocations in the last 24 hours.</p>
          )}
        </CardContent>
      </Card>

      {/* Method Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Method Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {(analytics?.methodBreakdown ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Method usage breakdown">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Method</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Invocations</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Avg Latency</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics!.methodBreakdown.map((m) => (
                    <tr key={m.method} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <code className="font-medium text-indigo dark:text-gray-100 bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{m.method}</code>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{m.count.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(m.totalRevenueCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{m.avgLatencyMs}ms</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{m.errorRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No method data yet. Analytics will appear once your tools receive invocations.</p>
          )}
        </CardContent>
      </Card>

      {/* Top Consumers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Consumers</CardTitle>
        </CardHeader>
        <CardContent>
          {(analytics?.topConsumers ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Top consumers by spend">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Consumer ID</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Total Spend</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Invocations</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics!.topConsumers.map((c) => (
                    <tr key={c.consumerId} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs text-gray-600 dark:text-gray-400">
                          {c.consumerId.slice(0, 12)}...
                        </code>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(c.totalSpendCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{c.invocationCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No consumers yet. Consumer activity will appear here once your tools are being used.</p>
          )}
        </CardContent>
      </Card>

      {/* Latency Percentiles */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latency Percentiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-indigo dark:text-gray-100">{analytics.latencyPercentiles.p50}ms</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">p50 (median)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo dark:text-gray-100">{analytics.latencyPercentiles.p95}ms</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">p95</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo dark:text-gray-100">{analytics.latencyPercentiles.p99}ms</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">p99</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
