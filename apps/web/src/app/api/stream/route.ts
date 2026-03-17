/**
 * GET /api/stream — Real-time cost streaming via Server-Sent Events (SSE).
 *
 * Streams session budget updates to connected clients. Events:
 * - session.state: Initial snapshot of budget/spent/reserved
 * - balance.updated: Emitted when spend changes
 * - budget.warning: Emitted when spend exceeds 80% of budget
 * - budget.exceeded: Emitted when spend exceeds budget
 *
 * Auth: API key in query param (?apiKey=...) or x-api-key header.
 * Query: ?sessionId=... (required)
 */

import { NextRequest } from 'next/server'
import { getRedis, tryRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const maxDuration = 300 // 5 minutes max for streaming
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  // Auth via API key
  const apiKey =
    req.nextUrl.searchParams.get('apiKey') ??
    req.headers.get('x-api-key')

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'API key required', code: 'AUTH_REQUIRED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Get session ID from query
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'sessionId query parameter required', code: 'MISSING_SESSION_ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const redis = getRedis()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let running = true

      // Send initial state
      const budget = await tryRedis(() => redis.get<number>(`session:budget:${sessionId}`))
      const spent = await tryRedis(() => redis.get<number>(`session:spent:${sessionId}`))
      const reserved = await tryRedis(() => redis.get<number>(`session:reserved:${sessionId}`))

      const budgetVal = budget ?? 0
      const spentVal = spent ?? 0
      const reservedVal = reserved ?? 0

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'session.state',
            sessionId,
            budgetCents: budgetVal,
            spentCents: spentVal,
            reservedCents: reservedVal,
            remainingCents: budgetVal - spentVal - reservedVal,
            timestamp: new Date().toISOString(),
          })}\n\n`
        )
      )

      let lastSpent = spentVal
      let warningEmitted = false

      // Poll for updates every second
      const intervalId = setInterval(async () => {
        if (!running) return

        try {
          const currentSpent = await tryRedis(() =>
            redis.get<number>(`session:spent:${sessionId}`)
          )
          const currentReserved = await tryRedis(() =>
            redis.get<number>(`session:reserved:${sessionId}`)
          )

          const spent = currentSpent ?? 0
          const reserved = currentReserved ?? 0
          const remaining = budgetVal - spent - reserved

          // Emit balance update if spend changed
          if (spent !== lastSpent) {
            lastSpent = spent
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'balance.updated',
                  sessionId,
                  spentCents: spent,
                  reservedCents: reserved,
                  remainingCents: remaining,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              )
            )
          }

          // Budget warning at 80%
          if (budgetVal > 0 && spent / budgetVal > 0.8 && !warningEmitted) {
            warningEmitted = true
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'budget.warning',
                  sessionId,
                  percentUsed: Math.round((spent / budgetVal) * 100),
                  remainingCents: remaining,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              )
            )
          }

          // Budget exceeded
          if (budgetVal > 0 && spent >= budgetVal) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'budget.exceeded',
                  sessionId,
                  spentCents: spent,
                  budgetCents: budgetVal,
                  overageCents: spent - budgetVal,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              )
            )
          }

          // Heartbeat
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch (err) {
          logger.error('stream.poll_error', { sessionId }, err)
          running = false
          clearInterval(intervalId)
          controller.close()
        }
      }, 1000)

      // Cleanup on abort
      req.signal.addEventListener('abort', () => {
        running = false
        clearInterval(intervalId)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
