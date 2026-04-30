/**
 * P4.8 — pure helpers + types for the signup-followup admin route.
 *
 * Lives in a sibling file (NOT route.ts) because Next.js App Router's
 * Route segment type-check rejects any export from `route.ts` that
 * isn't an HTTP method handler or recognized config export. Tests
 * + the route both import from here.
 */

/**
 * Hard cap on rows returned. The launch-week list is small (<200);
 * after that the founder should triage via filters or CSV export
 * rather than scrolling.
 */
export const SIGNUP_LIMIT = 200

/**
 * The state machine values. Spec-literal: the four statuses listed
 * in P4.8 ("not sent / sent / scheduled / interviewed"). Founders
 * who decide to deprioritize a signup should leave it as `not_sent`
 * with a note explaining the skip — keeps the enum aligned with the
 * spec without losing the workflow state in practice.
 */
export const SIGNUP_FOLLOWUP_STATUSES = [
  'not_sent',
  'sent',
  'scheduled',
  'interviewed',
] as const

export type SignupFollowupStatus = (typeof SIGNUP_FOLLOWUP_STATUSES)[number]

export interface SignupFollowupRow {
  developerId: string
  email: string
  name: string | null
  signedUpAt: string
  status: SignupFollowupStatus
  /** ISO timestamp of the latest status mutation, or null if untouched. */
  statusUpdatedAt: string | null
  /** Latest note, or null. */
  note: string | null
}

export interface SignupFollowupListResponse {
  total: number
  rows: SignupFollowupRow[]
}

/**
 * Type guard for status values pulled out of the audit_logs jsonb
 * details column. Anything else (legacy row, future status the route
 * doesn't know about, malformed data) renders as `not_sent` so the
 * founder doesn't lose the signup.
 */
export function isValidStatus(s: unknown): s is SignupFollowupStatus {
  return (
    typeof s === 'string' &&
    (SIGNUP_FOLLOWUP_STATUSES as readonly string[]).includes(s)
  )
}

/**
 * Coerce a Postgres timestamp value to an ISO string. The driver may
 * return a Date, a string, or a number depending on which path
 * (Drizzle's typed select vs raw db.execute). Normalizing here keeps
 * the response shape stable.
 *
 * Defensive: an invalid Date or unparseable string would throw
 * `RangeError: Invalid time value` from `.toISOString()`. We catch
 * and return epoch-0 — a known-bad sentinel ('1970-01-01T00:00:00Z')
 * the founder can spot on screen, rather than 500-ing the whole
 * signup list because of one malformed row.
 */
export function toIso(v: unknown): string {
  try {
    if (v instanceof Date) return v.toISOString()
    if (typeof v === 'string') return new Date(v).toISOString()
    if (typeof v === 'number') return new Date(v).toISOString()
  } catch {
    return new Date(0).toISOString()
  }
  return new Date(0).toISOString()
}
