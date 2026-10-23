import { describe, it, expect } from 'vitest'
import {
  LOG_RETENTION_OPTIONS,
  WEBHOOK_LOG_RETENTION_OPTIONS,
  AUDIT_LOG_RETENTION_OPTIONS,
  DEFAULT_LOG_RETENTION_DAYS,
  DEFAULT_WEBHOOK_LOG_RETENTION_DAYS,
  DEFAULT_AUDIT_LOG_RETENTION_DAYS,
  toRetentionOption,
  effectiveRetentionDays,
  MIN_LOG_RETENTION_DAYS,
  MIN_WEBHOOK_LOG_RETENTION_DAYS,
  MIN_AUDIT_LOG_RETENTION_DAYS,
} from '../retention-options'

describe('retention options', () => {
  it('defaults match the schema column defaults (log 90, webhook 7, audit 90)', () => {
    expect(DEFAULT_LOG_RETENTION_DAYS).toBe(90)
    expect(DEFAULT_WEBHOOK_LOG_RETENTION_DAYS).toBe(7)
    expect(DEFAULT_AUDIT_LOG_RETENTION_DAYS).toBe(90)
    expect(LOG_RETENTION_OPTIONS).toContain(DEFAULT_LOG_RETENTION_DAYS)
    expect(WEBHOOK_LOG_RETENTION_OPTIONS).toContain(DEFAULT_WEBHOOK_LOG_RETENTION_DAYS)
    expect(AUDIT_LOG_RETENTION_OPTIONS).toContain(DEFAULT_AUDIT_LOG_RETENTION_DAYS)
  })

  it('keeps a stored value that is an option', () => {
    expect(toRetentionOption(180, LOG_RETENTION_OPTIONS, 90)).toBe(180)
    expect(toRetentionOption(0, LOG_RETENTION_OPTIONS, 90)).toBe(0)
  })

  it('snaps an off-list value up to the next option', () => {
    // e.g. a tier default of 7 days, which the invocation-log validator rejects
    expect(toRetentionOption(7, LOG_RETENTION_OPTIONS, 90)).toBe(30)
    expect(toRetentionOption(45, LOG_RETENTION_OPTIONS, 90)).toBe(60)
  })

  it('falls back when nothing fits or nothing is stored', () => {
    expect(toRetentionOption(1000, AUDIT_LOG_RETENTION_OPTIONS, 90)).toBe(90)
    expect(toRetentionOption(null, WEBHOOK_LOG_RETENTION_OPTIONS, 7)).toBe(7)
    expect(toRetentionOption(undefined, WEBHOOK_LOG_RETENTION_OPTIONS, 7)).toBe(7)
  })
})

describe('effectiveRetentionDays', () => {
  it('keeps 0 (keep forever) and values at or above the minimum', () => {
    expect(effectiveRetentionDays(0, MIN_LOG_RETENTION_DAYS)).toBe(0)
    expect(effectiveRetentionDays(90, MIN_LOG_RETENTION_DAYS)).toBe(90)
    expect(effectiveRetentionDays(7, MIN_WEBHOOK_LOG_RETENTION_DAYS)).toBe(7)
  })

  it('raises a stored value below the settings minimum', () => {
    expect(effectiveRetentionDays(7, MIN_LOG_RETENTION_DAYS)).toBe(30)
    expect(effectiveRetentionDays(7, MIN_AUDIT_LOG_RETENTION_DAYS)).toBe(90)
  })

  it('minimums match the smallest non-forever dropdown option', () => {
    expect(MIN_LOG_RETENTION_DAYS).toBe(Math.min(...LOG_RETENTION_OPTIONS.filter((v) => v > 0)))
    expect(MIN_WEBHOOK_LOG_RETENTION_DAYS).toBe(Math.min(...WEBHOOK_LOG_RETENTION_OPTIONS))
    expect(MIN_AUDIT_LOG_RETENTION_DAYS).toBe(Math.min(...AUDIT_LOG_RETENTION_OPTIONS))
  })
})

