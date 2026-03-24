'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { ConsumerStatBar } from '@/components/consumer/stat-bar'
import { UsageAnalytics } from '@/components/consumer/usage-analytics'
import { AlertsManager } from '@/components/consumer/alerts-manager'
import { PurchaseHistory } from '@/components/consumer/purchase-history'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ToolBalance {
  toolId: string
  toolName: string
  toolSlug: string
  balanceCents: number
  autoRefill: boolean
}

interface ApiKey {
  id: string
  keyPrefix: string
  toolId: string
  status: string
  lastUsedAt: string | null
  createdAt: string
}

interface BudgetLimit {
  toolId: string
  toolName: string
  spendingLimitCents: number
  period: string
  alertThresholdPercent: number
  currentSpendCents: number
}

interface IpRestriction {
  keyId: string
  allowedIps: string[]
}

interface UsageInvocation {
  id: string
  toolId: string
  method: string
  costCents: number
  latencyMs: number
  status: string
  createdAt: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe / 100)
}

// ─── Chevron Icon ───────────────────────────────────────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ConsumerDashboardPage() {
  const [balances, setBalances] = useState<ToolBalance[]>([])
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [budgets, setBudgets] = useState<BudgetLimit[]>([])
  const [ipRestrictions, setIpRestrictions] = useState<Record<string, IpRestriction>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Budget edit state
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [budgetForm, setBudgetForm] = useState({ spendingLimitCents: '', period: 'monthly', alertThresholdPercent: '80' })
  const [savingBudget, setSavingBudget] = useState(false)

  // Key generation state
  const [generatingKeyForTool, setGeneratingKeyForTool] = useState<string | null>(null)
  const [newlyCreatedKeys, setNewlyCreatedKeys] = useState<Record<string, string>>({}) // toolId -> full key (shown once)

  // IP add state
  const [addingIpForKey, setAddingIpForKey] = useState<string | null>(null)
  const [newIp, setNewIp] = useState('')
  const [savingIp, setSavingIp] = useState(false)

  // Expandable tool detail state
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null)
  const [toolUsageData, setToolUsageData] = useState<Record<string, UsageInvocation[]>>({})
  const [toolUsageLoading, setToolUsageLoading] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [balRes, keyRes, budgetRes, ipRes] = await Promise.all([
          fetch('/api/consumer/balance'),
          fetch('/api/consumer/keys'),
          fetch('/api/consumer/budgets'),
          fetch('/api/consumer/ip-restrictions'),
        ])
        if (balRes.ok) {
          const balData = await balRes.json()
          setBalances(balData.balances ?? [])
        }
        if (keyRes.ok) {
          const keyData = await keyRes.json()
          setKeys(keyData.keys ?? [])
        }
        if (budgetRes.ok) {
          const budgetData = await budgetRes.json()
          setBudgets(budgetData.budgets ?? [])
        }
        if (ipRes.ok) {
          const ipData = await ipRes.json()
          const map: Record<string, IpRestriction> = {}
          for (const restriction of ipData.restrictions ?? []) {
            map[restriction.keyId] = restriction
          }
          setIpRestrictions(map)
        }
      } catch {
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Fetch tool-specific usage when expanding a balance card
  const fetchToolUsage = useCallback(async (toolId: string) => {
    if (toolUsageData[toolId]) return // Already fetched
    setToolUsageLoading(toolId)
    try {
      const res = await fetch(`/api/consumer/usage?toolId=${toolId}&days=7`)
      if (res.ok) {
        const data = await res.json()
        setToolUsageData((prev) => ({ ...prev, [toolId]: data.invocations ?? [] }))
      }
    } catch {
      // Silently fail -- detail section will show empty
    } finally {
      setToolUsageLoading(null)
    }
  }, [toolUsageData])

  function toggleToolExpansion(toolId: string) {
    if (expandedToolId === toolId) {
      setExpandedToolId(null)
    } else {
      setExpandedToolId(toolId)
      fetchToolUsage(toolId)
    }
  }

  async function revokeKey(keyId: string) {
    try {
      const res = await fetch(`/api/consumer/keys/${keyId}`, { method: 'DELETE' })
      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== keyId))
      }
    } catch {
      setError('Failed to revoke key')
    }
  }

  async function generateKey(toolId: string) {
    setGeneratingKeyForTool(toolId)
    setError('')
    try {
      const res = await fetch('/api/consumer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to generate API key')
        return
      }
      // Store the full key (shown once) and add the new key metadata to the list
      setNewlyCreatedKeys((prev) => ({ ...prev, [toolId]: data.key }))
      setKeys((prev) => [...prev, data.apiKey])
    } catch {
      setError('Network error')
    } finally {
      setGeneratingKeyForTool(null)
    }
  }

  function startEditBudget(budget: BudgetLimit) {
    setEditingBudget(budget.toolId)
    setBudgetForm({
      spendingLimitCents: String(budget.spendingLimitCents),
      period: budget.period,
      alertThresholdPercent: String(budget.alertThresholdPercent),
    })
  }

  async function saveBudget(toolId: string) {
    setSavingBudget(true)
    setError('')
    try {
      const res = await fetch(`/api/consumer/budgets/${toolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spendingLimitCents: parseInt(budgetForm.spendingLimitCents, 10),
          period: budgetForm.period,
          alertThresholdPercent: parseInt(budgetForm.alertThresholdPercent, 10),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save budget')
        return
      }
      const data = await res.json()
      setBudgets(budgets.map((b) => b.toolId === toolId ? { ...b, ...data.budget } : b))
      setEditingBudget(null)
    } catch {
      setError('Network error')
    } finally {
      setSavingBudget(false)
    }
  }

  async function addIp(keyId: string) {
    if (!newIp.trim()) return
    setSavingIp(true)
    setError('')
    try {
      const res = await fetch(`/api/consumer/keys/${keyId}/ip-restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to add IP')
        return
      }
      const current = ipRestrictions[keyId]?.allowedIps ?? []
      setIpRestrictions({
        ...ipRestrictions,
        [keyId]: { keyId, allowedIps: [...current, newIp.trim()] },
      })
      setNewIp('')
      setAddingIpForKey(null)
    } catch {
      setError('Network error')
    } finally {
      setSavingIp(false)
    }
  }

  async function removeIp(keyId: string, ip: string) {
    setError('')
    try {
      const res = await fetch(`/api/consumer/keys/${keyId}/ip-restrictions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to remove IP')
        return
      }
      const current = ipRestrictions[keyId]?.allowedIps ?? []
      setIpRestrictions({
        ...ipRestrictions,
        [keyId]: { keyId, allowedIps: current.filter((i) => i !== ip) },
      })
    } catch {
      setError('Network error')
    }
  }

  // ─── Loading Skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-4 w-40 mb-3" />
          <Skeleton className="h-8 w-64" />
        </div>
        {/* StatBar skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        {/* Balances skeleton */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        {/* Usage analytics skeleton */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        {/* Alerts skeleton */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
        {/* Purchase history skeleton */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        {/* Budget skeleton */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        {/* Keys skeleton */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Compute expanded tool details ────────────────────────────────────────

  function renderExpandedToolDetail(toolId: string) {
    const invocations = toolUsageData[toolId] ?? []
    const isLoading = toolUsageLoading === toolId

    if (isLoading) {
      return (
        <div className="mt-3 border-t border-gray-100 dark:border-[#252836] pt-3 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      )
    }

    const recentInvocations = invocations.slice(0, 10)
    const totalSpendCents = invocations.reduce((sum, inv) => sum + inv.costCents, 0)
    const totalCount = invocations.length
    const avgCostCents = totalCount > 0 ? Math.round(totalSpendCents / totalCount) : 0

    // Method-level cost breakdown
    const methodBreakdown = new Map<string, { count: number; totalCostCents: number }>()
    for (const inv of invocations) {
      const entry = methodBreakdown.get(inv.method)
      if (entry) {
        entry.count += 1
        entry.totalCostCents += inv.costCents
      } else {
        methodBreakdown.set(inv.method, { count: 1, totalCostCents: inv.costCents })
      }
    }
    const methods = Array.from(methodBreakdown.entries()).sort((a, b) => b[1].totalCostCents - a[1].totalCostCents)

    return (
      <div className="mt-3 border-t border-gray-100 dark:border-[#252836] pt-3">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-[#252836]/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Spend (7d)</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{formatCents(totalSpendCents)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#252836]/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Invocations (7d)</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{totalCount}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#252836]/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg Cost / Call</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{formatCents(avgCostCents)}</p>
          </div>
        </div>

        {/* Method Breakdown */}
        {methods.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Method Breakdown</h4>
            <div className="space-y-1.5">
              {methods.map(([method, data]) => (
                <div key={method} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{method}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {data.count} calls &middot; {formatCents(data.totalCostCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Invocations */}
        {recentInvocations.length > 0 ? (
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recent Invocations</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" aria-label="Recent invocations">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                    <th className="text-left py-1.5 pr-3 font-medium text-gray-500 dark:text-gray-400">Method</th>
                    <th className="text-right py-1.5 pr-3 font-medium text-gray-500 dark:text-gray-400">Cost</th>
                    <th className="text-right py-1.5 pr-3 font-medium text-gray-500 dark:text-gray-400">Latency</th>
                    <th className="text-center py-1.5 pr-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-right py-1.5 font-medium text-gray-500 dark:text-gray-400">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvocations.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 dark:border-[#252836] last:border-0">
                      <td className="py-1.5 pr-3 font-mono text-gray-700 dark:text-gray-300">{inv.method}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCents(inv.costCents)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{inv.latencyMs}ms</td>
                      <td className="py-1.5 pr-3 text-center">
                        <Badge variant={inv.status === 'success' ? 'success' : 'destructive'} className="text-[10px] px-1.5 py-0">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-1.5 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">No invocations in the last 7 days.</p>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Breadcrumbs & Title */}
      <div>
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Consumer' }]} />
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Consumer Dashboard</h1>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Stat Bar */}
      <ConsumerStatBar balances={balances} keys={keys} />

      {/* Credit Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No credits yet. Browse tools and purchase credits to get started.</p>
          ) : (
            <div className="space-y-3">
              {balances.map((b) => {
                const hasActiveKey = keys.some((k) => k.toolId === b.toolId && k.status === 'active')
                const newKey = newlyCreatedKeys[b.toolId]
                const isExpanded = expandedToolId === b.toolId
                return (
                  <div key={b.toolId} className="border border-gray-100 dark:border-[#252836] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleToolExpansion(b.toolId)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#252836] transition-colors text-gray-500 dark:text-gray-400 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                          aria-label={isExpanded ? `Collapse ${b.toolName || 'tool'} details` : `Expand ${b.toolName || 'tool'} details`}
                          aria-expanded={isExpanded}
                        >
                          <ChevronIcon expanded={isExpanded} />
                        </button>
                        <div>
                          <span className="font-medium text-indigo dark:text-gray-100">{b.toolName || 'Unnamed Tool'}</span>
                          <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">/{b.toolSlug || '—'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {b.autoRefill && <Badge variant="secondary">Auto-refill</Badge>}
                        <span className="font-semibold text-brand-text">{formatCents(b.balanceCents)}</span>
                        <a
                          href={`/tools/${b.toolSlug}`}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252836] h-9 px-3 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                          aria-label={`Add credits for ${b.toolName || 'this tool'}`}
                        >
                          Add Credits
                        </a>
                      </div>
                    </div>

                    {/* Generate Key / Show Key */}
                    {newKey ? (
                      <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-md p-3">
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 mb-1">API key created. Copy it now -- it will not be shown again.</p>
                        <code className="block text-xs bg-white dark:bg-[#1A1D2E] border border-emerald-200 dark:border-emerald-800/40 rounded px-2 py-1.5 font-mono text-gray-900 dark:text-gray-100 break-all select-all">
                          {newKey}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(newKey)
                            setNewlyCreatedKeys((prev) => {
                              const next = { ...prev }
                              delete next[b.toolId]
                              return next
                            })
                          }}
                        >
                          Copy &amp; Dismiss
                        </Button>
                      </div>
                    ) : !hasActiveKey ? (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          onClick={() => generateKey(b.toolId)}
                          disabled={generatingKeyForTool === b.toolId}
                        >
                          {generatingKeyForTool === b.toolId ? 'Generating...' : 'Generate API Key'}
                        </Button>
                      </div>
                    ) : null}

                    {/* Expandable Detail */}
                    {isExpanded && renderExpandedToolDetail(b.toolId)}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Analytics */}
      <UsageAnalytics />

      {/* Alerts Manager */}
      <AlertsManager tools={balances.map((b) => ({ toolId: b.toolId, toolName: b.toolName }))} />

      {/* Purchase History */}
      <PurchaseHistory />

      {/* Budget Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Controls</CardTitle>
          <CardDescription>Set per-tool spending limits and alert thresholds to control costs.</CardDescription>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No budget limits configured. Purchase credits for a tool to set spending controls.</p>
          ) : (
            <div className="space-y-4">
              {budgets.map((budget) => (
                <div key={budget.toolId} className="border border-gray-100 dark:border-[#252836] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-indigo dark:text-gray-100">{budget.toolName || 'Unnamed Tool'}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editingBudget === budget.toolId ? setEditingBudget(null) : startEditBudget(budget)}
                    >
                      {editingBudget === budget.toolId ? 'Cancel' : 'Edit'}
                    </Button>
                  </div>

                  {editingBudget === budget.toolId ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor={`limit-${budget.toolId}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Spending Limit (cents)</label>
                          <input
                            id={`limit-${budget.toolId}`}
                            type="number"
                            min="0"
                            value={budgetForm.spendingLimitCents}
                            onChange={(e) => setBudgetForm({ ...budgetForm, spendingLimitCents: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand focus-visible:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor={`period-${budget.toolId}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Period</label>
                          <select
                            id={`period-${budget.toolId}`}
                            value={budgetForm.period}
                            onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand focus-visible:outline-none"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`alert-${budget.toolId}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Alert at (%)</label>
                          <input
                            id={`alert-${budget.toolId}`}
                            type="number"
                            min="1"
                            max="100"
                            value={budgetForm.alertThresholdPercent}
                            onChange={(e) => setBudgetForm({ ...budgetForm, alertThresholdPercent: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand focus-visible:outline-none"
                          />
                        </div>
                      </div>
                      <Button size="sm" onClick={() => saveBudget(budget.toolId)} disabled={savingBudget}>
                        {savingBudget ? 'Saving...' : 'Save Budget'}
                      </Button>
                    </div>
                  ) : (
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Limit</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{formatCents(budget.spendingLimitCents)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Period</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100 capitalize">{budget.period}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Alert at</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{budget.alertThresholdPercent}%</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Current Spend</dt>
                        <dd className={`font-medium ${budget.spendingLimitCents > 0 && budget.currentSpendCents / budget.spendingLimitCents > 0.8 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                          {formatCents(budget.currentSpendCents)}
                        </dd>
                      </div>
                    </dl>
                  )}

                  {/* Spend progress bar */}
                  {editingBudget !== budget.toolId && budget.spendingLimitCents > 0 && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-2" role="progressbar" aria-valuenow={Math.min(100, Math.round((budget.currentSpendCents / budget.spendingLimitCents) * 100))} aria-valuemin={0} aria-valuemax={100} aria-label={`Budget usage: ${Math.min(100, Math.round((budget.currentSpendCents / budget.spendingLimitCents) * 100))}%`}>
                        <div
                          className={`h-2 rounded-full transition-all ${
                            budget.currentSpendCents / budget.spendingLimitCents > 0.8 ? 'bg-red-500 dark:bg-red-500' : 'bg-brand'
                          }`}
                          style={{ width: `${Math.min(100, (budget.currentSpendCents / budget.spendingLimitCents) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys with IP Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No API keys yet. Use the &quot;Generate API Key&quot; button on a tool above, or visit a tool storefront to create one.</p>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => {
                const restrictions = ipRestrictions[key.id]
                return (
                  <div key={key.id} className="border border-gray-100 dark:border-[#252836] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <code className="bg-gray-100 dark:bg-[#252836] px-2 py-1 rounded text-xs">{key.keyPrefix}...</code>
                        <Badge variant={key.status === 'active' ? 'success' : 'destructive'}>{key.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {key.status === 'active' && (
                          <Button variant="destructive" size="sm" onClick={() => revokeKey(key.id)} aria-label={`Revoke API key ${key.keyPrefix}`}>
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span>Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</span>
                      <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* IP Restrictions */}
                    {key.status === 'active' && (
                      <div className="border-t border-gray-100 dark:border-[#252836] pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IP Allowlist</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAddingIpForKey(addingIpForKey === key.id ? null : key.id)}
                            className="text-xs h-7 px-2"
                            aria-label={addingIpForKey === key.id ? 'Cancel adding IP' : `Add IP restriction for key ${key.keyPrefix}`}
                          >
                            {addingIpForKey === key.id ? 'Cancel' : '+ Add IP'}
                          </Button>
                        </div>

                        {addingIpForKey === key.id && (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="e.g. 192.168.1.0/24"
                              value={newIp}
                              onChange={(e) => setNewIp(e.target.value)}
                              className="flex h-8 flex-1 rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-2 py-1 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand focus-visible:outline-none"
                              aria-label="IP address or CIDR range"
                            />
                            <Button size="sm" className="h-8 text-xs" onClick={() => addIp(key.id)} disabled={savingIp}>
                              {savingIp ? 'Adding...' : 'Add'}
                            </Button>
                          </div>
                        )}

                        {restrictions && restrictions.allowedIps.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {restrictions.allowedIps.map((ip) => (
                              <span key={ip} className="inline-flex items-center gap-1 bg-gray-100 dark:bg-[#252836] text-gray-700 dark:text-gray-300 rounded-full px-2.5 py-0.5 text-xs font-mono">
                                {ip}
                                <button
                                  onClick={() => removeIp(key.id, ip)}
                                  className="text-gray-500 dark:text-gray-400 hover:text-red-500 ml-0.5 rounded focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                                  aria-label={`Remove IP ${ip}`}
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400">No IP restrictions. All IPs are allowed.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
