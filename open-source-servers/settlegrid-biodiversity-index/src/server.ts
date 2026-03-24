/**
 * settlegrid-biodiversity-index — Biodiversity Metrics MCP Server
 *
 * Provides biodiversity metrics, species counts, and occurrence data.
 * Uses GBIF (Global Biodiversity Information Facility). No API key needed.
 *
 * Methods:
 *   get_species_count(country)          (1¢)
 *   search_species(query)               (1¢)
 *   get_occurrence_data(species_key)    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetSpeciesCountInput { country: string }
interface SearchSpeciesInput { query: string; limit?: number }
interface GetOccurrenceDataInput { species_key: string; limit?: number }

const API_BASE = 'https://api.gbif.org/v1'
const USER_AGENT = 'settlegrid-biodiversity-index/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`GBIF API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'biodiversity-index',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_species_count: { costCents: 1, displayName: 'Get species count by country' },
      search_species: { costCents: 1, displayName: 'Search species' },
      get_occurrence_data: { costCents: 1, displayName: 'Get occurrence data' },
    },
  },
})

const getSpeciesCount = sg.wrap(async (args: GetSpeciesCountInput) => {
  if (!args.country) throw new Error('country is required (ISO alpha-2)')
  const code = args.country.toUpperCase().trim()
  const data = await apiFetch<Record<string, unknown>>('/occurrence/search', {
    country: code,
    limit: '0',
    facet: 'speciesKey',
    facetLimit: '10',
  })
  return { country: code, ...data }
}, { method: 'get_species_count' })

const searchSpecies = sg.wrap(async (args: SearchSpeciesInput) => {
  if (!args.query) throw new Error('query is required (species name)')
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
  const data = await apiFetch<Record<string, unknown>>('/species/search', {
    q: args.query,
    limit: String(limit),
  })
  return { query: args.query, ...data }
}, { method: 'search_species' })

const getOccurrenceData = sg.wrap(async (args: GetOccurrenceDataInput) => {
  if (!args.species_key) throw new Error('species_key is required')
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
  const data = await apiFetch<Record<string, unknown>>('/occurrence/search', {
    speciesKey: args.species_key,
    limit: String(limit),
  })
  return { species_key: args.species_key, ...data }
}, { method: 'get_occurrence_data' })

export { getSpeciesCount, searchSpecies, getOccurrenceData }

console.log('settlegrid-biodiversity-index MCP server ready')
console.log('Methods: get_species_count, search_species, get_occurrence_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
