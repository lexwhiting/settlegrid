import { getRedis, tryRedis } from './redis'
import { logger } from './logger'
import { accountLockedEmail, sendEmail } from './email'

export enum FraudSignal {
  RATE_SPIKE = 'rate_spike',
  NEW_KEY_HIGH_VALUE = 'new_key_high_value',
  RAPID_DUPLICATE = 'rapid_duplicate',
  HOURLY_VELOCITY = 'hourly_velocity',
  IP_VELOCITY = 'ip_velocity',
  SPENDING_VELOCITY = 'spending_velocity',
  MULTI_IP_KEY = 'multi_ip_key',
  DORMANT_KEY = 'dormant_key',
  UNUSUAL_AMOUNT = 'unusual_amount',
  CHARGEBACK_HISTORY = 'chargeback_history',
  SESSION_NESTING = 'session_nesting',
}

export interface FraudResult {
  flagged: boolean
  reasons: string[]
  signals: FraudSignal[]
  riskScore: number // 0-100
}

// In-memory fallback counters (used when Redis is unavailable)
const memoryCounters = new Map<string, { count: number; resetAt: number }>()
const memoryDuplicates = new Map<string, number>()
const memoryChargebacks = new Set<string>()
const memorySessionDepths = new Map<string, number>()


function incrMemoryCount(key: string, windowMs: number): number {
  const now = Date.now()
  const entry = memoryCounters.get(key)
  if (!entry || entry.resetAt <= now) {
    memoryCounters.set(key, { count: 1, resetAt: now + windowMs })
    return 1
  }
  entry.count += 1
  return entry.count
}

function checkMemoryDuplicate(key: string, windowMs: number): boolean {
  const now = Date.now()
  const lastSeen = memoryDuplicates.get(key)
  memoryDuplicates.set(key, now)
  if (lastSeen && now - lastSeen < windowMs) {
    return true
  }
  return false
}

/**
 * Detect potential fraud in metering requests.
 *
 * 12 signals are evaluated in parallel where possible:
 *   1. Rate spike — >50 invocations in 60s from same consumer
 *   2. New key high value — key <24h old + single invocation >$10
 *   3. Rapid duplicate — same consumer+tool+cost within 2s
 *   4. Hourly velocity — >500 invocations per hour
 *   5. IP velocity — >100/min from single IP
 *   6. Spending velocity — >$50/hour accumulated spend
 *   7. Multi-IP key — key used from >5 unique IPs in 5 min
 *   8. Dormant key reactivation — key idle >30 days with high-value call
 *   9. Unusual amount — cost >5x median of recent amounts
 *  10. Chargeback history — consumer has prior chargebacks
 *  11. Session nesting depth — depth >3 levels
 *
 * Returns risk score 0-100, list of reasons, and typed signal identifiers.
 */
export async function detectFraud(params: {
  consumerId: string
  toolId: string
  costCents: number
  ip: string
  keyId?: string
  keyCreatedAt?: Date
  keyLastUsedAt?: Date | null
  method?: string
}): Promise<FraudResult> {
  const { consumerId, toolId, costCents, ip, keyId, keyCreatedAt, keyLastUsedAt } = params
  const reasons: string[] = []
  const signals: FraudSignal[] = []
  let riskScore = 0

  try {
    const redis = getRedis()

    // ── Signal 1: Rate spike (>50 invocations in 60s) ─────────────────────────
    const rateKey = `fraud:rate:${consumerId}`
    const rateCount = await tryRedis(async () => {
      const pipeline = redis.pipeline()
      pipeline.incr(rateKey)
      pipeline.expire(rateKey, 60)
      const results = await pipeline.exec()
      return (results?.[0] as number) ?? null
    })

    const effectiveRate = rateCount ?? incrMemoryCount(rateKey, 60_000)

    if (effectiveRate > 50) {
      reasons.push(`Rate spike: ${effectiveRate} invocations in 60s (threshold: 50)`)
      signals.push(FraudSignal.RATE_SPIKE)
      riskScore += 50
    } else if (effectiveRate > 30) {
      riskScore += 15 // Elevated but not flagged
    }

    // ── Signal 2: New key high value ──────────────────────────────────────────
    if (keyCreatedAt) {
      const keyAgeMs = Date.now() - keyCreatedAt.getTime()
      const isNewKey = keyAgeMs < 24 * 60 * 60 * 1000 // <24h
      if (isNewKey && costCents > 1000) {
        reasons.push(`New key high value: key age ${Math.floor(keyAgeMs / 3600000)}h, cost ${costCents} cents (threshold: 1000)`)
        signals.push(FraudSignal.NEW_KEY_HIGH_VALUE)
        riskScore += 40
      }
    }

    // ── Signal 3: Rapid duplicate (same consumer+tool+cost in 2s) ─────────────
    const dupeKey = `fraud:dupe:${consumerId}:${toolId}:${costCents}`
    const dupeResult = await tryRedis(async () => {
      const existing = await redis.get<string>(dupeKey)
      await redis.set(dupeKey, '1', { ex: 2 })
      return existing !== null
    })

    const isDuplicate = dupeResult ?? checkMemoryDuplicate(dupeKey, 2000)

    if (isDuplicate) {
      reasons.push(`Rapid duplicate: same consumer+tool+cost within 2 seconds`)
      signals.push(FraudSignal.RAPID_DUPLICATE)
      riskScore += 30
    }

    // ── Signal 4: Multi-Window Velocity (Hourly) ──────────────────────────────
    const hourlyKey = `fraud:rate:1h:${consumerId}`
    const hourlyCount = await tryRedis(async () => {
      const pipeline = redis.pipeline()
      pipeline.incr(hourlyKey)
      pipeline.expire(hourlyKey, 3600)
      const results = await pipeline.exec()
      return (results?.[0] as number) ?? null
    })

    const effectiveHourly = hourlyCount ?? incrMemoryCount(hourlyKey, 3_600_000)

    if (effectiveHourly > 500) {
      reasons.push(`Hourly velocity: ${effectiveHourly} invocations in 1h (threshold: 500)`)
      signals.push(FraudSignal.HOURLY_VELOCITY)
      riskScore += 35
    }

    // ── Signal 5: Per-IP Velocity ─────────────────────────────────────────────
    const ipRateKey = `fraud:ip-rate:${ip}`
    const ipRateCount = await tryRedis(async () => {
      const pipeline = redis.pipeline()
      pipeline.incr(ipRateKey)
      pipeline.expire(ipRateKey, 60)
      const results = await pipeline.exec()
      return (results?.[0] as number) ?? null
    })

    const effectiveIpRate = ipRateCount ?? incrMemoryCount(ipRateKey, 60_000)

    if (effectiveIpRate > 100) {
      reasons.push(`IP velocity: ${effectiveIpRate} requests/min from ${ip} (threshold: 100)`)
      signals.push(FraudSignal.IP_VELOCITY)
      riskScore += 40
    }

    // ── Signal 6: Spending Velocity ($/hour) ──────────────────────────────────
    const spendKey = `fraud:spend:1h:${consumerId}`
    const hourlySpend = await tryRedis(async () => {
      const pipeline = redis.pipeline()
      pipeline.incrbyfloat(spendKey, costCents)
      pipeline.expire(spendKey, 3600)
      const results = await pipeline.exec()
      return (results?.[0] as number) ?? null
    })

    if (hourlySpend !== null && hourlySpend > 5000) {
      reasons.push(`Spending velocity: ${hourlySpend} cents in 1h (threshold: 5000)`)
      signals.push(FraudSignal.SPENDING_VELOCITY)
      riskScore += 35
    }

    // ── Signal 7: Key Used from Multiple IPs ──────────────────────────────────
    if (keyId) {
      const fiveMinBucket = Math.floor(Date.now() / (5 * 60 * 1000))
      const keyIpKey = `fraud:key-ips:${keyId}:${fiveMinBucket}`
      const uniqueIps = await tryRedis(async () => {
        const pipeline = redis.pipeline()
        pipeline.sadd(keyIpKey, ip)
        pipeline.scard(keyIpKey)
        pipeline.expire(keyIpKey, 300)
        const results = await pipeline.exec()
        return (results?.[1] as number) ?? null
      })

      if (uniqueIps !== null) {
        if (uniqueIps > 10) {
          reasons.push(`Multi-IP key: ${uniqueIps} unique IPs in 5min (threshold: 10)`)
          signals.push(FraudSignal.MULTI_IP_KEY)
          riskScore += 40
        } else if (uniqueIps > 5) {
          reasons.push(`Multi-IP key: ${uniqueIps} unique IPs in 5min (threshold: 5)`)
          signals.push(FraudSignal.MULTI_IP_KEY)
          riskScore += 25
        }
      }
    }

    // ── Signal 8: Dormant Key Reactivation ────────────────────────────────────
    if (keyLastUsedAt) {
      const dormantMs = Date.now() - keyLastUsedAt.getTime()
      const dormantDays = dormantMs / (24 * 60 * 60 * 1000)

      if (dormantDays > 90) {
        reasons.push(`Dormant key reactivation: ${Math.floor(dormantDays)} days inactive (threshold: 90)`)
        signals.push(FraudSignal.DORMANT_KEY)
        riskScore += 30
      } else if (dormantDays > 30 && costCents > 500) {
        reasons.push(`Dormant key reactivation: ${Math.floor(dormantDays)} days inactive + ${costCents} cents (threshold: 30d + 500c)`)
        signals.push(FraudSignal.DORMANT_KEY)
        riskScore += 25
      }
    }

    // ── Signal 9: Unusual Amount Pattern ──────────────────────────────────────
    if (costCents > 0) {
      const amountsKey = `fraud:amounts:${consumerId}:${toolId}`
      const recentAmounts = await tryRedis(async () => {
        await redis.lpush(amountsKey, costCents)
        await redis.ltrim(amountsKey, 0, 19)
        await redis.expire(amountsKey, 86400) // 24h TTL
        const amounts = await redis.lrange<number>(amountsKey, 0, 19)
        return amounts
      })

      if (recentAmounts && recentAmounts.length >= 3) {
        // Compute median of prior amounts (excluding the newly pushed value)
        const priorAmounts = recentAmounts.slice(1) // exclude the one we just pushed
        if (priorAmounts.length >= 2) {
          const sorted = [...priorAmounts].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid]

          if (median > 0 && costCents > median * 5) {
            reasons.push(`Unusual amount: ${costCents} cents is >5x median ${median} cents`)
            signals.push(FraudSignal.UNUSUAL_AMOUNT)
            riskScore += 15
          }
        }
      }
    }

    // ── Signal 10: Chargeback History ─────────────────────────────────────────
    const chargebackKey = `fraud:chargebacks:${consumerId}`
    const hasChargeback = await tryRedis(async () => {
      const val = await redis.get<string>(chargebackKey)
      return val !== null
    })

    const chargebackFlagged = hasChargeback ?? memoryChargebacks.has(consumerId)

    if (chargebackFlagged) {
      reasons.push(`Chargeback history: consumer has previous chargeback on record`)
      signals.push(FraudSignal.CHARGEBACK_HISTORY)
      riskScore += 30
    }
  } catch {
    // If fraud detection itself fails, log and allow the request through
    logger.warn('fraud.detection_error', { consumerId, toolId, costCents, ip })
    return { flagged: false, reasons: [], signals: [], riskScore: 0 }
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100)

  return {
    flagged: riskScore >= 50,
    reasons,
    signals,
    riskScore,
  }
}

// ── Signal 7 helpers: Failed Auth Tracking ──────────────────────────────────

/**
 * Track a failed authentication attempt from an IP.
 * After 5 failures within 60s, the IP is blocked for 15 minutes.
 * If a consumer email is known, sends an account-locked notification.
 */
export async function trackFailedAuth(ip: string, consumerEmail?: string): Promise<void> {
  try {
    const redis = getRedis()
    const failKey = `fraud:auth-fail:${ip}`

    const count = await tryRedis(async () => {
      const pipeline = redis.pipeline()
      pipeline.incr(failKey)
      pipeline.expire(failKey, 60)
      const results = await pipeline.exec()
      return (results?.[0] as number) ?? null
    })

    if (count !== null && count > 5) {
      const blockKey = `fraud:ip-blocked:${ip}`
      await tryRedis(async () => {
        await redis.set(blockKey, '1', { ex: 900 }) // 15 min block
      })
      logger.warn('fraud.ip_blocked', { ip, failedAttempts: count })

      // Send account-locked email if the consumer is identifiable
      if (consumerEmail) {
        const template = accountLockedEmail(
          consumerEmail,
          ip,
          `${count} failed authentication attempts in 60 seconds`
        )
        sendEmail({ to: consumerEmail, subject: template.subject, html: template.html })
          .catch(() => { /* fire-and-forget — logged inside sendEmail */ })
      }
    }
  } catch {
    logger.warn('fraud.track_failed_auth_error', { ip })
  }
}

/**
 * Check if an IP is currently blocked due to excessive failed auth attempts.
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const blockKey = `fraud:ip-blocked:${ip}`
    const result = await tryRedis(async () => {
      const val = await redis.get<string>(blockKey)
      return val !== null
    })
    return result ?? false
  } catch {
    return false
  }
}

// ── Signal 11: Chargeback Flag ──────────────────────────────────────────────

/**
 * Flag a consumer as having a chargeback. Persists in Redis indefinitely.
 */
export async function flagChargeback(consumerId: string): Promise<void> {
  try {
    const redis = getRedis()
    const key = `fraud:chargebacks:${consumerId}`
    await tryRedis(async () => {
      await redis.set(key, '1') // no expiry — permanent flag
    })
    memoryChargebacks.add(consumerId)
    logger.info('fraud.chargeback_flagged', { consumerId })
  } catch {
    // Fallback: at least keep in memory
    memoryChargebacks.add(consumerId)
    logger.warn('fraud.chargeback_flag_error', { consumerId })
  }
}

/**
 * Check if a consumer has any chargeback history.
 */
export async function hasChargebackHistory(consumerId: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const key = `fraud:chargebacks:${consumerId}`
    const result = await tryRedis(async () => {
      const val = await redis.get<string>(key)
      return val !== null
    })
    return result ?? memoryChargebacks.has(consumerId)
  } catch {
    return memoryChargebacks.has(consumerId)
  }
}

// ── Signal 12: Session Nesting Depth ────────────────────────────────────────

export interface SessionDepthResult {
  allowed: boolean
  depth: number
  riskScore: number
  signal?: FraudSignal
  reason?: string
}

/**
 * Check the nesting depth of a session. Depth >5 is rejected outright;
 * depth >3 adds risk score.
 */
export async function checkSessionDepth(sessionId: string): Promise<SessionDepthResult> {
  try {
    const redis = getRedis()
    const depthKey = `fraud:session-depth:${sessionId}`

    const depth = await tryRedis(async () => {
      const pipeline = redis.pipeline()
      pipeline.incr(depthKey)
      pipeline.expire(depthKey, 3600)
      const results = await pipeline.exec()
      return (results?.[0] as number) ?? null
    })

    const effectiveDepth = depth ?? (memorySessionDepths.get(sessionId) ?? 0) + 1
    if (depth === null) {
      memorySessionDepths.set(sessionId, effectiveDepth)
    }

    if (effectiveDepth > 5) {
      return {
        allowed: false,
        depth: effectiveDepth,
        riskScore: 100,
        signal: FraudSignal.SESSION_NESTING,
        reason: `Session nesting depth ${effectiveDepth} exceeds maximum (5)`,
      }
    }

    if (effectiveDepth > 3) {
      return {
        allowed: true,
        depth: effectiveDepth,
        riskScore: 15,
        signal: FraudSignal.SESSION_NESTING,
        reason: `Session nesting depth ${effectiveDepth} is elevated (threshold: 3)`,
      }
    }

    return { allowed: true, depth: effectiveDepth, riskScore: 0 }
  } catch {
    return { allowed: true, depth: 0, riskScore: 0 }
  }
}

/**
 * Clean up stale in-memory entries (call periodically or on timer).
 * Prevents unbounded memory growth.
 */
export function cleanupMemoryCounters(): void {
  const now = Date.now()
  for (const [key, entry] of memoryCounters) {
    if (entry.resetAt <= now) memoryCounters.delete(key)
  }
  // Duplicates older than 10s are safe to prune
  for (const [key, ts] of memoryDuplicates) {
    if (now - ts > 10_000) memoryDuplicates.delete(key)
  }
}
