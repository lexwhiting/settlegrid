/**
 * settlegrid-wildlife — IUCN Red List MCP Server
 *
 * Endangered species data from the IUCN Red List of Threatened Species.
 *
 * Methods:
 *   search_species(name)          — Search species by name  (2¢)
 *   get_country_species(iso)      — Get species list for a country by ISO code  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchSpeciesInput {
  name: string
}

interface GetCountrySpeciesInput {
  iso: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://apiv3.iucnredlist.org/api/v3'
const API_KEY = process.env.IUCN_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-wildlife/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IUCN Red List API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wildlife',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_species: { costCents: 2, displayName: 'Search Species' },
      get_country_species: { costCents: 2, displayName: 'Country Species' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpecies = sg.wrap(async (args: SearchSpeciesInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  const data = await apiFetch<any>(`/species/${encodeURIComponent(name)}?token=${API_KEY}`)
  const items = (data.result ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        taxonid: item.taxonid,
        scientific_name: item.scientific_name,
        category: item.category,
        main_common_name: item.main_common_name,
    })),
  }
}, { method: 'search_species' })

const getCountrySpecies = sg.wrap(async (args: GetCountrySpeciesInput) => {
  if (!args.iso || typeof args.iso !== 'string') throw new Error('iso is required')
  const iso = args.iso.trim()
  const data = await apiFetch<any>(`/country/getspecies/${encodeURIComponent(iso)}?token=${API_KEY}`)
  const items = (data.result ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        taxonid: item.taxonid,
        scientific_name: item.scientific_name,
        category: item.category,
        subspecies: item.subspecies,
        rank: item.rank,
    })),
  }
}, { method: 'get_country_species' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpecies, getCountrySpecies }

console.log('settlegrid-wildlife MCP server ready')
console.log('Methods: search_species, get_country_species')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
