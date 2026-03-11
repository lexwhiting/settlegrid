'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DeveloperStats {
  totalRevenueCents: number
  totalInvocations: number
  toolCount: number
  recentInvocations: { hour: string; count: number }[]
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-indigo">{value}</div>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

export default function DeveloperDashboardPage() {
  const [stats, setStats] = useState<DeveloperStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/developer/stats')
        if (!res.ok) {
          setError('Failed to load dashboard data')
          return
        }
        const data = await res.json()
        setStats(data.data)
      } catch {
        setError('Network error loading dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-indigo">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-20" />
                <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
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
        <h1 className="text-2xl font-bold text-indigo">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm" role="alert">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-indigo">Dashboard</h1>

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
            (stats?.recentInvocations ?? []).reduce((sum, r) => sum + r.count, 0) * 1
          )}
          subtitle="Last 24 hours"
        />
      </div>

      {/* Invocation chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invocations (Last 24 Hours)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentInvocations && stats.recentInvocations.length > 0 ? (
            <div className="flex items-end gap-1 h-40">
              {stats.recentInvocations.map((point, i) => {
                const max = Math.max(...stats.recentInvocations.map((p) => p.count), 1)
                const height = (point.count / max) * 100
                return (
                  <div
                    key={i}
                    className="flex-1 bg-brand/20 hover:bg-brand/40 rounded-t transition-colors relative group"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-indigo text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {point.count} calls
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No invocations yet. Publish a tool to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
