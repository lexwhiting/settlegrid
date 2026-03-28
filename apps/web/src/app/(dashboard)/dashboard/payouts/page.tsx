'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { EmptyState } from '@/components/dashboard/empty-state'

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
      setPayouts(data.payouts ?? [])
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
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Payouts' },
      ]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Payouts</h1>
        <Button onClick={triggerPayout} disabled={triggering}>
          {triggering ? 'Processing...' : 'Request Payout'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardContent>
        </Card>
      ) : payouts.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              }
              title="No payouts yet"
              description="Payouts let you withdraw your tool revenue directly to your bank account via Stripe Connect."
              actionLabel="Manage Tools"
              actionHref="/dashboard/tools"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-4">
              Payouts are triggered when your balance reaches $1. See{' '}
              <a href="/docs" className="text-brand hover:underline">payout docs</a> for details.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Payout history">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Period</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Platform Fee</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{formatDate(payout.createdAt)}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                        {formatDate(payout.periodStart)} - {formatDate(payout.periodEnd)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(payout.amountCents)}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{formatCents(payout.platformFeeCents)}</td>
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
