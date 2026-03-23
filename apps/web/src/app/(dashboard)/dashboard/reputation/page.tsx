'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ReputationData {
  developerId: string
  name: string | null
  score: number
  breakdown: {
    responseTimePct: number
    uptimePct: number
    reviewAvg: number
    totalTools: number
    totalConsumers: number
  }
  calculatedAt: string
}

interface DeveloperProfile {
  id: string
  email: string
  name: string | null
  publicProfile: boolean
  publicBio: string | null
}

interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  body: string
  action: { label: string; href: string }
  impact: string
}

type ReputationTier = 'new' | 'verified' | 'established' | 'trusted' | 'premier'

interface TierInfo {
  tier: ReputationTier
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: React.ReactNode
  description: string
}

const TIER_INFO: Record<ReputationTier, Omit<TierInfo, 'tier'>> = {
  new: {
    label: 'New Developer',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800/60',
    borderColor: 'border-gray-300 dark:border-gray-700',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
    description: 'Just getting started. Register your first tool to level up.',
  },
  verified: {
    label: 'Verified',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-300 dark:border-blue-700',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    description: 'You have at least one active tool and a score of 40+.',
  },
  established: {
    label: 'Established',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-700/30',
    borderColor: 'border-gray-400 dark:border-gray-500',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    description: 'Active consumers and reviews. A credible developer profile.',
  },
  trusted: {
    label: 'Trusted',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-300 dark:border-amber-700',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    ),
    description: 'High score, strong reviews, and proven reliability.',
  },
  premier: {
    label: 'Premier',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
      </svg>
    ),
    description: 'Top-tier developer. Exceptional reliability, reviews, and adoption.',
  },
}

function computeTier(score: number, data: ReputationData['breakdown']): ReputationTier {
  if (score >= 90 && data.totalConsumers >= 50 && data.reviewAvg >= 4.5 && data.uptimePct >= 99.9) return 'premier'
  if (score >= 75 && data.totalConsumers >= 10 && data.reviewAvg >= 4.0 && data.uptimePct >= 99) return 'trusted'
  if (score >= 60 && data.totalConsumers >= 3 && data.reviewAvg > 0) return 'established'
  if (score >= 40 && data.totalTools >= 1) return 'verified'
  return 'new'
}

function getNextTierRequirements(
  currentTier: ReputationTier,
  score: number,
  data: ReputationData['breakdown']
): { nextTier: ReputationTier; requirements: string[] } | null {
  const tiers: ReputationTier[] = ['new', 'verified', 'established', 'trusted', 'premier']
  const currentIdx = tiers.indexOf(currentTier)
  if (currentIdx >= tiers.length - 1) return null

  const nextTier = tiers[currentIdx + 1]
  const requirements: string[] = []

  switch (nextTier) {
    case 'verified':
      if (score < 40) requirements.push(`Score 40+ (currently ${score})`)
      if (data.totalTools < 1) requirements.push(`At least 1 tool (currently ${data.totalTools})`)
      break
    case 'established':
      if (score < 60) requirements.push(`Score 60+ (currently ${score})`)
      if (data.totalConsumers < 3) requirements.push(`3+ consumers (currently ${data.totalConsumers})`)
      if (data.reviewAvg <= 0) requirements.push('At least 1 review')
      break
    case 'trusted':
      if (score < 75) requirements.push(`Score 75+ (currently ${score})`)
      if (data.totalConsumers < 10) requirements.push(`10+ consumers (currently ${data.totalConsumers})`)
      if (data.reviewAvg < 4.0) requirements.push(`4.0+ review avg (currently ${data.reviewAvg.toFixed(1)})`)
      if (data.uptimePct < 99) requirements.push(`99%+ uptime (currently ${data.uptimePct}%)`)
      break
    case 'premier':
      if (score < 90) requirements.push(`Score 90+ (currently ${score})`)
      if (data.totalConsumers < 50) requirements.push(`50+ consumers (currently ${data.totalConsumers})`)
      if (data.reviewAvg < 4.5) requirements.push(`4.5+ review avg (currently ${data.reviewAvg.toFixed(1)})`)
      if (data.uptimePct < 99.9) requirements.push(`99.9%+ uptime (currently ${data.uptimePct}%)`)
      break
  }

  return { nextTier, requirements }
}

function getGrade(score: number): { letter: string; color: string; description: string } {
  if (score >= 90) return { letter: 'A', color: 'text-green-600', description: 'Excellent' }
  if (score >= 80) return { letter: 'B', color: 'text-blue-600', description: 'Very Good' }
  if (score >= 70) return { letter: 'C', color: 'text-yellow-600', description: 'Good' }
  if (score >= 60) return { letter: 'D', color: 'text-orange-600', description: 'Fair' }
  return { letter: 'F', color: 'text-red-600 dark:text-red-400', description: 'Needs Improvement' }
}

function generateRecommendations(
  breakdown: ReputationData['breakdown'],
  profile: DeveloperProfile | null
): Recommendation[] {
  const recs: Recommendation[] = []
  const { uptimePct, reviewAvg, responseTimePct, totalConsumers, totalTools } = breakdown

  // --- Uptime recommendations ---
  if (totalTools > 0 && uptimePct === 0) {
    recs.push({
      priority: 'critical',
      title: 'No uptime monitoring detected',
      body: `None of your tools have health monitoring. Add a health endpoint to start tracking uptime -- this dimension is worth up to 30 points.`,
      action: { label: 'Configure health endpoints', href: '/dashboard/tools' },
      impact: '+30 points',
    })
  } else if (uptimePct < 95) {
    const lostPoints = Math.round((99.9 - uptimePct) * 0.30)
    recs.push({
      priority: 'critical',
      title: 'Uptime is critically low',
      body: `Your 30-day uptime is ${uptimePct}%. Consumers expect 99%+. This is costing you ~${lostPoints} reputation points.`,
      action: { label: 'Check Health Dashboard', href: '/dashboard/health' },
      impact: `+${lostPoints} points`,
    })
  } else if (uptimePct < 99) {
    const gainPoints = Math.round((99.9 - uptimePct) * 0.30)
    recs.push({
      priority: 'medium',
      title: 'Uptime can still improve',
      body: `Your uptime is ${uptimePct}%. Reaching 99.9% would add ~${gainPoints} points to your score.`,
      action: { label: 'View incident history', href: '/dashboard/health' },
      impact: `+${gainPoints} points`,
    })
  }

  // --- Review recommendations ---
  if (reviewAvg === 0) {
    recs.push({
      priority: 'high',
      title: 'No reviews yet',
      body: 'You have no reviews yet. Tools with 3+ reviews get significantly more consumers. Share review links with your early adopters.',
      action: { label: 'View your tools', href: '/dashboard/tools' },
      impact: '+25 points at 5.0 avg',
    })
  } else if (reviewAvg < 3.5) {
    const gainPoints = Math.round(((4.5 - reviewAvg) / 5) * 100 * 0.25)
    recs.push({
      priority: 'high',
      title: 'Review average needs attention',
      body: `Your average rating is ${reviewAvg.toFixed(1)}/5. Focus on addressing consumer feedback to improve quality.`,
      action: { label: 'View reviews', href: '/dashboard/reputation' },
      impact: `+${gainPoints} points`,
    })
  } else if (reviewAvg < 4.5) {
    const gainPoints = Math.round(((5.0 - reviewAvg) / 5) * 100 * 0.25)
    recs.push({
      priority: 'medium',
      title: 'Reviews are solid but can improve',
      body: `Your average is ${reviewAvg.toFixed(1)}/5 -- solid. A few more 5-star reviews would boost your score.`,
      action: { label: 'View your tools', href: '/dashboard/tools' },
      impact: `+${gainPoints} points`,
    })
  }

  // --- Response time recommendations ---
  if (responseTimePct < 50) {
    const gainPoints = Math.round((80 - responseTimePct) * 0.20)
    recs.push({
      priority: 'high',
      title: 'Response time is below average',
      body: `Your response time is in the bottom half of developers. Optimizing latency below 100ms would significantly improve your score.`,
      action: { label: 'View tool analytics', href: '/dashboard/analytics' },
      impact: `+${gainPoints} points`,
    })
  } else if (responseTimePct < 80) {
    const gainPoints = Math.round((95 - responseTimePct) * 0.20)
    recs.push({
      priority: 'medium',
      title: 'Response time can be faster',
      body: 'Good response times, but there is room to improve. Consider caching or reducing payload sizes.',
      action: { label: 'View tool analytics', href: '/dashboard/analytics' },
      impact: `+${gainPoints} points`,
    })
  }

  // --- Consumer recommendations ---
  if (totalConsumers === 0) {
    recs.push({
      priority: 'critical',
      title: 'No consumers yet',
      body: 'No consumers yet. Share your tool listing, add clear descriptions, and consider offering promotional credits.',
      action: { label: 'View showcase listing', href: '/tools' },
      impact: '+15 points at 20 consumers',
    })
  } else if (totalConsumers <= 5) {
    const gainPoints = Math.round(((Math.min(10, 20) - totalConsumers) / 20) * 100 * 0.15)
    recs.push({
      priority: 'high',
      title: 'Grow your consumer base',
      body: `You have ${totalConsumers} consumer${totalConsumers === 1 ? '' : 's'}. Growing to 10+ would add ~${gainPoints} points. Create a referral link to incentivize sharing.`,
      action: { label: 'Set up referrals', href: '/dashboard/referrals' },
      impact: `+${gainPoints} points`,
    })
  } else if (totalConsumers <= 20) {
    const gainPoints = Math.round(((20 - totalConsumers) / 20) * 100 * 0.15)
    recs.push({
      priority: 'medium',
      title: 'Strong adoption, keep growing',
      body: `Solid adoption with ${totalConsumers} consumers. Focus on retention -- check analytics for churn patterns.`,
      action: { label: 'View analytics', href: '/dashboard/analytics' },
      impact: `+${gainPoints} points`,
    })
  }

  // --- Tool recommendations ---
  if (totalTools === 0) {
    recs.push({
      priority: 'critical',
      title: 'Create your first tool',
      body: 'Create and activate your first tool to start building reputation. You cannot earn a reputation score without at least one tool.',
      action: { label: 'Create a tool', href: '/dashboard/tools' },
      impact: '+10 points',
    })
  } else if (totalTools === 1) {
    recs.push({
      priority: 'low',
      title: 'Expand your tool portfolio',
      body: 'Developers with 3+ tools earn more through cross-discovery. Consider expanding your portfolio with complementary tools.',
      action: { label: 'Create another tool', href: '/dashboard/tools' },
      impact: '+4 points per tool',
    })
  }

  // --- Profile recommendations ---
  if (profile && !profile.publicProfile) {
    recs.push({
      priority: 'medium',
      title: 'Your profile is private',
      body: 'Your profile is private. Public profiles are visible to consumers in the developer directory and build trust.',
      action: { label: 'Go to Settings', href: '/dashboard/settings' },
      impact: 'Increased visibility',
    })
  }

  if (profile && !profile.publicBio) {
    recs.push({
      priority: 'low',
      title: 'Add a developer bio',
      body: 'Add a developer bio to build trust with potential consumers. Profiles with bios see higher engagement.',
      action: { label: 'Edit profile', href: '/dashboard/settings' },
      impact: 'Increased trust',
    })
  }

  // If everything is maxed out
  if (recs.length === 0) {
    recs.push({
      priority: 'low',
      title: 'Excellent reputation',
      body: 'Your reputation is strong across all areas. Keep up the great work and continue monitoring your metrics.',
      action: { label: 'View dashboard', href: '/dashboard' },
      impact: 'Maintain standing',
    })
  }

  // Sort by priority
  const order: Record<Recommendation['priority'], number> = { critical: 0, high: 1, medium: 2, low: 3 }
  recs.sort((a, b) => order[a.priority] - order[b.priority])

  return recs.slice(0, 6)
}

const PRIORITY_STYLES: Record<Recommendation['priority'], { badge: string; badgeBg: string }> = {
  critical: { badge: 'text-red-800 dark:text-red-300', badgeBg: 'bg-red-100 dark:bg-red-900/30' },
  high: { badge: 'text-amber-800 dark:text-amber-300', badgeBg: 'bg-amber-100 dark:bg-amber-900/30' },
  medium: { badge: 'text-blue-800 dark:text-blue-300', badgeBg: 'bg-blue-100 dark:bg-blue-900/30' },
  low: { badge: 'text-gray-700 dark:text-gray-300', badgeBg: 'bg-gray-100 dark:bg-gray-800' },
}

function ScoreBreakdownBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-medium text-indigo dark:text-gray-100">{value}{unit}</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-[#252836] rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${
            pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-50 dark:bg-red-900/200'
          }`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  )
}

export default function ReputationPage() {
  const [reputation, setReputation] = useState<ReputationData | null>(null)
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        // First get the developer's own info
        const meRes = await fetch('/api/auth/developer/me')
        if (!meRes.ok) {
          setError('Failed to load developer profile')
          setLoading(false)
          return
        }
        const meData = await meRes.json()
        const dev = meData.developer
        setProfile(dev)

        // Then fetch reputation for this developer
        const repRes = await fetch(`/api/developers/${dev.id}/reputation`)
        if (repRes.ok) {
          const repData = await repRes.json()
          setReputation(repData)
        } else {
          setError('Failed to load reputation data')
        }
      } catch {
        setError('Network error loading reputation')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reputation' },
        ]} />
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Developer Reputation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your public reputation score and breakdown across key performance areas.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardContent className="p-8 text-center">
              <Skeleton className="h-24 w-24 rounded-full mx-auto mb-4" />
              <Skeleton className="h-6 w-16 mx-auto mb-2" />
              <Skeleton className="h-4 w-24 mx-auto" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-2.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const grade = reputation ? getGrade(reputation.score) : getGrade(0)
  const tier = reputation ? computeTier(reputation.score, reputation.breakdown) : 'new'
  const tierInfo = TIER_INFO[tier]
  const nextTierInfo = reputation ? getNextTierRequirements(tier, reputation.score, reputation.breakdown) : null
  const recommendations = reputation ? generateRecommendations(reputation.breakdown, profile) : []

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reputation' },
      ]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Developer Reputation</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your public reputation score and breakdown across key performance areas.</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
      )}

      {reputation && (
        <>
          {/* Score + Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score card */}
            <Card className="lg:col-span-1">
              <CardContent className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-28 h-28 rounded-full border-4 border-gray-100 dark:border-[#252836] mb-4">
                  <div>
                    <div className={`text-5xl font-bold ${grade.color}`}>{reputation.score}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">out of 100</div>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${grade.color}`}>Grade: {grade.letter}</div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{grade.description}</p>

                {/* Tier Badge */}
                <div className="mt-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${tierInfo.color} ${tierInfo.bgColor} ${tierInfo.borderColor}`}>
                          {tierInfo.icon}
                          <span>{tierInfo.label}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-center">
                        <p>{tierInfo.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Next Tier Progress */}
                {nextTierInfo && nextTierInfo.requirements.length > 0 && (
                  <div className="mt-4 text-left border border-gray-100 dark:border-[#252836] rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                      To reach <span className={TIER_INFO[nextTierInfo.nextTier].color}>{TIER_INFO[nextTierInfo.nextTier].label}</span>:
                    </p>
                    <ul className="space-y-1">
                      {nextTierInfo.requirements.map((req) => (
                        <li key={req} className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                          </svg>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nextTierInfo && nextTierInfo.requirements.length === 0 && (
                  <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    You meet all requirements for {TIER_INFO[nextTierInfo.nextTier].label}!
                  </p>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  Last calculated: {new Date(reputation.calculatedAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              </CardContent>
            </Card>

            {/* Breakdown bars */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Score Breakdown</CardTitle>
                <CardDescription>
                  Weighted factors: Uptime 30%, Reviews 25%, Response Time 20%, Consumers 15%, Tools 10%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  <ScoreBreakdownBar
                    label="Response Time Percentile"
                    value={reputation.breakdown.responseTimePct}
                    max={100}
                    unit="th pctl"
                  />
                  <ScoreBreakdownBar
                    label="Uptime (30 days)"
                    value={reputation.breakdown.uptimePct}
                    max={100}
                    unit="%"
                  />
                  <ScoreBreakdownBar
                    label="Review Average"
                    value={Math.round(reputation.breakdown.reviewAvg * 100) / 100}
                    max={5}
                    unit=" / 5.0"
                  />
                  <ScoreBreakdownBar
                    label="Total Consumers"
                    value={reputation.breakdown.totalConsumers}
                    max={100}
                    unit=""
                  />
                  <ScoreBreakdownBar
                    label="Active Tools"
                    value={reputation.breakdown.totalTools}
                    max={10}
                    unit=""
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Improvement Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Improvement Recommendations</CardTitle>
              <CardDescription>Data-driven suggestions to improve your reputation score, prioritized by impact.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.map((rec) => {
                  const styles = PRIORITY_STYLES[rec.priority]
                  return (
                    <div key={rec.title} className="border border-gray-100 dark:border-[#252836] rounded-lg p-4">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 mt-0.5">
                          <span className={`inline-flex items-center rounded-full border-transparent px-2.5 py-0.5 text-xs font-semibold ${styles.badge} ${styles.badgeBg}`}>
                            {rec.priority}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-indigo dark:text-gray-100">{rec.title}</h4>
                            <span className="text-xs font-semibold text-brand dark:text-emerald-400 whitespace-nowrap shrink-0">
                              {rec.impact}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2.5">{rec.body}</p>
                          <Link
                            href={rec.action.href}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand dark:text-emerald-400 hover:text-brand-dark dark:hover:text-emerald-300 transition-colors"
                          >
                            {rec.action.label}
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Public Profile Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Public Profile Preview</CardTitle>
              <CardDescription>This is how other developers and consumers see your profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-gray-200 dark:border-[#2E3148] rounded-xl p-6 bg-gray-50 dark:bg-[#1A1D2E]">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-indigo flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {(reputation.name ?? profile?.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-lg font-bold text-indigo dark:text-gray-100">
                        {reputation.name ?? profile?.name ?? 'Developer'}
                      </h3>
                      <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tierInfo.color} ${tierInfo.bgColor} ${tierInfo.borderColor}`}>
                        {tierInfo.icon}
                        <span>{tierInfo.label}</span>
                      </div>
                      <Badge variant={profile?.publicProfile ? 'success' : 'secondary'}>
                        {profile?.publicProfile ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                    {profile?.publicBio && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{profile.publicBio}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-2xl font-bold ${grade.color}`}>{reputation.score}</span>
                        <span className="text-gray-500 dark:text-gray-400">reputation</span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">|</div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{reputation.breakdown.totalTools}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-1">tools</span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">|</div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{reputation.breakdown.totalConsumers}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-1">consumers</span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">|</div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{reputation.breakdown.uptimePct}%</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-1">uptime</span>
                      </div>
                      {reputation.breakdown.reviewAvg > 0 && (
                        <>
                          <div className="text-gray-500 dark:text-gray-400">|</div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{reputation.breakdown.reviewAvg.toFixed(1)}</span>
                            <span className="text-gray-500 dark:text-gray-400 ml-1">avg rating</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {!profile?.publicProfile && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Your profile is currently private. Enable public profile in Settings to make it visible to consumers.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
