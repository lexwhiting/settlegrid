'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

// ── Types ───────────────────────────────────────────────────────────────────

interface ReferralData {
  referralCode: string
  referralUrl: string
  totalReferrals: number
  creditsEarnedCents: number
  creditsBalanceCents: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe / 100)
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ConsumerReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/consumer/referral')
      if (res.ok) {
        const json = await res.json()
        setData(json as ReferralData)
      } else {
        setError('Failed to load referral data.')
      }
    } catch {
      setError('Network error loading referral data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function copyLink() {
    if (!data?.referralUrl) return
    try {
      await navigator.clipboard.writeText(data.referralUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Consumer', href: '/consumer' }, { label: 'Referral' }]} />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Consumer', href: '/consumer' }, { label: 'Referral' }]} />

      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Referral Program</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Share SettleGrid with others and earn credits when they sign up.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Share Link */}
          <Card className="border-2 border-brand/30 bg-brand/5">
            <CardHeader>
              <CardTitle>Your Referral Link</CardTitle>
              <CardDescription>
                Share this link. When someone signs up and makes their first purchase, you both earn credits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-gray-100 dark:bg-[#252836] border border-gray-200 dark:border-[#2A2D3E] px-3 py-2.5 rounded-lg font-mono text-gray-700 dark:text-gray-300 truncate">
                  {data.referralUrl}
                </code>
                <Button onClick={copyLink} className="shrink-0">
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your referral code: <code className="font-mono bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded">{data.referralCode}</code>
              </p>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-indigo dark:text-gray-100">{data.totalReferrals}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Referrals</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCents(data.creditsEarnedCents)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Credits Earned</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-indigo dark:text-gray-100">{formatCents(data.creditsBalanceCents)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Credits Balance</p>
              </CardContent>
            </Card>
          </div>

          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 list-decimal list-inside text-sm text-gray-700 dark:text-gray-300">
                <li>Share your unique referral link with friends and colleagues.</li>
                <li>They sign up for a SettleGrid account using your link.</li>
                <li>When they make their first credit purchase, you both receive bonus credits.</li>
                <li>There is no limit to how many people you can refer.</li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Referral credits are applied automatically and never expire.{' '}
        <Link href="/consumer" className="text-brand hover:text-brand/80 transition-colors">
          Back to Consumer Dashboard
        </Link>
      </p>
    </div>
  )
}
