'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

// ── Types ───────────────────────────────────────────────────────────────────

interface CreditPack {
  id: string
  label: string
  creditAmountCents: number
  priceCents: number
  discountPct: number
}

interface PurchaseHistory {
  id: string
  packId: string
  creditAmountCents: number
  priceCents: number
  status: string
  createdAt: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Page ────────────────────────────────────────────────────────────────────

export default function ConsumerCreditsPage() {
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [history, setHistory] = useState<PurchaseHistory[]>([])
  const [globalBalanceCents, setGlobalBalanceCents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [purchasing, setPurchasing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [packsRes, balanceRes, historyRes] = await Promise.all([
        fetch('/api/consumer/credit-packs'),
        fetch('/api/consumer/balance'),
        fetch('/api/consumer/purchases'),
      ])
      if (packsRes.ok) {
        const data = await packsRes.json()
        setPacks(data.packs ?? [])
      }
      if (balanceRes.ok) {
        const data = await balanceRes.json()
        setGlobalBalanceCents(data.globalBalanceCents ?? 0)
      }
      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.purchases ?? [])
      }
    } catch {
      setError('Failed to load credit pack data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function purchasePack(packId: string) {
    setPurchasing(packId)
    try {
      const res = await fetch('/api/consumer/credit-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl as string
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setError((data as Record<string, string>).error ?? 'Failed to initiate purchase.')
      }
    } catch {
      setError('Network error.')
    } finally {
      setPurchasing(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Consumer', href: '/consumer' }, { label: 'Credit Packs' }]} />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Consumer', href: '/consumer' }, { label: 'Credit Packs' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Credit Packs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Purchase credits in bulk at a discount. Credits apply across all tools.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Global Balance</p>
          <p className="text-xl font-bold text-indigo dark:text-gray-100">{formatCents(globalBalanceCents)}</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">
          {error}
        </div>
      )}

      {/* Credit Packs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packs.map((pack) => (
          <Card key={pack.id} className="relative overflow-hidden">
            {pack.discountPct > 0 && (
              <div className="absolute top-3 right-3">
                <Badge variant="success" className="text-xs">
                  {pack.discountPct}% off
                </Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-lg">{pack.label}</CardTitle>
              <CardDescription>
                {formatCents(pack.creditAmountCents)} in credits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold text-indigo dark:text-gray-100">
                  {formatCents(pack.priceCents)}
                </p>
                {pack.discountPct > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Save {formatCents(pack.creditAmountCents - pack.priceCents)}
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                onClick={() => purchasePack(pack.id)}
                disabled={purchasing === pack.id}
              >
                {purchasing === pack.id ? 'Redirecting...' : 'Purchase'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {packs.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No credit packs available at the moment. Check back soon or purchase credits directly from tool pages.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Purchase History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Purchase history">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Pack</th>
                    <th scope="col" className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Credits</th>
                    <th scope="col" className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Paid</th>
                    <th scope="col" className="text-center py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th scope="col" className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 dark:border-[#252836] last:border-0">
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{p.packId}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCents(p.creditAmountCents)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">{formatCents(p.priceCents)}</td>
                      <td className="py-2 pr-4 text-center">
                        <Badge variant={p.status === 'completed' ? 'success' : 'secondary'} className="text-[10px]">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right text-gray-500 dark:text-gray-400">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Credits never expire. All purchases are processed securely via Stripe.{' '}
        <Link href="/consumer" className="text-brand hover:text-brand/80 transition-colors">
          Back to Consumer Dashboard
        </Link>
      </p>
    </div>
  )
}
