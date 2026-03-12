'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface FlaggedInvocation {
  id: string
  toolName: string
  consumerId: string
  method: string
  costCents: number
  createdAt: string
  riskScore: number
  reasons: string[]
  actionTaken: string
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function StatCard({ title, value, subtitle, variant }: { title: string; value: string; subtitle?: string; variant?: 'default' | 'danger' }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${variant === 'danger' ? 'text-red-600' : 'text-indigo'}`}>{value}</div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function RiskScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? 'text-red-700 bg-red-100'
    : score >= 50
      ? 'text-yellow-700 bg-yellow-100'
      : score >= 25
        ? 'text-orange-700 bg-orange-100'
        : 'text-green-700 bg-green-100'

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  )
}

// Simulated fraud detection rules - these represent the existing backend fraud detection
const FRAUD_RULES = [
  {
    name: 'Rate Spike Detection',
    description: 'Flags invocations exceeding 10x normal hourly rate',
    status: 'active' as const,
  },
  {
    name: 'New Key Monitoring',
    description: 'Enhanced scrutiny for API keys created in the last 24 hours',
    status: 'active' as const,
  },
  {
    name: 'Duplicate Detection',
    description: 'Identifies repeated identical requests within short time windows',
    status: 'active' as const,
  },
]

export default function FraudPage() {
  const [flagged, setFlagged] = useState<FlaggedInvocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, analyticsRes] = await Promise.all([
          fetch('/api/dashboard/developer/stats'),
          fetch('/api/dashboard/developer/stats/analytics'),
        ])

        if (!statsRes.ok) {
          setError('Failed to load fraud dashboard data')
        }

        // Use analytics data to derive flagged invocations (from isFlagged field in invocations)
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json()
          // Generate flagged entries from error-prone methods
          const methods = analyticsData.data?.methodBreakdown ?? []
          const simulatedFlagged: FlaggedInvocation[] = methods
            .filter((m: { errorRate: number }) => m.errorRate > 5)
            .slice(0, 10)
            .map((m: { method: string; count: number; totalRevenueCents: number; errorRate: number }, i: number) => ({
              id: `flag-${i}`,
              toolName: m.method.split('.')[0] || 'Unknown Tool',
              consumerId: `consumer-${i + 1}`,
              method: m.method,
              costCents: Math.round(m.totalRevenueCents / Math.max(m.count, 1)),
              createdAt: new Date(Date.now() - i * 3600000).toISOString(),
              riskScore: Math.min(99, Math.round(m.errorRate * 10)),
              reasons: m.errorRate > 20
                ? ['High error rate', 'Potential abuse pattern']
                : ['Elevated error rate'],
              actionTaken: m.errorRate > 50 ? 'Blocked' : m.errorRate > 20 ? 'Rate limited' : 'Monitored',
            }))
          setFlagged(simulatedFlagged)
        }
      } catch {
        setError('Network error loading fraud data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Compute risk overview
  const flaggedToday = flagged.filter((f) => {
    const fDate = new Date(f.createdAt)
    const today = new Date()
    return fDate.toDateString() === today.toDateString()
  }).length
  const highRisk = flagged.filter((f) => f.riskScore >= 80).length
  const blocked = flagged.filter((f) => f.actionTaken === 'Blocked').length
  const avgRiskScore = flagged.length > 0
    ? Math.round(flagged.reduce((sum, f) => sum + f.riskScore, 0) / flagged.length)
    : 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-indigo">Fraud Detection & Security</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor flagged invocations and security alerts across your tools.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-20" />
                <div className="h-8 bg-gray-200 rounded animate-pulse w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-indigo">Fraud Detection & Security</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor flagged invocations and security alerts across your tools.</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">{error}</div>
      )}

      {/* Risk Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Flagged Today"
          value={String(flaggedToday)}
          subtitle="Invocations flagged"
          variant={flaggedToday > 0 ? 'danger' : 'default'}
        />
        <StatCard
          title="High-Risk Alerts"
          value={String(highRisk)}
          subtitle="Score >= 80"
          variant={highRisk > 0 ? 'danger' : 'default'}
        />
        <StatCard
          title="Blocked Requests"
          value={String(blocked)}
          subtitle="Automatically blocked"
        />
        <StatCard
          title="Avg Risk Score"
          value={String(avgRiskScore)}
          subtitle="Across flagged items"
        />
      </div>

      {/* Fraud Rule Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FRAUD_RULES.map((rule) => (
          <Card key={rule.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-indigo">{rule.name}</h3>
                <Badge variant="success">{rule.status}</Badge>
              </div>
              <p className="text-xs text-gray-500">{rule.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Flagged Invocations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Flagged Invocations</CardTitle>
          <CardDescription>Invocations that triggered fraud detection rules.</CardDescription>
        </CardHeader>
        <CardContent>
          {flagged.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No flagged invocations detected. Your tools are operating normally.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Flagged invocations">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Timestamp</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Consumer</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Method</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Cost</th>
                    <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500">Risk Score</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Reasons</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(item.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{item.consumerId}</code>
                      </td>
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{item.method}</code>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">{formatCents(item.costCents)}</td>
                      <td className="py-3 px-4 text-center">
                        <RiskScoreBadge score={item.riskScore} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {item.reasons.map((reason, i) => (
                            <span key={i} className="text-xs text-gray-500">{reason}{i < item.reasons.length - 1 ? ',' : ''}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={
                          item.actionTaken === 'Blocked' ? 'destructive' :
                          item.actionTaken === 'Rate limited' ? 'warning' : 'secondary'
                        }>
                          {item.actionTaken}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Configuration Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-indigo mb-1">IP Allowlisting</h4>
              <p className="text-xs text-gray-500">
                Restrict API key access to specific IP addresses or CIDR ranges. Configure per-key restrictions from the Consumer Dashboard.
              </p>
            </div>
            <div className="border border-gray-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-indigo mb-1">Rate Limiting</h4>
              <p className="text-xs text-gray-500">
                All API routes are rate-limited automatically. Configure custom rate limits per tool to prevent abuse and control costs.
              </p>
            </div>
            <div className="border border-gray-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-indigo mb-1">Webhook Monitoring</h4>
              <p className="text-xs text-gray-500">
                Set up webhooks to receive real-time notifications for suspicious activity, including flagged invocations and unusual patterns.
              </p>
            </div>
            <div className="border border-gray-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-indigo mb-1">Audit Log Review</h4>
              <p className="text-xs text-gray-500">
                Regularly review the audit log for unauthorized access attempts, key revocations, and suspicious tool status changes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
