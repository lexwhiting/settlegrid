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

interface InviteData {
  inviteCode: string
  inviteUrl: string
  totalInvites: number
  bonusOpsEarned: number
  bonusOpsBalance: number
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatOps(ops: number): string {
  if (ops >= 1000) {
    return `${(ops / 1000).toFixed(ops % 1000 === 0 ? 0 : 1)}k`
  }
  return String(ops)
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
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
      setReferrals(json.referrals ?? [])
    } catch {
      setError('Network error loading referrals')
    }
  }

  async function fetchTools() {
    try {
      const res = await fetch('/api/tools')
      if (res.ok) {
        const json = await res.json()
        setTools((json.tools ?? []).filter((t: Tool) => t.status === 'active'))
      }
    } catch {
      // Silently handle
    }
  }

  async function fetchInviteData() {
    try {
      const res = await fetch('/api/developer/invite')
      if (res.ok) {
        const json = await res.json()
        setInviteData(json)
      }
    } catch {
      // Silently handle — invite section will just not render
    }
  }

  useEffect(() => {
    async function init() {
      await Promise.all([fetchReferrals(), fetchTools(), fetchInviteData()])
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

  function copyToClipboard(text: string, label?: string) {
    navigator.clipboard.writeText(text)
    setCopied(label ?? text)
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

      {/* Invite Developers Card */}
      {inviteData && (
        <Card className="border-brand/30 dark:border-brand/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
              </svg>
              Invite Developers
            </CardTitle>
            <CardDescription>
              Share this link. When someone signs up, you both get 5,000 free operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Invite link with copy */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center rounded-lg border border-gray-300 dark:border-[#2A2D3E] bg-gray-50 dark:bg-[#252836] px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 overflow-hidden">
                  <code className="truncate">{inviteData.inviteUrl}</code>
                </div>
                <Button
                  onClick={() => copyToClipboard(inviteData.inviteUrl, 'invite-url')}
                  className="shrink-0"
                  aria-label="Copy invite link"
                >
                  {copied === 'invite-url' ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                      </svg>
                      Copy Link
                    </span>
                  )}
                </Button>
              </div>

              {/* Invite stats */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo dark:text-gray-100 tabular-nums">{inviteData.totalInvites}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Successful Invites</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo dark:text-gray-100 tabular-nums">{formatOps(inviteData.bonusOpsEarned)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bonus Ops Earned</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatOps(inviteData.bonusOpsBalance)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bonus Ops Balance</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
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
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
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
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                No referrals yet. Referral links let you earn recurring commissions when others use tools through your link.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Create your first referral link above, or learn more in the{' '}
                <a href="/docs" className="text-brand hover:underline">referral program docs</a>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Referrals list">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
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
                          onClick={() => copyToClipboard(ref.referralCode)}
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
