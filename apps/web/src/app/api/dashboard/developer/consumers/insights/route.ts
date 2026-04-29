import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools, invocations, consumers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'

export const maxDuration = 60

// ─── Constants ────────────────────────────────────────────────────────────────

const TOP_CONSUMERS_LIMIT = 20
const CHURN_ACTIVE_WINDOW_DAYS = 30
const CHURN_INACTIVE_WINDOW_DAYS = 14
const AT_RISK_WEEKS = 2
const EXPECTED_LIFETIME_MONTHS = 24 // conservative LTV estimate

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsumerInsight {
  consumerId: string
  email: string
  totalSpendCents: number
  totalInvocations: number
  firstSeenAt: string
  lastSeenAt: string
  avgCostPerCallCents: number
}

interface ChurningConsumer {
  consumerId: string
  email: string
  previousSpendCents: number
  previousInvocations: number
  lastSeenAt: string
}

interface AtRiskConsumer {
  consumerId: string
  email: string
  currentWeekInvocations: number
  previousWeekInvocations: number
  declinePct: number
}

interface NewConsumer {
  consumerId: string
  email: string
  firstSeenAt: string
  totalSpendCents: number
  totalInvocations: number
}

interface ConsumerLTV {
  consumerId: string
  email: string
  avgMonthlySpendCents: number
  monthsActive: number
  estimatedLtvCents: number
}

/** GET /api/dashboard/developer/consumers/insights — consumer analytics (Scale+) */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-consumer-insights:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // ── Tier gate: consumer_insights requires Scale+ ──────────────────
    const [developer] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND')
    }

    if (!hasFeature(developer.tier, 'consumer_insights', developer.isFoundingMember)) {
      return errorResponse(
        'This feature requires the Scale plan.',
        403,
        'TIER_REQUIRED',
        undefined,
        { requiredTier: 'scale', currentTier: developer.tier, upgradeUrl: '/pricing' }
      )
    }

    // ── Get developer's tools ──────────────────────────────────────────
    const developerTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)

    if (toolIds.length === 0) {
      return successResponse({
        topConsumers: [],
        churningConsumers: [],
        atRiskConsumers: [],
        newConsumers: [],
        consumerLtv: [],
      })
    }

    const now = new Date()
    const period = request.nextUrl.searchParams.get('period') ?? '30'
    const periodDays = Math.min(Math.max(Number(period) || 30, 7), 90)
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

    // ── Top 20 consumers by spend ─────────────────────────────────────
    const topConsumersRaw = await db
      .select({
        consumerId: invocations.consumerId,
        totalSpendCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        totalInvocations: sql<number>`count(*)::int`,
        firstSeenAt: sql<string>`min(${invocations.createdAt})::text`,
        lastSeenAt: sql<string>`max(${invocations.createdAt})::text`,
        avgCostPerCallCents: sql<number>`coalesce(avg(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        eq(invocations.isTest, false),
      ))
      .groupBy(invocations.consumerId)
      .orderBy(sql`sum(${invocations.costCents}) desc`)
      .limit(TOP_CONSUMERS_LIMIT)

    // Resolve consumer emails
    const consumerIds = topConsumersRaw.map((r) => r.consumerId)
    const consumerEmails = consumerIds.length > 0
      ? await db
          .select({ id: consumers.id, email: consumers.email })
          .from(consumers)
          .where(inArray(consumers.id, consumerIds))
          .limit(TOP_CONSUMERS_LIMIT)
      : []

    const emailMap = new Map(consumerEmails.map((c) => [c.id, c.email]))

    const topConsumers: ConsumerInsight[] = topConsumersRaw.map((r) => ({
      consumerId: r.consumerId,
      email: emailMap.get(r.consumerId) ?? 'unknown',
      totalSpendCents: r.totalSpendCents,
      totalInvocations: r.totalInvocations,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
      avgCostPerCallCents: r.avgCostPerCallCents,
    }))

    // ── Churning consumers ────────────────────────────────────────────
    // Active in previous 30 days, inactive in last 14 days
    const churnActiveStart = new Date(now.getTime() - CHURN_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const churnInactiveStart = new Date(now.getTime() - CHURN_INACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const churningRaw = await db
      .select({
        consumerId: invocations.consumerId,
        previousSpendCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        previousInvocations: sql<number>`count(*)::int`,
        lastSeenAt: sql<string>`max(${invocations.createdAt})::text`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        eq(invocations.isTest, false),
        gte(invocations.createdAt, sql`${churnActiveStart.toISOString()}::timestamptz`),
        lt(invocations.createdAt, sql`${churnInactiveStart.toISOString()}::timestamptz`),
      ))
      .groupBy(invocations.consumerId)
      .orderBy(sql`sum(${invocations.costCents}) desc`)
      .limit(TOP_CONSUMERS_LIMIT)

    // Exclude consumers who have activity in the last 14 days
    const recentActiveIds = churningRaw.length > 0
      ? await db
          .select({ consumerId: sql<string>`distinct ${invocations.consumerId}` })
          .from(invocations)
          .where(and(
            inArray(invocations.toolId, toolIds),
            eq(invocations.isTest, false),
            gte(invocations.createdAt, sql`${churnInactiveStart.toISOString()}::timestamptz`),
            inArray(invocations.consumerId, churningRaw.map((r) => r.consumerId)),
          ))
          .limit(1000)
      : []

    const recentActiveSet = new Set(recentActiveIds.map((r) => r.consumerId))

    // Resolve emails for churning consumers
    const churnIds = churningRaw
      .filter((r) => !recentActiveSet.has(r.consumerId))
      .map((r) => r.consumerId)

    const churnEmails = churnIds.length > 0
      ? await db
          .select({ id: consumers.id, email: consumers.email })
          .from(consumers)
          .where(inArray(consumers.id, churnIds))
          .limit(TOP_CONSUMERS_LIMIT)
      : []

    const churnEmailMap = new Map(churnEmails.map((c) => [c.id, c.email]))

    const churningConsumers: ChurningConsumer[] = churningRaw
      .filter((r) => !recentActiveSet.has(r.consumerId))
      .slice(0, TOP_CONSUMERS_LIMIT)
      .map((r) => ({
        consumerId: r.consumerId,
        email: churnEmailMap.get(r.consumerId) ?? 'unknown',
        previousSpendCents: r.previousSpendCents,
        previousInvocations: r.previousInvocations,
        lastSeenAt: r.lastSeenAt,
      }))

    // ── At-risk consumers: usage declining >30% week-over-week ────────
    const currentWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const previousWeekStart = new Date(now.getTime() - AT_RISK_WEEKS * 7 * 24 * 60 * 60 * 1000)

    const currentWeekCounts = await db
      .select({
        consumerId: invocations.consumerId,
        count: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        eq(invocations.isTest, false),
        gte(invocations.createdAt, sql`${currentWeekStart.toISOString()}::timestamptz`),
      ))
      .groupBy(invocations.consumerId)
      .limit(1000)

    const previousWeekCounts = await db
      .select({
        consumerId: invocations.consumerId,
        count: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        eq(invocations.isTest, false),
        gte(invocations.createdAt, sql`${previousWeekStart.toISOString()}::timestamptz`),
        lt(invocations.createdAt, sql`${currentWeekStart.toISOString()}::timestamptz`),
      ))
      .groupBy(invocations.consumerId)
      .limit(1000)

    const currentMap = new Map(currentWeekCounts.map((r) => [r.consumerId, r.count]))
    const previousMap = new Map(previousWeekCounts.map((r) => [r.consumerId, r.count]))

    const atRiskRaw: Array<{ consumerId: string; currentWeek: number; previousWeek: number; decline: number }> = []
    for (const [consumerId, prevCount] of previousMap) {
      if (prevCount < 5) continue // skip very low-volume consumers
      const currCount = currentMap.get(consumerId) ?? 0
      const decline = (prevCount - currCount) / prevCount
      if (decline > 0.3) {
        atRiskRaw.push({
          consumerId,
          currentWeek: currCount,
          previousWeek: prevCount,
          decline: Math.round(decline * 10000) / 10000,
        })
      }
    }

    // Sort by decline severity and limit
    atRiskRaw.sort((a, b) => b.decline - a.decline)
    const atRiskSlice = atRiskRaw.slice(0, TOP_CONSUMERS_LIMIT)

    const atRiskIds = atRiskSlice.map((r) => r.consumerId)
    const atRiskEmails = atRiskIds.length > 0
      ? await db
          .select({ id: consumers.id, email: consumers.email })
          .from(consumers)
          .where(inArray(consumers.id, atRiskIds))
          .limit(TOP_CONSUMERS_LIMIT)
      : []

    const atRiskEmailMap = new Map(atRiskEmails.map((c) => [c.id, c.email]))

    const atRiskConsumers: AtRiskConsumer[] = atRiskSlice.map((r) => ({
      consumerId: r.consumerId,
      email: atRiskEmailMap.get(r.consumerId) ?? 'unknown',
      currentWeekInvocations: r.currentWeek,
      previousWeekInvocations: r.previousWeek,
      declinePct: Math.round(r.decline * 100),
    }))

    // ── New consumers this period ──────────────────────────────────────
    const newConsumersRaw = await db
      .select({
        consumerId: invocations.consumerId,
        firstSeenAt: sql<string>`min(${invocations.createdAt})::text`,
        totalSpendCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        totalInvocations: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        eq(invocations.isTest, false),
      ))
      .groupBy(invocations.consumerId)
      .having(sql`min(${invocations.createdAt}) >= ${periodStart.toISOString()}::timestamptz`)
      .orderBy(sql`min(${invocations.createdAt}) desc`)
      .limit(TOP_CONSUMERS_LIMIT)

    const newIds = newConsumersRaw.map((r) => r.consumerId)
    const newEmails = newIds.length > 0
      ? await db
          .select({ id: consumers.id, email: consumers.email })
          .from(consumers)
          .where(inArray(consumers.id, newIds))
          .limit(TOP_CONSUMERS_LIMIT)
      : []

    const newEmailMap = new Map(newEmails.map((c) => [c.id, c.email]))

    const newConsumers: NewConsumer[] = newConsumersRaw.map((r) => ({
      consumerId: r.consumerId,
      email: newEmailMap.get(r.consumerId) ?? 'unknown',
      firstSeenAt: r.firstSeenAt,
      totalSpendCents: r.totalSpendCents,
      totalInvocations: r.totalInvocations,
    }))

    // ── Estimated LTV per consumer ─────────────────────────────────────
    // LTV = avg monthly spend x expected lifetime (24 months)
    const ltvRaw = await db
      .select({
        consumerId: invocations.consumerId,
        totalSpendCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        firstSeenAt: sql<string>`min(${invocations.createdAt})::text`,
        lastSeenAt: sql<string>`max(${invocations.createdAt})::text`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        eq(invocations.isTest, false),
      ))
      .groupBy(invocations.consumerId)
      .orderBy(sql`sum(${invocations.costCents}) desc`)
      .limit(TOP_CONSUMERS_LIMIT)

    const ltvIds = ltvRaw.map((r) => r.consumerId)
    const ltvEmails = ltvIds.length > 0
      ? await db
          .select({ id: consumers.id, email: consumers.email })
          .from(consumers)
          .where(inArray(consumers.id, ltvIds))
          .limit(TOP_CONSUMERS_LIMIT)
      : []

    const ltvEmailMap = new Map(ltvEmails.map((c) => [c.id, c.email]))

    const consumerLtv: ConsumerLTV[] = ltvRaw.map((r) => {
      const firstSeen = new Date(r.firstSeenAt)
      const lastSeen = new Date(r.lastSeenAt)
      const msActive = lastSeen.getTime() - firstSeen.getTime()
      const monthsActive = Math.max(1, msActive / (30 * 24 * 60 * 60 * 1000))
      const avgMonthlySpendCents = Math.round(r.totalSpendCents / monthsActive)
      const estimatedLtvCents = avgMonthlySpendCents * EXPECTED_LIFETIME_MONTHS

      return {
        consumerId: r.consumerId,
        email: ltvEmailMap.get(r.consumerId) ?? 'unknown',
        avgMonthlySpendCents,
        monthsActive: Math.round(monthsActive * 10) / 10,
        estimatedLtvCents,
      }
    })

    return successResponse({
      topConsumers,
      churningConsumers,
      atRiskConsumers,
      newConsumers,
      consumerLtv,
      periodDays,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
