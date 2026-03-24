/**
 * settlegrid-sec-company-search — SEC Company Search MCP Server
 *
 * Wraps the SEC Company Search API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(q)                                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  q: string
  forms?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://efts.sec.gov/LATEST'
const USER_AGENT = 'settlegrid-sec-company-search/1.0 contact@settlegrid.ai'

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
    throw new Error(`SEC Company Search API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sec-company-search',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search for companies in EDGAR' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (company name or ticker)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.forms !== undefined) params['forms'] = String(args.forms)

  const data = await apiFetch<Record<string, unknown>>('/search-index', {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search }

console.log('settlegrid-sec-company-search MCP server ready')
console.log('Methods: search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
