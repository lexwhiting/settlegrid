'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FraudSignal {
  name: string
  displayName: string
  description: string
  threshold: string
  status: 'active' | 'degraded'
  scannedToday: number
  flaggedThisWeek: number
  lastTriggeredAt: string | null
  riskContribution: string
  redisKeyPattern: string
  fallbackBehavior: string
  category: string
}

interface SignalCategory {
  id: string
  label: string
  signals: string[]
}

interface SignalsSummary {
  totalSignals: number
  activeSignals: number
  degradedSignals: number
  scannedToday: number
  flaggedThisWeek: number
  redisHealthy: boolean
}

interface SignalsResponse {
  signals: FraudSignal[]
  categories: SignalCategory[]
  summary: SignalsSummary
}

interface SecurityItem {
  id: string
  title: string
  priority: 'critical' | 'recommended' | 'built-in'
  completed: boolean
  statusDetail: string
  href: string
  steps: string[]
  comingSoon?: boolean
}

interface SecurityResponse {
  items: SecurityItem[]
  summary: {
    completed: number
    total: number
    percentage: number
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'

  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'Just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'active' | 'degraded' | 'inactive' }) {
  if (status === 'active') {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
    )
  }
  if (status === 'degraded') {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
      </span>
    )
  }
  return <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-400 shrink-0" />
}

function SignalCard({ signal }: { signal: FraudSignal }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-100 dark:border-[#252836] rounded-lg p-4 transition-all hover:border-gray-200 dark:hover:border-[#353849]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <StatusDot status={signal.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm text-indigo dark:text-gray-100 truncate">
              {signal.displayName}
            </h4>
            <Badge variant={signal.status === 'active' ? 'success' : 'warning'}>
              {signal.status}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 leading-relaxed">
            {signal.description}
          </p>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Threshold:</span>
            <code className="text-xs bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded font-mono">
              {signal.threshold}
            </code>
          </div>

          {/* Micro-stats */}
          <div className="flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-gray-400 dark:text-gray-500">Scanned today</span>
              <span className="ml-1.5 font-semibold text-indigo dark:text-gray-200">
                {formatNumber(signal.scannedToday)}
              </span>
            </div>
            <div>
              <span className="text-gray-400 dark:text-gray-500">Flagged this week</span>
              <span className="ml-1.5 font-semibold text-indigo dark:text-gray-200">
                {formatNumber(signal.flaggedThisWeek)}
              </span>
            </div>
            <div>
              <span className="text-gray-400 dark:text-gray-500">Last triggered</span>
              <span className="ml-1.5 font-semibold text-indigo dark:text-gray-200">
                {relativeTime(signal.lastTriggeredAt)}
              </span>
            </div>
          </div>

          {/* Expandable details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-xs text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-brand font-medium inline-flex items-center gap-1 transition-colors"
          >
            {expanded ? 'Hide details' : 'Show details'}
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <div
            className={`overflow-hidden transition-all duration-200 ${
              expanded ? 'max-h-48 mt-3 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-2 text-xs border-t border-gray-100 dark:border-[#252836] pt-3">
              <div className="flex gap-2">
                <span className="text-gray-400 dark:text-gray-500 shrink-0 w-28">Risk contribution:</span>
                <span className="text-gray-600 dark:text-gray-300">{signal.riskContribution}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 dark:text-gray-500 shrink-0 w-28">Redis key:</span>
                <code className="text-gray-600 dark:text-gray-300 font-mono break-all">{signal.redisKeyPattern}</code>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 dark:text-gray-500 shrink-0 w-28">Fallback:</span>
                <span className="text-gray-600 dark:text-gray-300">{signal.fallbackBehavior}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CategorySection({
  category,
  signals,
  defaultOpen,
}: {
  category: SignalCategory
  signals: FraudSignal[]
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const categorySignals = signals.filter((s) => s.category === category.id)
  const activeCount = categorySignals.filter((s) => s.status === 'active').length
  const degradedCount = categorySignals.filter((s) => s.status === 'degraded').length

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left group"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-indigo dark:text-gray-100">
            {category.label}
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {activeCount} active{degradedCount > 0 ? `, ${degradedCount} degraded` : ''}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 group-hover:text-gray-600 dark:group-hover:text-gray-300 ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
          {categorySignals.map((signal) => (
            <SignalCard key={signal.name} signal={signal} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CheckIcon({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 shrink-0">
        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />
  )
}

function PriorityBadge({ priority }: { priority: 'critical' | 'recommended' | 'built-in' }) {
  switch (priority) {
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>
    case 'recommended':
      return <Badge variant="warning">Recommended</Badge>
    case 'built-in':
      return <Badge variant="success">Built-in</Badge>
  }
}

function SecurityItemRow({ item }: { item: SecurityItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`border rounded-lg p-4 transition-all ${
      item.completed
        ? 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-900/10'
        : 'border-gray-100 dark:border-[#252836]'
    }`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <CheckIcon completed={item.completed} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-semibold text-sm text-indigo dark:text-gray-100">
              {item.title}
            </h4>
            <PriorityBadge priority={item.priority} />
            {item.comingSoon && (
              <Badge variant="secondary">Coming soon</Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.statusDetail}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {!item.completed && !item.comingSoon && (
              <Link href={item.href}>
                <Button size="sm" variant="outline">
                  Do it now
                </Button>
              </Link>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-brand font-medium inline-flex items-center gap-1 transition-colors"
            >
              {expanded ? 'Hide steps' : 'View steps'}
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ${
              expanded ? 'max-h-64 mt-3 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <ol className="space-y-1.5 border-t border-gray-100 dark:border-[#252836] pt-3">
              {item.steps.map((step, i) => (
                <li key={i} className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed flex gap-2">
                  <span className="font-semibold text-gray-400 dark:text-gray-500 shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function FraudPageSkeleton() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Fraud Detection' },
      ]} />
      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Fraud Detection & Security</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Loading fraud signal data...</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FraudPage() {
  const [signalsData, setSignalsData] = useState<SignalsResponse | null>(null)
  const [securityData, setSecurityData] = useState<SecurityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [signalsRes, securityRes] = await Promise.all([
        fetch('/api/dashboard/developer/fraud/signals'),
        fetch('/api/dashboard/developer/security-status'),
      ])

      if (signalsRes.ok) {
        setSignalsData(await signalsRes.json())
      } else {
        setError('Failed to load fraud signal data')
      }

      if (securityRes.ok) {
        setSecurityData(await securityRes.json())
      }
    } catch {
      setError('Network error loading fraud data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return <FraudPageSkeleton />
  }

  const summary = signalsData?.summary
  const signals = signalsData?.signals ?? []
  const categories = signalsData?.categories ?? []
  const securityItems = securityData?.items ?? []
  const securitySummary = securityData?.summary

  const allSecurityComplete = securitySummary?.completed === securitySummary?.total

  // Group security items by priority
  const criticalItems = securityItems.filter((i) => i.priority === 'critical')
  const recommendedItems = securityItems.filter((i) => i.priority === 'recommended')
  const builtInItems = securityItems.filter((i) => i.priority === 'built-in')

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Fraud Detection' },
      ]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Fraud Detection & Security</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          12 real-time fraud signals protect your tools and consumers around the clock.
        </p>
      </div>

      {error && (
        <div
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ─── Section A: Active Fraud Signals ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Fraud Signals</CardTitle>
          <CardDescription>
            All real-time detection signals evaluated on every metered invocation.
          </CardDescription>
          {summary && (
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <div className="flex items-center gap-2">
                <StatusDot status={summary.degradedSignals > 0 ? 'degraded' : 'active'} />
                <span className="text-indigo dark:text-gray-200 font-semibold">
                  {summary.activeSignals} signal{summary.activeSignals !== 1 ? 's' : ''} active
                </span>
                {summary.degradedSignals > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    ({summary.degradedSignals} degraded)
                  </span>
                )}
              </div>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-indigo dark:text-gray-200">
                  {formatNumber(summary.scannedToday)}
                </span>{' '}
                requests scanned today
              </span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-indigo dark:text-gray-200">
                  {formatNumber(summary.flaggedThisWeek)}
                </span>{' '}
                flagged this week
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100 dark:divide-[#252836]">
            {categories.map((cat, i) => (
              <CategorySection
                key={cat.id}
                category={cat}
                signals={signals}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Section B: Security Setup Wizard ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Setup</CardTitle>
          <CardDescription>
            Complete these steps to harden your SettleGrid deployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allSecurityComplete ? (
            /* Success banner when all items are complete */
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-1">
                All security steps completed
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your SettleGrid deployment is fully hardened. Keep monitoring your audit log and fraud signals.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress bar */}
              {securitySummary && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-indigo dark:text-gray-200">
                      {securitySummary.completed} of {securitySummary.total} completed
                    </span>
                    <span className="text-sm font-semibold text-brand">
                      {securitySummary.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-[#252836] rounded-full h-2.5">
                    <div
                      className="bg-brand h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${securitySummary.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Critical */}
              {criticalItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                    Critical
                  </h4>
                  <div className="space-y-3">
                    {criticalItems.map((item) => (
                      <SecurityItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended */}
              {recommendedItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                    Recommended
                  </h4>
                  <div className="space-y-3">
                    {recommendedItems.map((item) => (
                      <SecurityItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Built-in */}
              {builtInItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                    Built-in
                  </h4>
                  <div className="space-y-3">
                    {builtInItems.map((item) => (
                      <SecurityItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
