/**
 * settlegrid-plant-data — Plant Biology Data MCP Server
 * Wraps GBIF API with SettleGrid billing.
 * Methods:
 *   search_plants(query, limit?) — Search plants (1¢)
 *   get_species(id)              — Get species details (1¢)
 *   list_families()              — List plant families (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface SpeciesInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.gbif.org/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-plant-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GBIF API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'plant-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_plants: { costCents: 1, displayName: 'Search plant species' },
      get_species: { costCents: 1, displayName: 'Get species details' },
      list_families: { costCents: 1, displayName: 'List plant families' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlants = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('species/search', {
    q: args.query,
    limit: String(limit),
    highertaxonKey: '6', // Plantae kingdom
  })
}, { method: 'search_plants' })

const getSpecies = sg.wrap(async (args: SpeciesInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (GBIF species key)')
  }
  return apiFetch<unknown>(`species/${encodeURIComponent(args.id)}`)
}, { method: 'get_species' })

const listFamilies = sg.wrap(async () => {
  return apiFetch<unknown>('species/search', {
    rank: 'FAMILY',
    highertaxonKey: '6',
    limit: '50',
    status: 'ACCEPTED',
  })
}, { method: 'list_families' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlants, getSpecies, listFamilies }

console.log('settlegrid-plant-data MCP server ready')
console.log('Methods: search_plants, get_species, list_families')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
