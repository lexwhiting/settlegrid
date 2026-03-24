'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Purchase {
  id: string
  toolId: string
  toolName: string
  amountCents: number
  stripePaymentIntentId: string | null
  status: string
  createdAt: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PurchaseHistory() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchPurchases() {
      try {
        const res = await fetch('/api/consumer/purchases')
        if (res.ok) {
          const data = await res.json()
          setPurchases(data.purchases ?? [])
        } else {
          setError('Failed to load purchase history')
        }
      } catch {
        setError('Failed to load purchase history')
      } finally {
        setLoading(false)
      }
    }
    fetchPurchases()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase History</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3 mb-4" role="alert">
            {error}
          </div>
        )}

        {purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#252836] flex items-center justify-center mb-3 text-gray-400" aria-hidden="true">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No purchases yet. Browse the <Link href="/tools" className="text-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded">tool marketplace</Link> to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Purchase history">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tool</th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="text-center py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b border-gray-100 dark:border-[#252836] last:border-0"
                  >
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(purchase.createdAt)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-indigo dark:text-gray-100">
                      {purchase.toolName || 'Unknown Tool'}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCents(purchase.amountCents)}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <Badge variant={purchase.status === 'completed' ? 'success' : 'warning'}>
                        {purchase.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      {purchase.stripePaymentIntentId ? (
                        <a
                          href={`https://dashboard.stripe.com/payments/${purchase.stripePaymentIntentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded"
                          aria-label={`View receipt for ${purchase.toolName || 'purchase'}`}
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">&mdash;</span>
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
  )
}
