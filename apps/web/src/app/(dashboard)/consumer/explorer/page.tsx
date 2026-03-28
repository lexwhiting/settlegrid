'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { LiveIndicator } from '@/components/ui/live-indicator'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExplorerStats {
  spentToday: number
  spentWeek: number
  spentMonth: number
  callsToday: number
  callsWeek: number
  callsMonth: number
  avgCostCents: number
  avgResponseMs: number
}

interface Transaction {
  id: string
  toolId: string
  toolName: string
  toolSlug: string
  apiKeyId: string
  method: string
  costCents: number
  latencyMs: number | null
  status: string
  createdAt: string
}

interface ToolBreakdown {
  toolId: string
  toolName: string
  toolSlug: string
  totalCalls: number
  totalSpentCents: number
  avgCostCents: number
  avgResponseMs: number
  errorRate: number
  lastCalledAt: string
}

interface AgentBreakdown {
  apiKeyId: string
  keyPrefix: string
  totalCalls: number
  totalSpentCents: number
  budgetRemainingCents: number
  lastActiveAt: string
}

interface Anomaly {
  type: string
  severity: 'warning' | 'critical'
  description: string
  timestamp: string
}

interface ExplorerData {
  stats: ExplorerStats
  transactions: Transaction[]
  perTool: ToolBreakdown[]
  perAgent: AgentBreakdown[]
  anomalies: Anomaly[]
  period: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000
const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const
type Period = (typeof PERIODS)[number]['value']

type ToolSortKey = 'totalCalls' | 'totalSpentCents' | 'avgCostCents' | 'avgResponseMs' | 'errorRate' | 'lastCalledAt'
type TxSortKey = 'createdAt' | 'costCents' | 'latencyMs'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe / 100)
}

/* formatDate available if needed:
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
} */

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const ts = new Date(iso).getTime()
  const diff = now - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function statusBadgeVariant(status: string): 'success' | 'destructive' | 'warning' {
  if (status === 'success') return 'success'
  if (status === 'error') return 'destructive'
  return 'warning'
}

function anomalyTypeLabel(type: string): string {
  switch (type) {
    case 'spending_spike': return 'Spending Spike'
    case 'error_spike': return 'Error Spike'
    case 'new_tool': return 'New Tool'
    case 'budget_limit': return 'Budget Alert'
    default: return type
  }
}

function anomalyIcon(type: string): string {
  switch (type) {
    case 'spending_spike': return 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'error_spike': return 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z'
    case 'new_tool': return 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'
    case 'budget_limit': return 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'
    default: return 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'
  }
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#252836] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No transactions yet</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
        Start using tools from the marketplace to see real-time transaction data here.
      </p>
      <Link href="/consumer">
        <Button size="sm">Browse Tools</Button>
      </Link>
    </div>
  )
}

// ─── Stat Mini Card ─────────────────────────────────────────────────────────

function StatMini({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Per-Tool Bar ───────────────────────────────────────────────────────────

function ToolBar({ spent, maxSpent }: { spent: number; maxSpent: number }) {
  const pct = maxSpent > 0 ? Math.min((spent / maxSpent) * 100, 100) : 0
  const clampedPct = Number.isFinite(pct) ? pct : 0
  return (
    <div className="w-full h-4 bg-gray-100 dark:bg-[#252836] rounded overflow-hidden">
      <div
        className="h-full bg-brand/60 rounded transition-all duration-500"
        style={{ width: `${clampedPct}%` }}
      />
    </div>
  )
}

// ─── Anomaly Card ───────────────────────────────────────────────────────────

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const isCritical = anomaly.severity === 'critical'
  return (
    <div
      className={cn(
        'rounded-lg p-4 border',
        isCritical
          ? 'border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-900/10'
          : 'border-yellow-300 dark:border-yellow-700/50 bg-yellow-50 dark:bg-yellow-900/10'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isCritical
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-yellow-100 dark:bg-yellow-900/30'
        )}>
          <svg
            className={cn('w-4 h-4', isCritical ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400')}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={anomalyIcon(anomaly.type)} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'text-sm font-semibold',
              isCritical ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'
            )}>
              {anomalyTypeLabel(anomaly.type)}
            </span>
            <Badge variant={isCritical ? 'destructive' : 'warning'} className="text-[10px]">
              {anomaly.severity}
            </Badge>
          </div>
          <p className={cn(
            'text-sm',
            isCritical ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
          )}>
            {anomaly.description}
          </p>
          <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(anomaly.timestamp)}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ConsumerExplorerPage() {
  const [data, setData] = useState<ExplorerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<Period>('month')
  const [toolFilter, setToolFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [txSort, setTxSort] = useState<TxSortKey>('createdAt')
  const [txSortDir, setTxSortDir] = useState<'asc' | 'desc'>('desc')
  const [toolSort, setToolSort] = useState<ToolSortKey>('totalSpentCents')
  const [toolSortDir, setToolSortDir] = useState<'asc' | 'desc'>('desc')
  const [isPolling, setIsPolling] = useState(true)

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({ period })
      if (toolFilter) params.set('toolId', toolFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/consumer/explorer?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to load explorer data.')
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }, [period, toolFilter, statusFilter])

  // Initial fetch and on filter change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Polling
  useEffect(() => {
    if (!isPolling) return
    const interval = setInterval(() => fetchData(false), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isPolling, fetchData])

  // ─── Sort helpers ─────────────────────────────────────────────────────

  function handleTxSort(key: TxSortKey) {
    if (txSort === key) {
      setTxSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setTxSort(key)
      setTxSortDir('desc')
    }
  }

  function handleToolSort(key: ToolSortKey) {
    if (toolSort === key) {
      setToolSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setToolSort(key)
      setToolSortDir('desc')
    }
  }

  function sortIndicator(active: boolean, dir: 'asc' | 'desc') {
    if (!active) return null
    return (
      <svg className="w-3 h-3 inline ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={dir === 'asc' ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'} />
      </svg>
    )
  }

  // Sort transactions
  const sortedTransactions = data?.transactions ? [...data.transactions].sort((a, b) => {
    const dir = txSortDir === 'asc' ? 1 : -1
    switch (txSort) {
      case 'costCents': return (a.costCents - b.costCents) * dir
      case 'latencyMs': return ((a.latencyMs ?? 0) - (b.latencyMs ?? 0)) * dir
      case 'createdAt':
      default: return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
    }
  }) : []

  // Sort tools
  const sortedTools = data?.perTool ? [...data.perTool].sort((a, b) => {
    const dir = toolSortDir === 'asc' ? 1 : -1
    switch (toolSort) {
      case 'totalCalls': return (a.totalCalls - b.totalCalls) * dir
      case 'totalSpentCents': return (a.totalSpentCents - b.totalSpentCents) * dir
      case 'avgCostCents': return (a.avgCostCents - b.avgCostCents) * dir
      case 'avgResponseMs': return (a.avgResponseMs - b.avgResponseMs) * dir
      case 'errorRate': return (a.errorRate - b.errorRate) * dir
      case 'lastCalledAt': return (new Date(a.lastCalledAt).getTime() - new Date(b.lastCalledAt).getTime()) * dir
      default: return 0
    }
  }) : []

  // Unique tools for filter dropdown
  const uniqueTools = data?.perTool?.map((t) => ({ id: t.toolId, name: t.toolName })) ?? []

  // Max spend for bar chart
  const maxToolSpend = Math.max(...(data?.perTool?.map((t) => t.totalSpentCents) ?? [0]), 1)

  // ─── Loading State ────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: 'Consumer', href: '/consumer' }, { label: 'Explorer' }]} />
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  // ─── Error State ──────────────────────────────────────────────────────

  if (error && !data) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: 'Consumer', href: '/consumer' }, { label: 'Explorer' }]} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4" role="alert">{error}</p>
          <Button onClick={() => fetchData()} variant="outline" size="sm">Try Again</Button>
        </div>
      </div>
    )
  }

  const stats = data?.stats
  const hasData = (data?.transactions?.length ?? 0) > 0

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: 'Consumer', href: '/consumer' }, { label: 'Explorer' }]} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transaction Explorer</h1>
          <LiveIndicator connected={isPolling} label="Live" />
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center bg-gray-100 dark:bg-[#252836] rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  period === p.value
                    ? 'bg-white dark:bg-[#1A1D2E] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPolling((p) => !p)}
            className="text-xs"
          >
            {isPolling ? 'Pause' : 'Resume'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-3 text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </div>
      )}

      {!hasData && !loading ? (
        <EmptyState />
      ) : (
        <>
          {/* ─── Header Stats ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatMini
              label="Spent Today"
              value={formatCents(stats?.spentToday ?? 0)}
              subtitle={`${stats?.callsToday ?? 0} calls`}
            />
            <StatMini
              label="Spent This Week"
              value={formatCents(stats?.spentWeek ?? 0)}
              subtitle={`${stats?.callsWeek ?? 0} calls`}
            />
            <StatMini
              label="Avg Cost / Call"
              value={formatCents(stats?.avgCostCents ?? 0)}
            />
            <StatMini
              label="Avg Response Time"
              value={`${stats?.avgResponseMs ?? 0}ms`}
              subtitle={`${stats?.callsMonth ?? 0} calls this month`}
            />
          </div>

          {/* ─── Anomalies ──────────────────────────────────────────────── */}
          {(data?.anomalies?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Anomalies Detected</CardTitle>
                  <Badge variant="warning" className="text-[10px]">{data?.anomalies.length}</Badge>
                </div>
                <CardDescription>Unusual patterns in the last hour compared to 7-day baseline.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data?.anomalies.map((anomaly, i) => (
                    <AnomalyCard key={`${anomaly.type}-${i}`} anomaly={anomaly} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Transaction Feed ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">Recent Transactions</CardTitle>
                  <CardDescription>
                    Last {sortedTransactions.length} transactions{toolFilter ? ' (filtered)' : ''}.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* Tool filter */}
                  <select
                    value={toolFilter}
                    onChange={(e) => setToolFilter(e.target.value)}
                    className="text-xs bg-gray-100 dark:bg-[#252836] border border-gray-200 dark:border-[#2E3148] rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="">All Tools</option>
                    {uniqueTools.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs bg-gray-100 dark:bg-[#252836] border border-gray-200 dark:border-[#2E3148] rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="">All Statuses</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                    <option value="timeout">Timeout</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                      <th
                        className="text-left py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleTxSort('createdAt')}
                      >
                        Time {sortIndicator(txSort === 'createdAt', txSortDir)}
                      </th>
                      <th className="text-left py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400">Tool</th>
                      <th
                        className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleTxSort('costCents')}
                      >
                        Cost {sortIndicator(txSort === 'costCents', txSortDir)}
                      </th>
                      <th
                        className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleTxSort('latencyMs')}
                      >
                        Latency {sortIndicator(txSort === 'latencyMs', txSortDir)}
                      </th>
                      <th className="text-center py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-gray-100 dark:border-[#252836] last:border-0 hover:bg-gray-50 dark:hover:bg-[#1A1D2E] transition-colors"
                      >
                        <td className="py-2.5 px-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                              {formatTime(tx.createdAt)}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatRelativeTime(tx.createdAt)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900 dark:text-gray-100 text-xs">
                              {tx.toolName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">{tx.method}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-gray-900 dark:text-gray-100 tabular-nums text-xs">
                          {formatCents(tx.costCents)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                          {tx.latencyMs !== null ? `${tx.latencyMs}ms` : '--'}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant={statusBadgeVariant(tx.status)} className="text-[10px]">
                            {tx.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedTransactions.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                  No transactions match the current filters.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ─── Per-Tool Breakdown ────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Per-Tool Breakdown</CardTitle>
              <CardDescription>Performance and spending by tool. Click a column header to sort.</CardDescription>
            </CardHeader>
            <CardContent>
              {sortedTools.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                  No tool data available for this period.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                          <th className="text-left py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400">Tool</th>
                          <th
                            className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                            onClick={() => handleToolSort('totalCalls')}
                          >
                            Calls {sortIndicator(toolSort === 'totalCalls', toolSortDir)}
                          </th>
                          <th
                            className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                            onClick={() => handleToolSort('totalSpentCents')}
                          >
                            Total Spent {sortIndicator(toolSort === 'totalSpentCents', toolSortDir)}
                          </th>
                          <th
                            className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                            onClick={() => handleToolSort('avgCostCents')}
                          >
                            Avg Cost {sortIndicator(toolSort === 'avgCostCents', toolSortDir)}
                          </th>
                          <th
                            className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                            onClick={() => handleToolSort('avgResponseMs')}
                          >
                            Avg Latency {sortIndicator(toolSort === 'avgResponseMs', toolSortDir)}
                          </th>
                          <th
                            className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                            onClick={() => handleToolSort('errorRate')}
                          >
                            Errors {sortIndicator(toolSort === 'errorRate', toolSortDir)}
                          </th>
                          <th
                            className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                            onClick={() => handleToolSort('lastCalledAt')}
                          >
                            Last Called {sortIndicator(toolSort === 'lastCalledAt', toolSortDir)}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTools.map((tool) => (
                          <tr
                            key={tool.toolId}
                            className="border-b border-gray-100 dark:border-[#252836] last:border-0"
                          >
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-gray-900 dark:text-gray-100 text-xs">
                                  {tool.toolName}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">{tool.toolSlug}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right text-xs text-gray-700 dark:text-gray-300 tabular-nums">
                              {tool.totalCalls.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2 text-right text-xs font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                              {formatCents(tool.totalSpentCents)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                              {formatCents(tool.avgCostCents)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                              {tool.avgResponseMs}ms
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <Badge
                                variant={tool.errorRate > 10 ? 'destructive' : tool.errorRate > 5 ? 'warning' : 'success'}
                                className="text-[10px]"
                              >
                                {tool.errorRate}%
                              </Badge>
                            </td>
                            <td className="py-2.5 px-2 text-right text-xs text-gray-500 dark:text-gray-400">
                              {formatRelativeTime(tool.lastCalledAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* CSS Bar Chart */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Spending Distribution</p>
                    <div className="space-y-1.5">
                      {sortedTools.map((tool) => (
                        <div key={tool.toolId} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 truncate" title={tool.toolName}>
                            {tool.toolName}
                          </span>
                          <div className="flex-1">
                            <ToolBar spent={tool.totalSpentCents} maxSpent={maxToolSpend} />
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-16 text-right tabular-nums">
                            {formatCents(tool.totalSpentCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Per-Agent (API Key) Breakdown ─────────────────────────── */}
          {(data?.perAgent?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Per-Agent Breakdown</CardTitle>
                <CardDescription>Spending and activity per API key (each key represents one agent integration).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                        <th className="text-left py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400">Agent Key</th>
                        <th className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400">Total Calls</th>
                        <th className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400">Total Spent</th>
                        <th className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400">Budget Remaining</th>
                        <th className="text-right py-2.5 px-2 font-medium text-gray-500 dark:text-gray-400">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.perAgent.map((agent) => (
                        <tr
                          key={agent.apiKeyId}
                          className="border-b border-gray-100 dark:border-[#252836] last:border-0"
                        >
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-brand shrink-0" />
                              <span className="font-mono text-xs text-gray-900 dark:text-gray-100">
                                {agent.keyPrefix}...
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right text-xs text-gray-700 dark:text-gray-300 tabular-nums">
                            {agent.totalCalls.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-2 text-right text-xs font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                            {formatCents(agent.totalSpentCents)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                            {formatCents(agent.budgetRemainingCents)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-xs text-gray-500 dark:text-gray-400">
                            {formatRelativeTime(agent.lastActiveAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
