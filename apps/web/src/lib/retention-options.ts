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
