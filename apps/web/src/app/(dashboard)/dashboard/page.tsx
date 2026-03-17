'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { BarChart } from '@/components/charts/bar-chart'
import { AreaChart } from '@/components/charts/area-chart'

interface DeveloperStats {
  totalRevenueCents: number
  totalInvocations: number
  toolCount: number
  recentInvocations: { hour: string; count: number; revenueCents?: number }[]
}

interface AnalyticsData {
  methodBreakdown: { method: string; invocations: number; revenueCents: number; errorRate: number }[]
  revenueTrend: { date: string; revenueCents: number }[]
  topConsumers: { email: string; totalSpendCents: number; invocations: number }[]
  errorRate: number
  latency: { p50: number; p95: number; p99: number }
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

type Period = '7' | '30' | '90'

export default function DeveloperDashboardPage() {
  const [stats, setStats] = useState<DeveloperStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<Period>('30')

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, analyticsRes] = await Promise.all([
          fetch('/api/dashboard/developer/stats'),
          fetch('/api/dashboard/developer/stats/analytics'),
        ])
        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.data)
        } else {
          setError('Failed to load dashboard data')
        }
        if (analyticsRes.ok) {
          const data = await analyticsRes.json()
          setAnalytics(data.data)
        }
      } catch {
        setError('Network error loading dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />
        <h1 className="text-2xl font-bold text-indigo">Dashboard</h1>
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

  if (error) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />
        <h1 className="text-2xl font-bold text-indigo">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm" role="alert">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />

      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo">Dashboard</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['7', '30', '90'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-white text-indigo shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCents(stats?.totalRevenueCents ?? 0)}
          subtitle="80% of consumer spend"
        />
        <StatCard
          title="Total Invocations"
          value={(stats?.totalInvocations ?? 0).toLocaleString()}
          subtitle="All-time tool calls"
        />
        <StatCard
          title="Active Tools"
          value={String(stats?.toolCount ?? 0)}
          subtitle="Published tools"
        />
        <StatCard
          title="Revenue (24h)"
          value={formatCents(
            (stats?.recentInvocations ?? []).reduce((sum, r) => sum + (r.revenueCents ?? 0), 0)
          )}
          subtitle="Last 24 hours"
        />
      </div>

      {/* Error Rate & Latency */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Error Rate"
            value={`${(analytics.errorRate * 100).toFixed(2)}%`}
            subtitle="Last 30 days"
          />
          <StatCard
            title="Latency (p50)"
            value={`${analytics.latency.p50}ms`}
            subtitle="Median response time"
          />
          <StatCard
            title="Latency (p95)"
            value={`${analytics.latency.p95}ms`}
            subtitle="95th percentile"
          />
          <StatCard
            title="Latency (p99)"
            value={`${analytics.latency.p99}ms`}
            subtitle="99th percentile"
          />
        </div>
      )}

      {/* Invocation chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invocations (Last 24 Hours)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentInvocations && stats.recentInvocations.length > 0 ? (
            <BarChart
              data={stats.recentInvocations.map((point, i) => ({
                hour: point.hour || String(i),
                count: point.count,
              }))}
              xKey="hour"
              yKey="count"
              height={200}
              ariaLabel="Invocations per hour over the last 24 hours"
              formatXAxis={(v) => {
                const h = parseInt(v, 10)
                return isNaN(h) ? v : `${h}:00`
              }}
            />
          ) : (
            <p className="text-gray-500 text-sm">No invocations yet. Publish a tool to get started.</p>
          )}
        </CardContent>
      </Card>

      {/* Revenue Trend */}
      {analytics?.revenueTrend && analytics.revenueTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart
              data={analytics.revenueTrend.map((day) => ({
                date: day.date,
                revenue: day.revenueCents,
              }))}
              xKey="date"
              yKey="revenue"
              height={220}
              ariaLabel="Revenue trend over the last 30 days"
              formatValue={(v) =>
                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v / 100)
              }
              formatXAxis={(v) =>
                new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Method Breakdown */}
      {analytics?.methodBreakdown && analytics.methodBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Method breakdown">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Method</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Invocations</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Revenue</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.methodBreakdown.map((method) => (
                    <tr key={method.method} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{method.method}</code>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">{method.invocations.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo">{formatCents(method.revenueCents)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={method.errorRate > 0.05 ? 'text-red-600' : 'text-gray-500'}>
                          {(method.errorRate * 100).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Consumers */}
      {analytics?.topConsumers && analytics.topConsumers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Consumers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Top consumers">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">#</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Consumer</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Total Spend</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Invocations</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topConsumers.slice(0, 5).map((consumer, i) => (
                    <tr key={consumer.email} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-500 font-medium">{i + 1}</td>
                      <td className="py-3 px-4 text-gray-700">{consumer.email}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo">{formatCents(consumer.totalSpendCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500">{consumer.invocations.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
