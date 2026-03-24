/**
 * settlegrid-fec — FEC Campaign Finance MCP Server
 *
 * Wraps the FEC Campaign Finance API with SettleGrid billing.
 * Requires FEC_API_KEY environment variable.
 *
 * Methods:
 *   search_candidates(name)                  (1¢)
 *   get_totals(candidate_id)                 (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchCandidatesInput {
  name: string
  office?: string
}

interface GetTotalsInput {
  candidate_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.open.fec.gov/v1'
const USER_AGENT = 'settlegrid-fec/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  return process.env.FEC_API_KEY ?? 'DEMO_KEY'
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
    throw new Error(`FEC Campaign Finance API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fec',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_candidates: { costCents: 1, displayName: 'Search for political candidates' },
      get_totals: { costCents: 2, displayName: 'Get campaign finance totals by candidate ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCandidates = sg.wrap(async (args: SearchCandidatesInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (candidate name)')
  }

  const params: Record<string, string> = {}
  params['name'] = args.name
  if (args.office !== undefined) params['office'] = String(args.office)

  const data = await apiFetch<Record<string, unknown>>('/candidates/search/', {
    params,
  })

  return data
}, { method: 'search_candidates' })

const getTotals = sg.wrap(async (args: GetTotalsInput) => {
  if (!args.candidate_id || typeof args.candidate_id !== 'string') {
    throw new Error('candidate_id is required (fec candidate id)')
  }

  const params: Record<string, string> = {}
  params['candidate_id'] = String(args.candidate_id)

  const data = await apiFetch<Record<string, unknown>>(`/candidate/${encodeURIComponent(String(args.candidate_id))}/totals/`, {
    params,
  })

  return data
}, { method: 'get_totals' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCandidates, getTotals }

console.log('settlegrid-fec MCP server ready')
console.log('Methods: search_candidates, get_totals')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
