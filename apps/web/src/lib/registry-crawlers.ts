/**
 * Multi-registry crawler adapters for SettleGrid.
 *
 * Each adapter fetches MCP server metadata from a different source,
 * normalizes it into a common shape, and returns up to `limit` entries.
 * All adapters handle errors gracefully (return empty array on failure)
 * and enforce a 10-second timeout.
 *
 * Pagination: Each crawler accepts an `offset` parameter so that successive
 * cron runs continue from where the last run left off, progressively walking
 * through the full catalog instead of re-fetching page 1 every time.
 */

import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrawledServerEnrichment {
  /** Total uses/installations from the source registry */
  usageCount?: number
  /** Number of GitHub stars (if source is GitHub-based) */
  starCount?: number
  /** ISO date string of last update from the source */
  lastUpdatedAt?: string
  /** License identifier (e.g. 'MIT', 'Apache-2.0') */
  license?: string
  /** Tags/topics from the source registry */
  sourceTags?: string[]
  /** Whether the server is also listed on other registries */
  crossListedSources?: string[]
}

export interface CrawledServer {
  name: string
  description: string
  sourceUrl: string
  source: string
  /** Rich metadata for data moat — enhances directory value beyond source registries */
  enrichment?: CrawledServerEnrichment
}

/** Result from a paginated crawl, including the next offset for the following run */
export interface PaginatedCrawlResult {
  servers: CrawledServer[]
  /** Next offset to store — if null, the end of catalog was reached (reset to 0) */
  nextOffset: number | null
  /** Whether the end of the catalog was reached on this run */
  endOfCatalog: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-Crawler/1.0 (https://settlegrid.ai)'

/** Page size for APIs that support pagination */
const DEFAULT_PAGE_SIZE = 200

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

/**
 * Crawls the official MCP Registry.
 *
 * The MCP registry returns all servers in a single response (no pagination
 * at the API level). We simulate pagination by slicing the full list using
 * the offset parameter.
 */
export async function crawlMcpRegistry(limit: number, offset = 0): Promise<PaginatedCrawlResult> {
  try {
    const res = await fetchWithTimeout(MCP_REGISTRY_URL)
    if (!res.ok) {
      logger.warn('crawler.mcp_registry.fetch_failed', { status: res.status })
      return { servers: [], nextOffset: offset, endOfCatalog: false }
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) {
      return { servers: [], nextOffset: offset, endOfCatalog: false }
    }

    const servers = (data as { servers?: unknown[] }).servers
    if (!Array.isArray(servers)) {
      return { servers: [], nextOffset: offset, endOfCatalog: false }
    }

    // Slice from offset for progressive pagination through the full list
    const totalAvailable = servers.length
    const pageSlice = servers.slice(offset, offset + limit)

    const results: CrawledServer[] = []
    for (const entry of pageSlice) {
      if (results.length >= limit) break
      if (typeof entry !== 'object' || entry === null) continue

      // MCP registry wraps each entry: { server: { name, description, repository, ... } }
      const e = entry as Record<string, unknown>
      const s = (typeof e.server === 'object' && e.server !== null ? e.server : e) as Record<string, unknown>

      const name =
        typeof s.name === 'string' && s.name.trim().length > 0
          ? s.name.trim()
          : typeof s.title === 'string' && s.title.trim().length > 0
            ? s.title.trim()
            : null

      if (!name) continue

      // Repository URL may be nested under server.repository.url
      const repo = s.repository as Record<string, unknown> | undefined
      const repoUrl = typeof repo?.url === 'string' ? repo.url : null
      const websiteUrl = typeof s.websiteUrl === 'string' ? s.websiteUrl : null

      // Prefer the actual GitHub repo URL over the generic registry URL.
      const effectiveSourceUrl = repoUrl ?? websiteUrl ?? MCP_REGISTRY_URL

      results.push({
        name,
        description:
          typeof s.description === 'string' ? s.description.trim().slice(0, 2000) : '',
        sourceUrl: effectiveSourceUrl,
        source: 'mcp-registry',
      })
    }

    const newOffset = offset + results.length
    const endOfCatalog = newOffset >= totalAvailable

    logger.info('crawler.mcp_registry.completed', {
      count: results.length,
      offset,
      totalAvailable,
      endOfCatalog,
    })

    return {
      servers: results,
      nextOffset: endOfCatalog ? null : newOffset,
      endOfCatalog,
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.mcp_registry.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return { servers: [], nextOffset: offset, endOfCatalog: false }
  }
}

// ─── Source 2: PulseMCP ─────────────────────────────────────────────────────

const PULSEMCP_API_URL = 'https://api.pulsemcp.com/v0beta/servers'

/**
 * Crawls PulseMCP with offset-based pagination.
 * API supports `count_per_page` and `offset` parameters.
 */
export async function crawlPulseMcp(limit: number, offset = 0): Promise<PaginatedCrawlResult> {
  try {
    const pageSize = Math.min(limit, DEFAULT_PAGE_SIZE)
    const url = new URL(PULSEMCP_API_URL)
    url.searchParams.set('count_per_page', String(pageSize))
    url.searchParams.set('offset', String(offset))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.pulsemcp.fetch_failed', { status: res.status })
      return { servers: [], nextOffset: offset, endOfCatalog: false }
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) {
      return { servers: [], nextOffset: offset, endOfCatalog: false }
    }

    // PulseMCP v0beta returns { servers: [...], total_count, next }
    const raw = data as Record<string, unknown>
    const servers = Array.isArray(raw.servers) ? raw.servers : []
    const totalCount = typeof raw.total_count === 'number' ? raw.total_count : undefined

    const results: CrawledServer[] = []
    for (const server of servers) {
      if (results.length >= limit) break
      if (typeof server !== 'object' || server === null) continue

      const s = server as Record<string, unknown>
      const name =
        typeof s.name === 'string' && s.name.trim().length > 0
          ? s.name.trim()
          : null

      if (!name) continue

      // PulseMCP uses source_code_url (GitHub), external_url, and short_description
      const sourceCodeUrl = typeof s.source_code_url === 'string' ? s.source_code_url : null
      const externalUrl = typeof s.external_url === 'string' ? s.external_url : null
      const pulseUrl = typeof s.url === 'string' ? s.url : null

      // Extract enrichment metadata from PulseMCP's rich API
      const tags: string[] = Array.isArray(s.tags)
        ? (s.tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : []
      const githubStars = typeof s.github_stars === 'number' && Number.isFinite(s.github_stars as number)
        ? (s.github_stars as number) : undefined
      const updatedAt = typeof s.updated_at === 'string' ? (s.updated_at as string) : undefined

      results.push({
        name,
        description:
          typeof s.short_description === 'string' ? s.short_description.trim().slice(0, 2000) : '',
        sourceUrl: sourceCodeUrl ?? externalUrl ?? pulseUrl ?? 'https://pulsemcp.com',
        source: 'pulsemcp',
        enrichment: {
          starCount: githubStars,
          lastUpdatedAt: updatedAt,
          sourceTags: tags.slice(0, 20),
          crossListedSources: sourceCodeUrl
            ? ['github']
            : undefined,
        },
      })
    }

    // End of catalog: returned fewer results than requested page size, or offset exceeds total
    const endOfCatalog = servers.length < pageSize
      || (totalCount !== undefined && offset + servers.length >= totalCount)
    const newOffset = offset + results.length

    logger.info('crawler.pulsemcp.completed', {
      count: results.length,
      offset,
      totalCount,
      endOfCatalog,
    })

    return {
      servers: results,
      nextOffset: endOfCatalog ? null : newOffset,
      endOfCatalog,
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.pulsemcp.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return { servers: [], nextOffset: offset, endOfCatalog: false }
  }
}

// ─── Source 3: Smithery ─────────────────────────────────────────────────────

const SMITHERY_API_URL = 'https://registry.smithery.ai/servers'

/**
 * Crawls Smithery with page-based pagination.
 * API supports `pageSize` and `page` parameters.
 * Offset is translated to a 1-based page number.
 */
export async function crawlSmithery(limit: number, offset = 0): Promise<PaginatedCrawlResult> {
  try {
    const pageSize = Math.min(limit, 100) // Smithery caps at 100 per page
    // Convert offset to 1-based page number
    const page = Math.floor(offset / pageSize) + 1

    const url = new URL(SMITHERY_API_URL)
    url.searchParams.set('pageSize', String(pageSize))
    url.searchParams.set('page', String(page))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.smithery.fetch_failed', { status: res.status })
      return { servers: [], nextOffset: offset, endOfCatalog: false }
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) {
      return { servers: [], nextOffset: offset, endOfCatalog: false }
    }

    // Smithery returns { servers: [...] } or { items: [...] }
    const raw = data as Record<string, unknown>
    const servers = Array.isArray(raw.servers)
      ? raw.servers
      : Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(data)
          ? (data as unknown[])
          : []

    const totalCount = typeof raw.totalCount === 'number' ? raw.totalCount
      : typeof raw.total === 'number' ? raw.total
      : undefined

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

      const sourceUrl =
        typeof s.homepage === 'string'
          ? s.homepage
          : typeof s.url === 'string'
            ? s.url
            : typeof s.qualifiedName === 'string'
              ? `https://smithery.ai/server/${s.qualifiedName}`
              : 'https://smithery.ai'

      const useCount = typeof s.useCount === 'number' && Number.isFinite(s.useCount as number)
        ? (s.useCount as number) : undefined
      const tags: string[] = Array.isArray(s.tags)
        ? (s.tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : []

      results.push({
        name,
        description:
          typeof s.description === 'string' ? s.description.trim().slice(0, 2000) : '',
        sourceUrl,
        source: 'smithery',
        enrichment: {
          usageCount: useCount,
          sourceTags: tags.slice(0, 20),
        },
      })
    }

    // End of catalog: fewer results than page size, or reached total
    const endOfCatalog = servers.length < pageSize
      || (totalCount !== undefined && page * pageSize >= totalCount)
    const newOffset = offset + results.length

    logger.info('crawler.smithery.completed', {
      count: results.length,
      page,
      offset,
      totalCount,
      endOfCatalog,
    })

    return {
      servers: results,
      nextOffset: endOfCatalog ? null : newOffset,
      endOfCatalog,
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.smithery.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return { servers: [], nextOffset: offset, endOfCatalog: false }
  }
}

// ─── Source 4: npm search ───────────────────────────────────────────────────

const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search'

/** MCP-focused search queries for npm (expanded beyond just "mcp server") */
const NPM_MCP_QUERIES = [
  'mcp server',
  'mcp-server',
  'model-context-protocol',
] as const

/** Max results per npm query (API caps at 250) */
const NPM_RESULTS_PER_QUERY = 250

/**
 * Runs a single npm search query with offset-based pagination.
 * npm search API supports `from` offset parameter.
 */
async function searchNpmMcp(
  query: string,
  size: number,
  from: number,
): Promise<{ servers: CrawledServer[]; total: number }> {
  const url = new URL(NPM_SEARCH_URL)
  url.searchParams.set('text', query)
  url.searchParams.set('size', String(Math.min(size, 250)))
  url.searchParams.set('from', String(from))

  const res = await fetchWithTimeout(url.toString())
  if (!res.ok) {
    logger.warn('crawler.npm.query_failed', { query, status: res.status })
    return { servers: [], total: 0 }
  }

  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null) return { servers: [], total: 0 }

  const raw = data as { objects?: unknown[]; total?: number }
  if (!Array.isArray(raw.objects)) return { servers: [], total: 0 }

  const total = typeof raw.total === 'number' ? raw.total : 0
  const results: CrawledServer[] = []

  for (const obj of raw.objects) {
    if (typeof obj !== 'object' || obj === null) continue

    const pkg = (obj as { package?: Record<string, unknown> }).package
    if (!pkg || typeof pkg !== 'object') continue

    const name = typeof pkg.name === 'string' ? pkg.name.trim() : null
    if (!name) continue

    // Filter: only include packages with "mcp" or "model-context-protocol" in name or keywords
    const keywords = Array.isArray(pkg.keywords)
      ? (pkg.keywords as unknown[]).filter((k) => typeof k === 'string') as string[]
      : []
    const nameLower = name.toLowerCase()
    const hasMcpInName = nameLower.includes('mcp') || nameLower.includes('model-context-protocol')
    const hasMcpInKeywords = keywords.some((k) => {
      const kl = k.toLowerCase()
      return kl.includes('mcp') || kl.includes('model-context-protocol')
    })

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

    const npmKeywords: string[] = keywords.filter((k) => typeof k === 'string')

    results.push({
      name,
      description:
        typeof pkg.description === 'string' ? pkg.description.trim().slice(0, 2000) : '',
      sourceUrl: repoUrl,
      source: 'npm',
      enrichment: {
        sourceTags: npmKeywords.slice(0, 20),
        crossListedSources: typeof repoUrl === 'string' && repoUrl.includes('github.com')
          ? ['github']
          : undefined,
      },
    })
  }

  return { servers: results, total }
}

/**
 * Crawls npm for MCP-related packages with offset-based pagination.
 *
 * The offset encodes both which query we're on and where within that query:
 *   offset = queryIndex * 10000 + withinQueryOffset
 *
 * This lets us paginate across multiple search queries progressively.
 */
export async function crawlNpmSearch(limit: number, offset = 0): Promise<PaginatedCrawlResult> {
  try {
    const seen = new Set<string>()
    const results: CrawledServer[] = []

    // Decode compound offset: queryIndex * 10000 + withinQueryOffset
    const queryIndex = Math.floor(offset / 10000)
    const withinQueryOffset = offset % 10000

    let currentQueryIdx = queryIndex
    let currentWithinOffset = withinQueryOffset
    let endOfCatalog = false

    while (currentQueryIdx < NPM_MCP_QUERIES.length && results.length < limit) {
      const query = NPM_MCP_QUERIES[currentQueryIdx]
      try {
        const remaining = limit - results.length
        const { servers, total } = await searchNpmMcp(
          query,
          Math.min(remaining, NPM_RESULTS_PER_QUERY),
          currentWithinOffset,
        )

        for (const server of servers) {
          if (results.length >= limit) break

          const key = server.name.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)

          results.push(server)
        }

        logger.info('crawler.npm.query_completed', {
          query,
          found: servers.length,
          from: currentWithinOffset,
          total,
          totalSoFar: results.length,
        })

        // If this query is exhausted, move to the next query
        if (servers.length < NPM_RESULTS_PER_QUERY || currentWithinOffset + servers.length >= total) {
          currentQueryIdx++
          currentWithinOffset = 0
        } else {
          // More pages in this query
          currentWithinOffset += servers.length
          break // Stop for this run, continue next run
        }
      } catch (queryErr) {
        logger.warn('crawler.npm.query_error', {
          query,
          error: queryErr instanceof Error ? queryErr.message : String(queryErr),
        })
        // Move to next query on error
        currentQueryIdx++
        currentWithinOffset = 0
      }
    }

    // If we've exhausted all queries, reset
    if (currentQueryIdx >= NPM_MCP_QUERIES.length) {
      endOfCatalog = true
    }

    const newOffset = endOfCatalog ? null : currentQueryIdx * 10000 + currentWithinOffset

    logger.info('crawler.npm.completed', {
      count: results.length,
      offset,
      newOffset,
      endOfCatalog,
    })

    return {
      servers: results,
      nextOffset: newOffset,
      endOfCatalog,
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.npm.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return { servers: [], nextOffset: offset, endOfCatalog: false }
  }
}

// ─── Unified dispatcher ────────────────────────────────────────────────────

/**
 * Crawls a specific registry source with pagination support.
 * Returns normalized server entries plus pagination metadata.
 */
export async function crawlSource(
  source: RegistrySource,
  limit: number,
  offset = 0
): Promise<PaginatedCrawlResult> {
  switch (source) {
    case 'mcp-registry':
      return crawlMcpRegistry(limit, offset)
    case 'pulsemcp':
      return crawlPulseMcp(limit, offset)
    case 'smithery':
      return crawlSmithery(limit, offset)
    case 'npm':
      return crawlNpmSearch(limit, offset)
    default:
      logger.warn('crawler.unknown_source', { source })
      return { servers: [], nextOffset: null, endOfCatalog: true }
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
