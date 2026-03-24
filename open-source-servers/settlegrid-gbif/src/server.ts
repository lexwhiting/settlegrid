/**
 * settlegrid-gbif — GBIF (Biodiversity) MCP Server
 *
 * Wraps the GBIF (Biodiversity) API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_species(q)                        (1¢)
 *   get_occurrences(scientificName)          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchSpeciesInput {
  q: string
  limit?: number
}

interface GetOccurrencesInput {
  scientificName: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.gbif.org/v1'
const USER_AGENT = 'settlegrid-gbif/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`GBIF (Biodiversity) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gbif',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_species: { costCents: 1, displayName: 'Search for species by name' },
      get_occurrences: { costCents: 1, displayName: 'Search species occurrence records' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpecies = sg.wrap(async (args: SearchSpeciesInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (species name)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/species/search', {
    params,
  })

  return data
}, { method: 'search_species' })

const getOccurrences = sg.wrap(async (args: GetOccurrencesInput) => {
  if (!args.scientificName || typeof args.scientificName !== 'string') {
    throw new Error('scientificName is required (scientific species name)')
  }

  const params: Record<string, string> = {}
  params['scientificName'] = args.scientificName
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/occurrence/search', {
    params,
  })

  return data
}, { method: 'get_occurrences' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpecies, getOccurrences }

console.log('settlegrid-gbif MCP server ready')
console.log('Methods: search_species, get_occurrences')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
