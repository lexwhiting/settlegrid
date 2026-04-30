/**
 * P4.8 — Interview-request email template.
 *
 * **NOT integrated with the auto-send pipeline.** The Phase-4 interview
 * pipeline is intentionally manual (see docs/interviews/scheduling-script.md):
 * the founder copies the rendered output into Gmail, edits one
 * personalization line, and sends from a personal address. Going through
 * Resend would land us in the Promotions tab and lose the signal we're
 * after — whether someone responds to a personal stranger-founder email.
 *
 * This module exists to:
 *   1. Standardize the wording so the founder isn't rewriting the body
 *      from memory under launch-week pressure.
 *   2. Give us a single place to A/B subject lines if response rate
 *      stalls.
 *   3. Be testable — pure render, no I/O.
 *
 * @packageDocumentation
 */

/** Inputs for {@link interviewRequestEmail}. All required. */
export interface InterviewRequestInput {
  /**
   * Display name we address in the greeting. The function takes the
   * first whitespace-delimited token to build "Hey <first>" — pass
   * the full display name and let the function handle the split.
   * Falls back to login if name is empty or matches login.
   */
  recipientName: string
  /**
   * GitHub login. Used in the subject line ("Quick question about
   * <login>") to make the email feel personal at preview time.
   */
  recipientLogin: string
  /** First name of the founder (e.g. "Lex"). Appears in the sign-off. */
  founderName: string
  /**
   * Founder's contact phone in E.164 form (e.g. "+1-555-0100").
   * Spec literal: sign-off has founder name + phone. Why include
   * phone: shows we're real and answer-able; raises response rate
   * for B2B-ish recipients.
   */
  founderPhone: string
  /**
   * Calendly URL — the ONE link in the email. Must be https.
   * Multiple links lower response rate (decision fatigue).
   */
  calendlyUrl: string
}

/** Output: subject line + plain-text body, ready to paste into Gmail. */
export interface InterviewRequestEmail {
  subject: string
  body: string
}

/**
 * Maximum subject-line length. Gmail truncates at ~70 chars on mobile
 * and ~78 on desktop preview. We aim under both. Test asserts this.
 */
export const SUBJECT_MAX_LEN = 70

/**
 * Render the interview-request email. Pure function — no I/O, no
 * env reads, no clock — so the founder gets deterministic output
 * for the same input and tests don't need date stubbing.
 *
 * Validates inputs at the boundary and throws on invalid Calendly
 * URL or empty required fields. The route that ultimately surfaces
 * this template (or a Bash-pasted variant) won't ship a half-broken
 * email.
 */
export function interviewRequestEmail(
  input: InterviewRequestInput,
): InterviewRequestEmail {
  assertNonEmpty(input.recipientName, 'recipientName')
  assertNonEmpty(input.recipientLogin, 'recipientLogin')
  assertNonEmpty(input.founderName, 'founderName')
  assertNonEmpty(input.founderPhone, 'founderPhone')
  assertHttpsUrl(input.calendlyUrl, 'calendlyUrl')

  const firstName = firstNameOf(input.recipientName, input.recipientLogin)
  const subject = `Quick question about ${input.recipientLogin}`

  if (subject.length > SUBJECT_MAX_LEN) {
    // Hostile-up-front: a freakishly-long login could blow the cap.
    // We don't truncate silently — the caller fixes their input. The
    // alternative is that 12 founders send subjects that look fine to
    // the renderer and ugly in Gmail.
    throw new Error(
      `Subject exceeds ${SUBJECT_MAX_LEN} chars (${subject.length}). ` +
        `Pass a shorter recipientLogin or override the subject manually.`,
    )
  }

  // Plain text. No HTML — copies cleanly into Gmail's compose pane.
  // No greeting "Dear" / "Hi there" — too cold for a personal note.
  const body =
    `Hey ${firstName},

Thanks for signing up to SettleGrid earlier today.

I'm the founder. I'm trying to learn what people actually need from MCP monetization. Would you have 20 minutes this week? I'll share everything I'm learning with you.

${input.calendlyUrl}

— ${input.founderName}
${input.founderPhone}
`

  return { subject, body }
}

// ── Helpers (exported for tests) ────────────────────────────────────────────

/**
 * First-name extractor: takes the first whitespace-delimited token
 * of `name`, falls back to `login` when name is empty or equals
 * login (signal that the user didn't set a display name).
 *
 * Mirrors `firstNameOf` in the P4.6 outreach renderer — same
 * semantics, kept duplicated rather than imported because the two
 * modules have different lifecycles. If we centralize later, this
 * is the place to delete.
 */
export function firstNameOf(name: string, login: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed === login) return login
  const tokens = trimmed.split(/\s+/)
  return tokens[0] ?? login
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`interviewRequestEmail: ${fieldName} must be a non-empty string`)
  }
}

function assertHttpsUrl(value: string, fieldName: string): void {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`interviewRequestEmail: ${fieldName} is not a valid URL`)
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `interviewRequestEmail: ${fieldName} must be https:// (got ${parsed.protocol})`,
    )
  }
}
