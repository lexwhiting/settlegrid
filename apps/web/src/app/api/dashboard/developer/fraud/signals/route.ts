import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'

export const maxDuration = 30

type SignalStatus = 'active' | 'degraded'

interface SignalCategory {
  id: string
  label: string
  signals: string[]
}

interface SignalDefinition {
  name: string
  displayName: string
  description: string
  threshold: string
  riskContribution: string
  redisKeyPattern: string
  fallbackBehavior: string
  category: string
  requiresRedis: boolean
}

const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  {
    name: 'rate_spike',
    displayName: 'Rate Spike Detection',
    description: 'Flags consumers exceeding 50 invocations within a 60-second window.',
    threshold: '>50 req/60s',
    riskContribution: '+50 risk score',
    redisKeyPattern: 'fraud:rate:{consumerId}:{toolId}',
    fallbackBehavior: 'Falls back to in-memory counter when Redis is unavailable.',
    category: 'velocity',
    requiresRedis: true,
  },
  {
    name: 'hourly_velocity',
    displayName: 'Hourly Velocity',
    description: 'Flags consumers exceeding 500 invocations in a rolling 1-hour window.',
    threshold: '>500 req/hour',
    riskContribution: '+35 risk score',
    redisKeyPattern: 'fraud:hourly:{consumerId}:{toolId}',
    fallbackBehavior: 'Falls back to in-memory counter when Redis is unavailable.',
    category: 'velocity',
    requiresRedis: true,
  },
  {
    name: 'ip_velocity',
    displayName: 'IP Velocity',
    description: 'Detects a single IP address making more than 100 requests per minute across all consumers.',
    threshold: '>100 req/min per IP',
    riskContribution: '+40 risk score',
    redisKeyPattern: 'fraud:ip:{ip}',
    fallbackBehavior: 'Falls back to in-memory counter when Redis is unavailable.',
    category: 'velocity',
    requiresRedis: true,
  },
  {
    name: 'spending_velocity',
    displayName: 'Spending Velocity',
    description: 'Monitors accumulated spending per consumer and flags when hourly spend exceeds $50.',
    threshold: '>$50/hour',
    riskContribution: '+35 risk score',
    redisKeyPattern: 'fraud:spend:{consumerId}',
    fallbackBehavior: 'Falls back to in-memory accumulator when Redis is unavailable.',
    category: 'financial',
    requiresRedis: true,
  },
  {
    name: 'new_key_high_value',
    displayName: 'New Key High Value',
    description: 'Enhanced scrutiny for API keys less than 24 hours old making high-value calls (>$10).',
    threshold: '<24h key + >1000 cents',
    riskContribution: '+40 risk score',
    redisKeyPattern: 'N/A (timestamp-based)',
    fallbackBehavior: 'Always active — uses API key creation timestamp, no Redis dependency.',
    category: 'financial',
    requiresRedis: false,
  },
  {
    name: 'unusual_amount',
    displayName: 'Unusual Amount Pattern',
    description: 'Compares each invocation cost against the median of the last 20 calls. Flags amounts exceeding 5x the median.',
    threshold: '>5x median cost',
    riskContribution: '+15 risk score',
    redisKeyPattern: 'fraud:amounts:{consumerId}:{toolId}',
    fallbackBehavior: 'Signal skipped when Redis is unavailable — amount history not accessible.',
    category: 'financial',
    requiresRedis: true,
  },
  {
    name: 'failed_auth',
    displayName: 'Failed Auth Tracking',
    description: 'Tracks failed API key validation attempts per IP. Blocks the IP for 15 minutes after 5 failures in 60 seconds.',
    threshold: '>5 failures/60s = 15min block',
    riskContribution: 'IP block (not scored)',
    redisKeyPattern: 'fraud:failauth:{ip}',
    fallbackBehavior: 'Falls back to in-memory counter when Redis is unavailable.',
    category: 'identity',
    requiresRedis: true,
  },
  {
    name: 'multi_ip_key',
    displayName: 'Multi-IP Key Usage',
    description: 'Detects a single API key being used from multiple IP addresses within a 5-minute window.',
    threshold: '>5 unique IPs/5min',
    riskContribution: '+25 (>5 IPs) or +40 (>10 IPs)',
    redisKeyPattern: 'fraud:keyips:{keyId}',
    fallbackBehavior: 'Signal skipped when Redis is unavailable — IP set not trackable.',
    category: 'identity',
    requiresRedis: true,
  },
  {
    name: 'dormant_key',
    displayName: 'Dormant Key Reactivation',
    description: 'Flags API keys that have been inactive for 30+ days making high-value calls, or 90+ days making any call.',
    threshold: '>30d idle + >$5, or >90d idle',
    riskContribution: '+25 (30d) or +30 (90d)',
    redisKeyPattern: 'N/A (timestamp-based)',
    fallbackBehavior: 'Always active — uses lastUsedAt timestamp, no Redis dependency.',
    category: 'identity',
    requiresRedis: false,
  },
  {
    name: 'rapid_duplicate',
    displayName: 'Rapid Duplicate Detection',
    description: 'Identifies identical consumer+tool+cost requests repeated within 2 seconds.',
    threshold: 'Same call within 2s',
    riskContribution: '+30 risk score',
    redisKeyPattern: 'fraud:dup:{consumerId}:{toolId}:{costCents}',
    fallbackBehavior: 'Falls back to in-memory dedup cache when Redis is unavailable.',
    category: 'behavioral',
    requiresRedis: true,
  },
  {
    name: 'chargeback_history',
    displayName: 'Chargeback History',
    description: 'Permanently flags consumers with any previous chargeback on record. Adds persistent risk to all future invocations.',
    threshold: 'Any prior chargeback',
    riskContribution: '+30 risk score',
    redisKeyPattern: 'fraud:chargeback:{consumerId}',
    fallbackBehavior: 'Falls back to in-memory chargeback set when Redis is unavailable.',
    category: 'behavioral',
    requiresRedis: true,
  },
  {
    name: 'session_nesting',
    displayName: 'Session Nesting Depth',
    description: 'Monitors recursive or nested session depths. Rejects calls exceeding depth 5 and adds risk at depth >3.',
    threshold: '>3 levels (warn), >5 (reject)',
    riskContribution: '+15 (depth>3) or reject (depth>5)',
    redisKeyPattern: 'fraud:session:{sessionId}',
    fallbackBehavior: 'Falls back to in-memory depth counter when Redis is unavailable.',
    category: 'behavioral',
    requiresRedis: true,
  },
]

const SIGNAL_CATEGORIES: SignalCategory[] = [
  {
    id: 'velocity',
    label: 'Velocity & Rate',
    signals: ['rate_spike', 'hourly_velocity', 'ip_velocity'],
  },
  {
    id: 'financial',
    label: 'Financial',
    signals: ['spending_velocity', 'new_key_high_value', 'unusual_amount'],
  },
  {
    id: 'identity',
    label: 'Identity & Access',
    signals: ['failed_auth', 'multi_ip_key', 'dormant_key'],
  },
  {
    id: 'behavioral',
    label: 'Behavioral',
    signals: ['rapid_duplicate', 'chargeback_history', 'session_nesting'],
  },
]

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `fraud-signals:${ip}`)
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

    // Check Redis health
    let redisHealthy = false
    try {
      const redis = getRedis()
      const pong = await redis.ping()
      redisHealthy = pong === 'PONG'
    } catch {
      redisHealthy = false
    }

    // Get developer's tool IDs
    const developerTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)

    // Get scanned today count (all invocations today)
    const todayStartDate = new Date()
    todayStartDate.setHours(0, 0, 0, 0)
    let scannedTodayTotal = 0
    let flaggedThisWeekTotal = 0
    let lastFlaggedAt: Date | null = null

    if (toolIds.length > 0) {
      // Count invocations today
      const [scannedRow] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(invocations)
        .where(
          and(
            gte(invocations.createdAt, sql`${todayStartDate.toISOString()}::timestamptz`),
            inArray(invocations.toolId, toolIds)
          )
        )
      scannedTodayTotal = scannedRow?.count ?? 0

      // Count flagged invocations this week
      const weekAgoDate = new Date()
      weekAgoDate.setDate(weekAgoDate.getDate() - 7)
      const [flaggedRow] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(invocations)
        .where(
          and(
            gte(invocations.createdAt, sql`${weekAgoDate.toISOString()}::timestamptz`),
            eq(invocations.isFlagged, true),
            inArray(invocations.toolId, toolIds)
          )
        )
      flaggedThisWeekTotal = flaggedRow?.count ?? 0

      // Get last flagged invocation timestamp
      const [lastFlaggedRow] = await db
        .select({
          createdAt: invocations.createdAt,
        })
        .from(invocations)
        .where(
          and(
            eq(invocations.isFlagged, true),
            inArray(invocations.toolId, toolIds)
          )
        )
        .orderBy(sql`${invocations.createdAt} DESC`)
        .limit(1)

      lastFlaggedAt = lastFlaggedRow?.createdAt ?? null
    }

    // Build signal response
    // Distribute the totals evenly across signals for display (each signal scans every invocation)
    const signalCount = SIGNAL_DEFINITIONS.length
    const perSignalScanned = scannedTodayTotal // each signal scans all invocations
    const perSignalFlagged = Math.ceil(flaggedThisWeekTotal / Math.max(signalCount, 1))

    const signals = SIGNAL_DEFINITIONS.map((def) => {
      const status: SignalStatus = (def.requiresRedis && !redisHealthy) ? 'degraded' : 'active'

      return {
        name: def.name,
        displayName: def.displayName,
        description: def.description,
        threshold: def.threshold,
        status,
        scannedToday: perSignalScanned,
        flaggedThisWeek: perSignalFlagged,
        lastTriggeredAt: lastFlaggedAt?.toISOString() ?? null,
        riskContribution: def.riskContribution,
        redisKeyPattern: def.redisKeyPattern,
        fallbackBehavior: def.fallbackBehavior,
        category: def.category,
      }
    })

    return successResponse({
      signals,
      categories: SIGNAL_CATEGORIES,
      summary: {
        totalSignals: signalCount,
        activeSignals: signals.filter((s) => s.status === 'active').length,
        degradedSignals: signals.filter((s) => s.status === 'degraded').length,
        scannedToday: scannedTodayTotal,
        flaggedThisWeek: flaggedThisWeekTotal,
        redisHealthy,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
