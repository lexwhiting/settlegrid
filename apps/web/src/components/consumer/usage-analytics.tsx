'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type Period = '7d' | '30d' | '90d'

interface DailyEntry {
  date: string
  count: number
  totalCostCents: number
}

interface ToolEntry {
  toolId: string
  toolName: string
  count: number
  totalCostCents: number
}

interface AnalyticsData {
  dailyTrend: DailyEntry[]
  byTool: ToolEntry[]
  projectedMonthlySpendCents: number
  avgDailyCostCents: number
}

function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(safe / 100)
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

export function UsageAnalytics() {
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  const fetchAnalytics = useCallback(async (selectedPeriod: Period) => {
    setLoading(true)
    setError('')

    try {
      // The analytics endpoint always returns last 30 days.
      // For 7d/90d, we use the usage endpoint with a days param and aggregate client-side.
      const days = PERIOD_DAYS[selectedPeriod]

      if (selectedPeriod === '30d') {
        const res = await fetch('/api/consumer/usage/analytics')
        if (!res.ok) {
          setError('Failed to load analytics')
          return
        }
        const json: AnalyticsData = await res.json()
        setData(json)
      } else {
        // Use the usage endpoint which supports a days param
        const res = await fetch(`/api/consumer/usage?days=${days}`)
        if (!res.ok) {
          setError('Failed to load analytics')
          return
        }
        const json: {
          invocations: Array<{
            toolId: string
            toolName: string
            costCents: number
            createdAt: string
          }>
          summary: Array<{
            toolId: string
            toolName: string
            totalInvocations: number
            totalCostCents: number
          }>
        } = await res.json()

        // Aggregate into daily trend
        const dailyMap = new Map<string, { count: number; totalCostCents: number }>()
        const toolMap = new Map<string, { toolId: string; toolName: string; count: number; totalCostCents: number }>()

        for (const inv of json.invocations) {
          const dateStr = new Date(inv.createdAt).toISOString().split('T')[0]
          const dayEntry = dailyMap.get(dateStr)
          if (dayEntry) {
            dayEntry.count += 1
            dayEntry.totalCostCents += inv.costCents
          } else {
            dailyMap.set(dateStr, { count: 1, totalCostCents: inv.costCents })
          }

          const toolEntry = toolMap.get(inv.toolId)
          if (toolEntry) {
            toolEntry.count += 1
            toolEntry.totalCostCents += inv.costCents
          } else {
            toolMap.set(inv.toolId, {
              toolId: inv.toolId,
              toolName: inv.toolName,
              count: 1,
              totalCostCents: inv.costCents,
            })
          }
        }

        const dailyTrend = Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({ date, count: d.count, totalCostCents: d.totalCostCents }))

        const byTool = Array.from(toolMap.values()).sort(
          (a, b) => b.totalCostCents - a.totalCostCents
        )

        const totalCost = json.invocations.reduce((s, i) => s + i.costCents, 0)
        const daysWithData = dailyMap.size || 1
        const avgDailyCostCents = Math.round(totalCost / daysWithData)

        setData({
          dailyTrend,
          byTool,
          projectedMonthlySpendCents: avgDailyCostCents * 30,
          avgDailyCostCents,
        })
      }
    } catch {
      setError('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics(period)
  }, [period, fetchAnalytics])

  const handlePeriodChange = (p: Period) => {
    setPeriod(p)
  }

  // Compute chart max for scaling
  const maxDailyCents = data
    ? Math.max(...data.dailyTrend.map((d) => d.totalCostCents), 1)
    : 1
  const maxToolCents = data
    ? Math.max(...data.byTool.map((t) => t.totalCostCents), 1)
    : 1

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2" role="group" aria-label="Select analytics time period">
        {(['7d', '30d', '90d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            aria-pressed={period === p}
            aria-label={`Show ${p === '7d' ? '7 day' : p === '30d' ? '30 day' : '90 day'} analytics`}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              period === p
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 dark:bg-[#252836] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2A2D3E]'
            }`}
          >
            {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              No analytics data available. Usage data will appear here after your first API call.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Daily Spend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Spend</CardTitle>
            </CardHeader>
            <CardContent>
              {data.dailyTrend.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                  No usage data for this period.
                </p>
              ) : (
                <div className="relative" role="img" aria-label="Daily spend bar chart">
                  {/* Bar chart */}
                  <div className="flex items-end gap-px" style={{ height: 200 }}>
                    {data.dailyTrend.map((day, idx) => {
                      const heightPercent =
                        maxDailyCents > 0
                          ? (day.totalCostCents / maxDailyCents) * 100
                          : 0
                      const isHovered = hoveredBar === idx

                      return (
                        <div
                          key={day.date}
                          className="flex-1 flex flex-col items-center justify-end relative"
                          style={{ height: '100%' }}
                          onMouseEnter={() => setHoveredBar(idx)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          {/* Tooltip */}
                          {isHovered && (
                            <div className="absolute bottom-full mb-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap z-10 pointer-events-none shadow-lg">
                              <p className="font-medium">{formatDateShort(day.date)}</p>
                              <p>{formatCents(day.totalCostCents)}</p>
                              <p className="text-gray-400 dark:text-gray-500">
                                {day.count} call{day.count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          )}
                          {/* Bar */}
                          <div
                            className={`w-full rounded-t transition-colors ${
                              isHovered
                                ? 'bg-amber-400 dark:bg-amber-300'
                                : 'bg-amber-500 dark:bg-amber-500'
                            }`}
                            style={{
                              height: `${Math.max(heightPercent, day.totalCostCents > 0 ? 2 : 0)}%`,
                              minHeight: day.totalCostCents > 0 ? 2 : 0,
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* X-axis labels */}
                  <div className="flex gap-px mt-2">
                    {data.dailyTrend.map((day, idx) => {
                      const total = data.dailyTrend.length
                      const interval = total <= 7 ? 1 : total <= 14 ? 2 : total <= 30 ? 5 : 10
                      const showLabel = idx % interval === 0 || idx === total - 1

                      return (
                        <div key={day.date} className="flex-1 text-center">
                          {showLabel && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              {formatDateShort(day.date)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Per-tool Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Spend by Tool</CardTitle>
            </CardHeader>
            <CardContent>
              {data.byTool.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                  No tool usage data for this period.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.byTool.map((tool) => {
                    const widthPercent =
                      maxToolCents > 0
                        ? (tool.totalCostCents / maxToolCents) * 100
                        : 0

                    return (
                      <div key={tool.toolId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mr-3">
                            {tool.toolName}
                          </span>
                          <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300 shrink-0">
                            {formatCents(tool.totalCostCents)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full bg-amber-500 transition-all"
                            style={{
                              width: `${Math.max(widthPercent, tool.totalCostCents > 0 ? 1 : 0)}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {tool.count} invocation{tool.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Projection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatCents(data.projectedMonthlySpendCents)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  projected this month
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                At this rate, you will spend ~
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {formatCents(data.projectedMonthlySpendCents)}
                </span>{' '}
                this month based on an average of{' '}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {formatCents(data.avgDailyCostCents)}
                </span>{' '}
                per day.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
