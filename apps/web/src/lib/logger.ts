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
import { redactLogString } from '@/lib/settlement/log-redaction'

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  msg: string
  ts: string
  [key: string]: unknown
}

/**
 * V-N3-log-redaction (channel B) — the ONLY meta keys whose VALUE is human/error
 * PROSE (never a structured identifier), so the payer sanitizer rewrites them
 * keyed off the FIELD NAME. A viem/Postgres error formatted into one of these by
 * a caller (e.g. `error: err.message`) embeds the raw payer/nonce; structured
 * fields (`txHash`/`recipient`/`to`/…) are deliberately left intact — over-
 * redacting them would blind debugging (handoff §3d/§5#4). This is the narrow
 * sanctioned `emit()` change, NOT a blanket all-meta walk (that was rejected).
 */
const FREE_TEXT_ERROR_KEYS = ['error', 'reason', 'message', 'details', 'stack'] as const

/**
 * Funds-integrity / money-LOSS event keys (launch-gate G4-5). When an
 * error-level log carries one of these `msg` keys, the Sentry mirror also stamps
 * a `money_loss: 'true'` tag so ONE alert rule can page on the whole class
 * (instead of five separate `logKey` filters). These are the events where money
 * actually moved incorrectly — consumer debited but developer not credited
 * (off-chain), on-chain settled but credit lost, charged-but-undelivered (F3),
 * or a credit-reconciliation marker broke — plus one PROACTIVE integrity tripwire
 * (`schema.money_column_drift`, G4-4): "nothing moved yet," but a load-bearing
 * money column has silently drifted from schema.ts on the no-rollback push
 * substrate (DC-14) — page-worthy because it is the precondition for silent
 * future money loss. Keep this list TIGHT (each entry is a page-worthy
 * funds-integrity event, low false-positive); add a new key here when a new
 * funds-loss signal is introduced. The generic billing-record-update errors
 * (`proxy.*_billing_update_error`) and the MPP `proxy.mpp_upstream_error` are
 * deliberately EXCLUDED (noisier / not necessarily a loss) — see the ③ MPP
 * F3-alert-parity follow-up before adding them.
 */
export const MONEY_LOSS_KEYS: ReadonlySet<string> = new Set([
  'proxy.balance_race_unpaid_invocation', // off-chain: consumer debited, dev not credited
  'proxy.onchain_credit_lost_after_settle', // on-chain settled, dev credit lost
  'proxy.onchain_settled_upstream_failed', // charged on-chain, upstream undelivered (F3)
  'proxy.idempotency_gate_unavailable', // G3-3: Redis down → charge-dedup bypassed (fail-open); a client retry in the window may double-charge
  'settlement.credit_zero_row_unmarked', // credit reconciliation marker broke
  'settlement.credit_marker_unmatched', // credit reconciliation marker broke
  'stripe.webhook.dedup_delete_failed', // G3-5: a credit/transfer tx failed AND the dedup-marker delete also failed → marker persists → Stripe retry deduped → paid credit permanently skipped (consumer paid, balance never incremented)
  'stripe.connect_webhook.dedup_delete_failed', // G3-5: same funds-loss class on the Connect webhook rail
  'schema.money_column_drift', // G4-4: a load-bearing money column drifted from schema.ts on the no-rollback push substrate (DC-14) — proactive integrity tripwire (precondition for silent future money loss). NB: 'schema.check_unavailable' (the check-couldn't-run branch) is deliberately NOT here — a transient boot DB blip must not false-page this class.
])

/**
 * A sanitized COPY of an Error for `Sentry.captureException` — the error NAME is
 * preserved (Sentry's exception type / grouping key, incl. `AggregateError`),
 * with a payer-redacted message + stack. Deliberately does NOT copy the ancillary
 * own-props that can re-embed the raw from/nonce — viem's `metaMessages`/`args`/
 * `shortMessage`, the `.cause` chain, AggregateError's `.errors[]` — so the
 * default `linkedErrors` integration finds nothing unredacted to serialize.
 * Dropping them strictly improves the no-PII posture (the structured
 * `network`/etc. still rides in Sentry `extra`). Built UNCONDITIONALLY for every
 * `err instanceof Error` (F2/M3) — even a clean top-level message can hide a
 * PII-bearing cause/leg. Cloning (vs mutating the caller's `err`) preserves the
 * zero-behavioral-change contract.
 */
function sanitizedErrorClone(err: Error, message: string, stack: string | undefined): Error {
  const clone = new Error(message)
  clone.name = err.name
  clone.stack = stack
  return clone
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>, err?: unknown): void {
  // V-N3 channel B (free-text meta): redact ONLY the known free-text error keys,
  // copy-on-write so a clean meta is never reallocated. Done before the spread so
  // the stdout line + the Sentry `extra` both carry the sanitized values.
  let safeMeta = meta
  if (meta) {
    let copy: Record<string, unknown> | undefined
    for (const k of FREE_TEXT_ERROR_KEYS) {
      const v = meta[k]
      if (typeof v === 'string') {
        const red = redactLogString(v)
        if (red !== v) {
          copy ??= { ...meta }
          copy[k] = red
        }
      }
    }
    if (copy) safeMeta = copy
  }

  // Spread `safeMeta` FIRST so the reserved structured keys (`level`/`msg`/`ts`)
  // always win — a caller passing a human `{ msg: '…' }` meta (28 cron/crawler
  // sites do) must NOT clobber the positional event key that alert rules + log
  // queries key on. The `err`-derived `error`/`stack` assignment stays AFTER
  // the literal so a real Error still wins over any `meta.error`/`meta.stack`.
  const ts = new Date().toISOString()
  const entry: LogEntry = {
    ...safeMeta,
    level,
    msg,
    ts,
  }

  // V-N3 channel B (err 3rd arg): redact the message/stack the logger derives
  // from the Error BEFORE it reaches stdout AND `Sentry.captureException`. A
  // viem on-chain error carries the raw from+nonce in its call-arg message; a
  // Postgres error echoes the raw `operation_id` from a `WHERE operationId=…`.
  let safeErr = err
  if (err instanceof Error) {
    // M5: guard the free-text inputs with a `typeof` check. An Error carrying a
    // coerced non-string `.message`/`.stack` would make `redactLogString` throw
    // `s.replace is not a function` OUT of emit() — and logger.error runs inside
    // catch blocks, so a throw would alter control flow AND drop the log line
    // (the pre-redaction code only ASSIGNED err.message, never called a method).
    const message = redactLogString(
      typeof err.message === 'string' ? err.message : String(err.message),
    )
    const stack = typeof err.stack === 'string' ? redactLogString(err.stack) : err.stack
    entry.error = message
    entry.stack = stack
    // F2/M3: build the sanitized clone UNCONDITIONALLY (not only when the message
    // or stack changed). A viem error can carry the raw from/nonce ONLY in
    // ancillary own-props — `.cause`, AggregateError `.errors[]`, `.metaMessages`,
    // `.args`, `.shortMessage` — leaving `.message`/`.stack` clean; the OLD
    // conditional gate then shipped the ORIGINAL err, and `@sentry/nextjs`'s
    // default `linkedErrors` integration serialized the `.cause` chain (and the
    // AggregateError legs) UNREDACTED. The clone copies ONLY name + redacted
    // message + redacted stack, so those ancillary props NEVER reach
    // `captureException`. (DC-18 cost: Sentry loses cause chains app-wide —
    // accepted; the no-PII posture wins and the exception type/grouping key is
    // preserved via `clone.name`.)
    safeErr = sanitizedErrorClone(err, message, stack)
  } else if (err !== undefined) {
    entry.error = redactLogString(String(err))
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
      // `logKey` lets an alert rule filter by the exact structured event; a
      // money-LOSS key ALSO gets `money_loss:'true'` so one rule covers the class.
      const sentryTags: Record<string, string> = { logKey: msg }
      if (MONEY_LOSS_KEYS.has(msg)) sentryTags.money_loss = 'true'
      if (safeErr instanceof Error) {
        Sentry.captureException(safeErr, {
          tags: sentryTags,
          extra: safeMeta,
        })
      } else {
        Sentry.captureMessage(msg, {
          level: 'error',
          tags: sentryTags,
          extra: safeMeta,
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
