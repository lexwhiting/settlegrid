'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { BarChart } from '@/components/charts/bar-chart'
import { AreaChart } from '@/components/charts/area-chart'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

type TimeRange = '7' | '30' | '90'

interface UsageRecord {
  id: string
  toolId: string
  toolName: string
  toolSlug: string
  method: string
  costCents: number
  latencyMs: number | null
  status: string
  createdAt: string
}

interface ToolSummary {
  toolId: string
  toolName: string
  toolSlug: string
  totalInvocations: number
  totalCostCents: number
}

interface UsageData {
  invocations: UsageRecord[]
  summary: ToolSummary[]
  period: { days: number; from: string; to: string }
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function AnalyticsPage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<TimeRange>('30')

  const fetchUsage = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/consumer/usage?days=${range}`)
      if (!res.ok) {
        setError('Failed to load usage analytics')
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError('Network error loading analytics')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  // Compute derived stats
  const totalInvocations = data?.invocations.length ?? 0
  const totalSpend = data?.invocations.reduce((sum, inv) => sum + inv.costCents, 0) ?? 0
  const avgCostPerCall = totalInvocations > 0 ? totalSpend / totalInvocations : 0
  const daysInRange = parseInt(range, 10)
  const dailyAvg = daysInRange > 0 ? totalSpend / daysInRange : 0
  const projectedMonthly = dailyAvg * 30

  // Group invocations by day for the chart
  const dailyMap = new Map<string, { invocations: number; costCents: number }>()
  for (const inv of data?.invocations ?? []) {
    const day = new Date(inv.createdAt).toISOString().split('T')[0]
    const existing = dailyMap.get(day)
    if (existing) {
      existing.invocations += 1
      existing.costCents += inv.costCents
    } else {
      dailyMap.set(day, { invocations: 1, costCents: inv.costCents })
    }
  }
  const dailyData = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Per-tool breakdown with last used
  const toolBreakdown = (data?.summary ?? []).map((tool) => {
    const toolInvocations = (data?.invocations ?? []).filter((inv) => inv.toolId === tool.toolId)
    const lastUsed = toolInvocations.length > 0
      ? toolInvocations.reduce((latest, inv) =>
          new Date(inv.createdAt) > new Date(latest.createdAt) ? inv : latest
        ).createdAt
      : null
    const avgCost = tool.totalInvocations > 0 ? tool.totalCostCents / tool.totalInvocations : 0
    return {
      ...tool,
      avgCostCents: avgCost,
      lastUsed,
    }
  }).sort((a, b) => b.totalCostCents - a.totalCostCents)

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Analytics' },
        ]} />
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Usage Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your API consumption and spending across all tools.</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Usage Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your API consumption and spending across all tools.</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#252836] rounded-lg p-1">
          {(['7', '30', '90'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-white dark:bg-[#1A1D2E] text-indigo dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Invocations"
          value={totalInvocations.toLocaleString()}
          subtitle={`Last ${range} days`}
        />
        <StatCard
          title="Total Spend"
          value={formatCents(totalSpend)}
          subtitle={`Last ${range} days`}
        />
        <StatCard
          title="Avg Cost / Call"
          value={formatCents(Math.round(avgCostPerCall))}
          subtitle="Across all tools"
        />
        <StatCard
          title="Projected Monthly"
          value={formatCents(Math.round(projectedMonthly))}
          subtitle="Based on current usage"
        />
      </div>

      {/* Daily Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Usage</CardTitle>
          <CardDescription>Invocations and cost per day over the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Invocations</p>
                <BarChart
                  data={dailyData}
                  xKey="date"
                  yKey="invocations"
                  height={160}
                  ariaLabel="Daily API invocations over the selected period"
                  formatXAxis={(v) =>
                    new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Cost</p>
                <AreaChart
                  data={dailyData}
                  xKey="date"
                  yKey="costCents"
                  height={160}
                  color="#3B82F6"
                  ariaLabel="Daily API cost over the selected period"
                  formatValue={(v) => formatCents(v)}
                  formatXAxis={(v) =>
                    new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                />
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No usage data for the selected period.</p>
          )}
        </CardContent>
      </Card>

      {/* Per-Tool Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per-Tool Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {toolBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Tool usage breakdown">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Tool</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Invocations</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Total Cost</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Avg Cost</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {toolBreakdown.map((tool) => (
                    <tr key={tool.toolId} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-medium text-indigo dark:text-gray-100">{tool.toolName}</span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">/{tool.toolSlug}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{tool.totalInvocations.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(tool.totalCostCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{formatCents(Math.round(tool.avgCostCents))}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                        {tool.lastUsed ? new Date(tool.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No tools used in this period. Start making API calls to see analytics.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
