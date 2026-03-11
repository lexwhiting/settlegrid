import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const components: Record<string, { status: string; latencyMs?: number }> = {}
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

  // Check database connectivity
  const dbStart = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    components.database = { status: 'healthy', latencyMs: Date.now() - dbStart }
  } catch {
    components.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart }
    overallStatus = 'unhealthy'
  }

  // Check Redis (Upstash) connectivity
  const redisStart = Date.now()
  try {
    const redisUrl = process.env.REDIS_URL
    if (redisUrl) {
      // Simple ping via REST API (Upstash pattern)
      const res = await fetch(`${redisUrl}/ping`, {
        headers: { Authorization: `Bearer ${process.env.REDIS_TOKEN ?? ''}` },
        signal: AbortSignal.timeout(3000),
      })
      components.redis = {
        status: res.ok ? 'healthy' : 'degraded',
        latencyMs: Date.now() - redisStart,
      }
      if (!res.ok && overallStatus === 'healthy') overallStatus = 'degraded'
    } else {
      components.redis = { status: 'not_configured' }
    }
  } catch {
    components.redis = { status: 'unhealthy', latencyMs: Date.now() - redisStart }
    if (overallStatus === 'healthy') overallStatus = 'degraded'
  }

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components,
    },
    { status: statusCode }
  )
}
