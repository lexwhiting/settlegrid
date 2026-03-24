/**
 * settlegrid-gbif — GBIF Biodiversity Data MCP Server
 *
 * Wraps the GBIF REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_species(query, limit)        — Search species    (1¢)
 *   get_occurrences(taxon_key, limit)   — Get occurrences   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SpeciesSearchInput {
  query: string
  limit?: number
}

interface OccurrenceInput {
  taxon_key: number
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GBIF_BASE = 'https://api.gbif.org/v1'

async function gbifFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GBIF_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GBIF API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gbif',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_species: { costCents: 1, displayName: 'Search Species' },
      get_occurrences: { costCents: 1, displayName: 'Get Occurrences' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpecies = sg.wrap(async (args: SpeciesSearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await gbifFetch<{ results: any[] }>(`/species/search?q=${q}&limit=${limit}`)
  return {
    query: args.query,
    count: data.results.length,
    species: data.results.map((s: any) => ({
      key: s.key,
      scientificName: s.scientificName,
      commonName: s.vernacularNames?.[0]?.vernacularName || '',
      kingdom: s.kingdom,
      phylum: s.phylum,
      class: s.class,
      order: s.order,
      family: s.family,
      rank: s.rank,
    })),
  }
}, { method: 'search_species' })

const getOccurrences = sg.wrap(async (args: OccurrenceInput) => {
  if (typeof args.taxon_key !== 'number' || !Number.isFinite(args.taxon_key)) {
    throw new Error('taxon_key must be a number')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const data = await gbifFetch<{ results: any[] }>(
    `/occurrence/search?taxonKey=${args.taxon_key}&limit=${limit}`
  )
  return {
    taxonKey: args.taxon_key,
    count: data.results.length,
    occurrences: data.results.map((o: any) => ({
      key: o.key,
      species: o.species,
      country: o.country,
      decimalLatitude: o.decimalLatitude,
      decimalLongitude: o.decimalLongitude,
      eventDate: o.eventDate,
      basisOfRecord: o.basisOfRecord,
    })),
  }
}, { method: 'get_occurrences' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpecies, getOccurrences }

console.log('settlegrid-gbif MCP server ready')
console.log('Methods: search_species, get_occurrences')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
