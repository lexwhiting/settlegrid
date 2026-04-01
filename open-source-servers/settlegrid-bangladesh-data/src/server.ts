/**
 * settlegrid-bangladesh-data — Bangladesh Country Data MCP Server
 *
 * Provides demographic, economic, and general data about Bangladesh.
 * Uses REST Countries API for live data with local enrichment.
 *
 * Methods:
 *   get_demographics(division?)   — Population and demographic data  (2¢)
 *   get_economy(indicator)        — Economic indicators              (2¢)
 *   get_country_info()            — General country information      (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDemographicsInput {
  division?: string
}

interface GetEconomyInput {
  indicator: string
}

// ─── Data ───────────────────────────────────────────────────────────────────

const DIVISIONS: Record<string, number> = {
  dhaka: 44214100, chittagong: 33202300, rajshahi: 20353500, khulna: 17280700,
  sylhet: 11309100, rangpur: 17610900, barisal: 9328900, mymensingh: 12285100,
}

const ECONOMY: Record<string, { value: number; unit: string }> = {
  gdp: { value: 460.2, unit: 'billion USD' },
  garment_exports: { value: 47.4, unit: 'billion USD' },
  remittances: { value: 21.6, unit: 'billion USD' },
  inflation: { value: 9.5, unit: 'percent' },
  unemployment: { value: 5.2, unit: 'percent' },
  rice_production: { value: 38.1, unit: 'million tonnes' },
  gdp_per_capita: { value: 2688, unit: 'USD' },
  literacy_rate: { value: 74.7, unit: 'percent' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchCountryInfo(): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch('https://restcountries.com/v3.1/name/Bangladesh?fullText=true', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`REST Countries API ${res.status}`)
    const data = (await res.json()) as Record<string, unknown>[]
    return data[0] ?? {}
  } finally {
    clearTimeout(timeout)
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bangladesh-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_demographics: { costCents: 2, displayName: 'Get Demographics' },
      get_economy: { costCents: 2, displayName: 'Get Economy' },
      get_country_info: { costCents: 2, displayName: 'Get Country Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDemographics = sg.wrap(async (args: GetDemographicsInput) => {
  if (args.division) {
    const key = args.division.toLowerCase().replace(/ /g, '_')
    const pop = DIVISIONS[key]
    if (!pop) {
      throw new Error(`Unknown division. Available: ${Object.keys(DIVISIONS).join(', ')}`)
    }
    return { country: 'Bangladesh', division: args.division, population: pop }
  }
  return {
    country: 'Bangladesh',
    population: 169828911,
    year: 2023,
    density_per_km2: 1265,
    median_age: 27.9,
    divisions: Object.keys(DIVISIONS),
  }
}, { method: 'get_demographics' })

const getEconomy = sg.wrap(async (args: GetEconomyInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required')
  }
  const key = args.indicator.toLowerCase().replace(/ /g, '_')
  const data = ECONOMY[key]
  if (!data) {
    throw new Error(`Unknown indicator. Available: ${Object.keys(ECONOMY).join(', ')}`)
  }
  return { country: 'Bangladesh', year: 2023, indicator: args.indicator, ...data }
}, { method: 'get_economy' })

const getCountryInfo = sg.wrap(async (_args: Record<string, never>) => {
  try {
    const info = await fetchCountryInfo()
    const name = info.name as Record<string, unknown> | undefined
    const flags = info.flags as Record<string, string> | undefined
    const currencies = info.currencies as Record<string, Record<string, string>> | undefined
    const languages = info.languages as Record<string, string> | undefined
    return {
      name: (name?.common as string) ?? 'Bangladesh',
      official_name: (name?.official as string) ?? 'Bangladesh',
      capital: (info.capital as string[]) ?? [],
      region: info.region,
      subregion: info.subregion,
      population: info.population,
      area_km2: info.area,
      currencies: currencies ? Object.entries(currencies).map(([code, c]) => ({ code, name: c.name, symbol: c.symbol })) : [],
      languages: languages ? Object.values(languages) : [],
      flag_url: flags?.svg ?? flags?.png ?? null,
      timezones: info.timezones,
    }
  } catch {
    return { name: 'Bangladesh', population: 169828911, note: 'Live data unavailable — showing cached data' }
  }
}, { method: 'get_country_info' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDemographics, getEconomy, getCountryInfo }

console.log('settlegrid-bangladesh-data MCP server ready')
console.log('Methods: get_demographics, get_economy, get_country_info')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
