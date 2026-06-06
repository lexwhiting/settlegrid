/**
 * P4.7 — Launch-day war room metrics endpoint.
 *
 * Single GET that returns every signal the launch dashboard renders.
 * All upstream calls fan out in parallel and are bounded by an
 * AbortController; if a source is slow or down, that card on the
 * dashboard shows `null` rather than the whole route timing out.
 *
 * ## Auth
 *
 * Same gate as `/api/admin/stats`: rate-limited by IP, then
 * `requireDeveloper`, then ADMIN_EMAILS allowlist. Returns 401 on
 * unauth and 403 on non-admin email, matching the `/api/admin/stats`
 * pattern. The `/admin/launch-dashboard` page renders a generic 404
 * for any non-200 response, which is what actually hides the
 * admin surface — the route's status codes are the source of truth
 * for API consumers (e.g., monitoring), the dashboard's UI is the
 * surface-hide. (Sibling note: `/api/admin/kernel-health` chose to
 * return 404 directly from the route. Both patterns are valid; the
 * difference is whether the route or the page handles the surface-
 * hide. This route delegates to the page.)
 *
 * ## Cache
 *
 * `revalidate = 30` — one fresh fetch per 30 seconds at most. The
 * dashboard polls every 30s on the client side. Without revalidate,
 * each poll would trigger a fresh fan-out to PostHog/HN/Vercel.
 *
 * @packageDocumentation
 */
import { NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 30
/**
 * Cache the response for 30s. The dashboard polls every 30s; without
 * revalidate every render would re-fan out to PostHog/HN/Vercel.
 */
export const revalidate = 30

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/**
 * Per-source fetch ceiling. PostHog/HN/Sentry calls are best-effort
 * — if any one is slow, that card goes null on the dashboard. The
 * route still returns 200 so the rest of the cards render. This is
 * the launch-day-can't-be-blocked-by-PostHog invariant.
 */
const PER_SOURCE_TIMEOUT_MS = 5_000

// Pure helpers + types live in `./helpers` because Next.js App Router
// rejects any export from route.ts that isn't an HTTP method handler
// or recognized config export.
import {
  parsePostHogFunnelRow,
  parseHnRankFromHtml,
  type LaunchMetrics,
  type PostHogFunnel,
} from './helpers'

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `admin-launch:${ip}`)
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
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `admin-launch:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    if (!ADMIN_EMAILS.includes(auth.email)) {
      return errorResponse('Forbidden. Admin access required.', 403, 'FORBIDDEN')
    }

    // Parallel fan-out. Any failure here is per-source; the route
    // never throws if one upstream is down. Promise.all + per-call
    // try/catch (inside each fetch helper) keeps this simple.
    const [posthog, stripeConnections, dbLatency, hn, sentryErrorsLastHour] =
      await Promise.all([
        fetchPostHogFunnel().catch((err) => {
          logger.warn('admin.launch_metrics.posthog_failed', { error: String(err) })
          return null
        }),
        fetchStripeActiveConnections().catch((err) => {
          logger.warn('admin.launch_metrics.stripe_failed', { error: String(err) })
          return null
        }),
        fetchDbLatency().catch((err) => {
          logger.warn('admin.launch_metrics.db_failed', { error: String(err) })
          return { p50Ms: null, p95Ms: null }
        }),
        fetchHnItem().catch((err) => {
          logger.warn('admin.launch_metrics.hn_failed', { error: String(err) })
          return null
        }),
        fetchSentryErrorsLastHour().catch((err) => {
          logger.warn('admin.launch_metrics.sentry_failed', { error: String(err) })
          return null
        }),
      ])

    const cliInstalls = posthog
      ? {
          last15m: posthog.cliInstallStartedLast15m,
          last1h: posthog.cliInstallStartedLast1h,
          last24h: posthog.cliInstallStartedLast24h,
        }
      : null

    const scaffolds = posthog
      ? {
          successLast24h: posthog.scaffoldSuccessLast24h,
          failedLast24h: posthog.scaffoldFailedLast24h,
          successRate:
            posthog.scaffoldSuccessLast24h + posthog.scaffoldFailedLast24h > 0
              ? posthog.scaffoldSuccessLast24h /
                (posthog.scaffoldSuccessLast24h + posthog.scaffoldFailedLast24h)
              : null,
        }
      : null

    const payload: LaunchMetrics = {
      generatedAt: new Date().toISOString(),
      posthog,
      cliInstalls,
      scaffolds,
      stripeConnections,
      dbLatency,
      hn,
      sentryErrorsLastHour,
    }

    logger.info('admin.launch_metrics_accessed', { email: auth.email })
    return successResponse(payload)
  } catch (error) {
    return internalErrorResponse(error)
  }
}

// ── Source-specific fetchers ────────────────────────────────────────────────

/**
 * PostHog funnel via HogQL. Requires PERSONAL_API_KEY (`POSTHOG_PERSONAL_API_KEY`)
 * and `POSTHOG_PROJECT_ID`. Returns null when either env var is unset
 * (so the dashboard renders "PostHog: not configured" rather than crashing).
 *
 * Why HogQL: ad-hoc event counts over short windows are slow on PostHog's
 * `/api/projects/.../events` endpoint at scale. HogQL hits the columnar
 * store directly.
 */
async function fetchPostHogFunnel(): Promise<PostHogFunnel | null> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'
  if (!apiKey || !projectId) return null

  // Single SQL roundtrip per dashboard load — count() filtered per event,
  // bucketed by time window. Window math is server-side in HogQL so we
  // don't have to fetch and aggregate ourselves.
  const query = `
    SELECT
      countIf(event = 'gallery_viewed' AND timestamp > now() - INTERVAL 15 MINUTE) AS gallery_15m,
      countIf(event = 'gallery_viewed' AND timestamp > now() - INTERVAL 1 HOUR)    AS gallery_1h,
      countIf(event = 'gallery_viewed' AND timestamp > now() - INTERVAL 24 HOUR)   AS gallery_24h,
      countIf(event = 'template_detail_viewed' AND timestamp > now() - INTERVAL 24 HOUR) AS template_24h,
      countIf(event = 'scaffold_success' AND timestamp > now() - INTERVAL 24 HOUR) AS scaffold_ok_24h,
      countIf(event = 'scaffold_failed'  AND timestamp > now() - INTERVAL 24 HOUR) AS scaffold_fail_24h,
      countIf(event = 'cli_install_started' AND timestamp > now() - INTERVAL 15 MINUTE) AS cli_15m,
      countIf(event = 'cli_install_started' AND timestamp > now() - INTERVAL 1 HOUR)    AS cli_1h,
      countIf(event = 'cli_install_started' AND timestamp > now() - INTERVAL 24 HOUR)   AS cli_24h
    FROM events
  `

  const url = `${host.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectId)}/query`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PER_SOURCE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { results?: unknown[][] }
    return parsePostHogFunnelRow(data.results?.[0])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Active Stripe Connect express accounts (developers who finished
 * onboarding). Uses the Stripe API directly because we don't mirror
 * connection-state in the DB. Returns null when STRIPE_SECRET isn't
 * configured.
 *
 * Pagination: Stripe caps `limit=100` per page and exposes
 * `has_more` for cursoring. Under launch volume we don't expect
 * 100+ active accounts in 24h, so we read one page and surface
 * `has_more` as `truncated` rather than fan out cursors here. After
 * launch this should be replaced with a stored aggregate from
 * webhook-fed local state.
 */
async function fetchStripeActiveConnections(): Promise<
  LaunchMetrics['stripeConnections']
> {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return null
  const url = 'https://api.stripe.com/v1/accounts?limit=100'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PER_SOURCE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      data?: Array<{ details_submitted?: boolean; charges_enabled?: boolean }>
      has_more?: boolean
    }
    if (!data.data) return { count: 0, truncated: false }
    const count = data.data.filter(
      (a) => a.details_submitted === true && a.charges_enabled === true,
    ).length
    return { count, truncated: data.has_more === true }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * DB latency over the last 5 minutes. Uses `pg_stat_statements` if
 * available; falls back to a single SELECT 1 timing if not.
 *
 * Why approximate: enabling pg_stat_statements requires a Supabase
 * extension. If it's missing we measure roundtrip-now as a proxy —
 * the absolute number is less useful than the trend the dashboard
 * polls every 30s.
 */
async function fetchDbLatency(): Promise<{ p50Ms: number | null; p95Ms: number | null }> {
  try {
    // Try pg_stat_statements; if extension missing, fall through.
    const result = await db.execute<{ p50: number; p95: number }>(sql`
      WITH stats AS (
        SELECT mean_exec_time, calls
        FROM pg_stat_statements
        WHERE last_call > now() - INTERVAL '5 minutes'
      )
      SELECT
        COALESCE(percentile_disc(0.5)  WITHIN GROUP (ORDER BY mean_exec_time), 0) AS p50,
        COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY mean_exec_time), 0) AS p95
      FROM stats
    `)
    const row = (result as unknown as Array<{ p50?: number; p95?: number }>)[0]
    if (row && (row.p50 != null || row.p95 != null)) {
      return {
        p50Ms: row.p50 != null ? Math.round(Number(row.p50)) : null,
        p95Ms: row.p95 != null ? Math.round(Number(row.p95)) : null,
      }
    }
  } catch {
    // pg_stat_statements likely missing. Fall through to roundtrip probe.
  }

  // Fallback: single roundtrip timing as a proxy. `SELECT 1` is a
  // table-free no-op the planner can answer in ~1ms — measures pure
  // network + protocol roundtrip, which is what we want for "is the
  // DB hot or cold?". We expose the same value as p50 and p95 because
  // we only have one sample.
  const start = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    const elapsed = Date.now() - start
    return { p50Ms: elapsed, p95Ms: elapsed }
  } catch {
    return { p50Ms: null, p95Ms: null }
  }
}

/**
 * HN item details + rank. Item ID comes from `LAUNCH_HN_ITEM_ID` set
 * once the founder posts the Show HN. Rank is scraped from the front
 * page (HN's own API doesn't expose it). Both calls have the same 5s
 * timeout via AbortController.
 */
async function fetchHnItem(): Promise<LaunchMetrics['hn']> {
  const itemIdRaw = process.env.LAUNCH_HN_ITEM_ID
  if (!itemIdRaw) return null
  const itemId = Number.parseInt(itemIdRaw, 10)
  if (!Number.isFinite(itemId) || itemId <= 0) return null

  const itemUrl = `https://hacker-news.firebaseio.com/v0/item/${itemId}.json`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PER_SOURCE_TIMEOUT_MS)
  try {
    const itemRes = await fetch(itemUrl, { signal: controller.signal })
    if (!itemRes.ok) return null
    const item = (await itemRes.json()) as {
      title?: string
      score?: number
      descendants?: number
      deleted?: boolean
      dead?: boolean
    }
    // `deleted`/`dead` mean the post was nuked or flagged off the
    // front page. Surface as a flag on the dashboard via a 0 score
    // and rank=null so the founder sees it.
    if (item.deleted || item.dead) {
      return {
        itemId,
        url: `https://news.ycombinator.com/item?id=${itemId}`,
        title: item.title ?? null,
        points: 0,
        descendants: item.descendants ?? null,
        rank: null,
      }
    }
    const rank = await fetchHnRank(itemId, controller.signal)
    return {
      itemId,
      url: `https://news.ycombinator.com/item?id=${itemId}`,
      title: item.title ?? null,
      points: item.score ?? null,
      descendants: item.descendants ?? null,
      rank,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Scrape HN front page for the rank of our item. `null` if not
 * present in the top ~30 (page 1 is enough; we stop there for cost).
 */
async function fetchHnRank(
  itemId: number,
  signal: AbortSignal,
): Promise<number | null> {
  const res = await fetch('https://news.ycombinator.com/news', { signal })
  if (!res.ok) return null
  const html = await res.text()
  return parseHnRankFromHtml(html, itemId)
}

/**
 * Sentry events count over the last hour. Sentry's API returns events
 * matching a query; we use `level:[error,fatal]` to mirror what the
 * launch-day playbooks treat as "real" errors (warnings noisy enough
 * to fire during launch shouldn't gate the dashboard).
 */
async function fetchSentryErrorsLastHour(): Promise<number | null> {
  // Env var names match the Sentry SDK's installer convention
  // (`SENTRY_ORG`, `SENTRY_PROJECT`) — NOT `SENTRY_ORG_SLUG` /
  // `SENTRY_PROJECT_SLUG`. The values stored under those names ARE
  // the org + project slugs that the REST API takes, but the
  // variable names omit `_SLUG` to match what Sentry's `sentry-cli`
  // installer sets up. Using the wrong names here would make this
  // card silently return null on production even when Vercel has
  // the values set correctly.
  const authToken = process.env.SENTRY_AUTH_TOKEN
  const orgSlug = process.env.SENTRY_ORG
  const projectSlug = process.env.SENTRY_PROJECT
  if (!authToken || !orgSlug || !projectSlug) return null

  const url =
    `https://sentry.io/api/0/organizations/${encodeURIComponent(orgSlug)}/events/` +
    `?project=${encodeURIComponent(projectSlug)}` +
    `&query=${encodeURIComponent('level:[error,fatal]')}` +
    `&statsPeriod=1h`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PER_SOURCE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { data?: unknown[] }
    return Array.isArray(data.data) ? data.data.length : 0
  } finally {
    clearTimeout(timer)
  }
}
