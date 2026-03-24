/**
 * settlegrid-semantic-scholar — Semantic Scholar MCP Server
 *
 * Wraps the Semantic Scholar API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_papers(query)                     (1¢)
 *   get_paper(paperId)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPapersInput {
  query: string
  limit?: number
  fields?: string
}

interface GetPaperInput {
  paperId: string
  fields?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.semanticscholar.org/graph/v1'
const USER_AGENT = 'settlegrid-semantic-scholar/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Semantic Scholar API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'semantic-scholar',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_papers: { costCents: 1, displayName: 'Search academic papers' },
      get_paper: { costCents: 1, displayName: 'Get paper details by ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPapers = sg.wrap(async (args: SearchPapersInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search query)')
  }

  const params: Record<string, string> = {}
  params['query'] = args.query
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  if (args.fields !== undefined) params['fields'] = String(args.fields)

  const data = await apiFetch<Record<string, unknown>>('/paper/search', {
    params,
  })

  return data
}, { method: 'search_papers' })

const getPaper = sg.wrap(async (args: GetPaperInput) => {
  if (!args.paperId || typeof args.paperId !== 'string') {
    throw new Error('paperId is required (semantic scholar paper id or doi)')
  }

  const params: Record<string, string> = {}
  if (args.fields !== undefined) params['fields'] = String(args.fields)

  const data = await apiFetch<Record<string, unknown>>(`/paper/${encodeURIComponent(String(args.paperId))}`, {
    params,
  })

  return data
}, { method: 'get_paper' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPapers, getPaper }

console.log('settlegrid-semantic-scholar MCP server ready')
console.log('Methods: search_papers, get_paper')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
