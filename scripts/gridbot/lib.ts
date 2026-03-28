/**
 * GridBot Shared Library
 *
 * Production-ready utilities for discovering, selecting, and invoking
 * tools on the SettleGrid marketplace. Unlike the demo agents (which
 * simulate calls), GridBot makes REAL paid invocations via the Smart Proxy.
 */

import fs from 'fs'
import path from 'path'

// ─── Configuration ───────────────────────────────────────────────────────────

const BASE_URL = process.env.SETTLEGRID_URL ?? 'https://settlegrid.ai'
const API_KEY = process.env.SETTLEGRID_API_KEY ?? ''
const REQUEST_TIMEOUT_MS = 15_000
const STATE_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), 'state.json')
const LOG_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'logs')

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PricingConfig {
  defaultCostCents: number
  methods?: Record<string, number>
}

export interface DiscoveredTool {
  name: string
  slug: string
  description: string | null
  category: string | null
  tags: string[]
  version: string
  pricing: PricingConfig | null
  costCents: number | null
  invocations: number
  verified: boolean
  averageRating: number
  developer: string
  developerSlug: string | null
  url: string
  developerUrl: string | null
}

export interface DiscoveryResponse {
  data: {
    tools: DiscoveredTool[]
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface ProxyResult {
  ok: boolean
  status: number
  costCents: number
  latencyMs: number
  data: unknown
  error?: string
}

export interface TransactionLog {
  timestamp: string
  question: string
  category: string | null
  toolSlug: string | null
  toolName: string | null
  costCents: number
  latencyMs: number
  status: 'success' | 'error' | 'no_tools' | 'budget_exceeded' | 'skipped'
  error?: string
  response?: unknown
}

interface BudgetState {
  date: string // YYYY-MM-DD in UTC
  spentCents: number
  invocations: number
}

// ─── Category Routing ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, { keywords: string[]; searchTerms: string }> = {
  data: {
    keywords: ['weather', 'temperature', 'forecast', 'climate', 'api', 'database', 'feed', 'geolocation', 'location', 'ip', 'dns'],
    searchTerms: 'data API',
  },
  nlp: {
    keywords: ['translate', 'translation', 'sentiment', 'summarize', 'summary', 'text', 'language', 'grammar', 'spell', 'entity'],
    searchTerms: 'text analysis NLP',
  },
  image: {
    keywords: ['image', 'photo', 'picture', 'generate image', 'ocr', 'vision', 'detect object', 'visual', 'sunset', 'mountains', 'illustration'],
    searchTerms: 'image generation vision',
  },
  code: {
    keywords: ['code', 'lint', 'security', 'vulnerability', 'bug', 'review', 'format', 'compile', 'debug', 'analyze code', 'python', 'javascript', 'sandbox'],
    searchTerms: 'code analysis security',
  },
  search: {
    keywords: ['search', 'find', 'lookup', 'discover', 'paper', 'research', 'document', 'arxiv', 'scholar'],
    searchTerms: 'search retrieval',
  },
  finance: {
    keywords: ['stock', 'market', 'price', 'currency', 'exchange', 'convert', 'usd', 'eur', 'btc', 'crypto', 'trading', 'financial'],
    searchTerms: 'finance market data',
  },
  science: {
    keywords: ['molecule', 'chemical', 'physics', 'biology', 'genome', 'protein', 'scientific', 'experiment'],
    searchTerms: 'science research',
  },
  security: {
    keywords: ['ssl', 'certificate', 'threat', 'scan', 'vulnerability', 'malware', 'phishing', 'compliance'],
    searchTerms: 'security scanning',
  },
  utility: {
    keywords: ['convert', 'encode', 'decode', 'hash', 'validate', 'format', 'uuid', 'base64', 'json', 'csv'],
    searchTerms: 'utility conversion',
  },
  analytics: {
    keywords: ['analytics', 'metrics', 'dashboard', 'report', 'trend', 'statistics', 'insight'],
    searchTerms: 'analytics reporting',
  },
  'ai-inference': {
    keywords: ['gpt', 'gpt-4', 'inference', 'llm', 'prompt', 'completion', 'token', 'openai', 'anthropic', 'claude', 'cost to run'],
    searchTerms: 'LLM inference AI',
  },
  scraping: {
    keywords: ['scrape', 'scraping', 'crawl', 'extract', 'pricing page', 'webpage', 'browser', 'playwright'],
    searchTerms: 'web scraping browser automation',
  },
  crypto: {
    keywords: ['bitcoin', 'lightning', 'l402', 'macaroon', 'satoshi', 'micropayment', 'drain', 'voucher', 'usdc', 'polygon', 'eip-712', 'channel', 'off-chain'],
    searchTerms: 'crypto Lightning L402 micropayment',
  },
}

/**
 * Maps a natural language question to a tool category and search query.
 * Returns the best matching category or null for a broad search.
 */
export function categorizeQuestion(question: string): { category: string | null; searchQuery: string } {
  const lower = question.toLowerCase()

  let bestCategory: string | null = null
  let bestScore = 0
  let searchTerms = ''

  for (const [category, { keywords, searchTerms: terms }] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += keyword.length // longer keyword matches score higher
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
      searchTerms = terms
    }
  }

  // Extract meaningful words from the question for the search query
  const questionWords = question
    .replace(/[?!.,;:'"()]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['what', 'whats', "what's", 'how', 'does', 'have', 'this', 'that', 'with', 'from', 'about', 'there', 'their', 'some', 'most', 'latest', 'check'].includes(w.toLowerCase()))
    .slice(0, 4)

  const searchQuery = bestCategory
    ? `${searchTerms} ${questionWords.join(' ')}`.trim()
    : questionWords.join(' ') || 'tools'

  return { category: bestCategory, searchQuery }
}

// ─── API Calls ───────────────────────────────────────────────────────────────

/**
 * Fetch with timeout and standard headers.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GridBot/1.0 (settlegrid.ai)',
        ...options.headers,
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Discovers tools via the public SettleGrid Discovery API.
 *
 * @param query    - Free-text search (matched against name, description, slug)
 * @param category - Optional category filter slug
 * @param limit    - Max results (1-100, default 20)
 * @param maxCost  - Optional max cost in cents
 */
export async function discoverTools(
  query: string,
  category?: string,
  limit = 20,
  maxCost?: number,
): Promise<DiscoveredTool[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort: 'popular',
  })
  if (category) params.set('category', category)
  if (maxCost !== undefined) params.set('max_cost', String(maxCost))

  const url = `${BASE_URL}/api/v1/discover?${params}`

  try {
    const res = await fetchWithTimeout(url)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      log('discover', `HTTP ${res.status}: ${body.slice(0, 200)}`, 'warn')
      return []
    }

    const json = (await res.json()) as DiscoveryResponse
    const tools = json.data?.tools ?? []
    log('discover', `Found ${tools.length} tool(s) for "${query}"${category ? ` [${category}]` : ''}`)
    return tools
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('discover', `Request failed: ${message}`, 'error')
    return []
  }
}

/**
 * Calls a tool via the SettleGrid Smart Proxy.
 * This makes a REAL paid invocation — the consumer balance is charged.
 */
export async function callToolViaProxy(
  slug: string,
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<ProxyResult> {
  const url = `${BASE_URL}/api/proxy/${encodeURIComponent(slug)}`
  const start = Date.now()

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })

    const latencyMs = Date.now() - start
    const costHeader = res.headers.get('X-SettleGrid-Cost-Cents')
    const costCents = costHeader ? parseInt(costHeader, 10) : 0

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '')
      let errorData: unknown
      try {
        errorData = JSON.parse(errorBody)
      } catch {
        errorData = errorBody
      }

      return {
        ok: false,
        status: res.status,
        costCents,
        latencyMs,
        data: null,
        error: res.status === 402
          ? 'Insufficient credits'
          : res.status === 401
            ? 'Invalid or missing API key'
            : res.status === 429
              ? 'Rate limited'
              : `HTTP ${res.status}: ${typeof errorData === 'string' ? errorData.slice(0, 200) : JSON.stringify(errorData).slice(0, 200)}`,
      }
    }

    let data: unknown
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      data = await res.json()
    } else {
      data = await res.text()
    }

    return {
      ok: true,
      status: res.status,
      costCents,
      latencyMs,
      data,
    }
  } catch (err) {
    const latencyMs = Date.now() - start
    const message = err instanceof Error ? err.message : String(err)

    return {
      ok: false,
      status: 0,
      costCents: 0,
      latencyMs,
      data: null,
      error: message.includes('AbortError') || message.includes('aborted')
        ? 'Request timed out (15s)'
        : `Network error: ${message}`,
    }
  }
}

// ─── Tool Selection ──────────────────────────────────────────────────────────

/**
 * Selects the best tool from a list, preferring:
 * 1. Within budget
 * 2. Highest invocation count (proxy for quality/reliability)
 * 3. Lowest cost (to preserve budget)
 *
 * Returns null if no tools are available.
 */
export function selectBestTool(
  tools: DiscoveredTool[],
  remainingBudgetCents: number,
): DiscoveredTool | null {
  if (tools.length === 0) return null

  // Filter to tools within budget
  const affordable = tools.filter((t) => {
    const cost = t.costCents ?? t.pricing?.defaultCostCents ?? 0
    return cost <= remainingBudgetCents
  })

  if (affordable.length === 0) {
    log('select', `No tools within budget ($${(remainingBudgetCents / 100).toFixed(2)} remaining)`, 'warn')
    return null
  }

  // Sort: most invocations first, then cheapest
  affordable.sort((a, b) => {
    // Primary: invocations (higher is better)
    if (b.invocations !== a.invocations) return b.invocations - a.invocations
    // Secondary: cost (lower is better)
    const aCost = a.costCents ?? a.pricing?.defaultCostCents ?? 0
    const bCost = b.costCents ?? b.pricing?.defaultCostCents ?? 0
    return aCost - bCost
  })

  return affordable[0]
}

// ─── Budget Tracking ─────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadState(): BudgetState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8')
      const state = JSON.parse(raw) as BudgetState
      // Reset if it is a new day
      if (state.date !== todayUTC()) {
        return { date: todayUTC(), spentCents: 0, invocations: 0 }
      }
      return state
    }
  } catch {
    // Corrupted state file, reset
  }
  return { date: todayUTC(), spentCents: 0, invocations: 0 }
}

function saveState(state: BudgetState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
  } catch (err) {
    log('budget', `Failed to save state: ${err instanceof Error ? err.message : String(err)}`, 'warn')
  }
}

/**
 * Tracks spending against the daily budget.
 * Returns the remaining budget in cents, or -1 if the budget is exceeded.
 */
export function trackSpending(costCents: number, dailyLimitCents: number): number {
  const state = loadState()

  if (state.spentCents + costCents > dailyLimitCents) {
    log('budget', `Daily budget exceeded: spent $${(state.spentCents / 100).toFixed(2)} + $${(costCents / 100).toFixed(2)} > limit $${(dailyLimitCents / 100).toFixed(2)}`, 'warn')
    return -1
  }

  state.spentCents += costCents
  state.invocations += 1
  saveState(state)

  const remaining = dailyLimitCents - state.spentCents
  return remaining
}

/**
 * Returns current daily spending stats without modifying state.
 */
export function getSpendingStats(dailyLimitCents: number): {
  spentCents: number
  remainingCents: number
  invocations: number
  date: string
} {
  const state = loadState()
  return {
    spentCents: state.spentCents,
    remainingCents: Math.max(0, dailyLimitCents - state.spentCents),
    invocations: state.invocations,
    date: state.date,
  }
}

// ─── Transaction Logging ─────────────────────────────────────────────────────

/**
 * Logs a transaction to the daily JSON log file.
 */
export function logTransaction(tx: TransactionLog): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }

    const date = todayUTC()
    const logFile = path.join(LOG_DIR, `${date}.jsonl`)

    const line = JSON.stringify(tx) + '\n'
    fs.appendFileSync(logFile, line)
  } catch (err) {
    log('log', `Failed to write transaction log: ${err instanceof Error ? err.message : String(err)}`, 'warn')
  }
}

// ─── Console Output ──────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
} as const

export function log(tag: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const color = level === 'error' ? C.red : level === 'warn' ? C.yellow : C.cyan
  const prefix = `${C.dim}[${color}${tag}${C.dim}]${C.reset}`
  console.log(`${prefix} ${message}`)
}

export function heading(text: string): void {
  console.log()
  console.log(`${C.bold}${C.green}${'='.repeat(60)}${C.reset}`)
  console.log(`${C.bold}${C.green}  ${text}${C.reset}`)
  console.log(`${C.bold}${C.green}${'='.repeat(60)}${C.reset}`)
  console.log()
}

export function step(n: number, text: string): void {
  console.log(`${C.yellow}[${n}]${C.reset} ${text}`)
}

export function result(label: string, value: string): void {
  console.log(`    ${C.magenta}${label}:${C.reset} ${value}`)
}

export function separator(): void {
  console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`)
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function formatPricing(pricing: PricingConfig | null, costCentsVal?: number | null): string {
  const cost = costCentsVal ?? pricing?.defaultCostCents ?? 0
  if (cost === 0) return `${C.green}Free${C.reset}`
  return `${C.cyan}${formatCents(cost)}/call${C.reset}`
}

export function toolSummary(tool: DiscoveredTool): void {
  const cost = tool.costCents ?? tool.pricing?.defaultCostCents ?? 0
  const desc = tool.description
    ? tool.description.length > 55
      ? tool.description.slice(0, 52) + '...'
      : tool.description
    : '(no description)'
  console.log(`    ${C.bold}${tool.name}${C.reset} ${C.dim}(${tool.slug})${C.reset}`)
  console.log(`      ${desc}`)
  console.log(`      ${formatPricing(tool.pricing, tool.costCents)} | ${tool.invocations.toLocaleString()} calls | by ${tool.developer}`)
}

export function getApiKey(): string {
  if (!API_KEY) {
    console.error(`${C.red}Error: SETTLEGRID_API_KEY environment variable is required.${C.reset}`)
    console.error(`Set it with: export SETTLEGRID_API_KEY=sg_your_key_here`)
    process.exit(1)
  }
  return API_KEY
}

export function getBaseUrl(): string {
  return BASE_URL
}
