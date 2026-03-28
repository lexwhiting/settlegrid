/**
 * Multi-registry crawler adapters for SettleGrid.
 *
 * Each adapter fetches MCP server metadata from a different source,
 * normalizes it into a common shape, and returns up to `limit` entries.
 * All adapters handle errors gracefully (return empty array on failure)
 * and enforce a 10-second timeout.
 */

import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrawledServer {
  name: string
  description: string
  sourceUrl: string
  source: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-Crawler/1.0 (https://settlegrid.ai)'

/** Available registry sources in rotation order */
export const REGISTRY_SOURCES = [
  'mcp-registry',
  'pulsemcp',
  'smithery',
  'npm',
] as const

export type RegistrySource = (typeof REGISTRY_SOURCES)[number]

// ─── Fetch helper ───────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...options.headers,
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Source 1: Official MCP Registry ────────────────────────────────────────

const MCP_REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers'

export async function crawlMcpRegistry(limit: number): Promise<CrawledServer[]> {
  try {
    const res = await fetchWithTimeout(MCP_REGISTRY_URL)
    if (!res.ok) {
      logger.warn('crawler.mcp_registry.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return []

    const servers = (data as { servers?: unknown[] }).servers
    if (!Array.isArray(servers)) return []

    const results: CrawledServer[] = []
    for (const server of servers) {
      if (results.length >= limit) break
      if (typeof server !== 'object' || server === null) continue

      const s = server as Record<string, unknown>
      const name =
        typeof s.name === 'string' && s.name.trim().length > 0
          ? s.name.trim()
          : typeof s.title === 'string' && s.title.trim().length > 0
            ? s.title.trim()
            : null

      if (!name) continue

      results.push({
        name,
        description:
          typeof s.description === 'string' ? s.description.trim().slice(0, 2000) : '',
        sourceUrl:
          typeof s.url === 'string' ? s.url : `${MCP_REGISTRY_URL}`,
        source: 'mcp-registry',
      })
    }

    logger.info('crawler.mcp_registry.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.mcp_registry.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Source 2: PulseMCP ─────────────────────────────────────────────────────

const PULSEMCP_API_URL = 'https://api.pulsemcp.com/v0beta1/servers'

export async function crawlPulseMcp(limit: number): Promise<CrawledServer[]> {
  try {
    const res = await fetchWithTimeout(PULSEMCP_API_URL)
    if (!res.ok) {
      logger.warn('crawler.pulsemcp.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return []

    // PulseMCP may return { servers: [...] } or a top-level array
    const raw = data as Record<string, unknown>
    const servers = Array.isArray(raw.servers)
      ? raw.servers
      : Array.isArray(data)
        ? (data as unknown[])
        : []

    const results: CrawledServer[] = []
    for (const server of servers) {
      if (results.length >= limit) break
      if (typeof server !== 'object' || server === null) continue

      const s = server as Record<string, unknown>
      const name =
        typeof s.name === 'string' && s.name.trim().length > 0
          ? s.name.trim()
          : typeof s.title === 'string' && s.title.trim().length > 0
            ? s.title.trim()
            : null

      if (!name) continue

      results.push({
        name,
        description:
          typeof s.description === 'string' ? s.description.trim().slice(0, 2000) : '',
        sourceUrl:
          typeof s.url === 'string'
            ? s.url
            : typeof s.homepage === 'string'
              ? s.homepage
              : 'https://pulsemcp.com',
        source: 'pulsemcp',
      })
    }

    logger.info('crawler.pulsemcp.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.pulsemcp.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Source 3: Smithery ─────────────────────────────────────────────────────

const SMITHERY_API_URL = 'https://registry.smithery.ai/servers'

export async function crawlSmithery(limit: number): Promise<CrawledServer[]> {
  try {
    const url = new URL(SMITHERY_API_URL)
    url.searchParams.set('pageSize', String(Math.min(limit, 100)))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.smithery.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return []

    // Smithery returns { servers: [...] } or { items: [...] }
    const raw = data as Record<string, unknown>
    const servers = Array.isArray(raw.servers)
      ? raw.servers
      : Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(data)
          ? (data as unknown[])
          : []

    const results: CrawledServer[] = []
    for (const server of servers) {
      if (results.length >= limit) break
      if (typeof server !== 'object' || server === null) continue

      const s = server as Record<string, unknown>
      const name =
        typeof s.displayName === 'string' && s.displayName.trim().length > 0
          ? s.displayName.trim()
          : typeof s.name === 'string' && s.name.trim().length > 0
            ? s.name.trim()
            : typeof s.qualifiedName === 'string' && s.qualifiedName.trim().length > 0
              ? s.qualifiedName.trim()
              : null

      if (!name) continue

      results.push({
        name,
        description:
          typeof s.description === 'string' ? s.description.trim().slice(0, 2000) : '',
        sourceUrl:
          typeof s.homepage === 'string'
            ? s.homepage
            : typeof s.url === 'string'
              ? s.url
              : typeof s.qualifiedName === 'string'
                ? `https://smithery.ai/server/${s.qualifiedName}`
                : 'https://smithery.ai',
        source: 'smithery',
      })
    }

    logger.info('crawler.smithery.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.smithery.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Source 4: npm search ───────────────────────────────────────────────────

const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search'

export async function crawlNpmSearch(limit: number): Promise<CrawledServer[]> {
  try {
    const url = new URL(NPM_SEARCH_URL)
    url.searchParams.set('text', 'mcp server')
    url.searchParams.set('size', String(Math.min(limit, 250)))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.npm.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return []

    const raw = data as { objects?: unknown[] }
    if (!Array.isArray(raw.objects)) return []

    const results: CrawledServer[] = []
    for (const obj of raw.objects) {
      if (results.length >= limit) break
      if (typeof obj !== 'object' || obj === null) continue

      const pkg = (obj as { package?: Record<string, unknown> }).package
      if (!pkg || typeof pkg !== 'object') continue

      const name = typeof pkg.name === 'string' ? pkg.name.trim() : null
      if (!name) continue

      // Filter: only include packages with "mcp" in name or keywords
      const keywords = Array.isArray(pkg.keywords)
        ? (pkg.keywords as unknown[]).filter((k) => typeof k === 'string') as string[]
        : []
      const nameLower = name.toLowerCase()
      const hasMcpInName = nameLower.includes('mcp')
      const hasMcpInKeywords = keywords.some((k) => k.toLowerCase().includes('mcp'))

      if (!hasMcpInName && !hasMcpInKeywords) continue

      const repoUrl =
        typeof pkg.links === 'object' && pkg.links !== null
          ? typeof (pkg.links as Record<string, unknown>).repository === 'string'
            ? (pkg.links as Record<string, unknown>).repository as string
            : typeof (pkg.links as Record<string, unknown>).homepage === 'string'
              ? (pkg.links as Record<string, unknown>).homepage as string
              : typeof (pkg.links as Record<string, unknown>).npm === 'string'
                ? (pkg.links as Record<string, unknown>).npm as string
                : `https://www.npmjs.com/package/${name}`
          : `https://www.npmjs.com/package/${name}`

      results.push({
        name,
        description:
          typeof pkg.description === 'string' ? pkg.description.trim().slice(0, 2000) : '',
        sourceUrl: repoUrl,
        source: 'npm',
      })
    }

    logger.info('crawler.npm.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.npm.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Unified dispatcher ────────────────────────────────────────────────────

/**
 * Crawls a specific registry source.
 * Returns normalized server entries, up to `limit`.
 */
export async function crawlSource(
  source: RegistrySource,
  limit: number
): Promise<CrawledServer[]> {
  switch (source) {
    case 'mcp-registry':
      return crawlMcpRegistry(limit)
    case 'pulsemcp':
      return crawlPulseMcp(limit)
    case 'smithery':
      return crawlSmithery(limit)
    case 'npm':
      return crawlNpmSearch(limit)
    default:
      logger.warn('crawler.unknown_source', { source })
      return []
  }
}

/**
 * Determines which source to crawl based on the current hour.
 * Rotates through sources using modulo on the UTC hour.
 */
export function getSourceForCurrentRun(): RegistrySource {
  const hour = new Date().getUTCHours()
  const index = hour % REGISTRY_SOURCES.length
  return REGISTRY_SOURCES[index]
}
