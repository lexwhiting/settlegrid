/**
 * settlegrid-giphy — Giphy MCP Server
 *
 * Wraps the Giphy API with SettleGrid billing.
 * Requires GIPHY_API_KEY environment variable.
 *
 * Methods:
 *   search(q)                                (1¢)
 *   get_trending()                           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  q: string
  limit?: number
}

interface GetTrendingInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.giphy.com/v1'
const USER_AGENT = 'settlegrid-giphy/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.GIPHY_API_KEY
  if (!key) throw new Error('GIPHY_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('api_key', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Giphy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'giphy',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search for GIFs' },
      get_trending: { costCents: 1, displayName: 'Get trending GIFs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/gifs/search', {
    params,
  })

  return data
}, { method: 'search' })

const getTrending = sg.wrap(async (args: GetTrendingInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/gifs/trending', {
    params,
  })

  return data
}, { method: 'get_trending' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getTrending }

console.log('settlegrid-giphy MCP server ready')
console.log('Methods: search, get_trending')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
