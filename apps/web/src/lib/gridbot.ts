/**
 * GridBot — Universal AI Tool Demand Generator
 *
 * Discovers tools across ALL 8 tool types on the SettleGrid marketplace,
 * generates realistic request payloads appropriate to each type, and
 * invokes them via the Smart Proxy to create real marketplace activity.
 *
 * Supported tool types:
 *   mcp-server, ai-model, rest-api, agent-tool, automation,
 *   extension, dataset, sdk-package
 */

import { eq, and, not, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToolTypeSlug =
  | 'mcp-server'
  | 'ai-model'
  | 'rest-api'
  | 'agent-tool'
  | 'automation'
  | 'extension'
  | 'dataset'
  | 'sdk-package'

const ALL_TOOL_TYPES: readonly ToolTypeSlug[] = [
  'mcp-server',
  'ai-model',
  'rest-api',
  'agent-tool',
  'automation',
  'extension',
  'dataset',
  'sdk-package',
] as const

/** Human-readable labels for each tool type. */
const TOOL_TYPE_LABELS: Record<ToolTypeSlug, string> = {
  'mcp-server': 'MCP Server',
  'ai-model': 'AI Model',
  'rest-api': 'REST API',
  'agent-tool': 'Agent Tool',
  automation: 'Automation',
  extension: 'Extension',
  dataset: 'Dataset',
  'sdk-package': 'SDK Package',
}

export interface GridBotCandidate {
  id: string
  name: string
  slug: string
  toolType: string
  category: string | null
  description: string | null
  proxyEndpoint: string | null
  pricingConfig: unknown
  totalInvocations: number
}

export interface GridBotPayload {
  method: string
  body: Record<string, unknown>
  headers: Record<string, string>
}

export interface GridBotInvocationResult {
  toolSlug: string
  toolType: string
  toolName: string
  status: 'success' | 'error' | 'skipped' | 'no_tools'
  statusCode: number
  latencyMs: number
  costCents: number
  error?: string
}

export interface GridBotRunResult {
  startedAt: string
  completedAt: string
  toolTypesTargeted: string[]
  invocations: GridBotInvocationResult[]
  totalSuccess: number
  totalErrors: number
  totalSkipped: number
  totalCostCents: number
}

// ─── Payload Generators ───────────────────────────────────────────────────────

/**
 * Sample questions/prompts for different tool categories.
 * Used to build realistic payloads for different tool types.
 */
const SAMPLE_PROMPTS: Record<string, string[]> = {
  data: [
    'Fetch current weather data for San Francisco, CA',
    'Look up DNS records for example.com',
    'Get IP geolocation information for 8.8.4.4',
  ],
  nlp: [
    'Analyze the sentiment of: "The product launch exceeded expectations and customers loved it"',
    'Translate "Hello, how are you?" to Spanish',
    'Summarize the key points of the given text',
  ],
  image: [
    'Generate a 512x512 thumbnail image with text "SettleGrid Demo"',
    'Detect objects in the provided image URL',
    'Extract text from a document image using OCR',
  ],
  code: [
    'Lint this JavaScript: const x = [1,2,3]; x.map(i => {return i * 2})',
    'Analyze this Python function for security issues',
    'Format the given JSON object with proper indentation',
  ],
  search: [
    'Search for recent papers on transformer architectures',
    'Find documentation about MCP protocol specification',
    'Look up API design best practices',
  ],
  finance: [
    'Convert 250 USD to EUR at current exchange rates',
    'Get the current price of Bitcoin in USD',
    'Fetch the latest S&P 500 index value',
  ],
  security: [
    'Check if example.com has valid SSL certificates',
    'Scan the given URL for common vulnerabilities',
    'Validate the security headers of this API endpoint',
  ],
  utility: [
    'Validate this JSON: {"name": "test", "value": 42}',
    'Generate a new UUID v4',
    'Encode "Hello World" to base64',
  ],
  analytics: [
    'Calculate mean and standard deviation for [12, 15, 18, 22, 25, 28]',
    'Generate a trend analysis for the given time series data',
    'Compute percentile distribution of the provided dataset',
  ],
  general: [
    'Process this request with default parameters',
    'Execute the tool with standard settings',
    'Run a test invocation to verify connectivity',
  ],
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getPromptForCategory(category: string | null): string {
  const prompts = SAMPLE_PROMPTS[category ?? 'general'] ?? SAMPLE_PROMPTS.general
  return pickRandom(prompts)
}

/**
 * Generates a realistic request payload appropriate for the given tool type.
 */
export function generatePayload(toolType: ToolTypeSlug, category: string | null): GridBotPayload {
  const prompt = getPromptForCategory(category)
  const timestamp = new Date().toISOString()

  switch (toolType) {
    case 'mcp-server':
      return {
        method: 'POST',
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'query',
            arguments: { prompt, format: 'json' },
          },
          id: `gridbot-${Date.now()}`,
        },
        headers: { 'Content-Type': 'application/json' },
      }

    case 'ai-model':
      return {
        method: 'POST',
        body: {
          model: 'default',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 256,
          temperature: 0.7,
          stream: false,
          _gridbot: true,
          _ts: timestamp,
        },
        headers: { 'Content-Type': 'application/json' },
      }

    case 'rest-api':
      return {
        method: 'POST',
        body: {
          query: prompt,
          format: 'json',
          limit: 10,
          _gridbot: true,
          _ts: timestamp,
        },
        headers: { 'Content-Type': 'application/json' },
      }

    case 'agent-tool':
      return {
        method: 'POST',
        body: {
          action: 'invoke',
          tool_input: {
            query: prompt,
            context: {},
            return_direct: false,
          },
          metadata: {
            agent_framework: pickRandom(['langchain', 'crewai', 'autogen']),
            invocation_id: `gridbot-${Date.now()}`,
          },
          _gridbot: true,
          _ts: timestamp,
        },
        headers: { 'Content-Type': 'application/json' },
      }

    case 'automation':
      return {
        method: 'POST',
        body: {
          trigger: {
            type: 'manual',
            source: 'gridbot',
          },
          input: {
            query: prompt,
            params: {},
          },
          execution: {
            mode: 'sync',
            timeout_ms: 10000,
          },
          _gridbot: true,
          _ts: timestamp,
        },
        headers: { 'Content-Type': 'application/json' },
      }

    case 'extension':
      return {
        method: 'POST',
        body: {
          command: 'execute',
          args: { query: prompt },
          context: { source: 'gridbot' },
          _gridbot: true,
          _ts: timestamp,
        },
        headers: { 'Content-Type': 'application/json' },
      }

    case 'dataset':
      return {
        method: 'POST',
        body: {
          operation: 'query',
          query: prompt,
          format: 'json',
          limit: 25,
          offset: 0,
          _gridbot: true,
          _ts: timestamp,
        },
        headers: { 'Content-Type': 'application/json' },
      }

    case 'sdk-package':
      return {
        method: 'POST',
        body: {
          action: 'check_features',
          package_query: prompt,
          include_usage_stats: true,
          _gridbot: true,
          _ts: timestamp,
        },
        headers: { 'Content-Type': 'application/json' },
      }

    default: {
      // Exhaustiveness check — this should never happen
      const _exhaustive: never = toolType
      return _exhaustive
    }
  }
}

// ─── Tool Discovery ───────────────────────────────────────────────────────────

/**
 * Discovers candidate tools for GridBot invocation.
 * Selects random active tools of the given type that have a proxy endpoint set,
 * excluding already-seeded slugs.
 *
 * NOTE: Only tools with a proxyEndpoint can actually be invoked via the Smart Proxy.
 * Unclaimed/crawled tools do not have proxy endpoints until a developer claims them
 * and configures one. GridBot will naturally generate zero traffic until developers
 * start claiming tools and setting endpoints.
 */
export async function discoverCandidates(
  toolType: ToolTypeSlug,
  excludeSlugs: string[],
  limit: number = 5,
): Promise<GridBotCandidate[]> {
  const conditions = [
    eq(tools.status, 'active'),
    eq(tools.toolType, toolType),
    sql`${tools.proxyEndpoint} IS NOT NULL`,
  ]

  if (excludeSlugs.length > 0) {
    conditions.push(not(inArray(tools.slug, excludeSlugs)))
  }

  const candidates = await db
    .select({
      id: tools.id,
      name: tools.name,
      slug: tools.slug,
      toolType: tools.toolType,
      category: tools.category,
      description: tools.description,
      proxyEndpoint: tools.proxyEndpoint,
      pricingConfig: tools.pricingConfig,
      totalInvocations: tools.totalInvocations,
    })
    .from(tools)
    .where(and(...conditions))
    .orderBy(sql`RANDOM()`)
    .limit(limit)

  return candidates
}

/**
 * Discovers candidates across ALL tool types. Returns a map of toolType -> candidates.
 */
export async function discoverAllTypeCandidates(
  excludeSlugs: string[],
  perTypeLimit: number = 3,
): Promise<Record<string, GridBotCandidate[]>> {
  const result: Record<string, GridBotCandidate[]> = {}

  // Run all type queries in parallel
  const entries = await Promise.all(
    ALL_TOOL_TYPES.map(async (tt) => {
      const candidates = await discoverCandidates(tt, excludeSlugs, perTypeLimit)
      return [tt, candidates] as const
    })
  )

  for (const [tt, candidates] of entries) {
    if (candidates.length > 0) {
      result[tt] = candidates
    }
  }

  return result
}

// ─── Tool Invocation ──────────────────────────────────────────────────────────

function getEffectiveCost(pricingConfig: unknown): number {
  if (!pricingConfig || typeof pricingConfig !== 'object') return 0
  const config = pricingConfig as Record<string, unknown>
  const cost = config.defaultCostCents
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
    return Math.floor(cost)
  }
  return 0
}

/**
 * Invokes a single tool via the Smart Proxy.
 */
export async function invokeCandidate(
  candidate: GridBotCandidate,
  systemApiKey: string,
  appUrl: string,
): Promise<GridBotInvocationResult> {
  const toolType = candidate.toolType as ToolTypeSlug
  const payload = generatePayload(toolType, candidate.category)
  const proxyUrl = `${appUrl}/api/proxy/${encodeURIComponent(candidate.slug)}`
  const start = Date.now()

  try {
    const response = await fetch(proxyUrl, {
      method: payload.method,
      headers: {
        ...payload.headers,
        'x-api-key': systemApiKey,
        'x-gridbot-invocation': 'true',
        'User-Agent': 'GridBot/2.0 (settlegrid.ai)',
      },
      body: JSON.stringify(payload.body),
      signal: AbortSignal.timeout(15_000),
    })

    const latencyMs = Date.now() - start
    const costHeader = response.headers.get('X-SettleGrid-Cost-Cents')
    const costCents = costHeader ? parseInt(costHeader, 10) : getEffectiveCost(candidate.pricingConfig)

    if (!response.ok) {
      return {
        toolSlug: candidate.slug,
        toolType: candidate.toolType,
        toolName: candidate.name,
        status: 'error',
        statusCode: response.status,
        latencyMs,
        costCents: 0,
        error: `HTTP ${response.status}`,
      }
    }

    return {
      toolSlug: candidate.slug,
      toolType: candidate.toolType,
      toolName: candidate.name,
      status: 'success',
      statusCode: response.status,
      latencyMs,
      costCents: Number.isFinite(costCents) ? costCents : 0,
    }
  } catch (err) {
    const latencyMs = Date.now() - start
    const message = err instanceof Error ? err.message : String(err)

    return {
      toolSlug: candidate.slug,
      toolType: candidate.toolType,
      toolName: candidate.name,
      status: 'error',
      statusCode: 0,
      latencyMs,
      costCents: 0,
      error: message.includes('abort') ? 'Timeout (15s)' : `Network: ${message.slice(0, 100)}`,
    }
  }
}

// ─── Full Run ─────────────────────────────────────────────────────────────────

/** Default daily budget in cents (can be overridden via env). */
const DEFAULT_BUDGET_CENTS = 200

export interface GridBotRunOptions {
  /** Which tool types to target. Defaults to all 8. */
  targetTypes?: ToolTypeSlug[]
  /** Tool slugs to exclude (already seeded). */
  excludeSlugs?: string[]
  /** Max tools to invoke per type. Default: 2. */
  perTypeLimit?: number
  /** Daily budget in cents. Default: 200 ($2). */
  budgetCents?: number
  /** If true, discover but do not invoke. */
  dryRun?: boolean
}

/**
 * Runs the GridBot demand generator across all (or selected) tool types.
 * Returns a summary of all invocations.
 */
export async function runGridBot(options: GridBotRunOptions = {}): Promise<GridBotRunResult> {
  const {
    targetTypes = [...ALL_TOOL_TYPES],
    excludeSlugs = [],
    perTypeLimit = 2,
    budgetCents = Number(process.env.GRIDBOT_BUDGET_CENTS) || DEFAULT_BUDGET_CENTS,
    dryRun = false,
  } = options

  const systemApiKey = process.env.SETTLEGRID_SYSTEM_API_KEY ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://settlegrid.ai'
  const startedAt = new Date().toISOString()
  const invocations: GridBotInvocationResult[] = []
  let totalCostCents = 0

  if (!systemApiKey && !dryRun) {
    logger.warn('gridbot.no_system_key', { message: 'SETTLEGRID_SYSTEM_API_KEY not set, skipping invocations' })
    return {
      startedAt,
      completedAt: new Date().toISOString(),
      toolTypesTargeted: targetTypes,
      invocations: [],
      totalSuccess: 0,
      totalErrors: 0,
      totalSkipped: 0,
      totalCostCents: 0,
    }
  }

  logger.info('gridbot.run_start', {
    targetTypes,
    excludeCount: excludeSlugs.length,
    perTypeLimit,
    budgetCents,
    dryRun,
  })

  // Discover candidates across all targeted types
  const allCandidates: Record<string, GridBotCandidate[]> = {}
  for (const tt of targetTypes) {
    const candidates = await discoverCandidates(tt, excludeSlugs, perTypeLimit)
    if (candidates.length > 0) {
      allCandidates[tt] = candidates
    }
  }

  const typesWithCandidates = Object.keys(allCandidates)
  logger.info('gridbot.discovery_complete', {
    typesWithCandidates,
    totalCandidates: Object.values(allCandidates).reduce((sum, c) => sum + c.length, 0),
  })

  // Invoke candidates, respecting budget
  for (const [toolType, candidates] of Object.entries(allCandidates)) {
    for (const candidate of candidates) {
      const estimatedCost = getEffectiveCost(candidate.pricingConfig)

      if (totalCostCents + estimatedCost > budgetCents) {
        invocations.push({
          toolSlug: candidate.slug,
          toolType,
          toolName: candidate.name,
          status: 'skipped',
          statusCode: 0,
          latencyMs: 0,
          costCents: 0,
          error: 'Budget limit reached',
        })
        continue
      }

      if (dryRun) {
        const payload = generatePayload(toolType as ToolTypeSlug, candidate.category)
        logger.info('gridbot.dry_run', {
          toolSlug: candidate.slug,
          toolType,
          payload: payload.body,
        })
        invocations.push({
          toolSlug: candidate.slug,
          toolType,
          toolName: candidate.name,
          status: 'skipped',
          statusCode: 0,
          latencyMs: 0,
          costCents: 0,
          error: 'Dry run',
        })
        continue
      }

      const result = await invokeCandidate(candidate, systemApiKey, appUrl)
      invocations.push(result)
      totalCostCents += result.costCents

      logger.info('gridbot.invocation', {
        toolSlug: result.toolSlug,
        toolType: result.toolType,
        status: result.status,
        latencyMs: result.latencyMs,
        costCents: result.costCents,
        error: result.error,
      })

      // Small delay between invocations to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }

  const completedAt = new Date().toISOString()
  const totalSuccess = invocations.filter((i) => i.status === 'success').length
  const totalErrors = invocations.filter((i) => i.status === 'error').length
  const totalSkipped = invocations.filter((i) => i.status === 'skipped').length

  logger.info('gridbot.run_complete', {
    totalSuccess,
    totalErrors,
    totalSkipped,
    totalCostCents,
    durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
  })

  return {
    startedAt,
    completedAt,
    toolTypesTargeted: targetTypes,
    invocations,
    totalSuccess,
    totalErrors,
    totalSkipped,
    totalCostCents,
  }
}

// ─── Exports for ask/activity ─────────────────────────────────────────────────

export { ALL_TOOL_TYPES, TOOL_TYPE_LABELS }
