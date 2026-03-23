'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

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

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Consumer Dashboard</h1>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Consumer Dashboard</h1>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

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
                return (
                  <div key={b.toolId} className="border border-gray-100 dark:border-[#252836] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-indigo dark:text-gray-100">{b.toolName}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">/{b.toolSlug}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {b.autoRefill && <Badge variant="secondary">Auto-refill</Badge>}
                        <span className="font-semibold text-brand-text">{formatCents(b.balanceCents)}</span>
                        <a
                          href={`/tools/${b.toolSlug}`}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252836] h-9 px-3 transition-colors"
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
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <span className="font-medium text-indigo dark:text-gray-100">{budget.toolName}</span>
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
                            className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1 text-sm focus:ring-2 focus:ring-brand"
                          />
                        </div>
                        <div>
                          <label htmlFor={`period-${budget.toolId}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Period</label>
                          <select
                            id={`period-${budget.toolId}`}
                            value={budgetForm.period}
                            onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1 text-sm focus:ring-2 focus:ring-brand"
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
                            className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1 text-sm focus:ring-2 focus:ring-brand"
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
                        <dd className={`font-medium ${budget.currentSpendCents / budget.spendingLimitCents > 0.8 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                          {formatCents(budget.currentSpendCents)}
                        </dd>
                      </div>
                    </dl>
                  )}

                  {/* Spend progress bar */}
                  {editingBudget !== budget.toolId && budget.spendingLimitCents > 0 && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            budget.currentSpendCents / budget.spendingLimitCents > 0.8 ? 'bg-red-50 dark:bg-red-900/200' : 'bg-brand'
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
                          <Button variant="destructive" size="sm" onClick={() => revokeKey(key.id)}>
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
                              className="flex h-8 flex-1 rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-2 py-1 text-xs focus:ring-2 focus:ring-brand"
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
                                  className="text-gray-500 dark:text-gray-400 hover:text-red-500 ml-0.5"
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
