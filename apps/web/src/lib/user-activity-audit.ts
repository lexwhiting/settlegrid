/**
 * Pure helpers for the production user-activity audit
 * (`apps/web/scripts/audit-user-activity.ts`). Kept in src/lib so they are
 * covered by vitest and typechecked with the app; the script itself only
 * wires them to a read-only database connection.
 *
 * Classification rules mirror the 2026-06-06 / 2026-06-14 prod audits:
 *   - "internal" = founder / ops / seed / system accounts (lib/internal-accounts)
 *   - "test-looking" = throwaway or fixture-shaped emails that are almost
 *     certainly not a real person (example.com, mailinator, `test`, `+tag`)
 *   - a "real" invocation is one with is_test = false hitting a tool whose
 *     developer is external
 */

import { isInternalEmail } from './internal-accounts'

export interface AccountRow {
  id: string
  email: string
  createdAt: Date | string
}

export type AccountClass = 'internal' | 'test-looking' | 'external'

const TEST_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'mailinator.com',
  'guerrillamail.com',
  'yopmail.com',
  'tempmail.com',
  'localhost',
])

/**
 * Heuristic for fixture / throwaway addresses. Deliberately conservative:
 * a false "test-looking" hides a real person from the headline count, so
 * only patterns that are overwhelmingly fixtures are matched.
 */
export function looksLikeTestEmail(email: string | null | undefined): boolean {
  if (!email) return true
  const e = email.trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at === -1) return true
  const local = e.slice(0, at)
  const domain = e.slice(at + 1)
  if (TEST_DOMAINS.has(domain)) return true
  if (domain.endsWith('.test') || domain.endsWith('.invalid') || domain.endsWith('.local')) return true
  if (local.includes('+')) return true
  if (/^(test|tester|testing|demo|fake|dummy|qa|foo|bar)(\d+|[._-].*)?$/.test(local)) return true
  if (/(^|[._-])test(\d+)?($|[._-])/.test(local)) return true
  return false
}

export function classifyAccount(email: string | null | undefined): AccountClass {
  if (isInternalEmail(email)) return 'internal'
  if (looksLikeTestEmail(email)) return 'test-looking'
  return 'external'
}

export interface Partition<T extends AccountRow> {
  internal: T[]
  testLooking: T[]
  external: T[]
}

export function partitionAccounts<T extends AccountRow>(rows: T[]): Partition<T> {
  const out: Partition<T> = { internal: [], testLooking: [], external: [] }
  for (const r of rows) {
    const c = classifyAccount(r.email)
    if (c === 'internal') out.internal.push(r)
    else if (c === 'test-looking') out.testLooking.push(r)
    else out.external.push(r)
  }
  return out
}

/** Count rows created within the last `days` days relative to `now`. */
export function countSince<T extends AccountRow>(rows: T[], days: number, now: Date = new Date()): number {
  const cutoff = now.getTime() - days * 86_400_000
  let n = 0
  for (const r of rows) {
    const t = new Date(r.createdAt).getTime()
    if (Number.isFinite(t) && t >= cutoff) n++
  }
  return n
}

/**
 * Mask an email for pasting into chat / docs: keeps the first character of
 * the local part and the full domain, so the founder can still recognise an
 * address without the report carrying PII verbatim.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '(none)'
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  return `${local[0]}${'*'.repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`
}

export function formatUsd(cents: number | string | null | undefined): string {
  const n = typeof cents === 'string' ? Number(cents) : cents ?? 0
  return `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return 'never'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? 'invalid' : t.toISOString().slice(0, 10)
}

/** Days between `d` and `now`, floored; null when `d` is missing. */
export function daysAgo(d: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!d) return null
  const t = new Date(d).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((now.getTime() - t) / 86_400_000)
}

/**
 * One-line verdict from the headline signals. Kept deliberately blunt: the
 * point of the audit is to answer "is anyone actually using this?".
 */
export function verdict(input: {
  externalDevSignups30d: number
  externalConsumerSignups30d: number
  realInvocations30d: number
  completedPurchases30d: number
  lastRealInvocationDaysAgo: number | null
}): string {
  const { externalDevSignups30d, externalConsumerSignups30d, realInvocations30d, completedPurchases30d, lastRealInvocationDaysAgo } = input
  if (realInvocations30d > 0 && completedPurchases30d > 0) {
    return 'ACTIVE: real invocations and completed purchases in the last 30 days.'
  }
  if (realInvocations30d > 0) {
    return 'USAGE WITHOUT REVENUE: real invocations in the last 30 days, but no completed purchases.'
  }
  if (externalDevSignups30d + externalConsumerSignups30d > 0) {
    const last = lastRealInvocationDaysAgo === null ? 'never' : `${lastRealInvocationDaysAgo} days ago`
    return `SIGNUPS WITHOUT USAGE: new external accounts in the last 30 days, but no real invocations (last real invocation: ${last}).`
  }
  return 'DORMANT: no external signups, no real invocations, no purchases in the last 30 days.'
}
