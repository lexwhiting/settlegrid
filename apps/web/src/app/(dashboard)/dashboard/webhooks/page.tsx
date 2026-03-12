'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
      const res = await fetch('/api/dashboard/developer/webhooks')
      if (!res.ok) { setError('Failed to load webhooks'); return }
      const data = await res.json()
      setEndpoints(data.data ?? [])
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
      const res = await fetch('/api/dashboard/developer/webhooks', {
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
      const res = await fetch(`/api/dashboard/developer/webhooks/${id}`, { method: 'DELETE' })
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
      const res = await fetch(`/api/dashboard/developer/webhooks/${endpointId}/deliveries`)
      if (res.ok) {
        const data = await res.json()
        setDeliveries((prev) => ({ ...prev, [endpointId]: data.data ?? [] }))
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo">Webhooks</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Add Endpoint'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">{error}</div>
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
                <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
                <input
                  id="webhook-url"
                  type="url"
                  required
                  placeholder="https://your-server.com/webhooks/settlegrid"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{event}</code>
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
                <div className="h-5 bg-gray-200 rounded animate-pulse w-64 mb-2" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : endpoints.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 mb-4">No webhook endpoints configured. Add one to receive real-time event notifications.</p>
            <Button onClick={() => setShowCreate(true)}>Add Endpoint</Button>
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
                      <code className="text-sm font-medium text-indigo truncate">{ep.url}</code>
                      <Badge variant={ep.status === 'active' ? 'success' : 'destructive'}>
                        {ep.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ep.events.map((event) => (
                        <Badge key={event} variant="secondary" className="text-[10px]">{event}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
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
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Deliveries</h4>
                    {(deliveries[ep.id] ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500">No deliveries yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" role="table" aria-label="Webhook deliveries">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th scope="col" className="text-left py-2 px-3 font-medium text-gray-500">Event</th>
                              <th scope="col" className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                              <th scope="col" className="text-left py-2 px-3 font-medium text-gray-500">HTTP Code</th>
                              <th scope="col" className="text-left py-2 px-3 font-medium text-gray-500">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(deliveries[ep.id] ?? []).map((del) => (
                              <tr key={del.id} className="border-b border-gray-100">
                                <td className="py-2 px-3">
                                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{del.event}</code>
                                </td>
                                <td className="py-2 px-3">
                                  <Badge variant={del.success ? 'success' : 'destructive'}>
                                    {del.success ? 'Success' : 'Failed'}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3 text-gray-500">{del.statusCode ?? '—'}</td>
                                <td className="py-2 px-3 text-gray-500">{new Date(del.attemptedAt).toLocaleString()}</td>
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
