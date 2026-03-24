/**
 * settlegrid-arxiv — arXiv MCP Server
 *
 * Wraps the arXiv API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(search_query)                     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  search_query: string
  max_results?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://export.arxiv.org/api'
const USER_AGENT = 'settlegrid-arxiv/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`arXiv API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'arxiv',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search arXiv papers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.search_query || typeof args.search_query !== 'string') {
    throw new Error('search_query is required (search query (e.g. all:electron))')
  }

  const params: Record<string, string> = {}
  params['search_query'] = args.search_query
  if (args.max_results !== undefined) params['max_results'] = String(args.max_results)

  const data = await apiFetch<Record<string, unknown>>('/query', {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search }

console.log('settlegrid-arxiv MCP server ready')
console.log('Methods: search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
