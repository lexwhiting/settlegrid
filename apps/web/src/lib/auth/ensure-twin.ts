/**
 * Self-healing developer/consumer TWIN-ROW creation (the auth-path invariant repair).
 *
 * WHY THIS EXISTS — the dev+consumer twin rows are created in `auth/callback`'s
 * code-exchange (OAuth + PKCE email-confirmation). But `signInWithPassword` on
 * `/login` establishes a session client-side and `router.push('/dashboard')` WITHOUT
 * traversing `auth/callback` (and middleware is edge-runtime — no DB). So a
 * password login (especially under prod email auto-confirm) yields a valid session
 * with NO twin rows → every `requireDeveloper`/`requireConsumer` throws
 * "account not found" (dashboard 401/500). This module makes the twin invariant
 * hold at the AUTH-GUARD chokepoint, so ANY authenticated entry path self-heals.
 *
 * CONCURRENCY (load-bearing): the dashboard fires ~10 parallel fetches on first
 * paint. For a freshly-rowless user they ALL hit the guard at once → N concurrent
 * ensure calls racing on `developers.email` / `supabase_user_id` UNIQUE. The
 * check-then-insert in the erasure door's `resolveOrCreateDeveloperId` (single-call,
 * no fan-out) would throw a unique-violation under that race. Here we INSERT ...
 * ON CONFLICT DO NOTHING and, on a lost race, RE-SELECT — so all N callers converge
 * on the one winning row. Idempotent + race-safe.
 *
 * SECURITY — mirrors the A-1 / DC-27 hardening of `resolveOrCreateDeveloperId`:
 *   - NEVER adopt the system catalog principal (`isSystemPrincipal`) — throws.
 *   - NEVER relink a row already bound to a DIFFERENT live auth user (cross-identity
 *     takeover under an email collision) — throws `TwinConflictError`.
 *   - Relink is permitted ONLY for a row with a NULL link (a no-login lead cohort
 *     consumer, or a legit unlinked row) or one already bound to THIS user.
 */
import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, consumers } from '@/lib/db/schema'
import { isSystemPrincipal } from '@/lib/system-principal'
import { logger } from '@/lib/logger'

/** The resolved twin row's stable id + its (DB) email. */
export interface TwinIdentity {
  id: string
  email: string
}

export interface EnsureTwinOptions {
  /**
   * Whether the auth session's email is VERIFIED (from `currentEmailIsVerified`).
   * Gates the by-email adoption of a pre-existing NULL-linked row: adopting a row on
   * email EQUALITY is only safe for a proven email — `auth/callback` gets this for
   * free (it relinks only inside `exchangeCodeForSession`). An unverified session
   * (Supabase confirm-email off / an IdP returning an unverified email) must NOT
   * adopt a pre-existing row. Fresh inserts don't need it (no adoption). Defaults to
   * FALSE (fail-closed). NOTE: under Supabase email-auto-confirm this flag is only as
   * trustworthy as that config — enabling email confirmation is the root mitigation.
   */
  emailVerified?: boolean
}

/** The caller resolves to the system catalog principal — never an adoptable subject. */
export class SystemPrincipalError extends Error {
  constructor() {
    super('System principal is not an adoptable account.')
    this.name = 'SystemPrincipalError'
  }
}

/** A row with this email is already bound to a DIFFERENT live auth user (no relink). */
export class TwinConflictError extends Error {
  constructor() {
    super('Account resolution conflict: email is bound to a different identity.')
    this.name = 'TwinConflictError'
  }
}

/**
 * Ensure a `developers` twin row exists for `supabaseUserId`, creating/relinking it
 * safely and idempotently. Returns the row's id + email. Throws {@link SystemPrincipalError}
 * / {@link TwinConflictError} on the guarded cases (callers map these to 4xx, never create).
 */
export async function ensureDeveloperTwin(supabaseUserId: string, email: string | null | undefined, opts: EnsureTwinOptions = {}): Promise<TwinIdentity> {
  // (1) Fast path — already linked to this auth user.
  const [bySupabase] = await db
    .select({ id: developers.id, email: developers.email, slug: developers.slug })
    .from(developers)
    .where(eq(developers.supabaseUserId, supabaseUserId))
    .limit(1)
  if (bySupabase) {
    if (isSystemPrincipal(bySupabase)) throw new SystemPrincipalError()
    return { id: bySupabase.id, email: bySupabase.email }
  }

  const normalizedEmail = email?.trim()
  if (!normalizedEmail) {
    // No auth-user email → cannot key a by-email relink/insert. A session with no
    // email is anomalous; surface it rather than fabricate an empty-email row (which
    // would collide on the email UNIQUE across such sessions).
    throw new TwinConflictError()
  }
  // Never mint a row bearing the reserved system-principal email (would squat the
  // slug-less system identity + block the ops email migration). Guards the INSERT
  // path, symmetric with the relink/return guards below.
  if (isSystemPrincipal({ email: normalizedEmail })) throw new SystemPrincipalError()

  // (2) By-email relink ladder (mirrors auth/callback + resolveOrCreateDeveloperId).
  const [byEmail] = await db
    .select({ id: developers.id, email: developers.email, slug: developers.slug, supabaseUserId: developers.supabaseUserId })
    .from(developers)
    .where(eq(developers.email, normalizedEmail))
    .limit(1)
  if (byEmail) {
    if (isSystemPrincipal(byEmail)) throw new SystemPrincipalError()
    // Already ours (a concurrent self-heal bound it between our two selects) → return,
    // no adoption. A DIFFERENT non-null link is a cross-identity collision → refuse.
    if (byEmail.supabaseUserId === supabaseUserId) return { id: byEmail.id, email: byEmail.email }
    if (byEmail.supabaseUserId) throw new TwinConflictError()
    // NULL-linked → a genuine ADOPTION on email equality — permitted only for a
    // PROVEN email (see EnsureTwinOptions), mirroring auth/callback's property.
    if (!opts.emailVerified) throw new TwinConflictError()
    // Relink ONLY while still NULL-linked. Capture the rowcount: if a concurrent
    // request bound it first, our UPDATE matches 0 rows — we must NOT trust the
    // pre-UPDATE snapshot and return byEmail.id (that would hand this caller another
    // identity's twin — the relink-TOCTOU). Re-read + re-validate ownership instead.
    const relinked = await db
      .update(developers)
      .set({ supabaseUserId, updatedAt: new Date() })
      .where(and(eq(developers.id, byEmail.id), isNull(developers.supabaseUserId)))
      .returning({ id: developers.id, email: developers.email })
    if (relinked.length > 0) return { id: relinked[0].id, email: relinked[0].email }
    const [current] = await db
      .select({ id: developers.id, email: developers.email, slug: developers.slug, supabaseUserId: developers.supabaseUserId })
      .from(developers)
      .where(eq(developers.id, byEmail.id))
      .limit(1)
    if (current && !isSystemPrincipal(current) && current.supabaseUserId === supabaseUserId) {
      return { id: current.id, email: current.email }
    }
    throw new TwinConflictError()
  }

  // (3) Insert — race-safe. A concurrent winner → ON CONFLICT DO NOTHING → re-select.
  const [inserted] = await db
    .insert(developers)
    .values({ email: normalizedEmail, supabaseUserId, updatedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: developers.id, email: developers.email })
  if (inserted) {
    // A twin created OUTSIDE auth/callback → a login bypassed the callback (e.g.
    // password sign-in). Signals how often the callback-coupling gap is hit in prod.
    logger.info('auth.developer_twin_self_healed', { developerId: inserted.id, supabaseUserId })
    return { id: inserted.id, email: inserted.email }
  }

  // Lost the race — the winner's row now exists under our supabaseUserId or email.
  const [settled] = await db
    .select({ id: developers.id, email: developers.email, slug: developers.slug, supabaseUserId: developers.supabaseUserId })
    .from(developers)
    .where(or(eq(developers.supabaseUserId, supabaseUserId), eq(developers.email, normalizedEmail)))
    .limit(1)
  if (settled) {
    if (isSystemPrincipal(settled)) throw new SystemPrincipalError()
    if (settled.supabaseUserId && settled.supabaseUserId !== supabaseUserId) throw new TwinConflictError()
    return { id: settled.id, email: settled.email }
  }
  // Should be unreachable (we either inserted or lost to a row that now exists).
  throw new Error('ensureDeveloperTwin: failed to resolve or create developer twin')
}

/**
 * Ensure a `consumers` twin row exists for `supabaseUserId`. Same race-safe +
 * hardened relink ladder as {@link ensureDeveloperTwin}. Relink-by-email is
 * load-bearing here: the no-login lead cohort (`ask/capture` $25 credit +
 * `newsletter/subscribe`) creates NULL-linked consumer rows; when such a lead later
 * authenticates with the same email we RELINK their existing row (preserving their
 * balance/history) rather than collide on the email UNIQUE.
 */
export async function ensureConsumerTwin(supabaseUserId: string, email: string | null | undefined, opts: EnsureTwinOptions = {}): Promise<TwinIdentity> {
  const [bySupabase] = await db
    .select({ id: consumers.id, email: consumers.email })
    .from(consumers)
    .where(eq(consumers.supabaseUserId, supabaseUserId))
    .limit(1)
  if (bySupabase) {
    // Exact parity with ensureDeveloperTwin's fast path (unreachable today — L185
    // below blocks minting/adopting a system-emailed consumer, and consumers have no
    // slug — but keep the symmetry so no future reader wonders why it's absent).
    if (isSystemPrincipal(bySupabase)) throw new SystemPrincipalError()
    return { id: bySupabase.id, email: bySupabase.email }
  }

  const normalizedEmail = email?.trim()
  if (!normalizedEmail) throw new TwinConflictError()
  // Symmetric with ensureDeveloperTwin: never mint/adopt a consumer bearing the
  // reserved system-principal email (consumers have no slug, so this is the only
  // system-identity vector on this table) — defense-in-depth for any future
  // consumer-keyed logic that might trust a system-emailed row.
  if (isSystemPrincipal({ email: normalizedEmail })) throw new SystemPrincipalError()

  const [byEmail] = await db
    .select({ id: consumers.id, email: consumers.email, supabaseUserId: consumers.supabaseUserId })
    .from(consumers)
    .where(eq(consumers.email, normalizedEmail))
    .limit(1)
  if (byEmail) {
    if (byEmail.supabaseUserId === supabaseUserId) return { id: byEmail.id, email: byEmail.email }
    if (byEmail.supabaseUserId) throw new TwinConflictError()
    // Adopting a NULL-linked lead-cohort row on email equality — proven email only.
    if (!opts.emailVerified) throw new TwinConflictError()
    // TOCTOU-safe relink (see ensureDeveloperTwin): gate the return on the UPDATE
    // rowcount; a lost race → re-read + re-validate ownership, never trust the snapshot.
    const relinked = await db
      .update(consumers)
      .set({ supabaseUserId })
      .where(and(eq(consumers.id, byEmail.id), isNull(consumers.supabaseUserId)))
      .returning({ id: consumers.id, email: consumers.email })
    if (relinked.length > 0) return { id: relinked[0].id, email: relinked[0].email }
    const [current] = await db
      .select({ id: consumers.id, email: consumers.email, supabaseUserId: consumers.supabaseUserId })
      .from(consumers)
      .where(eq(consumers.id, byEmail.id))
      .limit(1)
    if (current && current.supabaseUserId === supabaseUserId) return { id: current.id, email: current.email }
    throw new TwinConflictError()
  }

  const [inserted] = await db
    .insert(consumers)
    .values({ email: normalizedEmail, supabaseUserId })
    .onConflictDoNothing()
    .returning({ id: consumers.id, email: consumers.email })
  if (inserted) {
    logger.info('auth.consumer_twin_self_healed', { consumerId: inserted.id, supabaseUserId })
    return { id: inserted.id, email: inserted.email }
  }

  const [settled] = await db
    .select({ id: consumers.id, email: consumers.email, supabaseUserId: consumers.supabaseUserId })
    .from(consumers)
    .where(or(eq(consumers.supabaseUserId, supabaseUserId), eq(consumers.email, normalizedEmail)))
    .limit(1)
  if (settled) {
    if (settled.supabaseUserId && settled.supabaseUserId !== supabaseUserId) throw new TwinConflictError()
    return { id: settled.id, email: settled.email }
  }
  throw new Error('ensureConsumerTwin: failed to resolve or create consumer twin')
}
