/**
 * settlegrid-inaturalist — iNaturalist Nature Observations MCP Server
 *
 * Wraps the iNaturalist API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_observations(taxon_name, per_page)  — Search observations  (1¢)
 *   search_taxa(query)                          — Search taxa info     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ObservationInput {
  taxon_name: string
  per_page?: number
}

interface TaxaInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const INAT_BASE = 'https://api.inaturalist.org/v1'

async function inatFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${INAT_BASE}${path}`)
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
      search_observations: { costCents: 1, displayName: 'Search Observations' },
      search_taxa: { costCents: 1, displayName: 'Search Taxa' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObservations = sg.wrap(async (args: ObservationInput) => {
  if (!args.taxon_name || typeof args.taxon_name !== 'string') {
    throw new Error('taxon_name is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.taxon_name)
  const data = await inatFetch<{ total_results: number; results: any[] }>(
    `/observations?taxon_name=${q}&per_page=${perPage}&order=desc&order_by=created_at`
  )
  return {
    taxonName: args.taxon_name,
    totalResults: data.total_results,
    observations: data.results.map((o: any) => ({
      id: o.id,
      species: o.taxon?.name || '',
      commonName: o.taxon?.preferred_common_name || '',
      location: o.place_guess,
      latitude: o.geojson?.coordinates?.[1],
      longitude: o.geojson?.coordinates?.[0],
      observedOn: o.observed_on,
      qualityGrade: o.quality_grade,
      photoUrl: o.photos?.[0]?.url || '',
    })),
  }
}, { method: 'search_observations' })

const searchTaxa = sg.wrap(async (args: TaxaInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await inatFetch<{ results: any[] }>(`/taxa?q=${q}&per_page=10`)
  return {
    query: args.query,
    count: data.results.length,
    taxa: data.results.map((t: any) => ({
      id: t.id,
      name: t.name,
      commonName: t.preferred_common_name || '',
      rank: t.rank,
      observationsCount: t.observations_count,
      wikipediaSummary: t.wikipedia_summary?.slice(0, 500) || '',
      photoUrl: t.default_photo?.medium_url || '',
    })),
  }
}, { method: 'search_taxa' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObservations, searchTaxa }

console.log('settlegrid-inaturalist MCP server ready')
console.log('Methods: search_observations, search_taxa')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
