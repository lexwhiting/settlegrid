/**
 * P4.7 — pure helpers + types for the launch-metrics route.
 *
 * Lives in a sibling file (NOT route.ts) because Next.js App Router's
 * Route segment type-check rejects any export from `route.ts` that
 * isn't an HTTP method handler (`GET`, `POST`, etc.) or a
 * recognized config export (`maxDuration`, `revalidate`, `dynamic`,
 * `runtime`, `OPTIONS`, etc.).
 *
 * Tests + the route both import from here. Sibling files like this
 * are not treated as routes by App Router — only `route.ts` is the
 * route entrypoint.
 */

export interface PostHogFunnel {
  galleryViewedLast15m: number
  galleryViewedLast1h: number
  galleryViewedLast24h: number
  templateDetailLast24h: number
  scaffoldSuccessLast24h: number
  scaffoldFailedLast24h: number
  cliInstallStartedLast15m: number
  cliInstallStartedLast1h: number
  cliInstallStartedLast24h: number
}

export interface LaunchMetrics {
  /** ISO timestamp of when this payload was assembled (server-side). */
  generatedAt: string
  /**
   * PostHog event-funnel counts per canonical event, bucketed by
   * window. `null` when PostHog is unreachable.
   */
  posthog: PostHogFunnel | null
  /** CLI install count from telemetry. `null` on PostHog failure. */
  cliInstalls: { last15m: number; last1h: number; last24h: number } | null
  /**
   * Scaffold success/fail ratio. `null` on PostHog failure.
   * `successRate` ∈ [0, 1] or null when no scaffolds in the window.
   */
  scaffolds: {
    successLast24h: number
    failedLast24h: number
    successRate: number | null
  } | null
  /**
   * Active Stripe Connect express accounts. `null` on Stripe failure.
   * `truncated` is true when we hit the per-page cap (100) and there
   * are likely more — surfaced on the dashboard as "100+" so the
   * founder doesn't read 100 as the actual count.
   */
  stripeConnections: { count: number; truncated: boolean } | null
  /** DB response time percentiles in ms over the last 5 minutes. */
  dbLatency: { p50Ms: number | null; p95Ms: number | null }
  /**
   * HN Show/post status. `null` if `LAUNCH_HN_ITEM_ID` env var unset
   * (i.e. we haven't posted yet) or the HN API is down.
   */
  hn: {
    itemId: number
    url: string
    title: string | null
    points: number | null
    descendants: number | null
    rank: number | null
  } | null
  /** Error count over the last hour from Sentry. `null` on Sentry failure. */
  sentryErrorsLastHour: number | null
}

/**
 * Pure parser: given HN's front-page HTML, return 1-based rank of an
 * item or null if the item isn't present in the snippet.
 *
 * Match `<tr class="athing submission" id="NNNNN">` (HN markup as of
 * 2026-04-27 — verified by curling the front page during the P4.7
 * hostile review). If HN's template changes we get null and the
 * dashboard shows `--`.
 */
export function parseHnRankFromHtml(
  html: string,
  itemId: number,
): number | null {
  const trRegex = /<tr[^>]+class="athing[^"]*"[^>]+id="(\d+)"/g
  const matches = [...html.matchAll(trRegex)]
  for (let i = 0; i < matches.length; i++) {
    if (Number(matches[i][1]) === itemId) return i + 1
  }
  return null
}

/**
 * Pure mapper: HogQL row (array of count(s)) → typed funnel object.
 * Defensive against missing/short rows — returns null if the row
 * isn't the expected shape so the caller can surface "PostHog
 * unreachable" rather than render zeroes that look real.
 */
export function parsePostHogFunnelRow(row: unknown): PostHogFunnel | null {
  if (!Array.isArray(row) || row.length < 9) return null
  return {
    galleryViewedLast15m: Number(row[0] ?? 0),
    galleryViewedLast1h: Number(row[1] ?? 0),
    galleryViewedLast24h: Number(row[2] ?? 0),
    templateDetailLast24h: Number(row[3] ?? 0),
    scaffoldSuccessLast24h: Number(row[4] ?? 0),
    scaffoldFailedLast24h: Number(row[5] ?? 0),
    cliInstallStartedLast15m: Number(row[6] ?? 0),
    cliInstallStartedLast1h: Number(row[7] ?? 0),
    cliInstallStartedLast24h: Number(row[8] ?? 0),
  }
}
