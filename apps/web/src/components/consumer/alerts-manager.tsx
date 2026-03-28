'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

type AlertType = 'low_balance' | 'budget_exceeded' | 'usage_spike'
type AlertChannel = 'email' | 'webhook'
type AlertStatus = 'active' | 'paused'

interface ConsumerAlert {
  id: string
  toolId: string
  toolName: string
  alertType: AlertType
  threshold: number
  channel: AlertChannel
  status: AlertStatus
  lastTriggeredAt: string | null
  createdAt: string
}

interface AlertsManagerProps {
  tools: { toolId: string; toolName: string }[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  low_balance: 'Low Balance',
  budget_exceeded: 'Budget Exceeded',
  usage_spike: 'Usage Spike',
}

const ALERT_TYPE_COLORS: Record<AlertType, string> = {
  low_balance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  budget_exceeded: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  usage_spike: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
}

const THRESHOLD_HINTS: Record<AlertType, string> = {
  low_balance: 'Balance threshold in cents (e.g. 500 = $5.00)',
  budget_exceeded: 'Budget percentage (e.g. 80 = 80%)',
  usage_spike: 'Invocation count threshold',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AlertsManager({ tools }: AlertsManagerProps) {
  const [alerts, setAlerts] = useState<ConsumerAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formType, setFormType] = useState<AlertType>('low_balance')
  const [formToolId, setFormToolId] = useState(tools[0]?.toolId ?? '')
  const [formThreshold, setFormThreshold] = useState('')
  const [formChannel, setFormChannel] = useState<AlertChannel>('email')

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/consumer/alerts')
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts ?? [])
      }
    } catch {
      setError('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  async function handleCreate() {
    if (!formToolId || !formThreshold) return
    const threshold = parseInt(formThreshold, 10)
    if (isNaN(threshold) || threshold < 1) {
      setError('Threshold must be at least 1')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/consumer/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: formToolId,
          alertType: formType,
          threshold,
          channel: formChannel,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create alert')
        return
      }
      // Re-fetch to get toolName from the joined query
      await fetchAlerts()
      setShowForm(false)
      setFormThreshold('')
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(alert: ConsumerAlert) {
    const newStatus: AlertStatus = alert.status === 'active' ? 'paused' : 'active'
    setTogglingId(alert.id)
    setError('')
    try {
      const res = await fetch(`/api/consumer/alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update alert')
        return
      }
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, status: newStatus } : a))
      )
    } catch {
      setError('Network error')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setError('')
    try {
      const res = await fetch(`/api/consumer/alerts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete alert')
        return
      }
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError('Network error')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Get notified about balance changes, budget limits, and usage spikes.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : '+ New Alert'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3 mb-4" role="alert">
            {error}
          </div>
        )}

        {/* Create Alert Form */}
        {showForm && (
          <div className="border border-gray-200 dark:border-[#2A2D3E] rounded-lg p-4 mb-4 bg-gray-50 dark:bg-[#252836]/50">
            <h4 className="text-sm font-medium text-indigo dark:text-gray-100 mb-3">New Alert</h4>
            {tools.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No tools available. Purchase credits for a tool first to create alerts.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="alert-type" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Alert Type
                    </label>
                    <select
                      id="alert-type"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AlertType)}
                      className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] px-3 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand focus-visible:outline-none"
                    >
                      <option value="low_balance">Low Balance</option>
                      <option value="budget_exceeded">Budget Exceeded</option>
                      <option value="usage_spike">Usage Spike</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="alert-tool" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Tool
                    </label>
                    <select
                      id="alert-tool"
                      value={formToolId}
                      onChange={(e) => setFormToolId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] px-3 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand focus-visible:outline-none"
                    >
                      {tools.map((t) => (
                        <option key={t.toolId} value={t.toolId}>{t.toolName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="alert-threshold" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Threshold
                    </label>
                    <input
                      id="alert-threshold"
                      type="number"
                      min="1"
                      value={formThreshold}
                      onChange={(e) => setFormThreshold(e.target.value)}
                      placeholder="e.g. 500"
                      className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] px-3 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand focus-visible:outline-none placeholder:text-gray-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">{THRESHOLD_HINTS[formType]}</p>
                  </div>

                  <div>
                    <label htmlFor="alert-channel" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Channel
                    </label>
                    <select
                      id="alert-channel"
                      value={formChannel}
                      onChange={(e) => setFormChannel(e.target.value as AlertChannel)}
                      className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] px-3 py-1 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand focus-visible:outline-none"
                    >
                      <option value="email">Email</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <Button size="sm" onClick={handleCreate} disabled={submitting || !formToolId || !formThreshold}>
                    {submitting ? 'Creating...' : 'Create Alert'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Alert List */}
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#252836] flex items-center justify-center mb-3 text-gray-400" aria-hidden="true">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              No alerts configured. Set up alerts to get notified about balance changes and usage spikes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="border border-gray-100 dark:border-[#252836] rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Alert type badge */}
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                    ALERT_TYPE_COLORS[alert.alertType]
                  )}>
                    {ALERT_TYPE_LABELS[alert.alertType]}
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-indigo dark:text-gray-100 truncate">
                      {alert.toolName || 'Unknown Tool'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Threshold: {alert.threshold}
                      <span className="mx-1.5">&middot;</span>
                      Channel: {alert.channel}
                      {alert.lastTriggeredAt && (
                        <>
                          <span className="mx-1.5">&middot;</span>
                          Last fired: {new Date(alert.lastTriggeredAt).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={alert.status === 'active' ? 'success' : 'secondary'}>
                    {alert.status}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-2"
                    onClick={() => toggleStatus(alert)}
                    disabled={togglingId === alert.id}
                    aria-label={alert.status === 'active' ? `Pause alert for ${alert.toolName || 'tool'}` : `Resume alert for ${alert.toolName || 'tool'}`}
                  >
                    {togglingId === alert.id ? '...' : alert.status === 'active' ? 'Pause' : 'Resume'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    onClick={() => handleDelete(alert.id)}
                    disabled={deletingId === alert.id}
                    aria-label={`Delete alert for ${alert.toolName}`}
                  >
                    {deletingId === alert.id ? '...' : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
