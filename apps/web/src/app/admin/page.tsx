'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface NuclearMetrics {
  statsCards: {
    totalDevelopers: number
    activeTools: number
    paidSubscribers: number
    mrrCents: number
    invocationsThisMonth: number
    organicToolsThisWeek: number
  }
  leadingIndicators: {
    activeConsumers: number
    referralInvitesSent: number
    referralConversions: number
    referralConversionRate: number
    badgeImpressions: number | null
  }
  signupsByDay: { date: string; count: number }[]
}

interface AdminStats {
  developers: { total: number; last24h: number; last7d: number; last30d: number }
  consumers: { total: number; last24h: number; last7d: number; last30d: number }
  tools: { total: number; active: number; draft: number }
  invocations: { total: number; last24h: number; last7d: number; last30d: number }
  revenue: { totalCents: number; last30dCents: number }
  payouts: { totalCents: number; pendingCents: number }
  recentSignups: { email: string; name: string | null; type: 'developer' | 'consumer'; createdAt: string }[]
}

interface FlaggedReview {
  id: string
  toolName: string
  toolSlug: string
  consumerEmail: string
  rating: number
  comment: string | null
  reportedAt: string | null
  status: string
  createdAt: string
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
    <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
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
  const [flaggedReviews, setFlaggedReviews] = useState<FlaggedReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewActionLoading, setReviewActionLoading] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<NuclearMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const res = await fetch('/api/admin/metrics')
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch {
      // Metrics section is supplementary — fail silently
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  const fetchFlaggedReviews = useCallback(async () => {
    setReviewsLoading(true)
    try {
      const res = await fetch('/api/admin/reviews?status=flagged')
      if (res.ok) {
        const data = await res.json()
        setFlaggedReviews(data.reviews ?? [])
      }
    } catch {
      // Silently fail — reviews section is supplementary
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  async function handleReviewAction(reviewId: string, action: 'hide' | 'dismiss') {
    setReviewActionLoading(reviewId)
    try {
      if (action === 'hide') {
        await fetch(`/api/admin/reviews/${reviewId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'hide', reason: 'abuse' }),
        })
      } else {
        // Dismiss flag = restore (clears reportedAt)
        await fetch(`/api/admin/reviews/${reviewId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        })
      }
      // Remove from local list
      setFlaggedReviews((prev) => prev.filter((r) => r.id !== reviewId))
    } catch {
      // Silently fail
    } finally {
      setReviewActionLoading(null)
    }
  }

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
    fetchFlaggedReviews()
    fetchMetrics()
  }, [fetchStats, fetchFlaggedReviews, fetchMetrics])

  if (error) {
    // Show a generic 404-style page — don't reveal /admin exists
    return (
      <div className="min-h-screen bg-[#0C0E14] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-7xl font-bold text-gray-700 mb-4">404</p>
          <p className="text-gray-500 mb-6">This page could not be found.</p>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Go home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0E14] text-gray-100">
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
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Main Dashboard
            </Link>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
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
              <div key={i} className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5 animate-pulse">
                <div className="h-4 w-24 bg-[#2A2D3E] rounded mb-4" />
                <div className="h-8 w-16 bg-[#2A2D3E] rounded mb-2" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-[#2A2D3E] rounded" />
                  <div className="h-3 w-3/4 bg-[#2A2D3E] rounded" />
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

            {/* Nuclear Expansion KPIs */}
            {metrics && (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-200 mb-4">Expansion KPIs</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard title="Total Developers">
                      <Metric label="All-time signups" value={formatNumber(metrics.statsCards.totalDevelopers)} />
                    </StatCard>
                    <StatCard title="Active Tools">
                      <Metric label="Status = active" value={formatNumber(metrics.statsCards.activeTools)} />
                    </StatCard>
                    <StatCard title="Paid Subscribers">
                      <Metric label="Tier != standard" value={formatNumber(metrics.statsCards.paidSubscribers)} />
                    </StatCard>
                    <StatCard title="MRR">
                      <Metric label="Monthly recurring revenue" value={formatCurrency(metrics.statsCards.mrrCents)} />
                    </StatCard>
                    <StatCard title="Invocations This Month">
                      <Metric label="Current calendar month" value={formatNumber(metrics.statsCards.invocationsThisMonth)} />
                    </StatCard>
                    <StatCard title="Organic Tools (7d)">
                      <Metric
                        label="Tools with non-founder invocations"
                        value={formatNumber(metrics.statsCards.organicToolsThisWeek)}
                      />
                    </StatCard>
                  </div>
                </div>

                {/* Signup Growth Chart (CSS bars) */}
                {metrics.signupsByDay.length > 0 && (
                  <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-4">Signups Per Day (Last 30 Days)</h3>
                    <div className="flex items-end gap-1 h-32" aria-label="Signups per day bar chart">
                      {(() => {
                        const maxCount = Math.max(...metrics.signupsByDay.map((d) => d.count), 1)
                        return metrics.signupsByDay.map((day) => {
                          const heightPct = Math.max((day.count / maxCount) * 100, 2)
                          const shortDate = day.date.slice(5) // MM-DD
                          return (
                            <div
                              key={day.date}
                              className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
                              title={`${day.date}: ${day.count} signups`}
                            >
                              <span className="text-[10px] text-gray-500 tabular-nums">{day.count > 0 ? day.count : ''}</span>
                              <div
                                className="w-full rounded-t bg-amber-500/80 transition-all duration-300 min-h-[2px]"
                                style={{ height: `${heightPct}%` }}
                              />
                              {metrics.signupsByDay.length <= 15 && (
                                <span className="text-[9px] text-gray-600 truncate max-w-full">{shortDate}</span>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                    {metrics.signupsByDay.length > 15 && (
                      <div className="flex justify-between mt-1 text-[9px] text-gray-600">
                        <span>{metrics.signupsByDay[0]?.date.slice(5)}</span>
                        <span>{metrics.signupsByDay[metrics.signupsByDay.length - 1]?.date.slice(5)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Leading Indicators */}
                <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5 mb-8">
                  <h3 className="text-sm font-medium text-gray-400 mb-4">Leading Indicators</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-gray-100">{formatNumber(metrics.leadingIndicators.activeConsumers)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Consumers with activity</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-100">{formatNumber(metrics.leadingIndicators.referralInvitesSent)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Referral invites sent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-100">
                        {metrics.leadingIndicators.referralConversionRate > 0
                          ? `${(metrics.leadingIndicators.referralConversionRate * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Referral conversion rate</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-100">
                        {metrics.leadingIndicators.badgeImpressions !== null
                          ? formatNumber(metrics.leadingIndicators.badgeImpressions)
                          : '--'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Badge impressions{metrics.leadingIndicators.badgeImpressions === null && (
                          <span className="ml-1 text-[10px] text-amber-500/80">tracking coming soon</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {metricsLoading && !metrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`m-${i}`} className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5 animate-pulse">
                    <div className="h-4 w-24 bg-[#2A2D3E] rounded mb-4" />
                    <div className="h-8 w-16 bg-[#2A2D3E] rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Recent Signups */}
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2A2D3E]">
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
                    <tbody className="divide-y divide-[#2A2D3E]">
                      {stats.recentSignups.map((s, i) => (
                        <tr key={`${s.email}-${s.type}-${i}`} className="hover:bg-[#252836] transition-colors">
                          <td className="px-5 py-3 text-gray-200 font-mono text-xs">{s.email}</td>
                          <td className="px-5 py-3 text-gray-400">{s.name ?? '-'}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                s.type === 'developer'
                                  ? 'bg-amber-500/10 text-amber-400'
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

            {/* Flagged Reviews */}
            <div className="mt-8 bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2A2D3E] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-300">Flagged Reviews</h3>
                  {flaggedReviews.length > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                      {flaggedReviews.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={fetchFlaggedReviews}
                  disabled={reviewsLoading}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
                >
                  {reviewsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              {flaggedReviews.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  No flagged reviews. All clear.
                </div>
              ) : (
                <div className="divide-y divide-[#2A2D3E]">
                  {flaggedReviews.map((review) => (
                    <div key={review.id} className="px-5 py-4 hover:bg-[#252836] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/tools/${review.toolSlug}`}
                              className="text-sm font-medium text-gray-200 hover:text-amber-400 transition-colors"
                            >
                              {review.toolName}
                            </Link>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-3 h-3 ${star <= review.rating ? 'text-yellow-400' : 'text-gray-600'}`}
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-gray-400 mb-1 line-clamp-2">{review.comment}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{review.consumerEmail}</span>
                            {review.reportedAt && (
                              <span className="text-red-400">Flagged {timeAgo(review.reportedAt)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleReviewAction(review.id, 'hide')}
                            disabled={reviewActionLoading === review.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            Hide
                          </button>
                          <button
                            onClick={() => handleReviewAction(review.id, 'dismiss')}
                            disabled={reviewActionLoading === review.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors disabled:opacity-50"
                          >
                            Dismiss Flag
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
