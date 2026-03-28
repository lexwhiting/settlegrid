/**
 * Analytics helper functions for the admin metrics dashboard
 * and leading-indicator tracking.
 */

import { db } from '@/lib/db'
import { developers, tools, invocations, consumers, signupInvites } from '@/lib/db/schema'
import { sql, eq, and, count } from 'drizzle-orm'

// ── Tier pricing for MRR calculation ────────────────────────────────────────

const TIER_PRICE_CENTS: Record<string, number> = {
  standard: 0,
  builder: 1900, // $19/mo
  starter: 1900, // legacy alias — treat as builder ($19/mo)
  growth: 1900, // legacy alias — treat as builder ($19/mo)
  scale: 7900, // $79/mo
  enterprise: 0, // custom pricing — excluded from auto-calc
}

// ── Leading indicator queries ───────────────────────────────────────────────

/**
 * Count tools that received at least one non-test invocation from a
 * consumer who is NOT the tool's creator (organic traction signal).
 */
export async function getToolsWithOrganicInvocations(days: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const rows = await db
    .select({ toolCount: sql<number>`COUNT(DISTINCT ${invocations.toolId})` })
    .from(invocations)
    .innerJoin(tools, eq(invocations.toolId, tools.id))
    .where(
      and(
        sql`${invocations.createdAt} >= ${cutoff.toISOString()}::timestamptz`,
        eq(invocations.isTest, false),
        sql`${invocations.consumerId} IS NOT NULL`
      )
    )
    .limit(1)

  return rows[0]?.toolCount ?? 0
}

/**
 * Count consumers that made at least 1 invocation (activation signal).
 */
export async function getConsumerAccountsWithActivity(): Promise<number> {
  const rows = await db
    .select({ active: sql<number>`COUNT(DISTINCT ${invocations.consumerId})` })
    .from(invocations)
    .where(eq(invocations.isTest, false))
    .limit(1)

  return rows[0]?.active ?? 0
}

/**
 * Daily signups for the last N days (developers table).
 * Returns newest first.
 */
export async function getSignupsByDay(days: number): Promise<{ date: string; count: number }[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const rows = await db
    .select({
      date: sql<string>`TO_CHAR(${developers.createdAt}::date, 'YYYY-MM-DD')`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(developers)
    .where(sql`${developers.createdAt} >= ${cutoff.toISOString()}::timestamptz`)
    .groupBy(sql`${developers.createdAt}::date`)
    .orderBy(sql`${developers.createdAt}::date ASC`)
    .limit(days)

  return rows.map((r) => ({ date: r.date, count: r.count }))
}

/**
 * Calculate Monthly Recurring Revenue from paid subscriptions.
 * Returns cents.
 */
export async function getMRR(): Promise<number> {
  const paidTiers = Object.entries(TIER_PRICE_CENTS)
    .filter(([, price]) => price > 0)
    .map(([tier]) => tier)

  if (paidTiers.length === 0) return 0

  let totalMrrCents = 0

  for (const tier of paidTiers) {
    const [result] = await db
      .select({ cnt: count() })
      .from(developers)
      .where(eq(developers.tier, tier))
      .limit(1)

    totalMrrCents += (result?.cnt ?? 0) * (TIER_PRICE_CENTS[tier] ?? 0)
  }

  return totalMrrCents
}

/**
 * Referral funnel stats: invites sent, conversions, rate.
 */
export async function getReferralStats(): Promise<{
  sent: number
  converted: number
  rate: number
}> {
  // Total invites = rows in signup_invites
  const [inviteResult] = await db
    .select({ total: count() })
    .from(signupInvites)
    .limit(1)

  const sent = inviteResult?.total ?? 0

  // Converted = invites where inviter was credited (meaning invitee signed up)
  const [convertedResult] = await db
    .select({ total: count() })
    .from(signupInvites)
    .where(eq(signupInvites.inviterCredited, true))
    .limit(1)

  const converted = convertedResult?.total ?? 0

  // Developers with an invite code (potential referrers)
  const [referrerResult] = await db
    .select({ total: count() })
    .from(developers)
    .where(sql`${developers.inviteCode} IS NOT NULL`)
    .limit(1)

  const potentialReferrers = referrerResult?.total ?? 0

  // Rate: conversions per referrer (or 0 if no referrers)
  const rate = potentialReferrers > 0 ? converted / potentialReferrers : 0

  return { sent, converted, rate }
}

/**
 * Total invocations this calendar month.
 */
export async function getInvocationsThisMonth(): Promise<number> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [result] = await db
    .select({ total: count() })
    .from(invocations)
    .where(sql`${invocations.createdAt} >= ${monthStart.toISOString()}::timestamptz`)
    .limit(1)

  return result?.total ?? 0
}

/**
 * Count of paid subscribers (tier != 'standard').
 */
export async function getPaidSubscribers(): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(developers)
    .where(sql`${developers.tier} != 'standard'`)
    .limit(1)

  return result?.total ?? 0
}

/**
 * Total active tools.
 */
export async function getActiveTools(): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(tools)
    .where(eq(tools.status, 'active'))
    .limit(1)

  return result?.total ?? 0
}

/**
 * Total developers.
 */
export async function getTotalDevelopers(): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(developers)
    .limit(1)

  return result?.total ?? 0
}

/**
 * Total consumers with at least one purchase or invocation.
 */
export async function getActiveConsumers(): Promise<number> {
  const [result] = await db
    .select({ total: sql<number>`COUNT(DISTINCT ${consumers.id})` })
    .from(consumers)
    .innerJoin(invocations, eq(consumers.id, invocations.consumerId))
    .limit(1)

  return result?.total ?? 0
}
