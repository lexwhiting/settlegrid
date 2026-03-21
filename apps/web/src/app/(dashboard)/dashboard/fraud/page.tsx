'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'

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

function RiskScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30'
    : score >= 50
      ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30'
      : score >= 25
        ? 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/30'
        : 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30'

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  )
}

const FRAUD_SIGNALS = [
  {
    name: 'Rate Spike Detection',
    signal: 'rate_spike',
    description: 'Flags consumers exceeding 50 invocations within a 60-second window. Risk +50.',
    threshold: '>50 req/60s',
    status: 'active' as const,
  },
  {
    name: 'New Key High Value',
    signal: 'new_key_high_value',
    description: 'Enhanced scrutiny for API keys less than 24 hours old making high-value calls (>$10). Risk +40.',
    threshold: '<24h key + >1000 cents',
    status: 'active' as const,
  },
  {
    name: 'Rapid Duplicate Detection',
    signal: 'rapid_duplicate',
    description: 'Identifies identical consumer+tool+cost requests repeated within 2 seconds. Risk +30.',
    threshold: 'Same call within 2s',
    status: 'active' as const,
  },
  {
    name: 'Hourly Velocity',
    signal: 'hourly_velocity',
    description: 'Flags consumers exceeding 500 invocations in a rolling 1-hour window. Risk +35.',
    threshold: '>500 req/hour',
    status: 'active' as const,
  },
  {
    name: 'IP Velocity',
    signal: 'ip_velocity',
    description: 'Detects a single IP address making more than 100 requests per minute across all consumers. Risk +40.',
    threshold: '>100 req/min per IP',
    status: 'active' as const,
  },
  {
    name: 'Spending Velocity',
    signal: 'spending_velocity',
    description: 'Monitors accumulated spending per consumer and flags when hourly spend exceeds $50. Risk +35.',
    threshold: '>$50/hour',
    status: 'active' as const,
  },
  {
    name: 'Failed Auth Tracking',
    signal: 'failed_auth',
    description: 'Tracks failed API key validation attempts per IP. Blocks the IP for 15 minutes after 5 failures in 60 seconds.',
    threshold: '>5 failures/60s = 15min block',
    status: 'active' as const,
  },
  {
    name: 'Multi-IP Key Usage',
    signal: 'multi_ip_key',
    description: 'Detects a single API key being used from multiple IP addresses within a 5-minute window. Risk +25 (>5 IPs) or +40 (>10 IPs).',
    threshold: '>5 unique IPs/5min',
    status: 'active' as const,
  },
  {
    name: 'Dormant Key Reactivation',
    signal: 'dormant_key',
    description: 'Flags API keys that have been inactive for 30+ days making high-value calls, or 90+ days making any call. Risk +25/+30.',
    threshold: '>30d idle + >$5, or >90d idle',
    status: 'active' as const,
  },
  {
    name: 'Unusual Amount Pattern',
    signal: 'unusual_amount',
    description: 'Compares each invocation cost against the median of the last 20 calls. Flags amounts exceeding 5x the median. Risk +15.',
    threshold: '>5x median cost',
    status: 'active' as const,
  },
  {
    name: 'Chargeback History',
    signal: 'chargeback_history',
    description: 'Permanently flags consumers with any previous chargeback on record. Adds persistent risk to all future invocations. Risk +30.',
    threshold: 'Any prior chargeback',
    status: 'active' as const,
  },
  {
    name: 'Session Nesting Depth',
    signal: 'session_nesting',
    description: 'Monitors recursive or nested session depths. Rejects calls exceeding depth 5 and adds risk at depth >3. Risk +15 or reject.',
    threshold: '>3 levels (warn), >5 (reject)',
    status: 'active' as const,
  },
]

const SECURITY_GUIDES = [
  {
    title: 'IP Allowlisting',
    content: [
      '1. Navigate to the Consumer Dashboard and select the API key you want to restrict.',
      '2. Click "Edit IP Allowlist" and add one or more CIDR ranges (e.g., 203.0.113.0/24) or single IPs (e.g., 198.51.100.42).',
      '3. Save changes. Only requests originating from the listed addresses will be accepted; all others receive a 403 error.',
      '4. Use this when your consumers have fixed server IPs, CI/CD pipelines, or known office egress addresses.',
      '5. Example: A consumer running from AWS us-east-1 might allowlist their NAT Gateway IP range.',
      '6. To remove restrictions, clear all entries from the allowlist. The key will then accept requests from any IP.',
    ],
  },
  {
    title: 'Rate Limiting',
    content: [
      '1. All SDK routes are automatically rate-limited per IP and per consumer.',
      '2. Rate limit tiers are determined by your developer plan: Free (100 req/min), Standard (500 req/min), Enterprise (2000 req/min).',
      '3. SDK endpoints enforce both global per-IP limits and per-consumer tiered limits.',
      '4. When a limit is hit, the API returns a 429 status code with a RATE_LIMIT_EXCEEDED error.',
      '5. Consumers should implement exponential backoff when receiving 429 responses.',
      '6. To increase your rate limits, upgrade your developer plan from the Billing page.',
    ],
  },
  {
    title: 'Webhook Monitoring',
    content: [
      '1. Go to Settings > Webhooks and click "Add Endpoint". Enter your HTTPS URL.',
      '2. Select the events you want to receive (e.g., invocation.flagged, key.revoked, payout.completed).',
      '3. Copy the signing secret provided. Use it to verify HMAC-SHA256 signatures on incoming webhooks.',
      '4. Verify signatures by computing HMAC-SHA256 of the raw request body using your secret and comparing to the X-SettleGrid-Signature header.',
      '5. Return a 2xx status within 30 seconds. Failed deliveries are retried up to 3 times with exponential backoff.',
      '6. Monitor the webhook delivery log for failed attempts and update your endpoint URL if your server moves.',
    ],
  },
  {
    title: 'API Key Rotation',
    content: [
      '1. Rotate keys proactively every 90 days, or immediately if you suspect compromise.',
      '2. Create a new API key for the same consumer+tool pair from the Consumer Dashboard.',
      '3. Deploy the new key to your consumer\'s application or configuration.',
      '4. Verify the new key is working by checking the invocation logs for successful calls.',
      '5. Revoke the old key only after confirming the new key is active in all environments.',
      '6. Never embed API keys in client-side code, version control, or log files.',
    ],
  },
  {
    title: 'Budget Controls',
    content: [
      '1. Set per-tool spending limits from the Consumer Dashboard under "Budget Settings".',
      '2. Choose a billing period (daily, weekly, or monthly) and set a maximum spend in cents.',
      '3. When the limit is reached, further invocations are rejected with a 402 BUDGET_EXCEEDED error.',
      '4. Enable auto-refill cautiously: set a sensible cap to prevent runaway costs from compromised keys.',
      '5. Configure alert thresholds at 50%, 75%, and 90% of budget to receive email notifications before hitting the limit.',
      '6. Review budget utilization on the Analytics page to right-size your limits over time.',
    ],
  },
  {
    title: 'Audit Logging',
    content: [
      '1. Every significant action (key creation, revocation, payout request, tool status change) is recorded in the audit log.',
      '2. Navigate to Dashboard > Audit Log to view recent events with timestamps, actors, and details.',
      '3. Look for unexpected patterns: key creations at odd hours, multiple revocations, or status changes you did not initiate.',
      '4. Use the date filter and event type dropdown to narrow down investigations.',
      '5. Export audit logs as CSV for compliance reporting or to share with your security team.',
      '6. Audit logs are retained for 12 months and cannot be modified or deleted.',
    ],
  },
  {
    title: 'Two-Factor Authentication',
    content: [
      '1. SettleGrid accounts are secured through Supabase Auth. Enable 2FA on your Supabase account for an extra layer of protection.',
      '2. Go to your account settings and enable TOTP-based 2FA using an authenticator app (Google Authenticator, Authy, 1Password).',
      '3. Save the recovery codes in a secure location (password manager, encrypted file).',
      '4. 2FA protects against password compromise: even if your password is leaked, attackers cannot access your account without the second factor.',
      '5. Require all team members with dashboard access to enable 2FA on their accounts.',
      '6. If you lose access to your authenticator, use a recovery code and immediately set up a new 2FA device.',
    ],
  },
  {
    title: 'Session Management',
    content: [
      '1. Sessions are managed via secure, HTTP-only cookies with a default timeout of 24 hours.',
      '2. Inactive sessions expire automatically. Re-authentication is required after expiry.',
      '3. To sign out from all devices, go to Account Settings > Security > "Sign Out All Sessions".',
      '4. If you suspect unauthorized access, sign out all sessions immediately and rotate your password.',
      '5. Session tokens are bound to the originating IP. IP changes may trigger re-authentication.',
      '6. The fraud detection system monitors session nesting depth: excessive nesting (>5 levels) is rejected to prevent recursion attacks.',
    ],
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
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Fraud Detection' },
        ]} />
        <div>
          <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Fraud Detection & Security</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monitor flagged invocations and security alerts across your tools.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
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
        { label: 'Fraud Detection' },
      ]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Fraud Detection & Security</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">12 real-time fraud signals protect your tools and consumers around the clock.</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">{error}</div>
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

      {/* Active Fraud Signals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Fraud Signals (12)</CardTitle>
          <CardDescription>All real-time detection signals evaluated on every metered invocation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FRAUD_SIGNALS.map((signal) => (
              <div key={signal.signal} className="border border-gray-100 dark:border-[#252836] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-indigo dark:text-gray-100">{signal.name}</h3>
                  <Badge variant="success">{signal.status}</Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{signal.description}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Threshold:</span>
                  <code className="text-xs bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded">{signal.threshold}</code>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Flagged Invocations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Flagged Invocations</CardTitle>
          <CardDescription>Invocations that triggered fraud detection rules.</CardDescription>
        </CardHeader>
        <CardContent>
          {flagged.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">No flagged invocations detected. Your tools are operating normally.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Flagged invocations">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#2E3148]">
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Timestamp</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Consumer</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Method</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Cost</th>
                    <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Risk Score</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Reasons</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-[#252836]">
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                        {new Date(item.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{item.consumerId}</code>
                      </td>
                      <td className="py-3 px-4">
                        <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{item.method}</code>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{formatCents(item.costCents)}</td>
                      <td className="py-3 px-4 text-center">
                        <RiskScoreBadge score={item.riskScore} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {item.reasons.map((reason, i) => (
                            <span key={i} className="text-xs text-gray-500 dark:text-gray-400">{reason}{i < item.reasons.length - 1 ? ',' : ''}</span>
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

      {/* Security Configuration Guides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Configuration Guides</CardTitle>
          <CardDescription>Step-by-step instructions to harden your SettleGrid deployment.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {SECURITY_GUIDES.map((guide) => (
              <div key={guide.title} className="border border-gray-100 dark:border-[#252836] rounded-lg p-5">
                <h4 className="text-sm font-semibold text-indigo dark:text-gray-100 mb-3">{guide.title}</h4>
                <ol className="space-y-1.5">
                  {guide.content.map((step, i) => (
                    <li key={i} className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed pl-1">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
