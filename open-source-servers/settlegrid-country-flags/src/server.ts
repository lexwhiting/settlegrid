/**
 * settlegrid-country-flags — Country Flags MCP Server
 *
 * Wraps REST Countries API for flag data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_flag(code)      — Flag URL + info by country code  (1¢)
 *   search_flags(name)  — Search countries by name          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFlagInput { code: string }
interface SearchInput { name: string }

interface CountryData {
  name: { common: string; official: string }
  cca2: string
  cca3: string
  flags: { png: string; svg: string; alt?: string }
  capital?: string[]
  region: string
  subregion?: string
  population: number
  languages?: Record<string, string>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://restcountries.com/v3.1'
const FIELDS = 'name,cca2,cca3,flags,capital,region,subregion,population,languages'

async function countriesFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Country not found')
    const body = await res.text().catch(() => '')
    throw new Error(`REST Countries API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatCountry(c: CountryData) {
  return {
    name: c.name.common,
    officialName: c.name.official,
    code: c.cca2,
    code3: c.cca3,
    flag: { png: c.flags.png, svg: c.flags.svg, alt: c.flags.alt || null },
    capital: c.capital?.[0] || null,
    region: c.region,
    subregion: c.subregion || null,
    population: c.population,
    languages: c.languages ? Object.values(c.languages) : [],
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'country-flags',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_flag: { costCents: 1, displayName: 'Get Flag' },
      search_flags: { costCents: 1, displayName: 'Search Flags' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFlag = sg.wrap(async (args: GetFlagInput) => {
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')
  const code = args.code.toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('code must be a 2-letter ISO country code (e.g. "US")')
  const data = await countriesFetch<CountryData[]>(`/alpha/${code}?fields=${FIELDS}`)
  const country = Array.isArray(data) ? data[0] : data
  return formatCountry(country as CountryData)
}, { method: 'get_flag' })

const searchFlags = sg.wrap(async (args: SearchInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  if (name.length === 0 || name.length > 100) throw new Error('name must be 1-100 characters')
  const data = await countriesFetch<CountryData[]>(`/name/${encodeURIComponent(name)}?fields=${FIELDS}`)
  return { query: name, count: data.length, countries: data.slice(0, 10).map(formatCountry) }
}, { method: 'search_flags' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFlag, searchFlags }

console.log('settlegrid-country-flags MCP server ready')
console.log('Methods: get_flag, search_flags')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
