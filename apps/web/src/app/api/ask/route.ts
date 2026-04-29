import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, desc, ilike, or, type SQL } from 'drizzle-orm'
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

/** Strips HTML tags to prevent XSS in reflected responses. */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

const askSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Question is required')
    .max(500, 'Question too long')
    .transform(stripHtml),
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

// ─── Tool Type Detection ──────────────────────────────────────────────────────

/** Human-readable labels for each tool type. */
const TOOL_TYPE_LABELS: Record<string, string> = {
  'mcp-server': 'MCP Server',
  'ai-model': 'AI Model',
  'rest-api': 'REST API',
  'agent-tool': 'Agent Tool',
  automation: 'Automation',
  extension: 'Extension',
  dataset: 'Dataset',
  'sdk-package': 'SDK Package',
}

/**
 * Maps question keywords to preferred tool types.
 * If the question mentions a specific tool type, we prefer that type in results.
 */
const TOOL_TYPE_KEYWORDS: Record<string, { keywords: string[]; toolType: string }> = {
  'ai-model': {
    keywords: ['ai model', 'inference', 'llm', 'gpt', 'claude', 'language model', 'embedding', 'text generation', 'image generation model', 'stable diffusion', 'whisper'],
    toolType: 'ai-model',
  },
  'rest-api': {
    keywords: ['rest api', 'api endpoint', 'http api', 'web api', 'json api', 'graphql'],
    toolType: 'rest-api',
  },
  'agent-tool': {
    keywords: ['agent tool', 'langchain', 'crewai', 'autogen', 'agent framework', 'tool calling', 'function calling'],
    toolType: 'agent-tool',
  },
  automation: {
    keywords: ['automation', 'workflow', 'zapier', 'n8n', 'trigger', 'cron job', 'scheduled task', 'pipeline'],
    toolType: 'automation',
  },
  extension: {
    keywords: ['extension', 'plugin', 'addon', 'browser extension', 'vscode extension', 'ide plugin'],
    toolType: 'extension',
  },
  dataset: {
    keywords: ['dataset', 'training data', 'data download', 'csv data', 'parquet', 'huggingface dataset', 'benchmark data'],
    toolType: 'dataset',
  },
  'sdk-package': {
    keywords: ['sdk', 'package', 'npm package', 'pip package', 'library', 'npm install', 'pip install', 'client library'],
    toolType: 'sdk-package',
  },
  'mcp-server': {
    keywords: ['mcp server', 'mcp tool', 'model context protocol', 'mcp'],
    toolType: 'mcp-server',
  },
}

/**
 * Detects if a question implies a specific tool type.
 * Returns the best matching tool type slug or null for any type.
 */
function detectToolType(question: string): string | null {
  const lower = question.toLowerCase()
  let bestType: string | null = null
  let bestScore = 0

  for (const { keywords, toolType } of Object.values(TOOL_TYPE_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += keyword.length
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestType = toolType
    }
  }

  return bestType
}

// ─── Category Routing (adapted from GridBot) ─────────────────────────────────

/** Maps question keywords to tool categories and expanded search terms. */
const CATEGORY_KEYWORDS: Record<string, { keywords: string[]; searchTerms: string[] }> = {
  data: {
    keywords: ['weather', 'temperature', 'forecast', 'climate', 'meteorology', 'api', 'database', 'feed', 'geolocation', 'location', 'ip address', 'dns', 'lookup'],
    searchTerms: ['data', 'api', 'weather', 'feed', 'lookup', 'geolocation'],
  },
  nlp: {
    keywords: ['translate', 'translation', 'sentiment', 'summarize', 'summary', 'text', 'language', 'grammar', 'spell', 'entity', 'extract text', 'paraphrase'],
    searchTerms: ['text', 'analysis', 'nlp', 'language', 'sentiment', 'translate'],
  },
  image: {
    keywords: ['image', 'photo', 'picture', 'generate image', 'ocr', 'vision', 'detect object', 'visual', 'sunset', 'mountains', 'illustration', 'draw', 'painting', 'art', 'avatar', 'thumbnail'],
    searchTerms: ['image', 'generation', 'vision', 'photo', 'visual', 'picture'],
  },
  media: {
    keywords: ['audio', 'video', 'music', 'podcast', 'transcribe', 'speech', 'voice', 'sound', 'mp3', 'mp4', 'stream'],
    searchTerms: ['media', 'audio', 'video', 'transcription', 'speech'],
  },
  code: {
    keywords: ['code', 'lint', 'bug', 'review', 'format', 'compile', 'debug', 'analyze code', 'python', 'javascript', 'sandbox', 'programming', 'developer', 'software', 'repository', 'github'],
    searchTerms: ['code', 'analysis', 'lint', 'security', 'developer', 'programming'],
  },
  search: {
    keywords: ['search', 'find', 'lookup', 'discover', 'paper', 'research', 'document', 'arxiv', 'scholar'],
    searchTerms: ['search', 'retrieval', 'find', 'discover'],
  },
  finance: {
    keywords: ['stock', 'market', 'currency', 'exchange', 'forex', 'usd', 'eur', 'gbp', 'jpy', 'btc', 'crypto', 'trading', 'financial', 'money', 'payment', 'invoice', 'price', 'convert usd', 'convert eur', 'convert gbp', 'convert currency'],
    searchTerms: ['finance', 'market', 'currency', 'exchange', 'forex', 'trading'],
  },
  science: {
    keywords: ['molecule', 'chemical', 'physics', 'biology', 'genome', 'protein', 'scientific', 'experiment', 'lab', 'formula'],
    searchTerms: ['science', 'research', 'molecular', 'computation'],
  },
  security: {
    keywords: ['ssl', 'certificate', 'threat', 'scan', 'vulnerability', 'malware', 'phishing', 'compliance', 'firewall', 'penetration'],
    searchTerms: ['security', 'scanning', 'threat', 'vulnerability'],
  },
  utility: {
    keywords: ['convert', 'encode', 'decode', 'hash', 'validate', 'uuid', 'base64', 'json', 'csv', 'qr code', 'checksum'],
    searchTerms: ['utility', 'conversion', 'encode', 'format', 'validate'],
  },
  analytics: {
    keywords: ['analytics', 'metrics', 'dashboard', 'report', 'trend', 'statistics', 'insight', 'chart', 'graph'],
    searchTerms: ['analytics', 'reporting', 'metrics', 'dashboard'],
  },
  'llm-inference': {
    keywords: ['gpt', 'gpt-4', 'inference', 'llm', 'prompt', 'completion', 'token', 'openai', 'anthropic', 'claude', 'cost to run'],
    searchTerms: ['llm', 'inference', 'ai', 'model'],
  },
  scraping: {
    keywords: ['scrape', 'scraping', 'crawl', 'extract', 'pricing page', 'webpage', 'browser', 'playwright'],
    searchTerms: ['scraping', 'browser', 'automation', 'crawl'],
  },
  communication: {
    keywords: ['email', 'sms', 'notification', 'message', 'chat', 'slack', 'webhook'],
    searchTerms: ['email', 'messaging', 'notification', 'communication'],
  },
  productivity: {
    keywords: ['calendar', 'task', 'schedule', 'workflow', 'automation', 'document', 'spreadsheet'],
    searchTerms: ['productivity', 'task', 'workflow', 'automation'],
  },
}

/** Stop words to exclude from keyword extraction. */
const STOP_WORDS = new Set([
  'what', 'whats', "what's", 'how', 'does', 'have', 'this', 'that', 'with',
  'from', 'about', 'there', 'their', 'some', 'most', 'latest', 'check',
  'can', 'the', 'for', 'and', 'but', 'not', 'you', 'all', 'are', 'was',
  'were', 'been', 'being', 'has', 'had', 'having', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'into', 'than', 'then', 'when', 'where',
  'which', 'who', 'whom', 'whose', 'why', 'any', 'each', 'every', 'both',
  'few', 'more', 'other', 'such', 'only', 'just', 'also', 'very', 'really',
  'please', 'help', 'want', 'need', 'like', 'tell', 'show', 'give', 'get',
])

/**
 * Maps a natural-language question to a tool category and search terms.
 * Uses keyword matching (longer keyword matches score higher) adapted
 * from GridBot's proven categorizeQuestion() logic.
 */
function categorizeQuestion(question: string): {
  category: string | null
  searchTerms: string[]
  questionKeywords: string[]
} {
  const lower = question.toLowerCase()

  // Detect best category via keyword scoring
  let bestCategory: string | null = null
  let bestScore = 0
  let bestSearchTerms: string[] = []

  for (const [category, { keywords, searchTerms }] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        // Longer keyword matches are more specific and score higher
        score += keyword.length
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
      bestSearchTerms = searchTerms
    }
  }

  // Extract meaningful words from the question for text search
  const questionKeywords = question
    .replace(/[?!.,;:'"()]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w.toLowerCase())
    .slice(0, 6)

  return { category: bestCategory, searchTerms: bestSearchTerms, questionKeywords }
}

type ToolRow = {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  toolType: string
  tags: unknown
  pricingConfig: unknown
  totalInvocations: number
}

const TOOL_SELECT = {
  id: tools.id,
  name: tools.name,
  slug: tools.slug,
  description: tools.description,
  category: tools.category,
  toolType: tools.toolType,
  tags: tools.tags,
  pricingConfig: tools.pricingConfig,
  totalInvocations: tools.totalInvocations,
} as const

/**
 * Scores a tool against a set of search terms and question keywords.
 * Uses weighted matching: name > tags > description > category > toolType.
 * When a preferred tool type is specified, tools of that type get a bonus.
 */
function scoreTool(
  tool: ToolRow,
  searchTerms: string[],
  questionKeywords: string[],
  preferredToolType?: string | null,
): number {
  const nameLower = (tool.name ?? '').toLowerCase()
  const descLower = (tool.description ?? '').toLowerCase()
  const catLower = (tool.category ?? '').toLowerCase()
  const tagValues: string[] = Array.isArray(tool.tags)
    ? (tool.tags as string[]).map((t) => t.toLowerCase())
    : []

  let score = 0
  const allTerms = new Set([...searchTerms, ...questionKeywords])

  for (const term of allTerms) {
    if (term.length < 2) continue
    // Name match is strongest signal
    if (nameLower.includes(term)) score += 5
    // Tag match is strong — tags are curated relevance signals
    if (tagValues.some((t) => t.includes(term))) score += 4
    // Description match
    if (descLower.includes(term)) score += 2
    // Category match
    if (catLower.includes(term)) score += 1
  }

  // Tool type preference bonus — matches the detected type from the question
  if (preferredToolType && tool.toolType === preferredToolType) {
    score += 3
  }

  // Small popularity tiebreaker (max +1 point, never enough to override relevance)
  score += Math.min(tool.totalInvocations / 10000, 1)

  return score
}

/** Minimum relevance score to consider a match valid. */
const MIN_MATCH_SCORE = 3

/**
 * POST /api/ask — Public "Ask SettleGrid" endpoint
 *
 * Accepts a question, discovers a relevant tool, and returns an answer
 * with attribution. Rate limited to 3 questions/day per IP.
 * Uses system credits with a daily budget cap.
 *
 * Matching strategy (category-first, with expanded keyword fallback):
 * 1. Categorize the question using keyword detection
 * 2. Query tools filtered to that category, score them
 * 3. If no category or no results, query broadly with text search
 * 4. If still no relevant match, return "no tools found" (never a random tool)
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

    const { category, searchTerms, questionKeywords } = categorizeQuestion(body.question)
    const preferredToolType = detectToolType(body.question)

    logger.info('ask.categorized', {
      question: body.question,
      category,
      preferredToolType,
      searchTerms,
      questionKeywords,
    })

    // ── Step 1: Category-filtered search (all tool types) ─────────────────
    let bestTool: ToolRow | null = null

    if (category) {
      // Search across all tool types within the category
      const conditions = [eq(tools.status, 'active'), eq(tools.category, category)]

      // If user's question implies a specific tool type, also try filtering by it
      if (preferredToolType) {
        const typedTools = await db
          .select(TOOL_SELECT)
          .from(tools)
          .where(and(...conditions, eq(tools.toolType, preferredToolType)))
          .orderBy(desc(tools.totalInvocations))
          .limit(20)

        if (typedTools.length > 0) {
          let bestScore = 0
          for (const tool of typedTools) {
            const score = scoreTool(tool, searchTerms, questionKeywords, preferredToolType)
            if (score > bestScore) {
              bestScore = score
              bestTool = tool
            }
          }
          if (bestScore < MIN_MATCH_SCORE) {
            bestTool = null
          }
        }
      }

      // Fall back to all tool types in the category
      if (!bestTool) {
        const categoryTools = await db
          .select(TOOL_SELECT)
          .from(tools)
          .where(and(...conditions))
          .orderBy(desc(tools.totalInvocations))
          .limit(20)

        if (categoryTools.length > 0) {
          let bestScore = 0
          for (const tool of categoryTools) {
            const score = scoreTool(tool, searchTerms, questionKeywords, preferredToolType)
            if (score > bestScore) {
              bestScore = score
              bestTool = tool
            }
          }
          if (bestScore < MIN_MATCH_SCORE) {
            bestTool = null
          }
        }
      }
    }

    // ── Step 2: Broad text-search fallback (all tool types) ───────────────
    if (!bestTool) {
      // Build ilike conditions from question keywords and search terms
      const searchWords = [...new Set([...searchTerms, ...questionKeywords])].filter(
        (w) => w.length >= 3,
      )

      let broadTools: ToolRow[]

      if (searchWords.length > 0) {
        // Build OR conditions: any keyword matching name, description, or slug
        // Escape SQL LIKE wildcards to prevent pattern injection from user input
        const textConditions: SQL[] = searchWords.flatMap((word) => {
          const escaped = word.replace(/[%_\\]/g, '\\$&')
          const pattern = `%${escaped}%`
          return [
            ilike(tools.name, pattern),
            ilike(tools.description, pattern),
            ilike(tools.slug, pattern),
          ]
        })

        broadTools = await db
          .select(TOOL_SELECT)
          .from(tools)
          .where(and(eq(tools.status, 'active'), or(...textConditions)!))
          .orderBy(desc(tools.totalInvocations))
          .limit(20)
      } else {
        // No usable keywords — fetch popular tools as candidates
        broadTools = await db
          .select(TOOL_SELECT)
          .from(tools)
          .where(eq(tools.status, 'active'))
          .orderBy(desc(tools.totalInvocations))
          .limit(20)
      }

      if (broadTools.length > 0) {
        let bestScore = 0
        for (const tool of broadTools) {
          const score = scoreTool(tool, searchTerms, questionKeywords, preferredToolType)
          if (score > bestScore) {
            bestScore = score
            bestTool = tool
          }
        }
        if (bestScore < MIN_MATCH_SCORE) {
          bestTool = null
        }
      }
    }

    // ── Step 3: No match — return helpful message instead of wrong tool ──
    if (!bestTool) {
      logger.info('ask.no_match', {
        ip,
        question: body.question,
        category,
        remaining: rl.remaining,
      })

      return NextResponse.json({
        answer: [
          `I couldn't find a tool on SettleGrid that matches your question.`,
          '',
          `Try browsing our categories at settlegrid.ai/explore or rephrasing your question with more specific terms.`,
        ].join('\n'),
        toolName: null,
        toolSlug: null,
        costDisplay: 'free',
        remaining: rl.remaining,
      })
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
    const toolTypeLabel = TOOL_TYPE_LABELS[bestTool.toolType] ?? bestTool.toolType
    const answer = [
      `Based on your question, I found a relevant ${toolTypeLabel} on SettleGrid:`,
      '',
      `**${bestTool.name}**${bestTool.description ? ` - ${bestTool.description}` : ''}`,
      '',
      `Type: ${toolTypeLabel}`,
      `Category: ${bestTool.category ?? 'General'}`,
      `Price: ${formatCostDisplay(costCents)} per call`,
      `Usage: ${bestTool.totalInvocations.toLocaleString()} total calls`,
      '',
      `You can try this tool directly at settlegrid.ai/tools/${bestTool.slug}`,
    ].join('\n')

    logger.info('ask.answered', {
      ip,
      toolSlug: bestTool.slug,
      toolType: bestTool.toolType,
      category,
      costCents,
      remaining: rl.remaining,
    })

    return NextResponse.json({
      answer,
      toolName: bestTool.name,
      toolSlug: bestTool.slug,
      toolType: bestTool.toolType,
      toolTypeLabel,
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
