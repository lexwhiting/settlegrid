/**
 * settlegrid-country-data — REST Countries MCP Server
 *
 * Wraps the free REST Countries API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_country(name)         — Full country details by name    (1¢)
 *   search(query)             — Search countries by partial name (1¢)
 *   get_by_region(region)     — List countries in a region       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCountryInput {
  name: string
}

interface SearchInput {
  query: string
}

interface GetByRegionInput {
  region: string
}

interface CountryRaw {
  name: { common: string; official: string }
  cca2: string
  cca3: string
  capital?: string[]
  region: string
  subregion?: string
  population: number
  area: number
  languages?: Record<string, string>
  currencies?: Record<string, { name: string; symbol: string }>
  timezones: string[]
  latlng: [number, number]
  borders?: string[]
  flags: { png: string; svg: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://restcountries.com/v3.1'
const FIELDS = 'name,cca2,cca3,capital,region,subregion,population,area,languages,currencies,timezones,latlng,borders,flags'

async function countriesFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (res.status === 404) {
    throw new Error('No countries found matching your query')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`REST Countries API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatCountry(c: CountryRaw) {
  return {
    name: c.name.common,
    officialName: c.name.official,
    codes: { alpha2: c.cca2, alpha3: c.cca3 },
    capital: c.capital?.[0] ?? null,
    region: c.region,
    subregion: c.subregion ?? null,
    population: c.population,
    area: c.area,
    languages: c.languages ? Object.values(c.languages) : [],
    currencies: c.currencies
      ? Object.entries(c.currencies).map(([code, info]) => ({
          code,
          name: info.name,
          symbol: info.symbol,
        }))
      : [],
    timezones: c.timezones,
    coordinates: { lat: c.latlng[0], lon: c.latlng[1] },
    borders: c.borders ?? [],
    flag: c.flags.svg,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'country-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_country: { costCents: 1, displayName: 'Get Country' },
      search: { costCents: 1, displayName: 'Search Countries' },
      get_by_region: { costCents: 1, displayName: 'Get by Region' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCountry = sg.wrap(async (args: GetCountryInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (e.g. "France", "United States")')
  }

  const countries = await countriesFetch<CountryRaw[]>(
    `/name/${encodeURIComponent(args.name.trim())}?fullText=true&fields=${FIELDS}`
  ).catch(() =>
    // Fallback to partial match if full text match fails
    countriesFetch<CountryRaw[]>(
      `/name/${encodeURIComponent(args.name.trim())}?fields=${FIELDS}`
    )
  )

  if (!countries.length) {
    throw new Error(`No country found for "${args.name}"`)
  }

  return formatCountry(countries[0])
}, { method: 'get_country' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (e.g. "united", "island")')
  }

  const countries = await countriesFetch<CountryRaw[]>(
    `/name/${encodeURIComponent(args.query.trim())}?fields=${FIELDS}`
  )

  return {
    query: args.query,
    count: countries.length,
    countries: countries.slice(0, 25).map(formatCountry),
  }
}, { method: 'search' })

const getByRegion = sg.wrap(async (args: GetByRegionInput) => {
  if (!args.region || typeof args.region !== 'string') {
    throw new Error('region is required (Africa, Americas, Asia, Europe, Oceania)')
  }
  const validRegions = ['africa', 'americas', 'asia', 'europe', 'oceania']
  const region = args.region.toLowerCase().trim()
  if (!validRegions.includes(region)) {
    throw new Error(`Invalid region "${args.region}". Valid: Africa, Americas, Asia, Europe, Oceania`)
  }

  const countries = await countriesFetch<CountryRaw[]>(
    `/region/${region}?fields=${FIELDS}`
  )

  return {
    region: args.region,
    count: countries.length,
    countries: countries
      .sort((a, b) => b.population - a.population)
      .map(formatCountry),
  }
}, { method: 'get_by_region' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCountry, search, getByRegion }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'country-data',
//   pricing: { defaultCostCents: 1 },
//   routes: { ... },
// })

console.log('settlegrid-country-data MCP server ready')
console.log('Methods: get_country, search, get_by_region')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
