import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { createStripeRailAdapter } from '@settlegrid/mcp'
import type { StripeClient } from '@settlegrid/mcp'

export const maxDuration = 60

/**
 * P2.RAIL1 — All Stripe SDK calls now go through the adapter.
 * This route handler is a thin orchestrator: auth → DB lookup →
 * adapter.startOnboarding → DB write → response.
 */
function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `stripe-connect:${ip}`)
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

    const [developer] = await db
      .select({
        stripeConnectId: developers.stripeConnectId,
        stripeConnectStatus: developers.stripeConnectStatus,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    const adapter = createStripeRailAdapter({
      stripe: getStripe() as unknown as StripeClient,
      appUrl: getAppUrl(),
    })

    // P2.RAIL1 resumability: two-step flow — persist the externalId
    // BETWEEN account creation and onboarding-link creation. If the
    // link step fails, the next retry reuses the already-persisted ID
    // instead of creating an orphan duplicate account. Matches the
    // pre-refactor persist order exactly.
    const existingAccountId = developer.stripeConnectId ?? undefined
    const { externalId, created } = await adapter.ensureAccount({
      developerId: auth.id,
      email: auth.email,
      existingExternalId: existingAccountId,
    })

    if (created) {
      await db
        .update(developers)
        .set({
          stripeConnectId: externalId,
          stripeConnectStatus: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(developers.id, auth.id))
    }

    const { url } = await adapter.createOnboardingLink(externalId)

    writeAuditLog({
      developerId: auth.id,
      action: 'billing.stripe_connect_started',
      resourceType: 'stripe_account',
      resourceId: externalId,
      details: { stripeAccountId: externalId },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {/* fire-and-forget */})

    return successResponse({ url })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
