/**
 * settlegrid-rest-countries-v2 — REST Countries Extended MCP Server
 *
 * Wraps REST Countries API for comprehensive country data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_country(code)       — Full country data by code   (1¢)
 *   search_countries(name)  — Search by name              (1¢)
 *   get_by_region(region)   — Countries in a region       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCountryInput { code: string }
interface SearchInput { name: string }
interface RegionInput { region: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://restcountries.com/v3.1'
const VALID_REGIONS = new Set(['africa', 'americas', 'asia', 'europe', 'oceania'])

async function rcFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found')
    const body = await res.text().catch(() => '')
    throw new Error(`REST Countries API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatCountry(c: Record<string, unknown>) {
  const name = c.name as Record<string, unknown>
  const currencies = c.currencies as Record<string, { name: string; symbol: string }> | undefined
  return {
    name: (name.common as string),
    officialName: (name.official as string),
    code: c.cca2,
    code3: c.cca3,
    capital: (c.capital as string[]) || [],
    region: c.region,
    subregion: c.subregion || null,
    population: c.population,
    area: c.area || null,
    currencies: currencies ? Object.entries(currencies).map(([code, v]) => ({ code, name: v.name, symbol: v.symbol })) : [],
    languages: c.languages ? Object.values(c.languages as Record<string, string>) : [],
    borders: (c.borders as string[]) || [],
    timezones: (c.timezones as string[]) || [],
    flag: ((c.flags as Record<string, string>)?.svg) || null,
    independent: c.independent ?? null,
    landlocked: c.landlocked ?? null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rest-countries-v2',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_country: { costCents: 1, displayName: 'Get Country' },
      search_countries: { costCents: 1, displayName: 'Search Countries' },
      get_by_region: { costCents: 1, displayName: 'Get by Region' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCountry = sg.wrap(async (args: GetCountryInput) => {
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')
  const code = args.code.toUpperCase().trim()
  if (!/^[A-Z]{2,3}$/.test(code)) throw new Error('code must be a 2 or 3 letter country code')
  const data = await rcFetch<Record<string, unknown>[]>(`/alpha/${code}`)
  return formatCountry(Array.isArray(data) ? data[0] : data)
}, { method: 'get_country' })

const searchCountries = sg.wrap(async (args: SearchInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  if (name.length === 0 || name.length > 100) throw new Error('name must be 1-100 characters')
  const data = await rcFetch<Record<string, unknown>[]>(`/name/${encodeURIComponent(name)}`)
  return { query: name, count: data.length, countries: data.slice(0, 15).map(formatCountry) }
}, { method: 'search_countries' })

const getByRegion = sg.wrap(async (args: RegionInput) => {
  if (!args.region || typeof args.region !== 'string') throw new Error('region is required')
  const region = args.region.toLowerCase().trim()
  if (!VALID_REGIONS.has(region)) {
    throw new Error(`region must be one of: ${[...VALID_REGIONS].join(', ')}`)
  }
  const data = await rcFetch<Record<string, unknown>[]>(`/region/${region}`)
  return { region, count: data.length, countries: data.map(c => ({ name: (c.name as Record<string, string>).common, code: c.cca2, population: c.population })) }
}, { method: 'get_by_region' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCountry, searchCountries, getByRegion }

console.log('settlegrid-rest-countries-v2 MCP server ready')
console.log('Methods: get_country, search_countries, get_by_region')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
