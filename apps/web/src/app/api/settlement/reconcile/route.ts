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
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api'
import { verifyLedgerIntegrity } from '@/lib/settlement/ledger'

export const maxDuration = 30

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
    const providedKey = request.headers.get('x-admin-key')
    if (providedKey !== adminKey) {
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
