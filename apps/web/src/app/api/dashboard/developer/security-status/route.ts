import { NextRequest } from 'next/server'
import { eq, sql, and, lt, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools, apiKeys, webhookEndpoints, consumerToolBalances } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 30

interface SecurityItem {
  id: string
  title: string
  priority: 'critical' | 'recommended' | 'built-in'
  completed: boolean
  statusDetail: string
  href: string
  steps: string[]
  comingSoon?: boolean
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `security-status:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // 1. Stripe Connect — check developer.stripeConnectStatus === 'active'
    const [developer] = await db
      .select({ stripeConnectStatus: developers.stripeConnectStatus })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    const stripeConnected = developer?.stripeConnectStatus === 'active'

    // Get developer's tool IDs (needed for several checks)
    const developerTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)

    // 2. IP Allowlisting — check if any API key for developer's tools has non-null ipAllowlist
    let ipAllowlistEnabled = false
    let keysWithoutIpRestriction = 0

    if (toolIds.length > 0) {
      const keysWithAllowlist = await db
        .select({
          total: sql<number>`count(*)::int`,
          withAllowlist: sql<number>`count(*) filter (where ${apiKeys.ipAllowlist} is not null)::int`,
        })
        .from(apiKeys)
        .where(
          and(
            inArray(apiKeys.toolId, toolIds),
            eq(apiKeys.status, 'active')
          )
        )

      const total = keysWithAllowlist[0]?.total ?? 0
      const withAllowlist = keysWithAllowlist[0]?.withAllowlist ?? 0
      ipAllowlistEnabled = withAllowlist > 0
      keysWithoutIpRestriction = total - withAllowlist
    }

    // 3. Webhook Monitoring — check if developer has any active webhook endpoints
    const [webhookRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.developerId, auth.id),
          eq(webhookEndpoints.status, 'active')
        )
      )

    const hasWebhooks = (webhookRow?.count ?? 0) > 0

    // 4. Budget Controls — check if any consumer_tool_balance for developer's tools has spendingLimitCents
    let budgetControlsEnabled = false

    if (toolIds.length > 0) {
      const [budgetRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(consumerToolBalances)
        .where(
          and(
            inArray(consumerToolBalances.toolId, toolIds),
            sql`${consumerToolBalances.spendingLimitCents} is not null`
          )
        )
      budgetControlsEnabled = (budgetRow?.count ?? 0) > 0
    }

    // 5. API Key Rotation — check if any key for developer's tools is older than 90 days
    let hasStaleKeys = false
    let staleKeyCount = 0

    if (toolIds.length > 0) {
      const ninetyDaysAgoDate = new Date()
      ninetyDaysAgoDate.setDate(ninetyDaysAgoDate.getDate() - 90)
      const ninetyDaysAgo = ninetyDaysAgoDate.toISOString()

      const [staleRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(apiKeys)
        .where(
          and(
            inArray(apiKeys.toolId, toolIds),
            eq(apiKeys.status, 'active'),
            lt(apiKeys.createdAt, ninetyDaysAgo)
          )
        )
      staleKeyCount = staleRow?.count ?? 0
      hasStaleKeys = staleKeyCount > 0
    }

    // Build items
    const items: SecurityItem[] = [
      {
        id: 'stripe-connect',
        title: 'Stripe Connect',
        priority: 'critical',
        completed: stripeConnected,
        statusDetail: stripeConnected ? 'Connected' : 'Not started',
        href: '/dashboard/settings#payouts',
        steps: [
          'Go to Dashboard > Settings > Payouts.',
          'Click "Connect with Stripe" to start the onboarding flow.',
          'Complete the Stripe Express account setup with your business details.',
          'Once connected, payouts will be deposited to your linked bank account.',
        ],
      },
      {
        id: '2fa',
        title: 'Two-Factor Authentication',
        priority: 'critical',
        completed: false, // Actual status checked client-side via /api/auth/mfa
        statusDetail: 'Check Settings > Security',
        href: '/dashboard/settings#security',
        steps: [
          'Go to Settings > Security.',
          'Click "Enable 2FA" to start TOTP enrollment.',
          'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.).',
          'Enter the 6-digit code to verify and activate two-factor authentication.',
        ],
      },
      {
        id: 'ip-allowlist',
        title: 'IP Allowlisting',
        priority: 'recommended',
        completed: ipAllowlistEnabled,
        statusDetail: ipAllowlistEnabled
          ? keysWithoutIpRestriction > 0
            ? `Enabled — ${keysWithoutIpRestriction} key${keysWithoutIpRestriction === 1 ? '' : 's'} without IP restrictions`
            : 'All keys have IP restrictions'
          : 'Not started',
        href: '/consumer',
        steps: [
          'Go to the Consumer Dashboard.',
          'Select the API key you want to restrict.',
          'Click "Edit IP Allowlist" and add one or more CIDR ranges (e.g., 203.0.113.0/24).',
          'Save changes. Only requests from listed addresses will be accepted.',
        ],
      },
      {
        id: 'webhooks',
        title: 'Webhook Monitoring',
        priority: 'recommended',
        completed: hasWebhooks,
        statusDetail: hasWebhooks ? 'Active' : 'Not started',
        href: '/dashboard/webhooks',
        steps: [
          'Go to Dashboard > Webhooks.',
          'Click "Add Endpoint" and enter your HTTPS URL.',
          'Select the events you want to receive (e.g., invocation.flagged, key.revoked).',
          'Copy the signing secret to verify HMAC-SHA256 signatures on incoming webhooks.',
        ],
      },
      {
        id: 'budget-controls',
        title: 'Budget Controls',
        priority: 'recommended',
        completed: budgetControlsEnabled,
        statusDetail: budgetControlsEnabled ? 'Active' : 'Not started',
        href: '/consumer',
        steps: [
          'Go to the Consumer Dashboard.',
          'Click "Edit Budget" on any tool balance.',
          'Set a spending limit and billing period (daily, weekly, or monthly).',
          'Configure alert thresholds to receive notifications before hitting the limit.',
        ],
      },
      {
        id: 'key-rotation',
        title: 'API Key Rotation',
        priority: 'recommended',
        completed: !hasStaleKeys,
        statusDetail: hasStaleKeys
          ? `${staleKeyCount} key${staleKeyCount === 1 ? '' : 's'} older than 90 days`
          : 'All keys are recent',
        href: '/consumer',
        steps: [
          'Create a new API key for the same consumer+tool pair from the Consumer Dashboard.',
          'Deploy the new key to your consumer\'s application or configuration.',
          'Verify the new key is working by checking invocation logs.',
          'Revoke the old key only after confirming the new key is active in all environments.',
        ],
      },
      {
        id: 'audit-logging',
        title: 'Audit Logging',
        priority: 'built-in',
        completed: true,
        statusDetail: 'Built-in — always active',
        href: '/dashboard/audit-log',
        steps: [
          'Audit logging is built into SettleGrid and cannot be disabled.',
          'Every key creation, revocation, payout, and status change is recorded.',
          'Visit Dashboard > Audit Log to view and export events.',
        ],
      },
      {
        id: 'session-management',
        title: 'Session Management',
        priority: 'built-in',
        completed: true,
        statusDetail: 'Built-in — always active',
        href: '/dashboard/settings#security',
        steps: [
          'Session management is built into SettleGrid and always active.',
          'Sessions use secure HTTP-only cookies with automatic expiry.',
          'The fraud detection system monitors session nesting depth to prevent recursion attacks.',
        ],
      },
    ]

    const completedCount = items.filter((i) => i.completed).length
    const totalCount = items.length

    return successResponse({
      items,
      summary: {
        completed: completedCount,
        total: totalCount,
        percentage: Math.round((completedCount / totalCount) * 100),
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
