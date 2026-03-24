import { NextRequest } from 'next/server'
import { sql, eq, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, consumers, tools, invocations, payouts } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

function dateCutoff(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `admin-stats:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    if (!ADMIN_EMAILS.includes(auth.email)) {
      return errorResponse('Forbidden. Admin access required.', 403, 'FORBIDDEN')
    }

    const cutoff24h = dateCutoff(1)
    const cutoff7d = dateCutoff(7)
    const cutoff30d = dateCutoff(30)

    // ── Developer stats ─────────────────────────────────────────────
    const [devTotal] = await db.select({ count: count() }).from(developers)
    const [devLast24h] = await db
      .select({ count: count() })
      .from(developers)
      .where(sql`${developers.createdAt} > ${cutoff24h.toISOString()}::timestamptz`)
    const [devLast7d] = await db
      .select({ count: count() })
      .from(developers)
      .where(sql`${developers.createdAt} > ${cutoff7d.toISOString()}::timestamptz`)
    const [devLast30d] = await db
      .select({ count: count() })
      .from(developers)
      .where(sql`${developers.createdAt} > ${cutoff30d.toISOString()}::timestamptz`)

    // ── Consumer stats ──────────────────────────────────────────────
    const [conTotal] = await db.select({ count: count() }).from(consumers)
    const [conLast24h] = await db
      .select({ count: count() })
      .from(consumers)
      .where(sql`${consumers.createdAt} > ${cutoff24h.toISOString()}::timestamptz`)
    const [conLast7d] = await db
      .select({ count: count() })
      .from(consumers)
      .where(sql`${consumers.createdAt} > ${cutoff7d.toISOString()}::timestamptz`)
    const [conLast30d] = await db
      .select({ count: count() })
      .from(consumers)
      .where(sql`${consumers.createdAt} > ${cutoff30d.toISOString()}::timestamptz`)

    // ── Tool stats ──────────────────────────────────────────────────
    const [toolTotal] = await db.select({ count: count() }).from(tools)
    const [toolActive] = await db
      .select({ count: count() })
      .from(tools)
      .where(eq(tools.status, 'active'))
    const [toolDraft] = await db
      .select({ count: count() })
      .from(tools)
      .where(eq(tools.status, 'draft'))

    // ── Invocation stats ────────────────────────────────────────────
    const [invTotal] = await db.select({ count: count() }).from(invocations)
    const [invLast24h] = await db
      .select({ count: count() })
      .from(invocations)
      .where(sql`${invocations.createdAt} > ${cutoff24h.toISOString()}::timestamptz`)
    const [invLast7d] = await db
      .select({ count: count() })
      .from(invocations)
      .where(sql`${invocations.createdAt} > ${cutoff7d.toISOString()}::timestamptz`)
    const [invLast30d] = await db
      .select({ count: count() })
      .from(invocations)
      .where(sql`${invocations.createdAt} > ${cutoff30d.toISOString()}::timestamptz`)

    // ── Revenue (sum of invocation costs) ───────────────────────────
    const [revTotal] = await db
      .select({ total: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)` })
      .from(invocations)
    const [revLast30d] = await db
      .select({ total: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)` })
      .from(invocations)
      .where(sql`${invocations.createdAt} > ${cutoff30d.toISOString()}::timestamptz`)

    // ── Payout stats ────────────────────────────────────────────────
    const [payoutTotal] = await db
      .select({ total: sql<number>`COALESCE(SUM(${payouts.amountCents}), 0)` })
      .from(payouts)
      .where(eq(payouts.status, 'completed'))
    const [payoutPending] = await db
      .select({ total: sql<number>`COALESCE(SUM(${payouts.amountCents}), 0)` })
      .from(payouts)
      .where(eq(payouts.status, 'pending'))

    // ── Recent signups (last 20, combined developers + consumers) ──
    const recentDevs = await db
      .select({
        email: developers.email,
        name: developers.name,
        createdAt: developers.createdAt,
      })
      .from(developers)
      .orderBy(sql`${developers.createdAt} DESC`)
      .limit(20)

    const recentCons = await db
      .select({
        email: consumers.email,
        createdAt: consumers.createdAt,
      })
      .from(consumers)
      .orderBy(sql`${consumers.createdAt} DESC`)
      .limit(20)

    const recentSignups = [
      ...recentDevs.map((d) => ({
        email: d.email,
        name: d.name,
        type: 'developer' as const,
        createdAt: d.createdAt.toISOString(),
      })),
      ...recentCons.map((c) => ({
        email: c.email,
        name: null,
        type: 'consumer' as const,
        createdAt: c.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)

    logger.info('admin.stats_accessed', { email: auth.email })

    return successResponse({
      developers: {
        total: devTotal.count,
        last24h: devLast24h.count,
        last7d: devLast7d.count,
        last30d: devLast30d.count,
      },
      consumers: {
        total: conTotal.count,
        last24h: conLast24h.count,
        last7d: conLast7d.count,
        last30d: conLast30d.count,
      },
      tools: {
        total: toolTotal.count,
        active: toolActive.count,
        draft: toolDraft.count,
      },
      invocations: {
        total: invTotal.count,
        last24h: invLast24h.count,
        last7d: invLast7d.count,
        last30d: invLast30d.count,
      },
      revenue: {
        totalCents: Number(revTotal.total),
        last30dCents: Number(revLast30d.total),
      },
      payouts: {
        totalCents: Number(payoutTotal.total),
        pendingCents: Number(payoutPending.total),
      },
      recentSignups,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
