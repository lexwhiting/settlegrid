'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BudgetItem {
  id: string
  toolId: string
  toolName: string
  toolSlug: string
  balanceCents: number
  spendingLimitCents: number | null
  spendingLimitPeriod: string | null
  currentPeriodSpendCents: number
  periodResetAt: string | null
  alertAtPct: number | null
}

interface UsageSummary {
  toolId: string
  toolName: string
  toolSlug: string
  totalInvocations: number
  totalCostCents: number
}

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

interface AlertItem {
  id: string
  toolId: string
  toolName: string
  alertType: string
  threshold: number
  channel: string
  status: string
  lastTriggeredAt: string | null
  createdAt: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALERT_THRESHOLDS = [80, 90, 100] as const
const USAGE_DAYS = 30

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getUtilizationColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 80) return 'bg-orange-500'
  if (pct >= 60) return 'bg-yellow-500'
  return 'bg-amber-500'
}

function getUtilizationTextColor(pct: number): string {
  if (pct >= 90) return 'text-red-600 dark:text-red-400'
  if (pct >= 80) return 'text-orange-600 dark:text-orange-400'
  if (pct >= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-amber-600 dark:text-amber-400'
}

function getUtilizationBadgeVariant(pct: number): 'success' | 'warning' | 'destructive' {
  if (pct >= 90) return 'destructive'
  if (pct >= 60) return 'warning'
  return 'success'
}

// ─── Budget Progress Bar ────────────────────────────────────────────────────

function BudgetProgressBar({ spentCents, limitCents }: { spentCents: number; limitCents: number }) {
  const pct = limitCents > 0 ? Math.min((spentCents / limitCents) * 100, 100) : 0
  const clampedPct = Number.isFinite(pct) ? pct : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          {formatCents(spentCents)} of {formatCents(limitCents)}
        </span>
        <span className={cn('font-semibold tabular-nums', getUtilizationTextColor(clampedPct))}>
          {clampedPct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-[#252836] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getUtilizationColor(clampedPct))}
          style={{ width: `${clampedPct}%` }}
          role="progressbar"
          aria-valuenow={clampedPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Budget utilization: ${clampedPct.toFixed(1)}%`}
        />
      </div>
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ title, description, actionLabel, actionHref }: {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#252836] flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button size="sm">{actionLabel}</Button>
        </Link>
      )}
    </div>
  )
}

// ─── Alert Configuration Row ────────────────────────────────────────────────

function AlertConfigRow({ budget, existingAlerts, onCreateAlert }: {
  budget: BudgetItem
  existingAlerts: AlertItem[]
  onCreateAlert: (toolId: string, threshold: number) => void
}) {
  const toolAlerts = existingAlerts.filter((a) => a.toolId === budget.toolId && a.alertType === 'budget_exceeded')
  const activeThresholds = new Set(toolAlerts.map((a) => a.threshold))

  return (
    <div className="flex items-center gap-2">
      {ALERT_THRESHOLDS.map((threshold) => {
        const isActive = activeThresholds.has(threshold)
        return (
          <button
            key={threshold}
            type="button"
            onClick={() => {
              if (!isActive) onCreateAlert(budget.toolId, threshold)
            }}
            disabled={isActive}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              isActive
                ? 'bg-brand/10 text-brand cursor-default'
                : 'bg-gray-100 dark:bg-[#252836] text-gray-500 dark:text-gray-400 hover:bg-brand/10 hover:text-brand'
            )}
          >
            {isActive ? (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {threshold}%
              </span>
            ) : (
              `${threshold}%`
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Spending History List ──────────────────────────────────────────────────

function SpendingHistory({ records }: { records: UsageRecord[] }) {
  // Group by day
  const grouped = new Map<string, { date: string; totalCents: number; count: number }>()

  for (const record of records) {
    const day = new Date(record.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const existing = grouped.get(day)
    if (existing) {
      existing.totalCents += record.costCents
      existing.count += 1
    } else {
      grouped.set(day, { date: day, totalCents: record.costCents, count: 1 })
    }
  }

  const days = Array.from(grouped.values())

  if (days.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
        No spending activity in the last {USAGE_DAYS} days.
      </p>
    )
  }

  // Find max for bar sizing
  const maxCents = Math.max(...days.map((d) => d.totalCents), 1)

  return (
    <div className="space-y-2">
      {days.map((day) => {
        const barWidth = (day.totalCents / maxCents) * 100
        return (
          <div key={day.date} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0 tabular-nums">
              {day.date}
            </span>
            <div className="flex-1 h-5 bg-gray-100 dark:bg-[#252836] rounded overflow-hidden">
              <div
                className="h-full bg-brand/60 rounded transition-all"
                style={{ width: `${Number.isFinite(barWidth) ? barWidth : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-16 text-right tabular-nums">
              {formatCents(day.totalCents)}
            </span>
            <span className="text-xs text-gray-400 w-16 text-right tabular-nums">
              {day.count} call{day.count !== 1 ? 's' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ConsumerBudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [usageSummary, setUsageSummary] = useState<UsageSummary[]>([])
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit state
  const [editingTool, setEditingTool] = useState<string | null>(null)
  const [editLimitDollars, setEditLimitDollars] = useState('')
  const [editAlertPct, setEditAlertPct] = useState('')
  const [saving, setSaving] = useState(false)

  // Alert creation state
  const [creatingAlert, setCreatingAlert] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [budgetRes, usageRes, alertsRes] = await Promise.all([
        fetch('/api/consumer/budget'),
        fetch(`/api/consumer/usage?days=${USAGE_DAYS}`),
        fetch('/api/consumer/alerts'),
      ])

      if (!budgetRes.ok || !usageRes.ok || !alertsRes.ok) {
        throw new Error('Failed to load budget data.')
      }

      const [budgetData, usageData, alertsData] = await Promise.all([
        budgetRes.json(),
        usageRes.json(),
        alertsRes.json(),
      ])

      setBudgets(budgetData.budgets ?? [])
      setUsageSummary(usageData.summary ?? [])
      setUsageRecords(usageData.invocations ?? [])
      setAlerts(alertsData.alerts ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Computed Values ────────────────────────────────────────────────────

  const totalSpentCents = budgets.reduce((sum, b) => sum + b.currentPeriodSpendCents, 0)
  const totalLimitCents = budgets.reduce((sum, b) => sum + (b.spendingLimitCents ?? 0), 0)
  const budgetsWithLimits = budgets.filter((b) => b.spendingLimitCents !== null && b.spendingLimitCents > 0)
  const overallPct = totalLimitCents > 0 ? (totalSpentCents / totalLimitCents) * 100 : 0
  const clampedOverallPct = Number.isFinite(overallPct) ? Math.min(overallPct, 100) : 0

  // ─── Edit Budget Handler ───────────────────────────────────────────────

  async function handleSaveBudget(toolId: string) {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { toolId }
      const limitCents = Math.round(parseFloat(editLimitDollars) * 100)
      if (Number.isFinite(limitCents) && limitCents > 0) {
        body.spendingLimitCents = limitCents
        body.spendingLimitPeriod = 'monthly'
      }
      const alertPct = parseInt(editAlertPct, 10)
      if (Number.isFinite(alertPct) && alertPct > 0 && alertPct <= 100) {
        body.alertAtPct = alertPct
      }

      const res = await fetch('/api/consumer/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update budget.')
      }

      setEditingTool(null)
      setEditLimitDollars('')
      setEditAlertPct('')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Create Alert Handler ──────────────────────────────────────────────

  async function handleCreateAlert(toolId: string, threshold: number) {
    setCreatingAlert(true)
    try {
      const res = await fetch('/api/consumer/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          alertType: 'budget_exceeded',
          threshold,
          channel: 'email',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create alert.')
      }

      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert.')
    } finally {
      setCreatingAlert(false)
    }
  }

  // ─── Loading State ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: 'Consumer', href: '/consumer' }, { label: 'Budgets' }]} />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  // ─── Error State ──────────────────────────────────────────────────────

  if (error && budgets.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: 'Consumer', href: '/consumer' }, { label: 'Budgets' }]} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4" role="alert">{error}</p>
          <Button onClick={fetchData} variant="outline" size="sm">Try Again</Button>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: 'Consumer', href: '/consumer' }, { label: 'Budgets' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Agent Budgets</h1>
        <Link href="/consumer/onboard">
          <Button variant="outline" size="sm">
            Onboarding Guide
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-3 text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </div>
      )}

      {/* ─── Spending Overview ─────────────────────────────────────────── */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Spent This Month</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-1">
              {formatCents(totalSpentCents)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Budget Limit</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-1">
              {totalLimitCents > 0 ? formatCents(totalLimitCents) : 'No limit set'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Budget Utilization</p>
            <p className={cn('text-2xl font-bold tabular-nums mt-1', getUtilizationTextColor(clampedOverallPct))}>
              {totalLimitCents > 0 ? `${clampedOverallPct.toFixed(1)}%` : '--'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Overall Progress Bar ─────────────────────────────────────── */}

      {totalLimitCents > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Overall Budget Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetProgressBar spentCents={totalSpentCents} limitCents={totalLimitCents} />
          </CardContent>
        </Card>
      )}

      {/* ─── Per-Tool Breakdown ───────────────────────────────────────── */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Tool Spending</CardTitle>
          <CardDescription>
            Spending breakdown and budget limits per tool this month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {budgetsWithLimits.length === 0 && usageSummary.length === 0 ? (
            <EmptyState
              title="No tool usage yet"
              description="Start using tools from the marketplace to see spending data here."
              actionLabel="Browse Tools"
              actionHref="/consumer"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Tool</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Spent</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Limit</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Usage</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Calls</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Alerts</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((budget) => {
                    const summary = usageSummary.find((s) => s.toolId === budget.toolId)
                    const pct = budget.spendingLimitCents && budget.spendingLimitCents > 0
                      ? Math.min((budget.currentPeriodSpendCents / budget.spendingLimitCents) * 100, 100)
                      : 0
                    const safePct = Number.isFinite(pct) ? pct : 0
                    const isEditing = editingTool === budget.toolId

                    return (
                      <tr key={budget.id} className="border-b border-gray-100 dark:border-[#252836] last:border-0">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {budget.toolName}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">{budget.toolSlug}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                          {formatCents(budget.currentPeriodSpendCents)}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-500">$</span>
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="w-20 h-7 text-xs text-right"
                                value={editLimitDollars}
                                onChange={(e) => setEditLimitDollars(e.target.value.replace(/[^0-9.]/g, ''))}
                                placeholder={budget.spendingLimitCents ? String(budget.spendingLimitCents / 100) : '0'}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                              {budget.spendingLimitCents ? formatCents(budget.spendingLimitCents) : '--'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {budget.spendingLimitCents && budget.spendingLimitCents > 0 ? (
                            <Badge variant={getUtilizationBadgeVariant(safePct)}>
                              {safePct.toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-700 dark:text-gray-300 tabular-nums">
                          {summary?.totalInvocations ?? 0}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <AlertConfigRow
                            budget={budget}
                            existingAlerts={alerts}
                            onCreateAlert={handleCreateAlert}
                          />
                        </td>
                        <td className="py-3 px-2 text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => { setEditingTool(null); setEditLimitDollars(''); setEditAlertPct('') }}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1"
                                disabled={saving}
                              >
                                Cancel
                              </button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveBudget(budget.toolId)}
                                disabled={saving}
                                className="h-7 text-xs"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTool(budget.toolId)
                                setEditLimitDollars(budget.spendingLimitCents ? String(budget.spendingLimitCents / 100) : '')
                                setEditAlertPct(budget.alertAtPct ? String(budget.alertAtPct) : '80')
                              }}
                              className="text-xs text-brand hover:text-brand-dark transition-colors px-2 py-1"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Alert Settings ───────────────────────────────────────────── */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Alerts</CardTitle>
          <CardDescription>
            Get notified when your spending reaches configured thresholds.
            Click the percentage buttons in the table above to add alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
              No alerts configured yet. Use the threshold buttons in the per-tool table to add alerts at 80%, 90%, or 100%.
            </p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between bg-gray-50 dark:bg-[#252836] rounded-lg px-4 py-3 border border-gray-100 dark:border-[#2A2D3E]"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      alert.status === 'active' ? 'bg-amber-500' : 'bg-gray-400'
                    )} />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {alert.toolName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        {alert.alertType === 'budget_exceeded' ? `Budget at ${alert.threshold}%` : alert.alertType}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {alert.channel}
                    </Badge>
                    {alert.lastTriggeredAt && (
                      <span className="text-xs text-gray-400">
                        Last triggered {formatDate(alert.lastTriggeredAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Spending History ─────────────────────────────────────────── */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spending History</CardTitle>
          <CardDescription>
            Daily spending over the last {USAGE_DAYS} days across all tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SpendingHistory records={usageRecords} />
        </CardContent>
      </Card>
    </div>
  )
}
