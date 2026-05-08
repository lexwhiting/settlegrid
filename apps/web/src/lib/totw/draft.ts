/**
 * P5.4 — Draft helpers: slug sanitization, file naming, word counting,
 * the prompt template fed to Claude, and the validator that gates the
 * generated draft before the workflow opens a PR.
 *
 * Pure functions only. The script wires these to the Anthropic SDK and
 * fs writes; everything here can be unit-tested without IO.
 */

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

/**
 * Spec target band. The validator allows ±10% slop so we don't
 * fight the model over a 12-word miss; outside that band, we ask the
 * caller to reject and let next week's run replace it.
 */
export const TARGET_WORDS_MIN = 270
export const TARGET_WORDS_MAX = 550

/**
 * Throws when a slug from the registry doesn't match the kebab-case
 * shape we use to build file paths. Defensive — the registry's
 * builder validates this already, but if a future schema relaxes the
 * rule we'd rather fail loud than write `apps/web/.../totw/2026-05-12-/.md`.
 */
export function assertSafeSlug(slug: string): void {
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(
      `Unsafe template slug ${JSON.stringify(slug)} — must match ${SLUG_REGEX} (lowercase kebab-case)`,
    )
  }
}

/**
 * Format a Date as YYYY-MM-DD in UTC. The cron fires at 09:00 UTC
 * Monday; using local time would give Sunday on the US west coast.
 */
export function formatDateUtc(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0')
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const dd = d.getUTCDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Path components for the draft. Returns the relative file path
 * inside the repo, the storage-side body filename, and the blog
 * registry slug (used as `BlogPost.slug`).
 */
export interface DraftPaths {
  /** `apps/web/src/lib/blog-bodies/totw/2026-05-12-stripe.md` */
  bodyPath: string
  /** `2026-05-12-stripe.md` */
  bodyFilename: string
  /** `totw-2026-05-12-stripe` — the public blog post slug. */
  postSlug: string
  /** `TOTW_2026_05_12_STRIPE_BODY` — TS import binding. */
  importBinding: string
}

export function makeDraftPaths(
  templateSlug: string,
  date: string,
): DraftPaths {
  assertSafeSlug(templateSlug)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Date must be YYYY-MM-DD, got ${JSON.stringify(date)}`)
  }
  const bodyFilename = `${date}-${templateSlug}.md`
  const bodyPath = `apps/web/src/lib/blog-bodies/totw/${bodyFilename}`
  const postSlug = `totw-${date}-${templateSlug}`
  const importBinding = `TOTW_${date.replaceAll('-', '_')}_${templateSlug.replaceAll('-', '_').toUpperCase()}_BODY`
  return { bodyPath, bodyFilename, postSlug, importBinding }
}

/**
 * Word-count the body in the same way blog-posts.ts does:
 * strip fenced code, inline code, headings, link syntax, and emphasis
 * markers, then count whitespace-separated tokens.
 *
 * Mirrors `wordCountFromMarkdown` so the two stay aligned (the public
 * blog-post renderer uses the same number for JSON-LD `wordCount`).
 */
export function countWords(body: string): number {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
  return cleaned.split(/\s+/).filter(Boolean).length
}

export interface DraftValidation {
  ok: boolean
  reason?: string
  wordCount: number
}

/**
 * Validate a generated draft. Reasons to reject:
 *  - empty / whitespace-only output
 *  - word count outside [TARGET_WORDS_MIN, TARGET_WORDS_MAX]
 *  - missing a fenced code block (the spec wants a code snippet)
 *  - first non-blank line isn't a level-1 heading (`# `) or a hook
 *    paragraph (we accept both — some founders open cold, some lead
 *    with a title; rejecting either would over-constrain the model)
 *
 * The validator does NOT enforce voice rules (first-person, no
 * adjectives) — those are the founder's rewrite checklist in the
 * playbook. Programmatic voice-checking would produce false positives
 * on every metaphor and quote.
 */
export function validateDraft(body: string): DraftValidation {
  const trimmed = body.trim()
  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty draft', wordCount: 0 }
  }
  const wc = countWords(trimmed)
  if (wc < TARGET_WORDS_MIN) {
    return {
      ok: false,
      reason: `word count ${wc} below floor ${TARGET_WORDS_MIN}`,
      wordCount: wc,
    }
  }
  if (wc > TARGET_WORDS_MAX) {
    return {
      ok: false,
      reason: `word count ${wc} above ceiling ${TARGET_WORDS_MAX}`,
      wordCount: wc,
    }
  }
  if (!/```/.test(trimmed)) {
    return {
      ok: false,
      reason: 'no fenced code block (spec requires a code snippet)',
      wordCount: wc,
    }
  }
  return { ok: true, wordCount: wc }
}

/**
 * Inputs the prompt builder needs from the caller. Keeping this
 * shape small + named makes the prompt easy to snapshot-test and
 * easy to tweak without touching the script logic.
 */
export interface DraftPromptInputs {
  templateName: string
  templateSlug: string
  templateDescription: string
  templateCategory: string
  scaffoldCount: number
  viewCount: number
  daysSinceAdded: number | null
  exampleEntryFile?: string
}

/**
 * The system + user prompt sent to Claude. Voice rules live here
 * because the prompt is the only place they're enforced before
 * founder review.
 *
 * NB: the founder ALWAYS rewrites before publishing. The model is
 * generating a starting point, not finished copy. Voice rules in this
 * prompt are about reducing the rewrite burden, not eliminating it.
 */
export function buildDraftPrompt(input: DraftPromptInputs): {
  system: string
  user: string
} {
  const system = [
    `You are drafting a "Template of the Week" blog post for SettleGrid's own blog.`,
    `The post is a starting point that the founder rewrites before publishing — your job is to give them a strong skeleton in their voice, not to ship final copy.`,
    ``,
    `VOICE RULES (non-negotiable):`,
    `- First person ("I", "we") — never "you should" or "let's".`,
    `- Concrete and specific. If you reach for an adjective, replace it with a fact.`,
    `- No marketing speak: "powerful", "seamless", "robust", "simple", "easy", "cutting-edge", "next-generation", "comprehensive", "leverage", "unlock", "elevate".`,
    `- No em-dashes. Use commas or sentence breaks.`,
    `- Show the actual code; don't hand-wave with "you can call the API".`,
    ``,
    `STRUCTURE (300-500 words total):`,
    `1. Hook (40-80 words): a concrete moment or observation. Not "Imagine if..." — start with something that actually happened or is true today.`,
    `2. What it does (60-100 words): one paragraph. What problem does this template solve? Who uses it?`,
    `3. Code snippet: a fenced code block (markdown \`\`\`) showing the minimal usage path. ~10-25 lines.`,
    `4. Why it's interesting (80-150 words): the angle. What makes this template worth a paragraph this week and not the dozen other ones we ship? Pricing model? Unusual integration? Specific category gap it fills?`,
    `5. CTA (20-40 words): a one-line link to the template page (https://settlegrid.ai/templates/${input.templateSlug}) and a one-line ask (try it / fork it / send feedback).`,
    ``,
    `The output must be plain markdown only. No frontmatter, no metadata block. Start with the hook paragraph. The next-step renderer will inject title and metadata.`,
  ].join('\n')

  const freshness =
    input.daysSinceAdded === null
      ? 'unknown (registry pre-dates freshness tracking)'
      : `${input.daysSinceAdded} days since first added to registry`

  const user = [
    `Template: ${input.templateName} (slug: ${input.templateSlug})`,
    `Category: ${input.templateCategory}`,
    `Description: ${input.templateDescription}`,
    ``,
    `Selection signal (last 7 days):`,
    `- scaffold_success events: ${input.scaffoldCount}`,
    `- template_detail_viewed events: ${input.viewCount}`,
    `- freshness: ${freshness}`,
    ``,
    input.exampleEntryFile
      ? `Reference for tone (existing settlegrid.ai blog post): ${input.exampleEntryFile}`
      : ``,
    `Write the post.`,
  ]
    .filter(Boolean)
    .join('\n')

  return { system, user }
}
