'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { BarChart } from '@/components/charts/bar-chart'
import { AreaChart } from '@/components/charts/area-chart'
import { LiveIndicator } from '@/components/ui/live-indicator'
import { calculateTakeCents } from '@/lib/pricing'
import { showAchievementToasts } from '@/components/ui/achievement-toast'
import { SocialShare } from '@/components/ui/social-share'
import type { AchievementWithProgress, BadgeDefinition } from '@/lib/achievements'

interface DeveloperStats {
  totalRevenueCents: number
  totalInvocations: number
  toolCount: number
  recentInvocations: { hour: string; count: number; revenueCents?: number }[]
}

interface DeveloperProfile {
  stripeConnectStatus: string
  slug: string | null
  publicProfile: boolean
}

interface ToolSummary {
  id: string
  status: string
}

interface InviteStats {
  inviteCode: string
  inviteUrl: string
  totalInvites: number
  bonusOpsEarned: number
  bonusOpsBalance: number
}

interface AchievementsData {
  achievements: AchievementWithProgress[]
  newlyUnlocked: BadgeDefinition[]
  totalEarned: number
  totalBadges: number
}

const CHECKLIST_DISMISSED_KEY = 'settlegrid_checklist_dismissed'
const SDK_STEP_DISMISSED_KEY = 'settlegrid_sdk_step_dismissed'

interface UsageData {
  currentMonthOps: number
  tierLimit: number
  tier: string
  isFoundingMember: boolean
  usagePercent: number
  periodStart: string
  periodEnd: string
  daysRemaining: number
  overLimit: boolean
}

const TIER_LABELS: Record<string, string> = {
  standard: 'Free',
  builder: 'Builder',
  starter: 'Builder', // legacy alias
  growth: 'Builder', // legacy alias
  scale: 'Scale',
  enterprise: 'Enterprise',
}

interface AnalyticsData {
  methodBreakdown: { method: string; invocations: number; revenueCents: number; errorRate: number }[]
  revenueTrend: { date: string; revenueCents: number }[]
  topConsumers: { email: string; totalSpendCents: number; invocations: number }[]
  errorRate: number
  latencyPercentiles: { p50: number; p95: number; p99: number }
}

interface BenchmarkData {
  benchmarks: Array<{
    toolId: string
    toolName: string
    category: string
    yourPrice: number
    categoryMedian: number
    singleToolCategory: boolean
  }>
  periodDays: number
}

interface ForecastData {
  currentMonthRevenueCents: number
  projectedNextMonthCents: number
  growthRate: number
  trend: 'growing' | 'stable' | 'declining'
  dailyDataPoints: number
  confidence: 'low' | 'medium' | 'high'
}

interface NotificationConfig {
  slack?: string
  discord?: string
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

type Period = '7' | '30' | '90'

// ─── Badge Snippet ───────────────────────────────────────────────────────────

function BadgeSnippet({ label, markdown }: { label: string; markdown: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — silently fail
    }
  }

  return (
    <div>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2.5 py-1.5 rounded font-mono text-gray-700 dark:text-gray-300 max-w-md truncate block">
          {markdown}
        </code>
        <button
          onClick={copy}
          className="shrink-0 text-gray-400 hover:text-brand transition-colors"
          aria-label={`Copy ${label} markdown`}
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Discovery Card ───────────────────────────────────────────────────────────

function DiscoveryCard({ slug, publicProfile }: { slug: string | null; publicProfile: boolean }) {
  const [expanded, setExpanded] = useState(false)

  const profileUrl = slug ? `settlegrid.ai/dev/${slug}` : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <CardTitle className="text-lg">Discovery &amp; Profile</CardTitle>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Profile Status */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile status:</span>
            {publicProfile && slug ? (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                Not public
                <Link href="/dashboard/settings#profile" className="text-brand hover:text-brand/80 font-medium transition-colors">
                  Enable in Settings
                </Link>
              </span>
            )}
          </div>

          {/* Profile URL */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile URL:</span>
            {profileUrl ? (
              <a
                href={`/dev/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand hover:text-brand/80 transition-colors inline-flex items-center gap-1"
              >
                {profileUrl}
                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                <Link href="/dashboard/settings#profile" className="text-brand hover:text-brand/80 font-medium transition-colors">
                  Set your slug in Settings
                </Link>
              </span>
            )}
          </div>

          {/* README Badges */}
          {slug && (
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
                README Badges
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Add these to your GitHub README to build credibility and drive discovery.
              </p>
              <div className="space-y-3">
                <BadgeSnippet
                  label="Developer reputation badge"
                  markdown={`[![SettleGrid](https://settlegrid.ai/api/badge/dev/${slug})](https://settlegrid.ai/dev/${slug})`}
                />
                <BadgeSnippet
                  label="Powered by SettleGrid"
                  markdown={`[![Powered by SettleGrid](https://settlegrid.ai/api/badge/powered-by)](https://settlegrid.ai)`}
                />
              </div>
            </div>
          )}

          {/* Showcase reminder */}
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Your tools appear in the Showcase when active and your profile is public.
          </p>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Savings Calculator Card ──────────────────────────────────────────────────

/** Competitor take rates */
const COMPETITOR_RATES = [
  { name: 'MCPize', calc: (revCents: number) => Math.round(revCents * 0.15) },
  { name: 'xpay', calc: (revCents: number) => Math.round(revCents * 0.025) },
  {
    name: 'Stripe Direct',
    // 2.9% + 30c per transaction. Assume ~$5 avg transaction for tx count.
    calc: (revCents: number) => {
      const avgTxCents = 500
      const txCount = Math.max(1, Math.round(revCents / avgTxCents))
      return Math.round(revCents * 0.029 + txCount * 30)
    },
  },
]

function SavingsCard({ monthlyRevenueCents }: { monthlyRevenueCents: number }) {
  if (monthlyRevenueCents <= 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
            <CardTitle className="text-lg">Savings Calculator</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No data yet. Start earning to see your savings accumulate here.
          </p>
        </CardContent>
      </Card>
    )
  }

  const settleGridTakeCents = calculateTakeCents(monthlyRevenueCents)
  const revenueDollars = formatCents(monthlyRevenueCents)

  // Find the competitor with the highest take for the "You saved" headline
  const competitorSavings = COMPETITOR_RATES.map((c) => {
    const theirTake = c.calc(monthlyRevenueCents)
    const saved = theirTake - settleGridTakeCents
    return { name: c.name, takeCents: theirTake, savedCents: saved }
  })

  const bestSaving = competitorSavings.reduce((best, c) =>
    c.savedCents > best.savedCents ? c : best
  )

  return (
    <Card className="border-2 border-green-500/30 bg-green-50/5 dark:bg-green-900/10">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          <CardTitle className="text-lg">Savings Calculator</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          You saved <strong className="text-green-600 dark:text-green-400">{formatCents(bestSaving.savedCents)}</strong> this month by using SettleGrid instead of {bestSaving.name}.
        </p>

        {/* Comparison table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {competitorSavings.map((c) => (
            <div key={c.name} className="bg-white/50 dark:bg-[#161822] rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.name}</p>
              <p className="text-sm font-semibold text-red-500">{formatCents(c.takeCents)}</p>
            </div>
          ))}
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">SettleGrid</p>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCents(settleGridTakeCents)}</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Based on {revenueDollars} monthly revenue. SettleGrid uses progressive take rates: 0% on your first $1K, scaling to 5% above $50K.
        </p>
      </CardContent>
    </Card>
  )
}

export default function DeveloperDashboardPage() {
  const [stats, setStats] = useState<DeveloperStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [toolList, setToolList] = useState<ToolSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<Period>('30')
  const [checklistDismissed, setChecklistDismissed] = useState(false)
  const [sdkStepDismissed, setSdkStepDismissed] = useState(false)
  const [inviteStats, setInviteStats] = useState<InviteStats | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [achievementsData, setAchievementsData] = useState<AchievementsData | null>(null)
  const [shareAchievement, setShareAchievement] = useState<AchievementWithProgress | null>(null)
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null)
  const [forecastData, setForecastData] = useState<ForecastData | null>(null)
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setChecklistDismissed(localStorage.getItem(CHECKLIST_DISMISSED_KEY) === 'true')
      setSdkStepDismissed(localStorage.getItem(SDK_STEP_DISMISSED_KEY) === 'true')
    } catch {
      // localStorage unavailable (private browsing, storage full, etc.)
    }
  }, [])

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, analyticsRes, profileRes, toolsRes, usageRes, inviteRes, achievementsRes, benchmarkRes, forecastRes, notifConfigRes] = await Promise.all([
          fetch('/api/dashboard/developer/stats'),
          fetch('/api/dashboard/developer/stats/analytics'),
          fetch('/api/auth/developer/me'),
          fetch('/api/tools'),
          fetch('/api/dashboard/developer/usage'),
          fetch('/api/developer/invite'),
          fetch('/api/developer/achievements'),
          fetch('/api/dashboard/developer/benchmarks'),
          fetch('/api/dashboard/developer/stats/forecast'),
          fetch('/api/developer/notifications/configure'),
        ])
        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        } else {
          setError('Failed to load dashboard data')
        }
        if (analyticsRes.ok) {
          const data = await analyticsRes.json()
          setAnalytics(data)
        }
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data.developer as DeveloperProfile)
        }
        if (toolsRes.ok) {
          const data = await toolsRes.json()
          setToolList((data.tools ?? []).map((t: { id: string; status: string }) => ({ id: t.id, status: t.status })))
        }
        if (usageRes.ok) {
          const data = await usageRes.json()
          setUsage(data as UsageData)
        }
        if (inviteRes.ok) {
          const data = await inviteRes.json()
          setInviteStats(data as InviteStats)
        }
        if (achievementsRes.ok) {
          const data = (await achievementsRes.json()) as AchievementsData
          setAchievementsData(data)
          // Show toasts for newly unlocked achievements
          if (data.newlyUnlocked && data.newlyUnlocked.length > 0) {
            showAchievementToasts(data.newlyUnlocked)
          }
        }
        if (benchmarkRes.ok) {
          const data = await benchmarkRes.json()
          setBenchmarkData(data as BenchmarkData)
        }
        if (forecastRes.ok) {
          const data = await forecastRes.json()
          setForecastData(data as ForecastData)
        }
        if (notifConfigRes.ok) {
          const data = await notifConfigRes.json()
          setNotificationConfig((data.notificationWebhooks ?? {}) as NotificationConfig)
        }
      } catch {
        setError('Network error loading dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  function dismissChecklist() {
    try {
      localStorage.setItem(CHECKLIST_DISMISSED_KEY, 'true')
    } catch {
      // localStorage unavailable
    }
    setChecklistDismissed(true)
  }

  function dismissSdkStep() {
    try {
      localStorage.setItem(SDK_STEP_DISMISSED_KEY, 'true')
    } catch {
      // localStorage unavailable
    }
    setSdkStepDismissed(true)
  }

  // Checklist step completion
  const hasTools = (stats?.toolCount ?? 0) > 0
  const stripeConnected = profile?.stripeConnectStatus === 'active'
  const hasInvocations = (stats?.totalInvocations ?? 0) > 0
  const hasActiveTool = toolList.some((t) => t.status === 'active')
  const sdkInstalled = sdkStepDismissed
  const hasPublicProfile = !!profile?.publicProfile && !!profile?.slug

  const checklistSteps = [
    { key: 'create-tool', label: 'Create your first tool', description: 'Register an MCP tool to start metering usage and collecting payments.', done: hasTools, href: '/dashboard/tools', cta: 'Create Tool' },
    { key: 'connect-stripe', label: 'Connect Stripe for payouts', description: 'Earn now, cash out later — your revenue accrues while you set up Stripe. Connect anytime to withdraw.', done: stripeConnected, href: '/dashboard/settings#payouts', cta: 'Connect Stripe' },
    { key: 'install-sdk', label: 'Install the SDK', description: 'Add the SettleGrid SDK to your project.', done: sdkInstalled, href: null, cta: null },
    { key: 'test-invocation', label: 'Make a test invocation', description: 'Send a test call to verify metering is working.', done: hasInvocations, href: '/docs', cta: 'View Docs' },
    { key: 'go-live', label: 'Go live', description: 'Activate a tool to start accepting production traffic.', done: hasActiveTool, href: '/dashboard/tools', cta: 'Manage Tools' },
    { key: 'public-profile', label: 'Set up your public profile', description: 'Enable your profile and choose a slug so consumers and AI agents can discover you.', done: hasPublicProfile, href: '/dashboard/settings#profile', cta: 'Edit Profile' },
  ]

  const completedCount = checklistSteps.filter((s) => s.done).length
  const allComplete = completedCount === checklistSteps.length
  const showChecklist = !checklistDismissed && !allComplete && !loading

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Dashboard</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm" role="alert">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />

      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Dashboard</h1>
          <LiveIndicator connected={!!stats} />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#252836] rounded-lg p-1">
          {(['7', '30', '90'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-white dark:bg-[#161822] text-indigo dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Invite Developers — prominent referral card */}
      {inviteStats && (
        <Card className="border-2 border-amber-500/40 bg-amber-50/5 dark:bg-amber-900/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <CardTitle className="text-xl">Invite Developers</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Share this link. Both you and your invite get <strong className="text-amber-600 dark:text-amber-400">5,000 free operations</strong>.
            </p>

            {/* Invite URL with copy */}
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-gray-100 dark:bg-[#252836] border border-gray-200 dark:border-[#2A2D3E] px-3 py-2.5 rounded-lg font-mono text-gray-700 dark:text-gray-300 truncate">
                {inviteStats.inviteUrl}
              </code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteStats.inviteUrl)
                    setInviteCopied(true)
                    setTimeout(() => setInviteCopied(false), 2000)
                  } catch {
                    // Clipboard API unavailable
                  }
                }}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
                aria-label="Copy invite URL"
              >
                {inviteCopied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Invite stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 dark:bg-[#161822] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{inviteStats.totalInvites}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Invites sent</p>
              </div>
              <div className="bg-white/50 dark:bg-[#161822] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{inviteStats.bonusOpsEarned.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bonus ops earned</p>
              </div>
            </div>

            <Link href="/dashboard/referrals" className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors">
              View all referrals
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Getting Started Checklist */}
      {showChecklist && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Getting Started</CardTitle>
              <button
                onClick={dismissChecklist}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Dismiss checklist"
              >
                Dismiss
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {completedCount} of {checklistSteps.length} complete
            </p>
            {/* Progress bar */}
            <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-2 mt-2">
              <div
                className="h-2 rounded-full bg-brand transition-all"
                style={{ width: `${(completedCount / checklistSteps.length) * 100}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-gray-100 dark:divide-[#252836]">
              {checklistSteps.map((step) => (
                <div key={step.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  {/* Checkbox icon */}
                  <div className="mt-0.5 shrink-0">
                    {step.done ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    )}
                  </div>
                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-indigo dark:text-gray-100'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {step.description}
                    </p>
                    {/* SDK install snippet */}
                    {step.key === 'install-sdk' && !step.done && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 dark:bg-[#252836] px-2.5 py-1.5 rounded font-mono text-gray-700 dark:text-gray-300">
                            npm install @settlegrid/mcp
                          </code>
                          <button
                            onClick={dismissSdkStep}
                            className="text-xs text-brand hover:text-brand/80 font-medium transition-colors"
                          >
                            Mark done
                          </button>
                        </div>
                        <Link
                          href="/docs#cli-tools"
                          className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand/80 font-medium transition-colors"
                        >
                          View all CLI tools
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                          </svg>
                        </Link>
                      </div>
                    )}
                  </div>
                  {/* CTA */}
                  {!step.done && step.href && step.cta && (
                    <Link href={step.href} className="shrink-0">
                      <Button variant="outline" size="sm">
                        {step.cta}
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discovery & Profile */}
      {!loading && (
        <DiscoveryCard
          slug={profile?.slug ?? null}
          publicProfile={profile?.publicProfile ?? false}
        />
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCents(stats?.totalRevenueCents ?? 0)}
          subtitle="Progressive take rate applied at payout"
          animate
        />
        <StatCard
          title="Total Invocations"
          value={(stats?.totalInvocations ?? 0).toLocaleString()}
          subtitle="All-time tool calls"
          animate
        />
        <StatCard
          title="Active Tools"
          value={String(stats?.toolCount ?? 0)}
          subtitle="Published tools"
          animate
        />
        <StatCard
          title="Revenue (24h)"
          value={formatCents(
            (stats?.recentInvocations ?? []).reduce((sum, r) => sum + (r.revenueCents ?? 0), 0)
          )}
          subtitle="Last 24 hours"
          animate
        />
      </div>

      {/* Savings Calculator */}
      <SavingsCard monthlyRevenueCents={stats?.totalRevenueCents ?? 0} />

      {/* Phase 3 Cards: Benchmarking, Forecast, Notification Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Benchmarking Summary (Builder+) */}
        {benchmarkData && benchmarkData.benchmarks.length > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <CardTitle className="text-base">Category Benchmark</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {benchmarkData.benchmarks.slice(0, 3).map((b) => {
                const diff = b.categoryMedian > 0
                  ? Math.round(((b.yourPrice - b.categoryMedian) / b.categoryMedian) * 100)
                  : 0
                const label = diff > 5 ? `${diff}% above` : diff < -5 ? `${Math.abs(diff)}% below` : 'at'
                return (
                  <div key={b.toolId} className="text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{b.toolName}</span>
                    {b.singleToolCategory ? (
                      <span className="text-gray-400 dark:text-gray-500 ml-1">(only tool in category)</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        priced {label} category median
                      </span>
                    )}
                  </div>
                )
              })}
              <Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand/80 font-medium transition-colors mt-2">
                View full benchmarks
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </CardContent>
          </Card>
        ) : benchmarkData === null && !loading ? (
          <Card className="border-dashed border-gray-200 dark:border-[#2A2D3E]">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Category Benchmarking</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Upgrade to Builder to compare your tools against the market.</p>
              <Link href="/pricing" className="inline-block mt-3">
                <Button variant="outline" size="sm">Upgrade to Builder</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {/* Revenue Forecast (Builder+) */}
        {forecastData && forecastData.projectedNextMonthCents > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
                <CardTitle className="text-base">Revenue Forecast</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold text-indigo dark:text-gray-100">
                {formatCents(forecastData.projectedNextMonthCents)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Projected next month
                {forecastData.growthRate !== 0 && (
                  <span className={forecastData.growthRate > 0 ? 'text-green-600 dark:text-green-400 ml-1' : 'text-red-500 ml-1'}>
                    ({forecastData.growthRate > 0 ? '+' : ''}{Math.round(forecastData.growthRate * 100)}%)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  forecastData.trend === 'growing'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : forecastData.trend === 'declining'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-[#252836] dark:text-gray-400'
                }`}>
                  {forecastData.trend}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {forecastData.confidence} confidence
                </span>
              </div>
            </CardContent>
          </Card>
        ) : forecastData === null && !loading ? (
          <Card className="border-dashed border-gray-200 dark:border-[#2A2D3E]">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Revenue Forecasting</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Upgrade to Builder to see revenue projections.</p>
              <Link href="/pricing" className="inline-block mt-3">
                <Button variant="outline" size="sm">Upgrade to Builder</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {/* Notification Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <CardTitle className="text-base">Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Slack</span>
              {notificationConfig?.slack ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Connected
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">Not connected</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Discord</span>
              {notificationConfig?.discord ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Connected
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">Not connected</span>
              )}
            </div>
            {!notificationConfig?.slack && !notificationConfig?.discord && (
              <Link href="/dashboard/settings#notifications" className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand/80 font-medium transition-colors">
                Set up notifications
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      {achievementsData && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.672c-.992 0-1.929-.24-2.77-.672" />
                </svg>
                <CardTitle className="text-lg">Achievements</CardTitle>
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {achievementsData.totalEarned} / {achievementsData.totalBadges} earned
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {achievementsData.achievements.map((achievement) => {
                const isUnlocked = achievement.unlocked
                const progressPct =
                  achievement.target && achievement.target > 0
                    ? Math.min(Math.round(((achievement.progress ?? 0) / achievement.target) * 100), 100)
                    : 0

                return (
                  <button
                    key={achievement.badgeKey}
                    onClick={() => {
                      if (isUnlocked) setShareAchievement(achievement)
                    }}
                    disabled={!isUnlocked}
                    className={`relative group flex flex-col items-center gap-1.5 rounded-lg p-3 text-center transition-all ${
                      isUnlocked
                        ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-700/30 hover:border-amber-400 dark:hover:border-amber-500/50 cursor-pointer'
                        : 'bg-gray-50 dark:bg-[#1a1d2e] border border-gray-200/40 dark:border-[#252836] opacity-60 cursor-default'
                    }`}
                    aria-label={
                      isUnlocked
                        ? `${achievement.badge.name} - unlocked. Click to share.`
                        : `${achievement.badge.name} - locked. ${progressPct}% progress.`
                    }
                  >
                    {/* Badge icon */}
                    <span className={`text-2xl ${isUnlocked ? '' : 'grayscale'}`} aria-hidden="true">
                      {isUnlocked ? achievement.badge.icon : '???'}
                    </span>

                    {/* Badge name */}
                    <span className={`text-xs font-medium leading-tight ${
                      isUnlocked
                        ? 'text-gray-800 dark:text-gray-200'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {isUnlocked ? achievement.badge.name : '???'}
                    </span>

                    {/* Progress bar for locked badges */}
                    {!isUnlocked && achievement.target && achievement.target > 1 && (
                      <div className="w-full mt-0.5">
                        <div className="w-full bg-gray-200 dark:bg-[#252836] rounded-full h-1">
                          <div
                            className="h-1 rounded-full bg-amber-400/60 transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {achievement.progress}/{achievement.target}
                        </p>
                      </div>
                    )}

                    {/* Unlock date tooltip for earned badges */}
                    {isUnlocked && achievement.unlockedAt && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {new Date(achievement.unlockedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Social share popover for selected achievement */}
            {shareAchievement && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-[#1a1d2e] rounded-lg border border-gray-200 dark:border-[#252836]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Share: {shareAchievement.badge.icon} {shareAchievement.badge.name}
                  </p>
                  <button
                    onClick={() => setShareAchievement(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label="Close share panel"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <SocialShare
                  type="achievement"
                  badgeName={shareAchievement.badge.name}
                  badgeIcon={shareAchievement.badge.icon}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage Tracking Widget */}
      {usage && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Monthly Usage</CardTitle>
              <div className="flex items-center gap-2">
                {usage.isFoundingMember && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                    ⭐ Founding Member
                  </span>
                )}
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#252836] text-gray-600 dark:text-gray-300">
                  {usage.isFoundingMember ? 'Scale (lifetime)' : `${TIER_LABELS[usage.tier] ?? usage.tier} plan`}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-medium text-indigo dark:text-gray-100">
                  {usage.currentMonthOps.toLocaleString()} / {usage.tierLimit.toLocaleString()} operations this month ({usage.usagePercent}%)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {usage.daysRemaining} day{usage.daysRemaining !== 1 ? 's' : ''} remaining
                </p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ease-out ${
                    usage.usagePercent >= 90
                      ? 'bg-red-500'
                      : usage.usagePercent >= 70
                        ? 'bg-amber-500'
                        : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(usage.usagePercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Warnings */}
            {usage.overLimit && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-3 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    You have exceeded your monthly operation limit
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">
                    Your tools still work, but consider upgrading for higher limits.
                  </p>
                </div>
                <Link href="/dashboard/settings#plan" className="shrink-0">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                    Upgrade
                  </Button>
                </Link>
              </div>
            )}
            {!usage.overLimit && usage.usagePercent >= 80 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Approaching your monthly limit
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5">
                    You have used {usage.usagePercent}% of your monthly operations.
                  </p>
                </div>
                <Link href="/dashboard/settings#plan" className="shrink-0">
                  <Button variant="outline" size="sm">
                    Upgrade
                  </Button>
                </Link>
              </div>
            )}

            {/* Reset date */}
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Operations reset on{' '}
              {new Date(usage.periodEnd).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>

            {/* Upgrade prompt for free-tier users */}
            {!usage.isFoundingMember && (usage.tier === 'free' || usage.tier === 'standard') && !usage.overLimit && usage.usagePercent < 80 && (
              <div className="bg-brand/5 border border-brand/20 rounded-lg p-3 flex items-start gap-3">
                <svg className="w-5 h-5 text-brand shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Unlock sandbox mode, notifications, benchmarking, and more
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Builder plan starts at $19/mo with 200K ops and priority listing.
                  </p>
                </div>
                <Link href="/pricing" className="shrink-0">
                  <Button variant="outline" size="sm">
                    View Plans
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Rate & Latency */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Error Rate"
            value={`${(analytics.errorRate * 100).toFixed(2)}%`}
            subtitle="Last 30 days"
          />
          <StatCard
            title="Latency (p50)"
            value={`${analytics.latencyPercentiles.p50}ms`}
            subtitle="Median response time"
          />
          <StatCard
            title="Latency (p95)"
            value={`${analytics.latencyPercentiles.p95}ms`}
            subtitle="95th percentile"
          />
          <StatCard
            title="Latency (p99)"
            value={`${analytics.latencyPercentiles.p99}ms`}
            subtitle="99th percentile"
          />
        </div>
      )}

      {/* Invocation chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invocations (Last 24 Hours)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentInvocations && stats.recentInvocations.length > 0 ? (
            <BarChart
              data={stats.recentInvocations.map((point, i) => ({
                hour: point.hour || String(i),
                count: point.count,
              }))}
              xKey="hour"
              yKey="count"
              height={200}
              ariaLabel="Invocations per hour over the last 24 hours"
              formatXAxis={(v) => {
                const h = parseInt(v, 10)
                return isNaN(h) ? v : `${h}:00`
              }}
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No activity yet. Publish your first tool to start earning.</p>
          )}
        </CardContent>
      </Card>

      {/* Revenue Trend */}
      {analytics?.revenueTrend && analytics.revenueTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart
              data={analytics.revenueTrend.map((day) => ({
                date: day.date,
                revenue: day.revenueCents,
              }))}
              xKey="date"
              yKey="revenue"
              height={220}
              ariaLabel="Revenue trend over the last 30 days"
              formatValue={(v) =>
                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v / 100)
              }
              formatXAxis={(v) =>
                new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Method Breakdown */}
      {analytics?.methodBreakdown && analytics.methodBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Method breakdown">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Method</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Invocations</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.methodBreakdown.map((method: Record<string, unknown>) => (
                    <tr key={String(method.method)} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{String(method.method)}</code>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{(Number(method.invocations ?? method.count ?? 0)).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(Number(method.revenueCents ?? method.totalRevenueCents ?? 0))}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={Number(method.errorRate ?? 0) > 0.05 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}>
                          {(Number(method.errorRate ?? 0) * 100).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Consumers */}
      {analytics?.topConsumers && analytics.topConsumers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Consumers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Top consumers">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Consumer</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Total Spend</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Invocations</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topConsumers.slice(0, 5).map((consumer: Record<string, unknown>, i: number) => (
                    <tr key={String(consumer.email ?? consumer.consumerId ?? i)} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">{i + 1}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{String(consumer.email ?? consumer.consumerId ?? 'Unknown')}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo dark:text-gray-100">{formatCents(Number(consumer.totalSpendCents ?? 0))}</td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">{(Number(consumer.invocations ?? consumer.invocationCount ?? 0)).toLocaleString()}</td>
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
