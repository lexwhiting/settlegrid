/**
 * settlegrid-butterfly-data — Butterfly Species Data MCP Server
 * Wraps GBIF API (Lepidoptera) with SettleGrid billing.
 * Methods:
 *   search_species(query, limit?)            — Search butterflies (1¢)
 *   get_species(key)                         — Get species details (1¢)
 *   get_occurrences(speciesKey, country?)     — Get occurrences (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface SpeciesInput {
  key: string
}

interface OccurrenceInput {
  speciesKey: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.gbif.org/v1'
const LEPIDOPTERA_KEY = '797' // GBIF key for Lepidoptera

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-butterfly-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GBIF API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'butterfly-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_species: { costCents: 1, displayName: 'Search butterfly species' },
      get_species: { costCents: 1, displayName: 'Get species details' },
      get_occurrences: { costCents: 2, displayName: 'Get occurrence records' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpecies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('species/search', {
    q: args.query,
    limit: String(limit),
    highertaxonKey: LEPIDOPTERA_KEY,
  })
}, { method: 'search_species' })

const getSpecies = sg.wrap(async (args: SpeciesInput) => {
  if (!args.key || typeof args.key !== 'string') {
    throw new Error('key is required (GBIF species key)')
  }
  return apiFetch<unknown>(`species/${encodeURIComponent(args.key)}`)
}, { method: 'get_species' })

const getOccurrences = sg.wrap(async (args: OccurrenceInput) => {
  if (!args.speciesKey || typeof args.speciesKey !== 'string') {
    throw new Error('speciesKey is required')
  }
  const params: Record<string, string> = { taxonKey: args.speciesKey, limit: '20' }
  if (args.country) params.country = args.country.toUpperCase()
  return apiFetch<unknown>('occurrence/search', params)
}, { method: 'get_occurrences' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpecies, getSpecies, getOccurrences }

console.log('settlegrid-butterfly-data MCP server ready')
console.log('Methods: search_species, get_species, get_occurrences')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
