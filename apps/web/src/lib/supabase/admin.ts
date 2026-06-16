// ─────────────────────────────────────────────────────────────────────────────
// SERVER-ONLY — Supabase ADMIN (service-role) client.
//
// This module wields the Supabase SERVICE-ROLE key (god-mode over auth.users).
// It must NEVER be imported into a Client Component / browser bundle. We do NOT
// use the `server-only` package: the repo has none and it breaks vitest's node
// env (see rails.ts / the convention documented across lib/). Server-only is
// enforced by CODE REVIEW + lazy fail-fast at first call:
//   1. the service-role key is read LAZILY per-call (never at module top-level),
//      so importing this module never throws and the missing-key path is
//      reachable on every call (FAIL-CLOSED, never a silent no-op);
//   2. the admin client constructor (`getAdminClient`) is module-private — it is
//      NOT exported, so no caller can obtain a general god-mode client. The ONLY
//      exported surface is `deleteSupabaseAuthUser`, narrowly scoped to one verb.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '@/lib/env'

/**
 * Construct the service-role admin client. Module-private (NOT exported) so this
 * file never hands a god-mode client to a caller. Constructed lazily per-call so
 * a missing key fails closed at call time rather than crashing unrelated imports.
 *
 * Throws (FAIL-CLOSED) with a STATIC message when the service-role key is unset —
 * the message NEVER interpolates the key value or any process.env contents.
 */
function getAdminClient(): SupabaseClient {
  const serviceRoleKey = getSupabaseServiceRoleKey()
  if (!serviceRoleKey) {
    // Static message — no secret/env value interpolation (it lands in stdout +
    // Sentry via the deletion catch). Fail-closed: the caller goes 'failed'
    // (retryable) rather than 'completed' with the auth user still alive.
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Delete a Supabase auth user (the `auth.users` row holding the email/identity).
 *
 * HARD delete (no `shouldSoftDelete` arg → defaults to false): removes the
 * `auth.users` row and cascades its identities/sessions/MFA factors within the
 * `auth` schema. A SOFT delete would RETAIN the row and re-introduce the false
 * "auth records are deleted" claim — do not pass `shouldSoftDelete: true`.
 *
 * Idempotent: a not-found user (HTTP 404) is treated as already-deleted
 * (success), so a retry of an already-completed deletion does not get stuck.
 *
 * Throws (so the caller goes 'failed'/retryable, never silently completes):
 *   - FAIL-CLOSED if the service-role key is unset (see {@link getAdminClient});
 *   - on any non-404 admin error;
 *   - on a malformed (non-UUID) id — the SDK's `validateUUID` throws before the
 *     network call (this lands in the deletion catch → 'failed').
 *
 * Never logs the key, the admin client, or the full admin response object — only
 * the `userId` is safe to surface.
 */
export async function deleteSupabaseAuthUser(userId: string): Promise<void> {
  const admin = getAdminClient()
  // No second arg → HARD delete (shouldSoftDelete defaults to false). For any
  // AuthError (incl. a 404 not-found) the SDK RETURNS { data, error } rather
  // than throwing; a non-UUID id throws from validateUUID before this resolves.
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    // Already-gone is success (idempotent retry safety) — key on the HTTP
    // status, not a message substring.
    if (error.status === 404) {
      return
    }
    throw error
  }
}
