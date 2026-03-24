'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface AdminStats {
  developers: { total: number; last24h: number; last7d: number; last30d: number }
  consumers: { total: number; last24h: number; last7d: number; last30d: number }
  tools: { total: number; active: number; draft: number }
  invocations: { total: number; last24h: number; last7d: number; last30d: number }
  revenue: { totalCents: number; last30dCents: number }
  payouts: { totalCents: number; pendingCents: number }
  recentSignups: { email: string; name: string | null; type: 'developer' | 'consumer'; createdAt: string }[]
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 font-medium">{value}</span>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stats')
      if (res.status === 403) {
        setError('Not authorized. Admin access required.')
        setLoading(false)
        return
      }
      if (res.status === 401) {
        setError('Authentication required. Please sign in first.')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(`Failed to load stats (${res.status})`)
        setLoading(false)
        return
      }
      const data = await res.json()
      setStats(data)
      setLastRefresh(new Date())
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (error) {
    // Show a generic 404-style page — don't reveal /admin exists
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-7xl font-bold text-gray-700 mb-4">404</p>
          <p className="text-gray-500 mb-6">This page could not be found.</p>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Go home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F1117] text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Platform metrics and recent activity
              {lastRefresh && (
                <span className="ml-2 text-gray-600">
                  Updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Main Dashboard
            </a>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading && !stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-5 animate-pulse">
                <div className="h-4 w-24 bg-[#2E3148] rounded mb-4" />
                <div className="h-8 w-16 bg-[#2E3148] rounded mb-2" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-[#2E3148] rounded" />
                  <div className="h-3 w-3/4 bg-[#2E3148] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {/* Developers */}
              <StatCard title="Developers">
                <Metric label="Total registered" value={formatNumber(stats.developers.total)} />
                <div className="mt-4 space-y-1.5">
                  <MiniStat label="Last 24h" value={`+${stats.developers.last24h}`} />
                  <MiniStat label="Last 7d" value={`+${stats.developers.last7d}`} />
                  <MiniStat label="Last 30d" value={`+${stats.developers.last30d}`} />
                </div>
              </StatCard>

              {/* Consumers */}
              <StatCard title="Consumers">
                <Metric label="Total registered" value={formatNumber(stats.consumers.total)} />
                <div className="mt-4 space-y-1.5">
                  <MiniStat label="Last 24h" value={`+${stats.consumers.last24h}`} />
                  <MiniStat label="Last 7d" value={`+${stats.consumers.last7d}`} />
                  <MiniStat label="Last 30d" value={`+${stats.consumers.last30d}`} />
                </div>
              </StatCard>

              {/* Tools */}
              <StatCard title="Tools">
                <Metric label="Total created" value={formatNumber(stats.tools.total)} />
                <div className="mt-4 space-y-1.5">
                  <MiniStat label="Active" value={stats.tools.active} />
                  <MiniStat label="Draft" value={stats.tools.draft} />
                </div>
              </StatCard>

              {/* Invocations */}
              <StatCard title="Invocations">
                <Metric label="Total calls" value={formatNumber(stats.invocations.total)} />
                <div className="mt-4 space-y-1.5">
                  <MiniStat label="Last 24h" value={`+${formatNumber(stats.invocations.last24h)}`} />
                  <MiniStat label="Last 7d" value={`+${formatNumber(stats.invocations.last7d)}`} />
                  <MiniStat label="Last 30d" value={`+${formatNumber(stats.invocations.last30d)}`} />
                </div>
              </StatCard>

              {/* Revenue */}
              <StatCard title="Revenue">
                <Metric label="Total earned" value={formatCurrency(stats.revenue.totalCents)} />
                <div className="mt-4 space-y-1.5">
                  <MiniStat label="Last 30d" value={formatCurrency(stats.revenue.last30dCents)} />
                </div>
              </StatCard>

              {/* Payouts */}
              <StatCard title="Payouts">
                <Metric label="Total paid out" value={formatCurrency(stats.payouts.totalCents)} />
                <div className="mt-4 space-y-1.5">
                  <MiniStat label="Pending" value={formatCurrency(stats.payouts.pendingCents)} />
                </div>
              </StatCard>
            </div>

            {/* Recent Signups */}
            <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2E3148]">
                <h3 className="text-sm font-medium text-gray-300">Recent Signups</h3>
              </div>
              {stats.recentSignups.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  No signups yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Recent signups">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 font-medium">Email</th>
                        <th className="px-5 py-3 font-medium">Name</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Signed up</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2E3148]">
                      {stats.recentSignups.map((s, i) => (
                        <tr key={`${s.email}-${s.type}-${i}`} className="hover:bg-[#252836] transition-colors">
                          <td className="px-5 py-3 text-gray-200 font-mono text-xs">{s.email}</td>
                          <td className="px-5 py-3 text-gray-400">{s.name ?? '-'}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                s.type === 'developer'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-blue-500/10 text-blue-400'
                              }`}
                            >
                              {s.type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{timeAgo(s.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
