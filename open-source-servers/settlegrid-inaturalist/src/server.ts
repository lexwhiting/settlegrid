/**
 * settlegrid-inaturalist — iNaturalist MCP Server
 *
 * Wraps the iNaturalist API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_observations()                    (1¢)
 *   search_taxa(q)                           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchObservationsInput {
  q?: string
  taxon_name?: string
  per_page?: number
}

interface SearchTaxaInput {
  q: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.inaturalist.org/v1'
const USER_AGENT = 'settlegrid-inaturalist/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`iNaturalist API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'inaturalist',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_observations: { costCents: 1, displayName: 'Search biodiversity observations' },
      search_taxa: { costCents: 1, displayName: 'Search taxonomic names' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObservations = sg.wrap(async (args: SearchObservationsInput) => {

  const params: Record<string, string> = {}
  if (args.q !== undefined) params['q'] = String(args.q)
  if (args.taxon_name !== undefined) params['taxon_name'] = String(args.taxon_name)
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/observations', {
    params,
  })

  return data
}, { method: 'search_observations' })

const searchTaxa = sg.wrap(async (args: SearchTaxaInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (taxon name to search)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q

  const data = await apiFetch<Record<string, unknown>>('/taxa', {
    params,
  })

  return data
}, { method: 'search_taxa' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObservations, searchTaxa }

console.log('settlegrid-inaturalist MCP server ready')
console.log('Methods: search_observations, search_taxa')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
