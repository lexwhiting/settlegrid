/**
 * Structured logger for SettleGrid.
 *
 * Outputs JSON lines to stdout/stderr so they can be ingested by
 * Vercel / Datadog / any structured-logging collector.
 *
 * Error-level logs are also mirrored into Sentry as captured events
 * so alert rules can fire on structured log keys (e.g.
 * `payout.rollback_failed`). The mirror is gated on `SENTRY_DSN` —
 * without it, Sentry SDK calls are no-ops and the local/test paths
 * are unaffected.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('checkout.completed', { purchaseId, amountCents })
 *   logger.error('webhook.dispatch_failed', { developerId, event }, err)
 */

import * as Sentry from '@sentry/nextjs'

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  msg: string
  ts: string
  [key: string]: unknown
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>, err?: unknown): void {
  const entry: LogEntry = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...meta,
  }

  if (err instanceof Error) {
    entry.error = err.message
    entry.stack = err.stack
  } else if (err !== undefined) {
    entry.error = String(err)
  }

  const line = JSON.stringify(entry)

  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }

  // Mirror error-level logs into Sentry so Sentry alert rules can fire
  // on structured log keys. The DSN gate matches instrumentation.ts —
  // tests + local dev without SENTRY_DSN see this path as a no-op.
  // The Sentry `logKey` tag lets alert rules filter by the structured
  // msg (e.g. `payout.rollback_failed`); meta becomes "extra" on the
  // resulting issue.
  if (level === 'error' && process.env.SENTRY_DSN) {
    try {
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: { logKey: msg },
          extra: meta,
        })
      } else {
        Sentry.captureMessage(msg, {
          level: 'error',
          tags: { logKey: msg },
          extra: meta,
        })
      }
    } catch {
      // Never let Sentry capture failure escape the logger — the JSON
      // line is already on stderr, so the operator still has a signal.
    }
  }
}

export const logger = {
  info(msg: string, meta?: Record<string, unknown>): void {
    emit('info', msg, meta)
  },
  warn(msg: string, meta?: Record<string, unknown>): void {
    emit('warn', msg, meta)
  },
  error(msg: string, meta?: Record<string, unknown>, err?: unknown): void {
    emit('error', msg, meta, err)
  },
}
