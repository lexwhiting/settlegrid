import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import {
  parseBody,
  successResponse,
  errorResponse,
  internalErrorResponse,
  ParseBodyError,
} from '@/lib/api'
import { getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { createStripeRailAdapter } from '@settlegrid/mcp'
import type { StripeClient } from '@settlegrid/mcp'
import { getStripeClient } from '@/lib/rails'
import {
  routeDeveloper,
  UnsupportedCountryError,
  InvalidInputError,
} from '@settlegrid/rails'

export const maxDuration = 60

/**
 * P3.RAIL1 — Eligibility-gated Stripe Connect onboarding.
 *
 * Spec-diff fix for D14 + D15 + D17:
 *   - D14: "Eligibility pre-check runs before the onboarding redirect
 *     in every path." Without this gate, a client could skip the
 *     `/onboarding` UI and POST directly here to start a Stripe
 *     account in an unsupported country, dead-ending at Stripe's
 *     own form.
 *   - D15 + hostile (d): "no account-type logic exists outside
 *     router.ts." The Stripe adapter previously defaulted to
 *     `accountType: 'express'` when callers didn't specify. We now
 *     pass the router-decided account type explicitly so the only
 *     account-type source of truth is `routeDeveloper()`.
 *   - D17 + hostile (a): "the eligibility pre-check is not skippable
 *     (client-side bypass test)." This route now runs the same
 *     `routeDeveloper()` call as `/api/eligibility` server-side, so a
 *     client-side bypass attempt that POSTs straight here gets a 403
 *     with a redirect hint to the waitlist.
 *
 * The route accepts country / entity / preferred-currency in the
 * request body. The `/onboarding` Server Component supplies them as
 * hidden form inputs. Callers without a body (legacy or bypass
 * attempts) get a 400 — defaults are NOT silently substituted because
 * a default could mask a real bug (a developer in IN routing through
 * to Express because the default said US).
 */

const connectSchema = z.object({
  countryIso: z
    .string()
    .min(1, 'countryIso is required')
    .max(8, 'countryIso must be at most 8 characters'),
  entityType: z.enum(['individual', 'company']),
  preferredCurrency: z.string().min(1).max(8).default('USD'),
  requestsSelfManaged: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `stripe-connect:${ip}`)
    if (!rateLimit.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const [developer] = await db
      .select({
        tier: developers.tier,
        stripeConnectId: developers.stripeConnectId,
        stripeConnectStatus: developers.stripeConnectStatus,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    // ─── P3.RAIL1 eligibility gate ───────────────────────────────
    // Routes the request through the same router used by
    // /api/eligibility so the gate is truly non-skippable. Errors
    // map deterministically to HTTP responses:
    //   - InvalidInputError   → 400 INVALID_INPUT
    //   - UnsupportedCountry  → 403 INELIGIBLE + waitlistUrl hint
    //   - other               → 500 (fail-closed: deny)
    let body
    try {
      body = await parseBody(request, connectSchema)
    } catch (err) {
      if (err instanceof ParseBodyError) {
        return errorResponse(err.message, err.statusCode, 'VALIDATION_ERROR')
      }
      throw err
    }

    const tier = mapTier(developer.tier)
    let accountType: 'express' | 'standard' | 'custom'
    try {
      const decision = routeDeveloper({
        countryIso: body.countryIso,
        entityType: body.entityType,
        preferredCurrency: body.preferredCurrency ?? 'USD',
        tier,
        requestsSelfManaged: body.requestsSelfManaged,
      })
      accountType = decision.accountType
    } catch (err) {
      if (err instanceof InvalidInputError) {
        return errorResponse(
          `Invalid input: ${err.field} is not a valid value.`,
          400,
          'INVALID_INPUT',
        )
      }
      if (err instanceof UnsupportedCountryError) {
        const waitlistUrl =
          `/onboarding/waitlist?country=${encodeURIComponent(err.countryIso)}` +
          `&entity=${encodeURIComponent(err.entityType)}` +
          `&reason=${encodeURIComponent(err.waitlistReason)}`
        return errorResponse(
          'Stripe Connect is not yet available for your country and entity-type combination.',
          403,
          'INELIGIBLE',
          undefined,
          { waitlistUrl, waitlistReason: err.waitlistReason },
        )
      }
      // Unknown router error — fail-closed: deny rather than risk
      // letting a developer through to Stripe in an unknown state.
      throw err
    }

    const adapter = createStripeRailAdapter({
      stripe: getStripeClient() as unknown as StripeClient,
      appUrl: getAppUrl(),
      // P3.RAIL1 D15 fix: pass the router-decided account type
      // explicitly so the adapter no longer defaults it. router.ts
      // is the single source of truth for the type decision.
      accountType,
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
      details: {
        stripeAccountId: externalId,
        accountType,
        countryIso: body.countryIso.toUpperCase(),
        entityType: body.entityType,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {
      /* fire-and-forget */
    })

    return successResponse({ url, accountType })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/**
 * Map the developer's stored `tier` text column to the closed enum
 * the router accepts. Legacy tier names ('starter', 'growth') are
 * coerced to 'builder' to match the project-wide tier-aliases table.
 *
 * Fail-closed: a missing or unrecognized tier maps to 'free' so a
 * privilege-escalation attempt that smuggles `tier: undefined`
 * cannot accidentally trigger the Standard escalation branch in the
 * router (which requires `tier: 'scale'` exactly).
 */
function mapTier(raw: string | null | undefined): 'free' | 'builder' | 'scale' {
  if (typeof raw !== 'string') return 'free'
  const lower = raw.toLowerCase()
  if (lower === 'scale') return 'scale'
  if (lower === 'builder' || lower === 'starter' || lower === 'growth') {
    return 'builder'
  }
  return 'free'
}
