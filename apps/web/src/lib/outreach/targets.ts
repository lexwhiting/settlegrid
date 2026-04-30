/**
 * P4.6 — Outreach target types.
 *
 * The launch-week second-batch outreach generator (script in
 * scripts/build-outreach-batch.ts) classifies recipients into
 * three priority tiers + emits a manually-reviewable markdown
 * file at docs/launch/outreach-batch-2.md. The founder sends the
 * emails by hand from a personal mailbox (Gmail/Superhuman) — the
 * SCRIPT NEVER SENDS EMAIL ITSELF, by design. That preserves the
 * "personal email from a founder" signal and dodges the spam
 * filters that bulk-tooling triggers.
 *
 * Types only. No I/O, no env reads, no SDK clients — keeps the
 * module importable from both the script (Node) and any future
 * runtime (Vercel route, etc.) without dragging in dependencies.
 */

/**
 * Priority tier. Hot targets get variant copy referencing the
 * specific repo they forked. Warm targets get the general
 * template. Cold targets get a softer opener that acknowledges
 * the lack of prior contact.
 */
export type TargetTier = 'hot' | 'warm' | 'cold'

/**
 * Identifier the founder uses to address the recipient. The
 * github_login is always present (every target source has it); a
 * resolved `name` is best-effort from the GitHub user object's
 * `name` field and may fall back to the login.
 */
export interface TargetIdentity {
  /** GitHub login — primary stable key for caching + dedupe. */
  githubLogin: string
  /** Display name from the GitHub user profile (defaults to login). */
  name: string
  /**
   * Public email if the user has one set on their GitHub profile.
   * Many users don't — when null, the founder finds the address
   * via their existing prospect database (mcp-developers.csv or
   * the cold-email tooling). The script does NOT scrape email
   * from commit history (privacy + abuse policy).
   */
  email: string | null
}

/**
 * Public-data context the personalizer uses to write one
 * specific sentence. All fields are optional — the personalizer
 * MUST handle missing fields gracefully and fall back to the
 * field with the most signal (usually `recentRepoName`).
 */
export interface TargetSignal {
  /** GitHub bio text — short, often empty. */
  bio: string | null
  /**
   * Most-recent public repo the user committed to (not
   * necessarily owned). Best signal for "what are they working
   * on right now."
   */
  recentRepoName: string | null
  /**
   * The latest non-merge commit message on `recentRepoName`. Cap
   * to ~120 chars during fetch to keep the personalize prompt
   * under control. Null when the script couldn't fetch a commit
   * message in budget.
   */
  recentCommitMessage: string | null
  /** Primary language across the user's recent repos. */
  primaryLanguage: string | null
  /**
   * Most-recent public PR or issue the user opened/closed,
   * parsed from `/users/<login>/events/public`. Stronger signal
   * than a raw commit message because PR titles are author-
   * curated descriptions of intent. Null when no recent PR/issue
   * activity surfaced in the events feed (rate-limited or the
   * user only commits without opening PRs).
   */
  recentActivityType: 'PR' | 'issue' | null
  /** Title of the recent PR or issue. Capped to ~120 chars during fetch. */
  recentActivityTitle: string | null
  /**
   * For shadow-directory cold targets, the star count on the
   * tool repo. Only set on `tier === 'cold'`. Used by the
   * sorting + size-of-batch logic, not by the personalizer.
   */
  starCount: number | null
  /**
   * For Phase-2 hot targets, the upstream template repo URL the
   * recipient forked (e.g. `https://github.com/settlegrid/settlegrid-airbyte`).
   * Only set on `tier === 'hot'`. The hot-tier email variant
   * references this repo by name.
   */
  forkedTemplateRepo: string | null
}

/**
 * The fully-classified, fully-enriched target the script feeds
 * into the renderer. Every field except the inner Signal/Identity
 * fields is non-null — defaulting + filtering happens during the
 * fetch+classify pass.
 */
export interface Target {
  tier: TargetTier
  identity: TargetIdentity
  signal: TargetSignal
}

/**
 * A draft email — the renderer's output, the script's per-target
 * markdown block. The founder reviews the draft, then copies
 * subject + body into their mail client and presses send.
 */
export interface DraftEmail {
  /** Subject line. Tier-specific variants share the same shape. */
  subject: string
  /** Plain-text body (rendered from the markdown template). */
  body: string
  /** Recipient identity (for the review file's metadata block). */
  identity: TargetIdentity
  /** Tier — affects the "hot/warm/cold" header in the review file. */
  tier: TargetTier
  /** The personalization sentence the renderer interpolated. */
  personalizationLine: string
}

/**
 * Hostile-review invariant baked into the type: the script that
 * builds drafts MUST verify `identity.email !== null` before
 * marking a draft "ready to send." Drafts where email is null
 * still get rendered (so the founder can resolve the address
 * later) but are flagged in the review file's metadata.
 */
export function isSendable(draft: DraftEmail): boolean {
  return (
    draft.identity.email !== null &&
    draft.identity.email.includes('@') &&
    draft.subject.trim().length > 0 &&
    draft.body.trim().length > 0
  )
}
