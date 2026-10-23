/**
 * Data retention dropdown values for the Settings page.
 */

// Dropdown values; the defaults match the column defaults in lib/db/schema.ts
// (log 90, webhook 7, audit 90). 0 = keep forever.
export const LOG_RETENTION_OPTIONS = [30, 60, 90, 180, 365, 0] as const
export const WEBHOOK_LOG_RETENTION_OPTIONS = [7, 14, 30, 60, 90] as const
export const AUDIT_LOG_RETENTION_OPTIONS = [90, 180, 365, 730] as const
export const DEFAULT_LOG_RETENTION_DAYS = 90
export const DEFAULT_WEBHOOK_LOG_RETENTION_DAYS = 7
export const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 90

/**
 * Snap a stored retention value onto a dropdown option (the smallest option
 * that keeps at least as much), so an out-of-range stored value can still be
 * saved through the profile API's validator.
 */
export function toRetentionOption(value: number | null | undefined, options: readonly number[], fallback: number): number {
  if (value == null) return fallback
  if (options.includes(value)) return value
  const larger = options.filter((o) => o > 0 && o >= value).sort((a, b) => a - b)
  return larger[0] ?? fallback
}

/** Smallest retention each purge may use: the smallest non-forever dropdown option. */
export const MIN_LOG_RETENTION_DAYS = 30
export const MIN_WEBHOOK_LOG_RETENTION_DAYS = 7
export const MIN_AUDIT_LOG_RETENTION_DAYS = 90

/**
 * Retention the purge job applies for a stored value: 0 (keep forever) stays 0,
 * anything else is raised to the minimum the settings form allows, so a stored
 * value below it (e.g. from a column default that drifted) never deletes early.
 */
export function effectiveRetentionDays(stored: number, minimum: number): number {
  if (stored === 0) return 0
  return Math.max(minimum, stored)
}

