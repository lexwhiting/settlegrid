import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { developers, tools, invocations } from '@/lib/db/schema'
import { eq, sql, and, gte, lt, inArray } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendNotificationEmailResult } from '@/lib/notifications'
import { deliverOnce } from '@/lib/notification-delivery'
import {
  loadSnapshot, storeSnapshot, inCaptureWindow, keptSince, invocationsCutoffKey, INVOCATIONS_CUTOFF_MEMBER, type SnapshotEntry,
} from '@/lib/monthly-summary-snapshot'
import { effectiveRetentionDays, MIN_LOG_RETENTION_DAYS } from '@/lib/retention-options'
import { monthlyDeveloperSummaryEmail } from '@/lib/email'
import { getRedis } from '@/lib/redis'
import type { Redis } from '@upstash/redis'
import { utcMonthStart, utcMonthKey } from '@/lib/utc-periods'

export const maxDuration = 60

/** Stop starting new sends after this long (maxDuration is 60 s). */
const SEND_BUDGET_MS = 45_000
/** At least this long between sends: under Resend's default 10 requests/second. */
const MIN_SEND_INTERVAL_MS = 150

/** Snapshots, done markers and delivery records outlive the month's runs. */
const RECORD_TTL_SECS = 40 * 24 * 60 * 60
/** Delivery records read per MGET. */
const MGET_CHUNK = 100


/**
 * Last month's figures for each developer with calls last month and at least 1
 * active tool, ordered by developer id. Sandbox calls don't count, as in the weekly
 * report. Timestamps go to SQL as ISO strings: the postgres-js driver cannot
 * serialize a JS Date inside a sql template.
 */
async function computeSnapshot(redis: Redis, now: Date, lastMonthStart: Date, prevMonthStart: Date, lastMonthEnd: Date): Promise<SnapshotEntry[]> {
  const ts = (d: Date) => sql`${d.toISOString()}::timestamptz`
  const inLast = sql`${invocations.createdAt} >= ${ts(lastMonthStart)}`
  const rows = await db
    .select({
      developerId: tools.developerId,
      toolName: tools.name,
      revenue: sql<number>`(coalesce(sum(${invocations.costCents}) filter (where ${inLast}), 0))::int`,
      calls: sql<number>`(count(*) filter (where ${inLast}))::int`,
      prevRevenue: sql<number>`(coalesce(sum(${invocations.costCents}) filter (where not ${inLast}), 0))::int`,
      prevCalls: sql<number>`(count(*) filter (where not ${inLast}))::int`,
    })
    .from(invocations)
    .innerJoin(tools, eq(invocations.toolId, tools.id))
    .where(and(
      eq(invocations.isTest, false),
      gte(invocations.createdAt, ts(prevMonthStart)),
      lt(invocations.createdAt, ts(lastMonthEnd)),
    ))
    .groupBy(tools.developerId, tools.name)

  type Totals = { revenue: number; calls: number; prevRevenue: number; prevCalls: number; topTool: string | null; topToolRevenue: number }
  const totalsByDev = new Map<string, Totals>()
  for (const r of rows) {
    const t = totalsByDev.get(r.developerId) ?? { revenue: 0, calls: 0, prevRevenue: 0, prevCalls: 0, topTool: null, topToolRevenue: 0 }
    t.revenue += r.revenue
    t.calls += r.calls
    t.prevRevenue += r.prevRevenue
    t.prevCalls += r.prevCalls
    // Top tool: most revenue last month; ties go to the name that sorts first
    if (r.calls > 0 && (t.topTool === null || r.revenue > t.topToolRevenue || (r.revenue === t.topToolRevenue && r.toolName < t.topTool))) {
      t.topTool = r.toolName
      t.topToolRevenue = r.revenue
    }
    totalsByDev.set(r.developerId, t)
  }

  // No email for a month without activity
  const activeIds = [...totalsByDev].filter(([, t]) => t.calls > 0).map(([id]) => id)
  if (activeIds.length === 0) return []
  const devs = await db
    .select({ id: developers.id, logRetentionDays: developers.logRetentionDays })
    .from(developers)
    .where(and(
      inArray(developers.id, activeIds),
      sql`EXISTS (SELECT 1 FROM ${tools} WHERE ${tools.developerId} = ${developers.id} AND ${tools.status} = 'active')`,
    ))
    .orderBy(developers.id)

  // The cutoffs the purge actually used, where recorded (data-retention cron)
  // (a high-water mark: the furthest cutoff any purge used)
  // A developer whose mark can't be read is left out (it can't be shown complete)
  // rather than failing the run for everyone.
  const recorded = new Map<string, Date>()
  const unreadable = new Set<string>()
  for (let i = 0; i < devs.length; i += MGET_CHUNK) {
    const chunk = devs.slice(i, i + MGET_CHUNK)
    const scores = await Promise.all(chunk.map((d) =>
      redis.zscore(invocationsCutoffKey(d.id), INVOCATIONS_CUTOFF_MEMBER).catch(() => undefined)))
    chunk.forEach((d, j) => {
      if (scores[j] === undefined) { unreadable.add(d.id); return }
      const ms = scores[j] == null ? NaN : Number(scores[j])
      if (Number.isFinite(ms)) recorded.set(d.id, new Date(ms))
    })
  }
  const entries: SnapshotEntry[] = []
  const notComplete: string[] = []
  for (const dev of devs) {
    const t = totalsByDev.get(dev.id)!
    if (unreadable.has(dev.id)) {
      notComplete.push(dev.id)
      continue
    }
    // What is still there for this developer (null: everything)
    const kept = keptSince(now, effectiveRetentionDays(dev.logRetentionDays, MIN_LOG_RETENTION_DAYS), recorded.get(dev.id) ?? null)
    if (kept && kept > lastMonthStart) {
      // Part of the reported month is purged (e.g. 30-day retention after a 31-day
      // month, or a purge that ran early): no summary rather than understated totals
      notComplete.push(dev.id)
      continue
    }
    // The month before may be partly purged: then no trend rather than a wrong one
    const prevComplete = !(kept && kept > prevMonthStart)
    entries.push({
      developerId: dev.id,
      summary: {
        totalRevenueCents: t.revenue,
        totalInvocations: t.calls,
        topToolName: t.topTool,
        topToolRevenueCents: t.topToolRevenue,
        momRevenuePct: prevComplete && t.prevRevenue > 0 ? ((t.revenue - t.prevRevenue) / t.prevRevenue) * 100 : null,
        momInvocationPct: prevComplete && t.prevCalls > 0 ? ((t.calls - t.prevCalls) / t.prevCalls) * 100 : null,
      },
    })
  }
  if (notComplete.length > 0) {
    logger.error('cron.monthly_summary.not_complete', { count: notComplete.length, developerIds: notComplete })
  }
  return entries
}

/**
 * Vercel Cron handler: sends monthly developer summary emails.
 * Runs every 20 minutes through the month from 00:15 UTC on the 1st (vercel.json);
 * every run in a month reports the month before. The figures are captured on the 1st
 * before the 03:00 log purge (nine runs from 00:15 to 02:55) and kept (a snapshot). A
 * month not captured in that window is logged (with a failing status) and not sent. Each run sends
 * what is left (within a 45 s budget) and retries failed sends, until every summary is
 * sent or recorded; then later runs stop at once (one Redis read).
 *
 * For each developer with at least 1 active tool and calls last UTC month (one
 * email per developer and month; sandbox calls don't count):
 *   - Total revenue last month
 *   - Total invocations
 *   - Top tool by revenue
 *   - Month-over-month trend (up/down %)
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-monthly-summary:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.monthly_summary.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const startedAt = Date.now()
    const now = new Date()

    // UTC calendar months: the month reported on and the month before it (for the trend).
    // Every run on days 1–3 reports the same month.
    const lastMonthEnd = utcMonthStart(now) // 1st of this month = end of last month
    const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth() - 1, 1))
    const prevMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth() - 2, 1))
    const monthKey = utcMonthKey(lastMonthStart)

    const monthName = lastMonthStart.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })

    const redis = getRedis()
    const doneKey = `monthly-summary:done:${monthKey}`
    if (await redis.get(doneKey)) {
      return successResponse({ month: monthName, done: true, devsChecked: 0, emailsSent: 0, failed: 0, skipped: 0, remaining: 0 })
    }

    // The month's figures are captured once, only while last month's logs are known
    // complete (the 1st, before the 03:00 purge), and kept (lib/monthly-summary-snapshot):
    // later runs send the same figures whatever was purged since.
    const state = await loadSnapshot(redis, monthKey)
    let snapshot: SnapshotEntry[] | null = state.status === 'ok' ? state.entries : null
    if (!snapshot) {
      if (state.status === 'incomplete' || !inCaptureWindow(now)) {
        // The stored figures are incomplete (never repaired: two runs could otherwise
        // publish different figures), or the capture was missed (e.g. first deployed
        // mid-month, or every run in the window failed): send nothing rather than
        // figures from partly purged logs, and don't mark the month done. Logged once
        // per month, with a failing status so the cron run shows it.
        if (await redis.set(`monthly-summary:not-captured:${monthKey}`, '1', { nx: true, ex: RECORD_TTL_SECS })) {
          logger.error('cron.monthly_summary.not_captured', { month: monthName, snapshot: state.status })
          return errorResponse(`Monthly summary for ${monthName} was not captured`, 503, 'NOT_CAPTURED')
        }
        return successResponse({ month: monthName, captured: false, devsChecked: 0, emailsSent: 0, failed: 0, skipped: 0, remaining: 0 })
      }
      // In the window, before the day's purge; developers whose month an earlier purge
      // already reached are left out (computeSnapshot)
      const computed = await computeSnapshot(redis, now, lastMonthStart, prevMonthStart, lastMonthEnd)
      snapshot = await storeSnapshot(redis, monthKey, computed, RECORD_TTL_SECS)
      if (!snapshot) {
        // Not readable back: send nothing; the next run in the window tries again
        logger.error('cron.monthly_summary.snapshot_unreadable', { month: monthName })
        return errorResponse('Snapshot could not be stored', 503, 'SNAPSHOT_UNAVAILABLE')
      }
    }

    // Skip what is already delivered with batched reads, so a run's 45 s go to the
    // summaries still to send rather than to re-checking sent ones one by one.
    const deliveryKey = (developerId: string) => `monthly-summary:${developerId}:${monthKey}`
    const pending: SnapshotEntry[] = []
    for (let i = 0; i < snapshot.length; i += MGET_CHUNK) {
      const chunk = snapshot.slice(i, i + MGET_CHUNK)
      const records = await redis.mget<unknown[]>(...chunk.map((e) => deliveryKey(e.developerId)))
      chunk.forEach((e, j) => { if (!records[j]) pending.push(e) })
    }

    // Names and addresses as they are now
    const ids = pending.map((e) => e.developerId)
    const contacts = new Map(
      (ids.length === 0 ? [] : await db
        .select({ id: developers.id, email: developers.email, name: developers.name })
        .from(developers)
        .where(inArray(developers.id, ids))
      ).map((d) => [d.id, d]),
    )

    let emailsSent = 0
    let remaining = 0
    let failed = 0
    let skipped = 0
    let busy = 0
    let ambiguous = 0
    let lastSendAt = 0

    for (const entry of pending) {
      // Stop starting sends well before the 60 s limit; the next run (every 20 minutes
      // through the month) carries on with the same snapshot.
      if (Date.now() - startedAt > SEND_BUDGET_MS) {
        remaining++
        continue
      }
      const dev = contacts.get(entry.developerId)
      if (!dev) continue // account deleted since
      try {
        // Once per developer and month (lib/notification-delivery): recorded only when
        // sent or opted out, so a failed send is retried by the next run; overlapping
        // runs and a run killed mid-send can't send it twice.
        const result = await deliverOnce(redis, {
          key: deliveryKey(dev.id),
          recordTtlSecs: RECORD_TTL_SECS,
          recipient: dev.email,
          render: () => ({ to: dev.email, ...monthlyDeveloperSummaryEmail(dev.name ?? 'Developer', monthName, entry.summary) }),
          send: async (payload, idempotencyKey) => {
            const wait = lastSendAt + MIN_SEND_INTERVAL_MS - Date.now()
            if (wait > 0) await new Promise((r) => setTimeout(r, wait))
            lastSendAt = Date.now()
            return sendNotificationEmailResult({
              developerId: dev.id,
              eventKey: 'monthly_summary',
              email: payload.to,
              subject: payload.subject,
              html: payload.html,
              idempotencyKey,
            })
          },
        })

        if (result === 'sent') emailsSent++
        else if (result === 'opted_out') skipped++ // recorded, not counted as sent
        else if (result === 'busy') busy++
        else if (result === 'ambiguous') {
          // An earlier attempt's outcome is unknown and Resend's 24 h window has passed:
          // not resent (recorded); reconcile by hand
          ambiguous++
          logger.error('cron.monthly_summary.delivery_ambiguous', { developerId: dev.id, month: monthName })
        } else if (result === 'failed') {
          failed++
          logger.warn('cron.monthly_summary.send_failed', { developerId: dev.id })
        }
      } catch (devErr) {
        // Don't let one developer failure stop the batch; the next run retries it
        failed++
        logger.error('cron.monthly_summary.dev_failed', { developerId: dev.id }, devErr)
      }
    }

    if (remaining === 0 && failed === 0 && busy === 0) {
      // Every summary for the month is sent or recorded: later runs stop at the top
      await redis.set(doneKey, '1', { ex: RECORD_TTL_SECS })
    } else if (now.getUTCDate() >= 2) {
      // Still not done after the 1st: say so on every run until it is (runs continue
      // every 20 minutes through the month)
      logger.error('cron.monthly_summary.behind', { month: monthName, remaining, failed, busy })
    } else if (remaining > 0) {
      logger.warn('cron.monthly_summary.incomplete', { month: monthName, remaining })
    }

    logger.info('cron.monthly_summary.completed', {
      month: monthName,
      devsChecked: snapshot.length,
      emailsSent,
      failed,
      skipped,
      ambiguous,
      remaining,
    })

    return successResponse({
      month: monthName,
      devsChecked: snapshot.length,
      emailsSent,
      failed,
      skipped,
      ambiguous,
      remaining,
    })
  } catch (error) {
    logger.error('cron.monthly_summary.failed', {}, error)
    return internalErrorResponse(error)
  }
}
