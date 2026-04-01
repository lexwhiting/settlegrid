/**
 * settlegrid-malta-data — Malta Country Data MCP Server
 *
 * Provides demographic, economic, and general data about Malta.
 * Uses REST Countries API for live data with local enrichment.
 *
 * Methods:
 *   get_demographics(district?)   — Population and demographic data  (2c)
 *   get_economy(indicator)        — Economic indicators              (2c)
 *   get_country_info()            — General country information      (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface GetDemographicsInput {
  district?: string
}

interface GetEconomyInput {
  indicator: string
}

// --- Data -------------------------------------------------------------------

const REGIONS: Record<string, number> = {
  southern_harbour: 83834, northern_harbour: 118409, south_eastern: 69037,
  western: 62228, northern: 65487, gozo: 37349,
}

const ECONOMY: Record<string, { value: number; unit: string }> = {
  gdp: { value: 19.2, unit: 'billion USD' },
  gdp_per_capita: { value: 36490, unit: 'USD' },
  tourism_revenue: { value: 2.6, unit: 'billion USD' },
  igaming_revenue: { value: 1.9, unit: 'billion EUR' },
  inflation: { value: 5.8, unit: 'percent' },
  unemployment: { value: 2.9, unit: 'percent' },
  financial_services: { value: 12, unit: 'percent of GDP' },
}

// --- Helpers ----------------------------------------------------------------

async function fetchCountryInfo(): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(
      'https://restcountries.com/v3.1/name/Malta?fullText=true',
      { signal: controller.signal, headers: { Accept: 'application/json' } }
    )
    if (!res.ok) throw new Error(`REST Countries API ${res.status}`)
    const data = (await res.json()) as Record<string, unknown>[]
    return data[0] ?? {}
  } finally {
    clearTimeout(timeout)
  }
}

// --- SettleGrid Init --------------------------------------------------------

const sg = settlegrid.init({
  toolSlug: 'malta-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_demographics: { costCents: 2, displayName: 'Get Demographics' },
      get_economy: { costCents: 2, displayName: 'Get Economy' },
      get_country_info: { costCents: 2, displayName: 'Get Country Info' },
    },
  },
})

// --- Handlers ---------------------------------------------------------------

const getDemographics = sg.wrap(async (args: GetDemographicsInput) => {
  if (args.district) {
    const key = args.district.toLowerCase().replace(/ /g, '_')
    const pop = REGIONS[key]
    if (!pop) {
      throw new Error(`Unknown district. Available: ${Object.keys(REGIONS).join(', ')}`)
    }
    return { country: 'Malta', district: args.district, population: pop }
  }
  return {
    country: 'Malta',
    population: 535064,
    year: 2023,
    median_age: 42.4, population_density_km2: 1672,
    districts: Object.keys(REGIONS),
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
  return { country: 'Malta', year: 2023, indicator: args.indicator, ...data }
}, { method: 'get_economy' })

const getCountryInfo = sg.wrap(async (_args: Record<string, never>) => {
  try {
    const info = await fetchCountryInfo()
    const name = info.name as Record<string, unknown> | undefined
    const flags = info.flags as Record<string, string> | undefined
    const currencies = info.currencies as Record<string, Record<string, string>> | undefined
    const languages = info.languages as Record<string, string> | undefined
    return {
      name: (name?.common as string) ?? 'Malta',
      official_name: (name?.official as string) ?? 'Malta',
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
    return { name: 'Malta', population: 535064, note: 'Live data unavailable' }
  }
}, { method: 'get_country_info' })

// --- Exports ----------------------------------------------------------------

export { getDemographics, getEconomy, getCountryInfo }

console.log('settlegrid-malta-data MCP server ready')
console.log('Methods: get_demographics, get_economy, get_country_info')
console.log('Pricing: 2c per call | Powered by SettleGrid')
