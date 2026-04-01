/**
 * settlegrid-costa-rica-data — Costa Rica Country Data MCP Server
 *
 * Provides demographic, economic, and general data about Costa Rica.
 * Uses REST Countries API for live data with local enrichment.
 *
 * Methods:
 *   get_demographics(province?)   — Population and demographic data  (2c)
 *   get_economy(indicator)        — Economic indicators              (2c)
 *   get_country_info()            — General country information      (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface GetDemographicsInput {
  province?: string
}

interface GetEconomyInput {
  indicator: string
}

// --- Data -------------------------------------------------------------------

const REGIONS: Record<string, number> = {
  san_jose: 1404242, alajuela: 1001387, cartago: 535748, heredia: 513320,
  puntarenas: 467020, guanacaste: 364646, limon: 434115,
}

const ECONOMY: Record<string, { value: number; unit: string }> = {
  gdp: { value: 68.4, unit: 'billion USD' },
  gdp_per_capita: { value: 13090, unit: 'USD' },
  tourism_revenue: { value: 4.2, unit: 'billion USD' },
  coffee_exports: { value: 0.34, unit: 'billion USD' },
  inflation: { value: 0.5, unit: 'percent' },
  unemployment: { value: 11.8, unit: 'percent' },
  renewable_energy: { value: 99.0, unit: 'percent of electricity' },
  literacy_rate: { value: 97.9, unit: 'percent' },
}

// --- Helpers ----------------------------------------------------------------

async function fetchCountryInfo(): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(
      'https://restcountries.com/v3.1/name/Costa Rica?fullText=true',
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
  toolSlug: 'costa-rica-data',
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
  if (args.province) {
    const key = args.province.toLowerCase().replace(/ /g, '_')
    const pop = REGIONS[key]
    if (!pop) {
      throw new Error(`Unknown province. Available: ${Object.keys(REGIONS).join(', ')}`)
    }
    return { country: 'Costa Rica', province: args.province, population: pop }
  }
  return {
    country: 'Costa Rica',
    population: 5212173,
    year: 2023,
    median_age: 33.9, life_expectancy: 80.3,
    provinces: Object.keys(REGIONS),
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
  return { country: 'Costa Rica', year: 2023, indicator: args.indicator, ...data }
}, { method: 'get_economy' })

const getCountryInfo = sg.wrap(async (_args: Record<string, never>) => {
  try {
    const info = await fetchCountryInfo()
    const name = info.name as Record<string, unknown> | undefined
    const flags = info.flags as Record<string, string> | undefined
    const currencies = info.currencies as Record<string, Record<string, string>> | undefined
    const languages = info.languages as Record<string, string> | undefined
    return {
      name: (name?.common as string) ?? 'Costa Rica',
      official_name: (name?.official as string) ?? 'Costa Rica',
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
    return { name: 'Costa Rica', population: 5212173, note: 'Live data unavailable' }
  }
}, { method: 'get_country_info' })

// --- Exports ----------------------------------------------------------------

export { getDemographics, getEconomy, getCountryInfo }

console.log('settlegrid-costa-rica-data MCP server ready')
console.log('Methods: get_demographics, get_economy, get_country_info')
console.log('Pricing: 2c per call | Powered by SettleGrid')
