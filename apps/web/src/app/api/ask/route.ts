import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { createRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 30

/** 3 requests per day per IP — budget-controlled public demo */
const askLimiter = createRateLimiter(3, '1 d')

/** Daily budget in cents (default $1/day = 100 cents) */
const DEMO_BUDGET_CENTS_PER_DAY = Number(process.env.DEMO_BUDGET_CENTS_PER_DAY) || 100

// Simple in-memory daily budget tracker (resets on deploy/restart)
let dailySpendCents = 0
let budgetResetDate = new Date().toISOString().slice(0, 10)

function checkAndDeductBudget(costCents: number): boolean {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== budgetResetDate) {
    dailySpendCents = 0
    budgetResetDate = today
  }
  if (dailySpendCents + costCents > DEMO_BUDGET_CENTS_PER_DAY) {
    return false
  }
  dailySpendCents += costCents
  return true
}

const askSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(500, 'Question too long'),
})

function getEffectiveCost(pricingConfig: unknown): number {
  if (!pricingConfig || typeof pricingConfig !== 'object') return 0
  const config = pricingConfig as Record<string, unknown>
  const cost = config.defaultCostCents
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) return Math.floor(cost)
  return 0
}

function formatCostDisplay(cents: number): string {
  if (cents === 0) return 'free'
  return cents < 100 ? `$0.${String(cents).padStart(2, '0')}` : `$${(cents / 100).toFixed(2)}`
}

/**
 * POST /api/ask — Public "Ask SettleGrid" endpoint
 *
 * Accepts a question, discovers a relevant tool, and returns an answer
 * with attribution. Rate limited to 3 questions/day per IP.
 * Uses system credits with a daily budget cap.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Rate limit by IP
    const rl = await checkRateLimit(askLimiter, `ask:${ip}`)
    if (!rl.success) {
      return NextResponse.json(
        {
          error: 'You have used all your free questions for today. Come back tomorrow!',
          remaining: 0,
        },
        { status: 429 }
      )
    }

    // Parse the question
    let body: z.infer<typeof askSchema>
    try {
      const raw = await request.json()
      body = askSchema.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'Invalid request. Provide a question.' },
        { status: 400 }
      )
    }

    // Discover a relevant tool — search for active tools that might match the question
    const matchingTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        pricingConfig: tools.pricingConfig,
        totalInvocations: tools.totalInvocations,
      })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .orderBy(desc(tools.totalInvocations))
      .limit(10)

    if (matchingTools.length === 0) {
      return NextResponse.json(
        {
          error: 'No tools available right now. Check back soon!',
          remaining: rl.remaining,
        },
        { status: 503 }
      )
    }

    // Simple keyword matching — find the best tool based on question content
    const questionLower = body.question.toLowerCase()
    let bestTool = matchingTools[0]
    let bestScore = 0

    for (const tool of matchingTools) {
      let score = 0
      const nameLower = (tool.name ?? '').toLowerCase()
      const descLower = (tool.description ?? '').toLowerCase()
      const catLower = (tool.category ?? '').toLowerCase()

      // Score based on keyword overlap
      const words = questionLower.split(/\s+/)
      for (const word of words) {
        if (word.length < 3) continue
        if (nameLower.includes(word)) score += 3
        if (descLower.includes(word)) score += 2
        if (catLower.includes(word)) score += 1
      }

      // Boost popular tools slightly
      score += Math.min(tool.totalInvocations / 1000, 2)

      if (score > bestScore) {
        bestScore = score
        bestTool = tool
      }
    }

    const costCents = getEffectiveCost(bestTool.pricingConfig)

    // Check budget
    if (!checkAndDeductBudget(costCents)) {
      return NextResponse.json(
        {
          error: 'Demo budget exhausted for today. Come back tomorrow!',
          remaining: rl.remaining,
        },
        { status: 503 }
      )
    }

    // Build a helpful response using the tool's information
    const answer = [
      `Based on your question, I found a relevant tool on SettleGrid:`,
      '',
      `**${bestTool.name}**${bestTool.description ? ` - ${bestTool.description}` : ''}`,
      '',
      `Category: ${bestTool.category ?? 'General'}`,
      `Price: ${formatCostDisplay(costCents)} per call`,
      `Usage: ${bestTool.totalInvocations.toLocaleString()} total calls`,
      '',
      `You can try this tool directly at settlegrid.ai/tools/${bestTool.slug}`,
    ].join('\n')

    logger.info('ask.answered', {
      ip,
      toolSlug: bestTool.slug,
      costCents,
      remaining: rl.remaining,
    })

    return NextResponse.json({
      answer,
      toolName: bestTool.name,
      toolSlug: bestTool.slug,
      costDisplay: formatCostDisplay(costCents),
      remaining: rl.remaining,
    })
  } catch (error) {
    logger.error('ask.error', {}, error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
