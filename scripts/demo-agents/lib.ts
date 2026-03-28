/**
 * Shared utilities for SettleGrid agent demo scripts.
 *
 * These helpers wrap the public SettleGrid APIs so each demo agent
 * can discover tools, inspect pricing, and simulate invocations
 * without duplicating fetch/error-handling boilerplate.
 */

const BASE_URL = process.env.SETTLEGRID_URL ?? 'https://settlegrid.ai'
const REQUEST_TIMEOUT_MS = 10_000

// ─── Types ──────────────────────────────────────────────────────────────────────

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
  invocations: number
  developer: string
  developerSlug: string | null
  url: string
  developerUrl: string | null
}

export interface DiscoveryResponse {
  tools: DiscoveredTool[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ToolDetail {
  id: string
  name: string
  slug: string
  description: string
  category: string
  currentVersion: string
  pricingConfig: PricingConfig
  developerName: string
  developerSlug: string | null
  reviews: unknown[]
  changelog: unknown[]
  averageRating: number
  reviewCount: number
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

/** Fetch with a timeout guard so demos never hang. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Discover tools via the public SettleGrid API.
 *
 * @param query  - Free-text search (matched against name, description, slug)
 * @param category - Optional category filter (e.g. 'data', 'code', 'nlp')
 * @param limit  - Max results (1-100, default 20)
 */
export async function discoverTools(
  query: string,
  category?: string,
  limit = 20,
): Promise<DiscoveredTool[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  if (category) params.set('category', category)

  const url = `${BASE_URL}/api/v1/discover?${params}`
  log('discovery', `GET ${url}`)

  try {
    const res = await fetchWithTimeout(url)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      log('discovery', `HTTP ${res.status}: ${body.slice(0, 200)}`)
      return []
    }

    const json = (await res.json()) as DiscoveryResponse
    log('discovery', `Found ${json.tools.length} tool(s) (${json.total} total)`)
    return json.tools
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('discovery', `Request failed: ${message}`)
    return []
  }
}

/**
 * Fetch full details for a single tool by slug.
 */
export async function getToolDetails(slug: string): Promise<ToolDetail | null> {
  const url = `${BASE_URL}/api/tools/public/${encodeURIComponent(slug)}`
  log('detail', `GET ${url}`)

  try {
    const res = await fetchWithTimeout(url)

    if (!res.ok) {
      log('detail', `HTTP ${res.status} for slug "${slug}"`)
      return null
    }

    const json = (await res.json()) as { data: ToolDetail }
    return json.data
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('detail', `Request failed: ${message}`)
    return null
  }
}

/**
 * Format a pricing config into a human-readable string.
 *
 * Examples:
 *   { defaultCostCents: 5 }                         => "$0.05/call"
 *   { defaultCostCents: 5, methods: { screen: 3 } } => "$0.05/call (screen: $0.03)"
 *   null                                             => "Free"
 */
export function formatPricing(pricing: PricingConfig | null): string {
  if (!pricing || pricing.defaultCostCents === 0) return 'Free'

  const base = `$${(pricing.defaultCostCents / 100).toFixed(2)}/call`

  if (pricing.methods && Object.keys(pricing.methods).length > 0) {
    const methodParts = Object.entries(pricing.methods)
      .map(([method, cents]) => `${method}: $${(cents / 100).toFixed(2)}`)
      .join(', ')
    return `${base} (${methodParts})`
  }

  return base
}

/**
 * Extract the per-call cost in cents from a pricing config.
 * Returns 0 for free/null configs.
 */
export function costCents(pricing: PricingConfig | null): number {
  return pricing?.defaultCostCents ?? 0
}

/**
 * Filter tools that fit within a budget (in cents).
 * Returns tools sorted by cost ascending (cheapest first).
 */
export function budgetCheck(
  tools: DiscoveredTool[],
  budgetCents: number,
): DiscoveredTool[] {
  return tools
    .filter((t) => costCents(t.pricing) <= budgetCents)
    .sort((a, b) => costCents(a.pricing) - costCents(b.pricing))
}

/**
 * Simulate calling a tool. Logs what would happen and returns a
 * synthetic result. Real invocations would go through the tool's
 * registered endpoint with an x402 payment header.
 */
export function simulateCall(
  tool: DiscoveredTool,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const cost = costCents(tool.pricing)
  log('invoke', `Calling ${tool.name} (${tool.slug})`)
  log('invoke', `  Cost: ${formatPricing(tool.pricing)}`)
  log('invoke', `  Input: ${JSON.stringify(input)}`)
  log('invoke', `  [SIMULATED] Payment of $${(cost / 100).toFixed(2)} would be sent via x402 header`)

  return {
    tool: tool.slug,
    status: 'simulated',
    costCents: cost,
    input,
    output: `[Simulated response from ${tool.name}]`,
  }
}

// ─── Logging ────────────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
} as const

export function log(tag: string, message: string): void {
  const prefix = `${COLORS.dim}[${COLORS.cyan}${tag}${COLORS.dim}]${COLORS.reset}`
  console.log(`${prefix} ${message}`)
}

export function heading(text: string): void {
  console.log()
  console.log(`${COLORS.bold}${COLORS.green}=== ${text} ===${COLORS.reset}`)
  console.log()
}

export function step(n: number, text: string): void {
  console.log(`${COLORS.yellow}Step ${n}:${COLORS.reset} ${text}`)
}

export function result(label: string, value: string): void {
  console.log(`  ${COLORS.magenta}${label}:${COLORS.reset} ${value}`)
}

export function separator(): void {
  console.log(`${COLORS.dim}${'─'.repeat(60)}${COLORS.reset}`)
}

export function toolTable(tools: DiscoveredTool[]): void {
  if (tools.length === 0) {
    console.log('  (no tools found)')
    return
  }
  for (const t of tools) {
    const price = formatPricing(t.pricing)
    const desc = t.description
      ? t.description.length > 60
        ? t.description.slice(0, 57) + '...'
        : t.description
      : '(no description)'
    console.log(`  ${COLORS.bold}${t.name}${COLORS.reset} ${COLORS.dim}(${t.slug})${COLORS.reset}`)
    console.log(`    ${desc}`)
    console.log(`    ${COLORS.cyan}${price}${COLORS.reset} | ${t.invocations.toLocaleString()} calls | by ${t.developer}`)
  }
}
