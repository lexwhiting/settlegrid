import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

// G4-4: guard so the money-schema drift check fires at most ONCE per warm instance
// (per-process, not per-deploy — it re-fires on each cold start; fine, Sentry groups
// by logKey). register() is normally called once per process, but a HMR/dev re-invoke
// could call it again — this makes that idempotent.
let moneySchemaCheckStarted = false

/**
 * G4-4 — money-column drift tripwire (DC-14). Runs against the LIVE prod DB the app
 * connects to; web-ci is secret-free and can't reach prod (F10), so instrumentation
 * is the only prod-reachable automated hook.
 *
 * Constraints honored (§6 FOLD 3/4/5):
 *  - DYNAMIC import of @/lib/db + the checker INSIDE the nodejs guard — a top-level
 *    postgres import pulls node net/tls into the EDGE bundle → `next build` fails.
 *  - Fire-and-forget + NON-blocking: register() does not await the query; this
 *    function's own try/catch is the terminal handler, so `void`-ing it can never
 *    leak an unhandled rejection (→ boot self-DoS, the exact LBD-3 inversion).
 *  - DRIFT → logger.error('schema.money_column_drift') (in MONEY_LOSS_KEYS → PAGES).
 *    CHECK-COULDN'T-RUN (a rejecting query — transient cold-start DB blip) → a
 *    SEPARATE non-money-loss warn key, so it can't false-page the money-loss class.
 *  - NEVER throws (a schema-check failure must not take the app down).
 */
async function runMoneySchemaCheck(): Promise<void> {
  try {
    const { db } = await import('@/lib/db')
    const { verifyMoneySchema } = await import('@/lib/db/money-schema-check')
    const drifts = await verifyMoneySchema(db)
    if (drifts.length > 0) {
      logger.error('schema.money_column_drift', { drifts })
    }
  } catch (err) {
    logger.warn('schema.check_unavailable', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      })
    }

    // G4-4: prod-only (matches isProduction()), fire-and-forget, once per warm instance.
    if (!moneySchemaCheckStarted && process.env.NODE_ENV === 'production') {
      moneySchemaCheckStarted = true
      void runMoneySchemaCheck()
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      })
    }
  }
}

// Capture errors from nested React Server Components
export const onRequestError = Sentry.captureRequestError
