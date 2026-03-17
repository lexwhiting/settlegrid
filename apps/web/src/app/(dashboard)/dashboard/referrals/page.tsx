'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

interface Referral {
  id: string
  referredToolId: string
  toolName: string
  toolSlug: string
  referralCode: string
  commissionPct: number
  totalEarnedCents: number
  status: string
  createdAt: string
}

interface Tool {
  id: string
  name: string
  slug: string
  status: string
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ toolId: '', commissionPct: '10' })
  const [copied, setCopied] = useState<string | null>(null)

  async function fetchReferrals() {
    try {
      const res = await fetch('/api/developer/referrals')
      if (!res.ok) {
        setError('Failed to load referrals')
        return
      }
      const json = await res.json()
      setReferrals(json.data?.referrals ?? [])
    } catch {
      setError('Network error loading referrals')
    }
  }

  async function fetchTools() {
    try {
      const res = await fetch('/api/tools')
      if (res.ok) {
        const json = await res.json()
        setTools((json.data ?? []).filter((t: Tool) => t.status === 'active'))
      }
    } catch {
      // Silently handle
    }
  }

  useEffect(() => {
    async function init() {
      await Promise.all([fetchReferrals(), fetchTools()])
      setLoading(false)
    }
    init()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/developer/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: form.toolId,
          commissionPct: parseInt(form.commissionPct, 10),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create referral')
        return
      }
      setShowCreate(false)
      setForm({ toolId: '', commissionPct: '10' })
      fetchReferrals()
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  // Stats
  const totalReferrals = referrals.length
  const activeReferrals = referrals.filter((r) => r.status === 'active').length
  const totalEarnings = referrals.reduce((sum, r) => sum + r.totalEarnedCents, 0)

  // This month earnings (approximate: referrals created this month)
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthEarnings = referrals
    .filter((r) => new Date(r.createdAt) >= thisMonthStart)
    .reduce((sum, r) => sum + r.totalEarnedCents, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Referrals' },
        ]} />
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Referral Program</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Earn commissions by referring consumers to tools on SettleGrid.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Referrals' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Referral Program</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Earn commissions by referring consumers to tools on SettleGrid.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'New Referral'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Referrals" value={String(totalReferrals)} subtitle="All-time created" />
        <StatCard title="Active Referrals" value={String(activeReferrals)} subtitle="Currently earning" />
        <StatCard title="Total Earnings" value={formatCents(totalEarnings)} subtitle="All-time commissions" />
        <StatCard title="This Month" value={formatCents(thisMonthEarnings)} subtitle="March earnings" />
      </div>

      {/* Create Referral Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Referral Link</CardTitle>
            <CardDescription>Generate a unique referral code for an active tool.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="referral-tool" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tool</label>
                  <select
                    id="referral-tool"
                    required
                    value={form.toolId}
                    onChange={(e) => setForm({ ...form, toolId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Select a tool...</option>
                    {tools.map((tool) => (
                      <option key={tool.id} value={tool.id}>{tool.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="referral-commission" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Commission (%)</label>
                  <input
                    id="referral-commission"
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={form.commissionPct}
                    onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create Referral'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Referral Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No referrals yet. Create your first referral link to start earning commissions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Referrals list">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Referral Code</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Tool</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Commission</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Total Earned</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Created</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((ref) => (
                    <tr key={ref.id} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{ref.referralCode}</code>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-indigo dark:text-gray-100">{ref.toolName}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">/{ref.toolSlug}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{ref.commissionPct}%</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(ref.totalEarnedCents)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={ref.status === 'active' ? 'success' : 'destructive'}>{ref.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                        {new Date(ref.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => copyCode(ref.referralCode)}
                          className="text-xs text-brand-text hover:text-brand-dark font-medium"
                          aria-label={`Copy referral code ${ref.referralCode}`}
                        >
                          {copied === ref.referralCode ? 'Copied!' : 'Copy'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earnings Breakdown */}
      {referrals.filter((r) => r.totalEarnedCents > 0).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Earnings Breakdown</CardTitle>
            <CardDescription>Revenue earned per referral link.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrals
                .filter((r) => r.totalEarnedCents > 0)
                .sort((a, b) => b.totalEarnedCents - a.totalEarnedCents)
                .map((ref) => {
                  const maxEarned = Math.max(...referrals.map((r) => r.totalEarnedCents), 1)
                  const width = (ref.totalEarnedCents / maxEarned) * 100
                  return (
                    <div key={ref.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {ref.toolName}
                          <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">({ref.commissionPct}%)</span>
                        </span>
                        <span className="text-sm font-medium text-indigo dark:text-gray-100">{formatCents(ref.totalEarnedCents)}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-brand transition-all"
                          style={{ width: `${Math.max(width, 2)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
