/**
 * settlegrid-pubmed — PubMed/NCBI MCP Server
 *
 * Wraps the PubMed/NCBI API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(term)                             (1¢)
 *   get_summary(id)                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  term: string
  retmax?: number
}

interface GetSummaryInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const USER_AGENT = 'settlegrid-pubmed/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`PubMed/NCBI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pubmed',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search PubMed articles' },
      get_summary: { costCents: 1, displayName: 'Get article summaries by PubMed IDs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.term || typeof args.term !== 'string') {
    throw new Error('term is required (search term)')
  }

  const params: Record<string, string> = {}
  params['term'] = args.term
  if (args.retmax !== undefined) params['retmax'] = String(args.retmax)

  const data = await apiFetch<Record<string, unknown>>('/esearch.fcgi', {
    params,
  })

  return data
}, { method: 'search' })

const getSummary = sg.wrap(async (args: GetSummaryInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (comma-separated pubmed ids)')
  }

  const params: Record<string, string> = {}
  params['id'] = args.id

  const data = await apiFetch<Record<string, unknown>>('/esummary.fcgi', {
    params,
  })

  return data
}, { method: 'get_summary' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getSummary }

console.log('settlegrid-pubmed MCP server ready')
console.log('Methods: search, get_summary')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
