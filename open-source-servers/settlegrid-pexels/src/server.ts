/**
 * settlegrid-pexels — Pexels MCP Server
 *
 * Wraps the Pexels API with SettleGrid billing.
 * Requires PEXELS_API_KEY environment variable.
 *
 * Methods:
 *   search_photos(query)                     (1¢)
 *   get_curated()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPhotosInput {
  query: string
  per_page?: number
}

interface GetCuratedInput {
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.pexels.com/v1'
const USER_AGENT = 'settlegrid-pexels/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.PEXELS_API_KEY
  if (!key) throw new Error('PEXELS_API_KEY environment variable is required')
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
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Authorization': `${getApiKey()}`,
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
    throw new Error(`Pexels API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pexels',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_photos: { costCents: 1, displayName: 'Search for photos' },
      get_curated: { costCents: 1, displayName: 'Get curated photos' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPhotos = sg.wrap(async (args: SearchPhotosInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search query)')
  }

  const params: Record<string, string> = {}
  params['query'] = args.query
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/search', {
    params,
  })

  return data
}, { method: 'search_photos' })

const getCurated = sg.wrap(async (args: GetCuratedInput) => {

  const params: Record<string, string> = {}
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/curated', {
    params,
  })

  return data
}, { method: 'get_curated' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPhotos, getCurated }

console.log('settlegrid-pexels MCP server ready')
console.log('Methods: search_photos, get_curated')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
