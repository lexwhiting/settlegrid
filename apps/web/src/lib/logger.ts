/**
 * Structured logger for SettleGrid.
 *
 * Outputs JSON lines to stdout/stderr so they can be ingested by
 * Vercel / Datadog / any structured-logging collector.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('checkout.completed', { purchaseId, amountCents })
 *   logger.error('webhook.dispatch_failed', { developerId, event }, err)
 */

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
    // eslint-disable-next-line no-console
    console.error(line)
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line)
  } else {
    // eslint-disable-next-line no-console
    console.log(line)
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
