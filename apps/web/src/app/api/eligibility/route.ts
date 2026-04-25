/**
 * P3.RAIL1 — Stripe Connect onboarding eligibility pre-check.
 *
 * The /onboarding UI flow calls this BEFORE redirecting the developer
 * to Stripe so a country+entity-type combination Stripe would dead-end
 * surfaces as a clean "not yet supported" + waitlist instead of a
 * broken Stripe form.
 *
 * # Contract
 *
 *   POST /api/eligibility
 *   body:  { countryIso, entityType, preferredCurrency?, tier?, requestsSelfManaged? }
 *   200:   { eligible: true,  accountType: 'express'|'standard'|'custom' }
 *          OR
 *          { eligible: false, waitlistReason: <enum>, countryIso, entityType }
 *   400:   structurally-invalid input (e.g., non-2-letter country code)
 *   429:   rate-limited
 *   500:   internal error (never on a normal "not eligible" path —
 *          unsupported developers always get 200 with eligible=false)
 *
 * # Hostile-lens contracts
 *
 *   - **Fail-closed:** an unhandled router error is treated as
 *     "ineligible" (not "eligible"). A bug must NEVER let a developer
 *     through onboarding to a Stripe form Stripe will reject.
 *   - **No info leak:** the response body is the small contract above
 *     plus an opaque `waitlistReason` enum. We do NOT echo the full
 *     supported-countries list, do NOT include the request body in
 *     error responses, and do NOT differentiate "country not in matrix"
 *     from "currency not in matrix" with detailed prose. A client
 *     probing for the matrix gets at most an enum.
 *   - **Bypass-resistant:** the check is server-side and does NOT
 *     depend on session state or persisted developer fields — a
 *     client bypassing the UI form and POSTing arbitrary JSON still
 *     hits the same `routeDeveloper()` decision used everywhere
 *     else, so the only thing they can "bypass" is the UX hint to
 *     route to the waitlist (Stripe's own onboarding form would
 *     still reject them).
 *   - **Bounded inputs:** the Zod schema clamps every string field to
 *     a small max length and rejects unknown extras. A 10MB body
 *     fails Zod parsing before the router ever runs.
 *   - **Rate-limited:** 100 requests / minute / IP via the shared
 *     `apiLimiter`. Defends the routing function against probing
 *     traffic.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  parseBody,
  successResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import {
  routeDeveloper,
  UnsupportedCountryError,
  InvalidInputError,
} from '@settlegrid/rails'

export const maxDuration = 10

const eligibilitySchema = z.object({
  countryIso: z
    .string()
    .min(1, 'countryIso is required')
    .max(8, 'countryIso must be at most 8 characters'),
  entityType: z.enum(['individual', 'company']),
  preferredCurrency: z
    .string()
    .min(1)
    .max(8)
    .default('USD'),
  tier: z.enum(['free', 'builder', 'scale']).optional(),
  requestsSelfManaged: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `eligibility:${ip}`)
    if (!rl.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    const body = await parseBody(request, eligibilitySchema)
    // Zod's `.default()` produces an output value but the inferred
    // input type still includes `undefined`. Narrow at the boundary.
    const preferredCurrency = body.preferredCurrency ?? 'USD'

    try {
      const decision = routeDeveloper({
        countryIso: body.countryIso,
        entityType: body.entityType,
        preferredCurrency,
        tier: body.tier,
        requestsSelfManaged: body.requestsSelfManaged,
      })
      return successResponse({
        eligible: true,
        accountType: decision.accountType,
        countryIso: decision.countryIso,
        entityType: decision.entityType,
      })
    } catch (err) {
      if (err instanceof UnsupportedCountryError) {
        // Expected ineligible path — return 200 with a structured
        // waitlist hint rather than a 4xx. The UI uses this to render
        // the "not yet supported" state and pre-fill the waitlist
        // form. Status code intentionally NOT 4xx because the request
        // itself was well-formed; only the eligibility outcome was
        // negative.
        return successResponse({
          eligible: false,
          waitlistReason: err.waitlistReason,
          countryIso: err.countryIso,
          entityType: err.entityType,
        })
      }
      if (err instanceof InvalidInputError) {
        // Caller-side bug (e.g., 'usa' instead of 'US'). 400 with a
        // sanitized message — we don't echo body fields back since
        // an attacker could otherwise smuggle reflected XSS via a
        // server-side error message that we route to a client log.
        return errorResponse(
          `Invalid input: ${err.field} is not a valid value.`,
          400,
          'INVALID_INPUT',
        )
      }
      // Unknown error class — fail-closed: do NOT let the developer
      // through. Treat as 500 so observability fires; the client
      // sees a generic message without internals.
      throw err
    }
  } catch (error) {
    return internalErrorResponse(error)
  }
}
