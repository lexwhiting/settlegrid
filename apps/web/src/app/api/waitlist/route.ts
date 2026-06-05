import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { waitlistSignups } from '@/lib/db/schema'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  sendEmail,
  waitlistConfirmationEmail,
  railWaitlistEmail,
} from '@/lib/email'
import { sendSlackNotification, sendDiscordNotification } from '@/lib/notifications'
import { isWebhookUrlSafe } from '@/lib/webhooks'
import { logger } from '@/lib/logger'

export const maxDuration = 60

/**
 * P3.RAIL1 extension — the waitlist route now also serves the rail
 * waitlist flow. When `feature === 'stripe-connect-rail'` the route
 * persists the supplied countryIso / entityType / preferredCurrency
 * into the existing `waitlist_signups.metadata` jsonb column (no
 * schema change), sends a country-specific confirmation email, and
 * fires a fire-and-forget Slack + Discord notification keyed off
 * `WAITLIST_SLACK_WEBHOOK_URL` + `WAITLIST_DISCORD_WEBHOOK_URL` for
 * demand-signal tracking. Phase 5 telemetry queries the `metadata`
 * column to count waitlist demand per country.
 */

const RAIL_FEATURE_VALUES = ['stripe-connect-rail'] as const
const ISO_COUNTRY = /^[A-Z]{2}$/i
const ISO_CURRENCY = /^[A-Z]{3}$/i

const waitlistSchema = z.object({
  email: z.string().email('Invalid email address').max(320),
  feature: z.string().min(1).max(100).default('showcase'),
  // Rail-waitlist-only fields. Optional for backward-compat with
  // existing showcase / marketplace waitlist callers. When the
  // feature is `stripe-connect-rail`, the eligibility-gated UI
  // populates them; older callers omit them harmlessly.
  countryIso: z
    .string()
    .regex(ISO_COUNTRY, 'countryIso must be ISO-3166 alpha-2')
    .optional(),
  entityType: z.enum(['individual', 'company']).optional(),
  preferredCurrency: z
    .string()
    .regex(ISO_CURRENCY, 'preferredCurrency must be ISO-4217 alpha-3')
    .optional(),
  waitlistReason: z.string().max(100).optional(),
})

type WaitlistInput = z.infer<typeof waitlistSchema>

function isRailWaitlist(feature: string): boolean {
  return (RAIL_FEATURE_VALUES as readonly string[]).includes(feature)
}

function buildMetadata(
  input: Omit<WaitlistInput, 'feature'> & { feature: string },
): Record<string, unknown> | null {
  // Only structured payloads land in metadata. Showcase / marketplace
  // submissions (no country/entity) keep metadata=null so existing
  // analytics queries that assume `metadata IS NULL` for the
  // pre-RAIL1 waitlist row don't shift unexpectedly.
  if (!input.countryIso && !input.entityType && !input.waitlistReason) {
    return null
  }
  const meta: Record<string, unknown> = {}
  if (input.countryIso) meta.countryIso = input.countryIso.toUpperCase()
  if (input.entityType) meta.entityType = input.entityType
  if (input.preferredCurrency) {
    meta.preferredCurrency = input.preferredCurrency.toUpperCase()
  }
  if (input.waitlistReason) meta.waitlistReason = input.waitlistReason
  meta.feature = input.feature
  meta.signedUpAt = new Date().toISOString()
  return meta
}

async function fireDemandSignals(
  emailRedacted: string,
  feature: string,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  // Fire-and-forget Slack/Discord posts. Never throws — a failed
  // outbound webhook must NOT cause the waitlist signup to look
  // like it failed to the user (their row is already persisted).
  const slackUrl = process.env.WAITLIST_SLACK_WEBHOOK_URL
  const discordUrl = process.env.WAITLIST_DISCORD_WEBHOOK_URL
  if (!slackUrl && !discordUrl) return

  const country = metadata?.countryIso ?? '—'
  const entity = metadata?.entityType ?? '—'
  const message =
    `New waitlist signup — feature=${feature}, country=${country}, ` +
    `entity=${entity}, email=${emailRedacted}`

  if (slackUrl) {
    if (isWebhookUrlSafe(slackUrl)) {
      sendSlackNotification(slackUrl, message).catch(() => {})
    } else {
      // H3 fix — operator visibility: a misconfigured WAITLIST_*
      // webhook URL would otherwise silently disappear (the helper
      // returns false; we skip; no Slack message arrives; the
      // operator wonders why). Surface the rejection at WARN level
      // so it's grep-able + alertable.
      logger.warn('waitlist.slack_webhook_rejected', {
        reason: 'isWebhookUrlSafe returned false',
        urlPrefix: slackUrl.slice(0, 30),
      })
    }
  }
  if (discordUrl) {
    if (isWebhookUrlSafe(discordUrl)) {
      sendDiscordNotification(discordUrl, message).catch(() => {})
    } else {
      logger.warn('waitlist.discord_webhook_rejected', {
        reason: 'isWebhookUrlSafe returned false',
        urlPrefix: discordUrl.slice(0, 30),
      })
    }
  }
}

function redactEmail(email: string): string {
  // Slack messages should not log raw emails verbatim (the channel
  // could be archived in a search index). Show first char + domain.
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***'
  return `${local[0]}***@${domain}`
}

export async function POST(request: NextRequest) {
  try {
    // H1 fix — first-hop IP. `x-forwarded-for` is a comma-separated
    // chain of proxies; only [0] (the trusted entry edge's view of
    // the originating client) is meaningful for rate-limiting.
    // Using the whole header as the bucket key let an attacker
    // varying later hops produce different keys and bypass the
    // limiter entirely.
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(authLimiter, `waitlist:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, waitlistSchema)
    const email = body.email.toLowerCase().trim()
    // Zod `.default()` produces an output value at runtime but the
    // inferred input type still includes `undefined`. Narrow here.
    const feature: string = body.feature ?? 'showcase'
    const metadata = buildMetadata({ ...body, feature })

    // H2 fix — `.returning({...})` lets us tell whether this insert
    // actually wrote a row vs hit the unique-key conflict. A
    // duplicate signup must NOT re-fire the email + Slack/Discord
    // posts (spam vector). The user is already on the waitlist;
    // re-confirming is best-effort UX, but firing another Slack
    // post per resubmission is operator noise + an abuse vector.
    const inserted = await db
      .insert(waitlistSignups)
      .values({
        email,
        feature,
        metadata,
      })
      .onConflictDoNothing({
        target: [waitlistSignups.email, waitlistSignups.feature],
      })
      .returning({ id: waitlistSignups.id })

    const wasNewSignup = inserted.length > 0

    if (wasNewSignup) {
      // Fire-and-forget: confirmation email. Rail-specific copy when
      // we know the country, otherwise the generic feature template.
      if (isRailWaitlist(feature) && body.countryIso && body.entityType) {
        const tmpl = railWaitlistEmail(
          email,
          body.countryIso.toUpperCase(),
          body.entityType,
        )
        sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html }).catch(() => {})
      } else {
        const tmpl = waitlistConfirmationEmail(email, feature)
        sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html }).catch(() => {})
      }

      // Fire-and-forget: platform-level demand-signal Slack/Discord
      // post. Only on a NEW signup so resubmissions don't flood the
      // operator channel.
      fireDemandSignals(redactEmail(email), feature, metadata).catch(() => {})
    }

    return successResponse({ success: true, alreadyOnWaitlist: !wasNewSignup })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
