/**
 * settlegrid-unsplash — Unsplash MCP Server
 *
 * Wraps the Unsplash API with SettleGrid billing.
 * Requires UNSPLASH_ACCESS_KEY environment variable.
 *
 * Methods:
 *   search(query)                            (1¢)
 *   get_random()                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  per_page?: number
}

interface GetRandomInput {
  query?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.unsplash.com'
const USER_AGENT = 'settlegrid-unsplash/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) throw new Error('UNSPLASH_ACCESS_KEY environment variable is required')
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
    'Authorization': `Client-ID ${getApiKey()}`,
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
    throw new Error(`Unsplash API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'unsplash',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search for photos' },
      get_random: { costCents: 1, displayName: 'Get a random photo' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search query)')
  }

  const params: Record<string, string> = {}
  params['query'] = args.query
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/search/photos', {
    params,
  })

  return data
}, { method: 'search' })

const getRandom = sg.wrap(async (args: GetRandomInput) => {

  const params: Record<string, string> = {}
  if (args.query !== undefined) params['query'] = String(args.query)

  const data = await apiFetch<Record<string, unknown>>('/photos/random', {
    params,
  })

  return data
}, { method: 'get_random' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getRandom }

console.log('settlegrid-unsplash MCP server ready')
console.log('Methods: search, get_random')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
