/**
 * settlegrid-crossref — Crossref MCP Server
 *
 * Wraps the Crossref API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_works(query)                      (1¢)
 *   get_work(doi)                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchWorksInput {
  query: string
  rows?: number
}

interface GetWorkInput {
  doi: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.crossref.org'
const USER_AGENT = 'settlegrid-crossref/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Crossref API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'crossref',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_works: { costCents: 1, displayName: 'Search scholarly works' },
      get_work: { costCents: 1, displayName: 'Get work metadata by DOI' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchWorks = sg.wrap(async (args: SearchWorksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search query)')
  }

  const params: Record<string, string> = {}
  params['query'] = args.query
  if (args.rows !== undefined) params['rows'] = String(args.rows)

  const data = await apiFetch<Record<string, unknown>>('/works', {
    params,
  })

  return data
}, { method: 'search_works' })

const getWork = sg.wrap(async (args: GetWorkInput) => {
  if (!args.doi || typeof args.doi !== 'string') {
    throw new Error('doi is required (doi (e.g. 10.1038/nature12373))')
  }

  const params: Record<string, string> = {}
  params['doi'] = String(args.doi)

  const data = await apiFetch<Record<string, unknown>>(`/works/${encodeURIComponent(String(args.doi))}`, {
    params,
  })

  return data
}, { method: 'get_work' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchWorks, getWork }

console.log('settlegrid-crossref MCP server ready')
console.log('Methods: search_works, get_work')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
