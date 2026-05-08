/**
 * P5.4 — Template-of-the-Week scoring + selection.
 *
 * Pure functions only. The script (`scripts/template-of-the-week.ts`)
 * fetches PostHog data and registry shape; this module turns those
 * inputs into a deterministic ranking, isolated for unit testing
 * (no fs / network / clock).
 *
 * Scoring formula (per spec §P5.4):
 *
 *   score = scaffold_count * 2 + view_count + freshness_bonus
 *
 * - scaffold_count: PostHog `scaffold_success` events with
 *   `properties.template_slug = <slug>` over the lookback window.
 * - view_count: PostHog `template_detail_viewed` events for the slug
 *   over the same window.
 * - freshness_bonus: gives recently-added templates a finite early
 *   advantage so a brand-new template can compete with a well-loved
 *   one in its first month. Decays linearly to 0 by day 30.
 *
 * A candidate is excluded if it appears in the recency-window of the
 * featured-history (default 8 weeks) — this prevents re-featuring a
 * template before its "spotlight" period has expired.
 *
 * If every remaining candidate has score ≤ 0, the caller MUST treat
 * the week as "no candidate" and skip — never pick at random, never
 * fall back to alphabetical first. Picking arbitrarily would burn
 * Anthropic spend and PR-noise cost on content nobody asked for.
 */

export interface TotwScoringInput {
  /** Slug of the template (must match registry.json `slug`). */
  slug: string
  /** PostHog `scaffold_success` count for this slug in the window. */
  scaffoldCount: number
  /** PostHog `template_detail_viewed` count for this slug in the window. */
  viewCount: number
  /**
   * Days since this template was first added to the registry. Used by
   * the freshness bonus. Pass `null` if unknown — the bonus then
   * defaults to 0 (older / safer behavior).
   */
  daysSinceAdded: number | null
}

export interface TotwScored extends TotwScoringInput {
  score: number
  /**
   * Diagnostic — broken out so the script can surface "why" in the PR
   * body without re-running the math.
   */
  components: {
    scaffold: number
    view: number
    freshness: number
  }
}

export const FRESHNESS_WINDOW_DAYS = 30

/**
 * Pure score for a single candidate. NaN inputs collapse to 0 to
 * survive PostHog returning a string-shaped count (asNumber pattern
 * from funnel-queries.ts), and negative scaffold/view counts are
 * clamped to 0 (PostHog should never emit negative counts; this
 * defends against an upstream bug producing one).
 */
export function scoreTemplate(input: TotwScoringInput): TotwScored {
  const scaffold = clampNonNegative(input.scaffoldCount) * 2
  const view = clampNonNegative(input.viewCount)
  const freshness = freshnessBonus(input.daysSinceAdded)
  return {
    ...input,
    score: scaffold + view + freshness,
    components: { scaffold, view, freshness },
  }
}

/**
 * Returns the most recent peak: linear decay from FRESHNESS_WINDOW_DAYS
 * down to 0 over `FRESHNESS_WINDOW_DAYS` days. A 1-day-old template
 * gets +29; a 30-day-old template gets 0; an unknown-age template
 * gets 0.
 */
export function freshnessBonus(daysSinceAdded: number | null): number {
  if (daysSinceAdded === null) return 0
  if (!Number.isFinite(daysSinceAdded) || daysSinceAdded < 0) return 0
  if (daysSinceAdded >= FRESHNESS_WINDOW_DAYS) return 0
  return FRESHNESS_WINDOW_DAYS - daysSinceAdded
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

/**
 * Filter out slugs that appear in the recently-featured set, then
 * rank the remainder. Slugs absent from the input list are absent
 * from the output (no synthesis of zero-score entries).
 *
 * Ties: ranked alphabetically by slug — deterministic, useful for
 * tests and for stable PR titles when scaffold_count ties on a
 * quiet week.
 */
export function selectCandidates(
  inputs: TotwScoringInput[],
  recentlyFeatured: ReadonlySet<string>,
): TotwScored[] {
  return inputs
    .filter((c) => !recentlyFeatured.has(c.slug))
    .map(scoreTemplate)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.slug.localeCompare(b.slug)
    })
}

/**
 * Pick the winner for the week. Returns null when every candidate
 * has score 0 (or the candidate list is empty after filtering).
 *
 * The "every candidate has score 0" check is load-bearing: pre-launch,
 * PostHog returns zeros across the board, and a fall-through-pick
 * would drag a random template into the spotlight. The weekly cron
 * SKIPS those weeks instead.
 */
export function pickWinner(
  inputs: TotwScoringInput[],
  recentlyFeatured: ReadonlySet<string>,
): TotwScored | null {
  const ranked = selectCandidates(inputs, recentlyFeatured)
  if (ranked.length === 0) return null
  const top = ranked[0]
  if (top.score <= 0) return null
  return top
}
