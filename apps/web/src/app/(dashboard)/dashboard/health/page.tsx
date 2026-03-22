'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

interface Tool {
  id: string
  name: string
  slug: string
  healthEndpoint: string | null
}

interface HealthData {
  toolId: string
  toolName: string
  currentStatus: string
  lastCheckedAt: string | null
  uptimePct30d: number
  avgResponseTimeMs: number
  incidents?: Array<{
    status: string
    responseTimeMs: number | null
    checkedAt: string
  }>
  totalChecks30d?: number
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'up'
    ? 'success' as const
    : status === 'degraded'
      ? 'warning' as const
      : status === 'down'
        ? 'destructive' as const
        : 'secondary' as const

  return <Badge variant={variant}>{status}</Badge>
}

export default function HealthPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [healthMap, setHealthMap] = useState<Record<string, HealthData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function fetchData() {
    setError('')
    try {
      // Fetch tools to get the list with health endpoints
      const toolsRes = await fetch('/api/tools')
      if (!toolsRes.ok) {
        setError('Failed to load tools')
        setLoading(false)
        return
      }
      const toolsJson = await toolsRes.json()
      const toolList: Tool[] = toolsJson.tools ?? []
      setTools(toolList)

      // Fetch health data for each tool that has a health endpoint
      const healthPromises = toolList
        .filter((t) => t.healthEndpoint)
        .map(async (t) => {
          try {
            const res = await fetch(`/api/tools/${t.id}/health`)
            if (res.ok) {
              const json = await res.json()
              return json as HealthData
            }
          } catch {
            // Silently skip failed health fetches
          }
          return null
        })

      const results = await Promise.all(healthPromises)
      const map: Record<string, HealthData> = {}
      for (const result of results) {
        if (result) {
          map[result.toolId] = result
        }
      }
      setHealthMap(map)
    } catch {
      setError('Network error loading health data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const monitoredTools = tools.filter((t) => t.healthEndpoint)
  const healthEntries = monitoredTools.map((t) => healthMap[t.id]).filter(Boolean) as HealthData[]

  // Overall stats
  const currentUptime = healthEntries.length > 0
    ? Math.round(healthEntries.reduce((sum, h) => sum + h.uptimePct30d, 0) / healthEntries.length * 100) / 100
    : 100
  const avgResponseTime = healthEntries.length > 0
    ? Math.round(healthEntries.reduce((sum, h) => sum + h.avgResponseTimeMs, 0) / healthEntries.length)
    : 0
  const incidentsToday = healthEntries.reduce((count, h) => {
    const todayIncidents = (h.incidents ?? []).filter((inc) => {
      const checked = new Date(inc.checkedAt)
      const today = new Date()
      return checked.toDateString() === today.toDateString()
    })
    return count + todayIncidents.length
  }, 0)

  // Collect all recent incidents across all tools for the timeline
  const allIncidents = healthEntries.flatMap((h) =>
    (h.incidents ?? []).map((inc) => ({
      toolName: h.toolName,
      toolId: h.toolId,
      ...inc,
    }))
  ).sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
    .slice(0, 20)

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Health' },
        ]} />
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Tool Health Monitoring</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monitor the uptime and performance of your registered tools.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
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
        { label: 'Health' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Tool Health Monitoring</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monitor the uptime and performance of your registered tools.</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Tools Monitored"
          value={String(monitoredTools.length)}
          subtitle={`${tools.length} total tools`}
        />
        <StatCard
          title="Current Uptime"
          value={`${currentUptime}%`}
          subtitle="Average across all tools"
        />
        <StatCard
          title="Avg Response Time"
          value={`${avgResponseTime}ms`}
          subtitle="Last 30 days"
        />
        <StatCard
          title="Incidents Today"
          value={String(incidentsToday)}
          subtitle="Down or degraded events"
        />
      </div>

      {/* Tool Health Cards */}
      {monitoredTools.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-2">No tools with health endpoints configured.</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Add a health endpoint URL to your tools to enable monitoring.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {monitoredTools.map((tool) => {
            const health = healthMap[tool.id]
            return (
              <Card key={tool.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-indigo dark:text-gray-100">{tool.name}</h3>
                    <StatusBadge status={health?.currentStatus ?? 'unknown'} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Response Time</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">
                        {health ? `${health.avgResponseTimeMs}ms` : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Uptime (30d)</dt>
                      <dd className={`font-medium ${
                        health && health.uptimePct30d < 99 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {health ? `${health.uptimePct30d}%` : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Last Checked</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">
                        {health?.lastCheckedAt
                          ? new Date(health.lastCheckedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Total Checks</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">
                        {health?.totalChecks30d?.toLocaleString() ?? '-'}
                      </dd>
                    </div>
                  </dl>
                  {/* Uptime bar */}
                  {health && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            health.uptimePct30d >= 99.5 ? 'bg-green-500' :
                            health.uptimePct30d >= 95 ? 'bg-yellow-500' : 'bg-red-50 dark:bg-red-900/200'
                          }`}
                          style={{ width: `${Math.min(100, health.uptimePct30d)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Health History Timeline */}
      {allIncidents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Incidents</CardTitle>
            <CardDescription>Down or degraded health check results across all tools.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Recent health incidents">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Timestamp</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Tool</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {allIncidents.map((inc, i) => (
                    <tr key={`${inc.toolId}-${i}`} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                        {new Date(inc.checkedAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 font-medium text-indigo dark:text-gray-100">{inc.toolName}</td>
                      <td className="py-3 px-4"><StatusBadge status={inc.status} /></td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                        {inc.responseTimeMs ? `${inc.responseTimeMs}ms` : '-'}
                      </td>
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
