'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

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

function getGrade(score: number): { letter: string; color: string; description: string } {
  if (score >= 90) return { letter: 'A', color: 'text-green-600', description: 'Excellent' }
  if (score >= 80) return { letter: 'B', color: 'text-blue-600', description: 'Very Good' }
  if (score >= 70) return { letter: 'C', color: 'text-yellow-600', description: 'Good' }
  if (score >= 60) return { letter: 'D', color: 'text-orange-600', description: 'Fair' }
  return { letter: 'F', color: 'text-red-600', description: 'Needs Improvement' }
}

function getImprovementTips(breakdown: ReputationData['breakdown']): Array<{ area: string; tip: string; priority: 'high' | 'medium' | 'low' }> {
  const tips: Array<{ area: string; tip: string; priority: 'high' | 'medium' | 'low' }> = []

  if (breakdown.uptimePct < 99) {
    tips.push({
      area: 'Uptime',
      tip: 'Improve your tool uptime by adding health check endpoints, implementing retry logic, and monitoring for outages. Target 99.9% uptime.',
      priority: 'high',
    })
  }

  if (breakdown.reviewAvg < 4.0) {
    tips.push({
      area: 'Reviews',
      tip: 'Improve consumer satisfaction by responding to feedback, fixing reported issues quickly, and providing clear documentation.',
      priority: breakdown.reviewAvg < 3.0 ? 'high' : 'medium',
    })
  }

  if (breakdown.responseTimePct < 70) {
    tips.push({
      area: 'Response Time',
      tip: 'Optimize your tool performance by adding caching, reducing external API dependencies, and using faster infrastructure.',
      priority: 'medium',
    })
  }

  if (breakdown.totalConsumers < 10) {
    tips.push({
      area: 'Consumer Reach',
      tip: 'Grow your consumer base by creating compelling tool descriptions, setting competitive pricing, and leveraging referral links.',
      priority: 'low',
    })
  }

  if (breakdown.totalTools < 3) {
    tips.push({
      area: 'Tool Portfolio',
      tip: 'Expand your offerings by creating complementary tools. A diverse portfolio attracts more consumers and increases your reputation.',
      priority: 'low',
    })
  }

  if (tips.length === 0) {
    tips.push({
      area: 'Excellent',
      tip: 'Your reputation is strong across all areas. Keep up the great work and continue monitoring your metrics.',
      priority: 'low',
    })
  }

  return tips.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })
}

function ScoreBreakdownBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-medium text-indigo">{value}{unit}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${
            pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
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
        const dev = meData.data
        setProfile(dev)

        // Then fetch reputation for this developer
        const repRes = await fetch(`/api/developers/${dev.id}/reputation`)
        if (repRes.ok) {
          const repData = await repRes.json()
          setReputation(repData.data)
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
          <h1 className="text-2xl font-bold text-indigo">Developer Reputation</h1>
          <p className="text-sm text-gray-500 mt-1">Your public reputation score and breakdown across key performance areas.</p>
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
  const tips = reputation ? getImprovementTips(reputation.breakdown) : []

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reputation' },
      ]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-indigo">Developer Reputation</h1>
        <p className="text-sm text-gray-500 mt-1">Your public reputation score and breakdown across key performance areas.</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">{error}</div>
      )}

      {reputation && (
        <>
          {/* Score + Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score card */}
            <Card className="lg:col-span-1">
              <CardContent className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-28 h-28 rounded-full border-4 border-gray-100 mb-4">
                  <div>
                    <div className={`text-5xl font-bold ${grade.color}`}>{reputation.score}</div>
                    <div className="text-xs text-gray-500 mt-0.5">out of 100</div>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${grade.color}`}>Grade: {grade.letter}</div>
                <p className="text-sm text-gray-500 mt-1">{grade.description}</p>
                <p className="text-xs text-gray-500 mt-4">
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

          {/* Improvement Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Improvement Recommendations</CardTitle>
              <CardDescription>Suggestions to improve your reputation score, prioritized by impact.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tips.map((tip) => (
                  <div key={tip.area} className="flex gap-4 border border-gray-100 rounded-lg p-4">
                    <div className="shrink-0 mt-0.5">
                      <Badge variant={
                        tip.priority === 'high' ? 'destructive' :
                        tip.priority === 'medium' ? 'warning' : 'secondary'
                      }>
                        {tip.priority}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-indigo mb-0.5">{tip.area}</h4>
                      <p className="text-xs text-gray-500">{tip.tip}</p>
                    </div>
                  </div>
                ))}
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
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-indigo flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {(reputation.name ?? profile?.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-indigo">
                        {reputation.name ?? profile?.name ?? 'Developer'}
                      </h3>
                      <Badge variant={profile?.publicProfile ? 'success' : 'secondary'}>
                        {profile?.publicProfile ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                    {profile?.publicBio && (
                      <p className="text-sm text-gray-600 mb-3">{profile.publicBio}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-2xl font-bold ${grade.color}`}>{reputation.score}</span>
                        <span className="text-gray-500">reputation</span>
                      </div>
                      <div className="text-gray-500">|</div>
                      <div>
                        <span className="font-medium text-gray-700">{reputation.breakdown.totalTools}</span>
                        <span className="text-gray-500 ml-1">tools</span>
                      </div>
                      <div className="text-gray-500">|</div>
                      <div>
                        <span className="font-medium text-gray-700">{reputation.breakdown.totalConsumers}</span>
                        <span className="text-gray-500 ml-1">consumers</span>
                      </div>
                      <div className="text-gray-500">|</div>
                      <div>
                        <span className="font-medium text-gray-700">{reputation.breakdown.uptimePct}%</span>
                        <span className="text-gray-500 ml-1">uptime</span>
                      </div>
                      {reputation.breakdown.reviewAvg > 0 && (
                        <>
                          <div className="text-gray-500">|</div>
                          <div>
                            <span className="font-medium text-gray-700">{reputation.breakdown.reviewAvg.toFixed(1)}</span>
                            <span className="text-gray-500 ml-1">avg rating</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {!profile?.publicProfile && (
                <p className="text-xs text-gray-500 mt-3">
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
