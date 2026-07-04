/**
 * Canonical email suppression gate (G6-1/2/3 — email-compliance).
 *
 * ONE shared module that every bulk sender (read) and every opt-out /
 * bounce / complaint writer imports, so opt-outs actually stick end-to-end.
 * The G6-2 defect was precisely a write/read KEY MISMATCH — so normalization
 * lives HERE, structurally, not by caller discipline:
 *   - `normalizeEmail` is the single identity every writer AND reader keys off.
 *   - `isSuppressed` normalizes its OWN argument (callers pass raw emails).
 *   - `suppress` stores the normalized email.
 *
 * Backed by the `email_suppressions` Postgres table (see schema.ts). During
 * the manual-migration deploy window the table may not yet exist — bulk
 * `isSuppressed` fails CLOSED (returns true → skip the send), so a
 * pre-migration deploy pauses bulk sends rather than leaking to opted-out
 * addresses. Transactional/security senders NEVER call this (CAN-SPAM exempt).
 */
import { and, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { emailSuppressions } from '@/lib/db/schema'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * Streams a PUBLIC unsubscribe endpoint (`/api/unsubscribe`,
 * `/api/newsletter/unsubscribe`) is allowed to write. `'all'` is deliberately
 * NOT here — it is written ONLY by the Resend bounce/complaint webhook (a hard
 * bounce = dead mailbox; a complaint = legal/reputational signal), never by a
 * user link. A typed const so a sender/endpoint can't gate on a stream no
 * writer writes (the LITERAL-EXECUTION guard).
 *
 * NOTE: `weekly-report` is SHARED by the enhanced dev report and the
 * Tool-of-the-Week congrats — one opt-out silences both (intended).
 * `'marketing'` is intentionally absent (orphan literal — no writer/reader).
 */
export const SUPPRESSIBLE_STREAMS = [
  'newsletter',
  'consumer-digest',
  'outreach',
  'weekly-report',
  'abandoned-checkout',
] as const

export type SuppressibleStream = (typeof SUPPRESSIBLE_STREAMS)[number]

/** Every stream that can appear in a row (includes the webhook-only `'all'`). */
export type SuppressionStream = SuppressibleStream | 'all'

export type SuppressionReason = 'unsubscribe' | 'bounce' | 'complaint' | 'manual'
export type SuppressionSource = 'link' | 'list-unsub-post' | 'resend-webhook' | 'admin'

/**
 * THE normalization identity. Byte-matches the legacy Redis writers
 * (`unsub:outreach:{trim().toLowerCase()}`) so the legacy union below can't
 * silently drop the ~500 historical opt-outs. Every writer and reader in the
 * system MUST route the email through this exact function.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Runtime membership test for the public suppressible streams. */
export function isSuppressibleStream(stream: string): stream is SuppressibleStream {
  return (SUPPRESSIBLE_STREAMS as readonly string[]).includes(stream)
}

const SITE_ORIGIN = 'https://settlegrid.ai'

/**
 * RFC-8058 List-Unsubscribe + one-click headers for a bulk send. The
 * List-Unsubscribe URL is the machine one-click POST target — the mailbox
 * provider POSTs `List-Unsubscribe=One-Click` to it (address in the query).
 * Newsletter keeps its own route; every other stream routes through the
 * stream-aware /api/unsubscribe.
 */
export function listUnsubscribeHeaders(
  email: string,
  stream: SuppressibleStream,
): Record<string, string> {
  const e = encodeURIComponent(normalizeEmail(email))
  const target =
    stream === 'newsletter'
      ? `${SITE_ORIGIN}/api/newsletter/unsubscribe?email=${e}`
      : `${SITE_ORIGIN}/api/unsubscribe?email=${e}&stream=${stream}`
  return {
    'List-Unsubscribe': `<${target}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

/**
 * The VISIBLE in-body unsubscribe URL (CAN-SPAM requires a visible link, not
 * just the header). Points at the friendly browser confirmation page, which
 * forwards `type` to the stream-aware /api/unsubscribe on click.
 */
export function unsubscribeLinkUrl(email: string, stream: SuppressibleStream): string {
  return `${SITE_ORIGIN}/unsubscribe?email=${encodeURIComponent(normalizeEmail(email))}&type=${stream}`
}

// Legacy Redis outreach keys the crons wrote before this table existed.
// isSuppressed unions BOTH for the 'outreach' stream so no historical opt-out
// (unsub, permanent) or recent send-failure (bounce, 30d TTL) is dropped on
// cutover (DECISION-4 / FOLD #5). The key strings byte-match the writers.
const LEGACY_UNSUB_OUTREACH_PREFIX = 'unsub:outreach:'
const LEGACY_BOUNCE_OUTREACH_PREFIX = 'bounce:outreach:'

/**
 * True if `email` is suppressed for `stream`. Matches a row for `(email,'all')`
 * OR `(email, stream)`, plus the legacy Redis outreach keys for the outreach
 * stream. Normalizes its own argument.
 *
 * FAIL-CLOSED for bulk: on any DB/Redis error (incl. a missing table during
 * the deploy window) returns TRUE — a paused send is safe; emailing an
 * opted-out / complained / hard-bounced address is not.
 */
export async function isSuppressed(email: string, stream: SuppressionStream): Promise<boolean> {
  try {
    const normalized = normalizeEmail(email)
    // 'marketing' was an orphan literal; collapse any stray caller to 'outreach'
    // so the legacy-Redis union still applies (FOLD #6).
    const effectiveStream: SuppressionStream =
      (stream as string) === 'marketing' ? 'outreach' : stream

    // Match on lower(email) — the SAME expression the unique index is built on —
    // so the read (a) HONORS the DB canonicalization backstop (a row stored
    // un-normalized via an admin/manual insert is still found; write-side
    // normalization is not the only line of defense) and (b) can USE the
    // (lower(email), stream) index instead of a full sequential scan.
    const rows = await db
      .select({ stream: emailSuppressions.stream })
      .from(emailSuppressions)
      .where(
        and(
          sql`lower(${emailSuppressions.email}) = ${normalized}`,
          inArray(emailSuppressions.stream, ['all', effectiveStream]),
        ),
      )
      .limit(1)
    if (rows.length > 0) return true

    // Transition safety: honor the legacy Redis outreach opt-outs/bounces.
    if (effectiveStream === 'outreach') {
      const redis = getRedis()
      const [unsub, bounce] = await Promise.all([
        redis.get<string>(`${LEGACY_UNSUB_OUTREACH_PREFIX}${normalized}`),
        redis.get<string>(`${LEGACY_BOUNCE_OUTREACH_PREFIX}${normalized}`),
      ])
      if (unsub || bounce) return true
    }

    return false
  } catch (err) {
    // Fail CLOSED on ANY error inside the gate — a bad argument (e.g. a null
    // email making normalizeEmail throw) OR a DB/Redis failure both return true
    // (skip the send). normalizeEmail runs inside this try precisely so a bad
    // argument can't escape the fail-closed contract.
    logger.error('email_suppression.check_failed', { stream }, err)
    return true
  }
}

/**
 * Idempotent upsert — `ON CONFLICT DO NOTHING` against the unique
 * `(lower(email), stream)` index. Stores the normalized email.
 *
 * MAY THROW on a DB error / missing table. The Resend webhook lets that
 * surface (a non-2xx → Resend redelivers → this is idempotent). The
 * user-facing unsubscribe click paths MUST instead use `suppressBestEffort`
 * AFTER recording their durable fallback (FOLD #4) so a click never 500s or
 * loses the opt-out.
 */
export async function suppress(
  email: string,
  stream: SuppressionStream,
  reason: SuppressionReason,
  source?: SuppressionSource,
): Promise<void> {
  const normalized = normalizeEmail(email)
  await db
    .insert(emailSuppressions)
    .values({ email: normalized, stream, reason, source: source ?? null })
    .onConflictDoNothing()
}

/**
 * Best-effort variant for user-facing WRITE paths (unsubscribe click /
 * RFC-8058 one-click POST). The caller records the DURABLE FALLBACK FIRST
 * (flip `newsletterSubscribed=false` / write the legacy Redis key); this then
 * mirrors the opt-out into the canonical table but NEVER throws — so a missing
 * table (deploy window) or transient DB error cannot 500 the click or drop the
 * opt-out that the fallback already recorded (FOLD #4).
 */
export async function suppressBestEffort(
  email: string,
  stream: SuppressionStream,
  reason: SuppressionReason,
  source?: SuppressionSource,
): Promise<void> {
  try {
    await suppress(email, stream, reason, source)
  } catch (err) {
    logger.error('email_suppression.suppress_best_effort_failed', { stream }, err)
  }
}
