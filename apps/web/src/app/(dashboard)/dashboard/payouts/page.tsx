'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Payout {
  id: string
  amountCents: number
  platformFeeCents: number
  status: string
  periodStart: string
  periodEnd: string
  createdAt: string
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [triggering, setTriggering] = useState(false)

  async function fetchPayouts() {
    try {
      const res = await fetch('/api/payouts')
      if (!res.ok) { setError('Failed to load payouts'); return }
      const data = await res.json()
      setPayouts(data.data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayouts() }, [])

  async function triggerPayout() {
    setTriggering(true)
    setError('')
    try {
      const res = await fetch('/api/payouts/trigger', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to trigger payout'); return }
      fetchPayouts()
    } catch {
      setError('Network error')
    } finally {
      setTriggering(false)
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success' as const
      case 'pending': return 'warning' as const
      case 'failed': return 'destructive' as const
      default: return 'secondary' as const
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo">Payouts</h1>
        <Button onClick={triggerPayout} disabled={triggering}>
          {triggering ? 'Processing...' : 'Request Payout'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">{error}</div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-48 mb-2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-64" />
          </CardContent>
        </Card>
      ) : payouts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-400">No payouts yet. Payouts are processed when your balance reaches the minimum threshold ($25).</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Period</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Amount</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Platform Fee</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-700">{formatDate(payout.createdAt)}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {formatDate(payout.periodStart)} - {formatDate(payout.periodEnd)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-indigo">{formatCents(payout.amountCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500">{formatCents(payout.platformFeeCents)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(payout.status)}>{payout.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
