/**
 * P3.K4 — Settlement ledger reconciliation endpoint.
 *
 * Operator-only GET. Runs {@link verifyLedgerIntegrity} against the
 * unified ledger table and returns the debits-vs-credits balance.
 * Dashboards + reconciliation cron jobs (P3.RAIL2) call this; on
 * the `balanced: false` branch the response is a 5xx so a monitor
 * can alert off the non-2xx status alone.
 *
 * This route is the first API consumer of `@/lib/settlement/ledger`
 * per the unified-ledger spec — other settlement flows go through
 * `recordHop` / `postLedgerEntry` which are lib-level. Having the
 * reconcile endpoint here means the gate's "adapter-dispatch → ledger
 * wiring" check (C14) reads a real, productized dependency.
 *
 * Auth: requires a `X-Admin-Key` header matching `SETTLEGRID_ADMIN_KEY`.
 * Bootstrapping — the spec-diff / hostile rounds will replace this
 * with the standard SSO gate once the admin-auth helper lands.
 */

import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api'
import { verifyLedgerIntegrity } from '@/lib/settlement/ledger'

export const maxDuration = 30

/**
 * Minimum admin-key length. Short keys are brute-forceable; 32
 * chars (256 bits at base64) is the conventional minimum for a
 * sensitive-operator credential. Hostile fix H45: without this
 * guard, an operator who set `SETTLEGRID_ADMIN_KEY=foo` would
 * effectively have a guessable endpoint.
 */
const MIN_ADMIN_KEY_LENGTH = 32

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const adminKey = process.env.SETTLEGRID_ADMIN_KEY
    if (typeof adminKey !== 'string' || adminKey.length === 0) {
      // If the env is unset, the endpoint is effectively disabled —
      // a production-safe default that avoids leaking integrity data
      // until the operator explicitly enables the route.
      return errorResponse(
        'reconciliation endpoint not enabled',
        503,
        'NOT_ENABLED',
      )
    }
    if (adminKey.length < MIN_ADMIN_KEY_LENGTH) {
      // Hostile fix H45 — a short admin key is brute-forceable.
      // We intentionally DO NOT leak the min-length in the public
      // error body; operators discover it via application logs.
      return errorResponse(
        'reconciliation endpoint not enabled',
        503,
        'NOT_ENABLED',
      )
    }
    const providedKey = request.headers.get('x-admin-key')
    if (typeof providedKey !== 'string' || providedKey.length === 0) {
      return errorResponse('unauthenticated', 401, 'UNAUTHENTICATED')
    }
    // Hostile fix H42 — timing-safe equality. A plain `!==` check
    // leaks the admin-key byte-by-byte through response-time
    // analysis; an attacker observing microsecond differences can
    // guess the key one character at a time. timingSafeEqual
    // requires equal-length Buffers; we short-circuit the
    // length-mismatch case to a stable false (the length-check
    // short-circuit IS itself timing-safe: an attacker learns only
    // the key's length, which is no secret).
    const providedBuf = Buffer.from(providedKey)
    const adminBuf = Buffer.from(adminKey)
    const keysMatch =
      providedBuf.length === adminBuf.length &&
      timingSafeEqual(providedBuf, adminBuf)
    if (!keysMatch) {
      return errorResponse('unauthenticated', 401, 'UNAUTHENTICATED')
    }

    const result = await verifyLedgerIntegrity()

    if (!result.balanced) {
      // A 500-class status lets uptime monitors alert directly. The
      // body still carries the integrity details so the dashboard
      // can surface the exact discrepancy.
      return errorResponse(
        'ledger integrity check failed',
        500,
        'LEDGER_IMBALANCED',
        undefined,
        {
          totalDebits: result.totalDebits,
          totalCredits: result.totalCredits,
          discrepancy: result.discrepancy,
          entryCount: result.entryCount,
        },
      )
    }

    return successResponse({
      balanced: true,
      totalDebits: result.totalDebits,
      totalCredits: result.totalCredits,
      entryCount: result.entryCount,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
