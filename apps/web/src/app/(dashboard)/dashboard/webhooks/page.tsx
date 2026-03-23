'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { EmptyState } from '@/components/dashboard/empty-state'

interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  status: string
  secret: string
  lastDeliveryAt: string | null
  createdAt: string
}

interface WebhookDelivery {
  id: string
  event: string
  statusCode: number | null
  success: boolean
  attemptedAt: string
}

const WEBHOOK_EVENTS = [
  'invocation.completed',
  'invocation.failed',
  'credit.purchased',
  'credit.depleted',
  'payout.completed',
  'payout.failed',
  'tool.activated',
  'tool.deactivated',
  'key.created',
  'key.revoked',
] as const

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ url: '', events: [] as string[] })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({})
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(null)

  async function fetchEndpoints() {
    try {
      const res = await fetch('/api/developer/webhooks')
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to load webhooks'); return }
      setEndpoints(data.endpoints ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEndpoints() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (form.events.length === 0) {
      setError('Select at least one event')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/developer/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.url, events: form.events }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create webhook')
        return
      }
      setShowCreate(false)
      setForm({ url: '', events: [] })
      fetchEndpoints()
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  async function deleteEndpoint(id: string) {
    setError('')
    try {
      const res = await fetch(`/api/developer/webhooks/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete webhook')
        return
      }
      setEndpoints(endpoints.filter((ep) => ep.id !== id))
    } catch {
      setError('Failed to delete webhook')
    }
  }

  async function fetchDeliveries(endpointId: string) {
    if (expandedId === endpointId) {
      setExpandedId(null)
      return
    }
    setLoadingDeliveries(endpointId)
    try {
      const res = await fetch(`/api/developer/webhooks/${endpointId}/deliveries`)
      if (res.ok) {
        const data = await res.json()
        setDeliveries((prev) => ({ ...prev, [endpointId]: data.deliveries ?? [] }))
      }
    } catch {
      setError('Failed to load deliveries')
    } finally {
      setLoadingDeliveries(null)
      setExpandedId(endpointId)
    }
  }

  function toggleEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }))
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Webhooks' },
      ]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Webhooks</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Add Endpoint'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New Webhook Endpoint</CardTitle>
            <CardDescription>Receive real-time event notifications via HMAC-SHA256 signed HTTP POST requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint URL</label>
                <input
                  id="webhook-url"
                  type="url"
                  required
                  placeholder="https://your-server.com/webhooks/settlegrid"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Events</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-gray-300 dark:border-[#2E3148] text-brand focus:ring-brand"
                      />
                      <code className="text-xs bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded">{event}</code>
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Endpoint'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Endpoints List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-64 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : endpoints.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              }
              title="No webhook endpoints"
              description="Webhooks keep your backend in sync by pushing real-time events for invocations, payouts, and tool changes."
              onAction={() => setShowCreate(true)}
              actionLabel="Add Endpoint"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-4">
              All deliveries are HMAC-SHA256 signed. See the{' '}
              <a href="/docs" className="text-brand hover:underline">webhook integration guide</a>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {endpoints.map((ep) => (
            <Card key={ep.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <code className="text-sm font-medium text-indigo dark:text-gray-100 truncate">{ep.url}</code>
                      <Badge variant={ep.status === 'active' ? 'success' : 'destructive'}>
                        {ep.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ep.events.map((event) => (
                        <Badge key={event} variant="secondary" className="text-[10px]">{event}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Last delivery: {ep.lastDeliveryAt ? new Date(ep.lastDeliveryAt).toLocaleString() : 'Never'}
                      {' | '}
                      Created: {new Date(ep.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchDeliveries(ep.id)}
                      disabled={loadingDeliveries === ep.id}
                    >
                      {loadingDeliveries === ep.id ? 'Loading...' : expandedId === ep.id ? 'Hide' : 'Deliveries'}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteEndpoint(ep.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Deliveries panel */}
                {expandedId === ep.id && (
                  <div className="mt-4 border-t border-gray-100 dark:border-[#252836] pt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent Deliveries</h4>
                    {(deliveries[ep.id] ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No deliveries yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" role="table" aria-label="Webhook deliveries">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                              <th scope="col" className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Event</th>
                              <th scope="col" className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                              <th scope="col" className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">HTTP Code</th>
                              <th scope="col" className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(deliveries[ep.id] ?? []).map((del) => (
                              <tr key={del.id} className="border-b border-gray-100 dark:border-[#252836]">
                                <td className="py-2 px-3">
                                  <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{del.event}</code>
                                </td>
                                <td className="py-2 px-3">
                                  <Badge variant={del.success ? 'success' : 'destructive'}>
                                    {del.success ? 'Success' : 'Failed'}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{del.statusCode ?? '—'}</td>
                                <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{new Date(del.attemptedAt).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
