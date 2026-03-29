'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

interface ActivityItem {
  type: string
  category?: string
  toolType?: string
  toolTypeLabel?: string
  tool?: string
  timestamp: string
  message: string
}

interface ActivityData {
  activity: ActivityItem[]
  stats: {
    toolsToday: number
    invocationsLastHour: number
    developersThisWeek: number
    toolTypeBreakdown?: Record<string, number>
  }
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function activityIcon(type: string): string {
  switch (type) {
    case 'tool_published':
      return 'M12 4.5v15m7.5-7.5h-15'
    case 'invocation':
      return 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z'
    case 'developer_joined':
      return 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0'
    default:
      return 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
  }
}

/** Maps tool types to accent colors for the activity feed. */
const TOOL_TYPE_COLORS: Record<string, string> = {
  'mcp-server': 'text-[#E5A336]',
  'ai-model': 'text-[#8B5CF6]',
  'rest-api': 'text-[#0EA5E9]',
  'agent-tool': 'text-[#10B981]',
  automation: 'text-[#F97316]',
  extension: 'text-[#EC4899]',
  dataset: 'text-[#14B8A6]',
  'sdk-package': 'text-[#6366F1]',
}

function activityColor(type: string, toolType?: string): string {
  if (type === 'tool_published' && toolType && TOOL_TYPE_COLORS[toolType]) {
    return TOOL_TYPE_COLORS[toolType]
  }
  if (type === 'invocation' && toolType && TOOL_TYPE_COLORS[toolType]) {
    return TOOL_TYPE_COLORS[toolType]
  }
  switch (type) {
    case 'tool_published':
      return 'text-green-400'
    case 'invocation':
      return 'text-brand'
    case 'developer_joined':
      return 'text-blue-400'
    default:
      return 'text-gray-400'
  }
}

function AnimatedCounter({ value, label }: { value: number; label: string }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0)
      return
    }
    const duration = 1200
    const steps = 30
    const increment = value / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      current = Math.min(Math.round(increment * step), value)
      setDisplayValue(current)
      if (step >= steps) clearInterval(timer)
    }, duration / steps)

    return () => clearInterval(timer)
  }, [value])

  return (
    <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 text-center">
      <p className="text-3xl font-display font-bold text-brand tabular-nums">{displayValue.toLocaleString()}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  )
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity')
      if (!res.ok) {
        setError('Failed to load activity.')
        return
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30_000)
    return () => clearInterval(interval)
  }, [fetchActivity])

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Explore
            </Link>
            <Link href="/start" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Publish a Tool
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 space-y-2">
            <h1 className="text-4xl font-display font-bold text-gray-100">
              Marketplace <span className="text-brand">Pulse</span>
            </h1>
            <p className="text-gray-400">
              Real-time activity across AI models, APIs, agent tools, datasets, and more
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <svg className="w-8 h-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-label="Loading">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 text-center">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Stats counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <AnimatedCounter value={data.stats.toolsToday} label="Tools published today" />
                <AnimatedCounter value={data.stats.invocationsLastHour} label="Calls in the last hour" />
                <AnimatedCounter value={data.stats.developersThisWeek} label="New developers this week" />
              </div>

              {/* Activity feed */}
              <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#2A2D3E] flex items-center justify-between">
                  <h2 className="font-semibold text-gray-100">Recent Activity</h2>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    <span className="text-xs text-gray-500">Live</span>
                  </div>
                </div>

                {data.activity.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-gray-500">No recent activity. Check back soon!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#2A2D3E]">
                    {data.activity.map((item, i) => (
                      <div key={i} className="px-6 py-3.5 flex items-center gap-4 hover:bg-[#1E2030] transition-colors">
                        <div className={`flex-shrink-0 ${activityColor(item.type, item.toolType)}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d={activityIcon(item.type)} />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">{item.message}</p>
                          <div className="flex items-center gap-2">
                            {item.toolTypeLabel && (
                              <span className={`text-xs ${item.toolType ? (TOOL_TYPE_COLORS[item.toolType] ?? 'text-gray-500') : 'text-gray-500'}`}>
                                {item.toolTypeLabel}
                              </span>
                            )}
                            {item.toolTypeLabel && item.category && (
                              <span className="text-xs text-gray-600">&middot;</span>
                            )}
                            {item.category && (
                              <span className="text-xs text-gray-500">{item.category}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="mt-10 text-center space-y-4">
                <p className="text-gray-400">
                  Join the growing ecosystem of AI tool developers.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href="/start"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand text-white font-medium hover:bg-brand-dark transition-colors"
                  >
                    Publish Your Tool
                  </Link>
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#2A2D3E] text-gray-300 font-medium hover:bg-[#161822] transition-colors"
                  >
                    Browse Tools
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
          Powered by <Link href="/" className="text-brand-text hover:text-brand-dark">SettleGrid</Link>
          {' '}&mdash; The settlement layer for the AI economy
        </div>
      </footer>
    </div>
  )
}
