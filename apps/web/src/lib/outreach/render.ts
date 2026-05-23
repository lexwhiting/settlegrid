/**
 * P4.6 — Email template rendering.
 *
 * Reads the markdown template at templates/launch-live.md and
 * fills in the per-target tokens. Tier-specific copy is injected
 * via the `tier_specific_line` slot rather than swapping templates
 * entirely — keeps the CAN-SPAM footer + CTA shape identical
 * across hot/warm/cold (an audit-easier surface).
 *
 * ## CAN-SPAM compliance baked into the template
 *
 *   - **Physical postal address** in the footer (rendered from
 *     `RenderConfig.physicalAddress`).
 *   - **Identity disclosure**: founder name + role + company in
 *     the footer.
 *   - **Opt-out mechanism**: "Reply STOP and I won't email you
 *     again." Personal emails don't legally require an unsubscribe
 *     link, but reply-based opt-out is best practice and the
 *     spec literal.
 *   - **No deceptive subject line**: subject is fixed and literal
 *     ("SettleGrid is live — thought you'd want to see it").
 *     The script also asserts subject doesn't start with "Re:"
 *     before writing the review file (DoD literal).
 *
 * ## Token list
 *
 *   - {{recipient_first_name}}  — derived from TargetIdentity.name
 *   - {{personalization_line}}  — Claude-generated, ≤ 20 words
 *   - {{tier_specific_line}}    — hot/warm/cold variant, see TIER_LINES
 *   - {{blog_url}}              — launch blog post URL (config)
 *   - {{founder_name}}          — config
 *   - {{founder_role}}          — config (e.g. "Founder")
 *   - {{company_name}}          — config (e.g. "SettleGrid")
 *   - {{physical_address}}      — config, REQUIRED for CAN-SPAM
 *
 * Hostile-review note: the renderer is deterministic with no
 * side effects, so the script's idempotency guarantee depends
 * only on the template + RenderConfig + TargetIdentity/Signal
 * being stable per re-run.
 *
 * @packageDocumentation
 */
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Target, TargetTier, DraftEmail } from './targets'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/**
 * Per-tier opening context (slotted via {{intro_context}}). The
 * load-bearing reason this is per-tier rather than fixed: the
 * spec literal "I emailed you 6 weeks ago" is FACTUALLY TRUE for
 * Phase-2 hot targets and FACTUALLY FALSE for cold targets who
 * weren't in Phase 2. Per spec ("Cold targets get a softer opener
 * that acknowledges we're reaching out without prior contact"),
 * cold targets get a fresh-contact opener that names the crawl
 * source.
 *
 * The {{blog_url}} token inside the string is replaced by a
 * second pass in renderDraft — the entries reference {{blog_url}}
 * literally so the per-tier template stays declarative.
 */
export const TIER_INTROS: Record<TargetTier, string> = {
  hot:
    "I emailed you about SettleGrid 6 weeks ago. We're live today: per-call billing for any MCP server, one command to wrap an existing repo. Launch post: {{blog_url}}.",
  warm:
    "I sent some MCP-server outreach 6 weeks ago and you may have seen it. We're live today: per-call billing for any MCP server, one command to wrap an existing repo. Launch post: {{blog_url}}.",
  cold:
    "We launched this week. I'm reaching out cold because your repo surfaced in our public-MCP crawl — feel free to ignore. SettleGrid adds per-call billing to any MCP server in one command. Launch post: {{blog_url}}.",
}

/**
 * Tier-specific line slotted via {{tier_specific_line}} after the
 * gallery-click ask. Carries the tier's distinctive CTA:
 *
 *   Hot: codemod CTA referencing the recipient's specific fork.
 *   Warm: registry-feedback ask.
 *   Cold: empty (cold targets already got the "feel free to ignore"
 *         disclaimer in the intro_context; no further softening here).
 */
export const TIER_LINES: Record<TargetTier, (target: Target) => string> = {
  hot: (target) => {
    const repo = target.signal.forkedTemplateRepo
    if (repo) {
      // Extract `owner/name` from the repo URL for compactness.
      const match = repo.match(/github\.com\/([^/]+)\/([^/?#]+)/)
      const slug = match ? `${match[1]}/${match[2]}` : repo
      return `Or, since you forked ${slug}, run \`npx @settlegrid/cli add github:your-fork --dry-run\` and tell me what the codemod did.`
    }
    return `Or run \`npx @settlegrid/cli add github:your-mcp-server --dry-run\` and tell me what the codemod did.`
  },
  warm: () =>
    `Or, if you maintain a list or registry of MCP servers, I'd value 60 seconds of "this would land better if…" feedback.`,
  cold: () => '',
}

/**
 * Per-deployment / per-founder configuration. Values come from
 * the script's CLI args + env at runtime, never hardcoded into
 * the template (so a different person/company can run the same
 * generator).
 */
export interface RenderConfig {
  /** Founder's first name as it appears in the sign-off. */
  founderName: string
  /** Founder's role for the CAN-SPAM footer (e.g. "Founder"). */
  founderRole: string
  /** Legal entity name for the CAN-SPAM footer. */
  companyName: string
  /** Physical postal address. REQUIRED for CAN-SPAM. */
  physicalAddress: string
  /** Launch blog post URL (full https:// URL). */
  blogUrl: string
  /**
   * Gallery URL for the primary "click and tell me what's broken"
   * CTA (spec literal). Defaults to /templates if unset; full
   * https:// URL.
   */
  galleryUrl: string
  /**
   * Optional unsubscribe link (full https:// URL). For PERSONAL
   * email batches the spec says reply-STOP is best practice and
   * a link is not required — leave empty for that mode. Set to
   * a real URL only if running this generator against a transactional
   * tool that needs CAN-SPAM compliance via List-Unsubscribe.
   * Rendered with a leading space + "Or unsubscribe at <url>"
   * sentence when non-empty.
   */
  unsubscribeUrl: string
}

/**
 * Validate the RenderConfig has every CAN-SPAM-required field
 * set to a non-empty value. The script calls this BEFORE
 * generating any email; missing config aborts the run loudly
 * rather than producing 100 broken drafts.
 *
 * `unsubscribeUrl` is intentionally NOT required — for personal
 * email batches the spec says reply-STOP is best practice and a
 * link is optional. When set, however, it must be https://.
 */
export function assertCanSpamConfig(config: RenderConfig): void {
  const required: Array<keyof RenderConfig> = [
    'founderName',
    'founderRole',
    'companyName',
    'physicalAddress',
    'blogUrl',
    'galleryUrl',
  ]
  for (const key of required) {
    if (!config[key] || !config[key].trim()) {
      throw new Error(
        `Missing required RenderConfig.${String(key)} — outreach generator requires every CAN-SPAM field set before emitting drafts. See apps/web/src/lib/outreach/render.ts.`,
      )
    }
  }
  if (!config.blogUrl.startsWith('https://')) {
    throw new Error(
      'RenderConfig.blogUrl must start with https://. Sending plain http:// from a personal Gmail flags as suspicious in some clients.',
    )
  }
  if (!config.galleryUrl.startsWith('https://')) {
    throw new Error(
      'RenderConfig.galleryUrl must start with https://.',
    )
  }
  if (config.unsubscribeUrl && !config.unsubscribeUrl.startsWith('https://')) {
    throw new Error(
      'RenderConfig.unsubscribeUrl must start with https:// when set (or be empty for personal-email reply-STOP mode).',
    )
  }
}

/**
 * Extract a plausible first name from the recipient's display
 * name. Falls back to the GitHub login when the display name is
 * empty or the same as the login. The greeting tolerates a
 * lowercase login as a casual "hey lex,"-style salutation —
 * common enough on dev outreach that it doesn't feel off.
 */
export function firstNameOf(displayName: string, githubLogin: string): string {
  const name = (displayName || '').trim()
  if (name && name !== githubLogin) {
    // Take the first whitespace-delimited token; common cases:
    //   "Lex Whiting" -> "Lex"
    //   "李明" -> "李明" (single CJK token, no surname split)
    //   "Lex 'lex' Whiting" -> "Lex"
    const first = name.split(/\s+/)[0]
    return first
  }
  return githubLogin
}

/**
 * Read the markdown template synchronously from disk. Exported as
 * a function (rather than a top-level constant) so test runners
 * can stub it without touching the filesystem. The script is the
 * only Node consumer today; this module imports `node:fs` at
 * load time so it must not be imported from edge-runtime code.
 */
export function readLaunchLiveTemplate(): string {
  return readFileSync(
    path.join(HERE, 'templates', 'launch-live.md'),
    'utf8',
  )
}

/**
 * Render a single email draft from a target + personalization line.
 * Pure function — no I/O. The caller (the script) handles file
 * loading + writing.
 */
export function renderDraft(args: {
  target: Target
  personalizationLine: string
  template: string
  config: RenderConfig
}): DraftEmail {
  const { target, personalizationLine, template, config } = args
  assertCanSpamConfig(config)

  const tierLine = TIER_LINES[target.tier](target)
  const tierIntro = TIER_INTROS[target.tier]
  const firstName = firstNameOf(target.identity.name, target.identity.githubLogin)
  const unsubscribeBlock = config.unsubscribeUrl
    ? ` Or unsubscribe at ${config.unsubscribeUrl}.`
    : ''

  // First-pass token resolution. The intro_context value contains
  // a literal {{blog_url}} placeholder which is resolved in the
  // single-pass replace below — but only because blog_url is
  // ITERATED AFTER intro_context in this map (see the recursion
  // hostile-fix in renderTokens()).
  const tokens: Record<string, string> = {
    recipient_name: firstName,
    personalization: personalizationLine,
    intro_context: tierIntro,
    tier_specific_line: tierLine,
    gallery_url: config.galleryUrl,
    blog_url: config.blogUrl,
    founder_name: config.founderName,
    founder_role: config.founderRole,
    company_name: config.companyName,
    physical_address: config.physicalAddress,
    unsubscribe_link: unsubscribeBlock,
  }

  // Hostile-fix: build the substitution as a SINGLE regex pass
  // over all tokens at once. A naive iteration replaces tokens
  // sequentially, which lets a Claude-generated personalization
  // line containing literal `{{founder_name}}` text recursively
  // pick up the founder's name. Single-pass with one combined
  // regex disables that recursion vector.
  //
  // Exception by design: TIER_INTROS values contain a literal
  // {{blog_url}} placeholder so the per-tier copy stays
  // declarative. We resolve that placeholder INSIDE the tier-
  // intro string before adding it to the tokens map, so the
  // single-pass substitution doesn't need to handle nested tokens.
  tokens.intro_context = renderTokens(tierIntro, {
    blog_url: config.blogUrl,
  })

  const body = renderTokens(template, tokens)

  // Pull subject off the first line, then strip the "Subject: "
  // prefix and the line itself from the body. Lets us keep
  // subject + body in one template file without separate parsing.
  const lines = body.split('\n')
  const subjectLine = lines[0] ?? ''
  const subjectMatch = subjectLine.match(/^Subject:\s*(.*)$/)
  if (!subjectMatch) {
    throw new Error(
      'launch-live.md template must begin with a "Subject: ..." line. Renderer found: ' +
        JSON.stringify(subjectLine.slice(0, 80)),
    )
  }
  const subject = subjectMatch[1].trim()
  // Drop the subject line + the blank line that follows it.
  const bodyText = lines
    .slice(lines[1]?.trim() === '' ? 2 : 1)
    .join('\n')
    .trim()

  // Hostile-review fix at scaffold time: assert subject doesn't
  // start with "Re:" (DoD literal — deceptive subject lines
  // violate CAN-SPAM and HN/X commenters call it out).
  if (/^re:/i.test(subject)) {
    throw new Error(
      `Subject line starts with "Re:" — that's deceptive (CAN-SPAM § 5(a)(2) + DoD spec literal). Got: ${JSON.stringify(subject)}`,
    )
  }

  return {
    subject,
    body: bodyText,
    identity: target.identity,
    tier: target.tier,
    personalizationLine,
  }
}

/**
 * Render the review-markdown block for a single draft. The script
 * concatenates these with a `---` divider to produce
 * docs/launch/outreach-batch-2.md.
 *
 * Format (deterministic for diff-friendly re-runs):
 *
 *   ## Email NN — TIER — display_name (@github_login)
 *   - Recipient: <email or "(missing)">
 *   - Subject: <subject>
 *   - Sent: [ ]
 *
 *   <body>
 *
 *   ---
 */
export function renderReviewBlock(
  index: number,
  draft: DraftEmail,
): string {
  const { identity, subject, body, tier } = draft
  const idx = String(index).padStart(3, '0')
  const tierLabel = tier.toUpperCase()
  const recipient = identity.email ?? '(email missing — resolve before sending)'
  return [
    `## Email ${idx} — ${tierLabel} — ${identity.name} (@${identity.githubLogin})`,
    '',
    `- Recipient: ${recipient}`,
    `- Subject: ${subject}`,
    `- Sent: [ ]`,
    '',
    body,
    '',
    '---',
    '',
    '',
  ].join('\n')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Single-pass token substitution. Builds one combined alternation
 * regex from the token names and replaces each match in a single
 * `String.prototype.replace`. Tokens not in the map are left
 * intact (defensive: a typo in the template surfaces as visible
 * `{{foo}}` rather than silently breaking).
 *
 * The hostile-review property: token VALUES are inserted
 * verbatim, never re-scanned. Even if a value contains literal
 * `{{founder_name}}` text, that text remains in the output —
 * the regex was constructed BEFORE the substitution started.
 */
function renderTokens(
  template: string,
  tokens: Record<string, string>,
): string {
  const keys = Object.keys(tokens)
  if (keys.length === 0) return template
  const pattern = new RegExp(
    keys.map((k) => `\\{\\{${escapeRegExp(k)}\\}\\}`).join('|'),
    'g',
  )
  return template.replace(pattern, (match) => {
    // Match looks like `{{key}}` — strip braces.
    const key = match.slice(2, -2)
    return tokens[key] ?? match
  })
}
