'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function ConsumerDashboardPage() {
  const [balances, setBalances] = useState<ToolBalance[]>([])
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const [balRes, keyRes] = await Promise.all([
          fetch('/api/consumer/balance'),
          fetch('/api/consumer/keys'),
        ])
        if (balRes.ok) {
          const balData = await balRes.json()
          setBalances(balData.data)
        }
        if (keyRes.ok) {
          const keyData = await keyRes.json()
          setKeys(keyData.data)
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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-indigo">Consumer Dashboard</h1>
        <Card>
          <CardContent className="p-6">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-indigo">Consumer Dashboard</h1>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Credit Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-gray-400 text-sm">No credits yet. Browse tools and purchase credits to get started.</p>
          ) : (
            <div className="space-y-3">
              {balances.map((b) => (
                <div key={b.toolId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="font-medium text-indigo">{b.toolName}</span>
                    <span className="text-gray-400 text-sm ml-2">/{b.toolSlug}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.autoRefill && <Badge variant="secondary">Auto-refill</Badge>}
                    <span className="font-semibold text-brand">{formatCents(b.balanceCents)}</span>
                    <a
                      href={`/tools/${b.toolSlug}`}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-9 px-3 transition-colors"
                    >
                      Add Credits
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-gray-400 text-sm">No API keys yet. Create a key from a tool storefront to start making API calls.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Key</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Last Used</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Created</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">{key.keyPrefix}...</code>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={key.status === 'active' ? 'success' : 'destructive'}>{key.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{new Date(key.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right">
                        {key.status === 'active' && (
                          <Button variant="destructive" size="sm" onClick={() => revokeKey(key.id)}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
