/**
 * settlegrid-myanmar-data — Myanmar Country Data MCP Server
 *
 * Provides demographic, economic, and general data about Myanmar.
 * Uses REST Countries API for live data with local enrichment.
 *
 * Methods:
 *   get_demographics(state?)   — Population and demographic data  (2c)
 *   get_economy(indicator)        — Economic indicators              (2c)
 *   get_country_info()            — General country information      (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface GetDemographicsInput {
  state?: string
}

interface GetEconomyInput {
  indicator: string
}

// --- Data -------------------------------------------------------------------

const REGIONS: Record<string, number> = {
  yangon: 7360703, mandalay: 6165723, ayeyarwady: 6184829, sagaing: 5325347,
  bago: 4867373, magway: 3917055, shan: 5824432, mon: 2054393,
}

const ECONOMY: Record<string, { value: number; unit: string }> = {
  gdp: { value: 59.4, unit: 'billion USD' },
  gdp_per_capita: { value: 1095, unit: 'USD' },
  natural_gas_exports: { value: 3.5, unit: 'billion USD' },
  garment_exports: { value: 5.6, unit: 'billion USD' },
  rice_production: { value: 25.2, unit: 'million tonnes' },
  jade_exports: { value: 1.0, unit: 'billion USD' },
  inflation: { value: 8.8, unit: 'percent' },
  remittances: { value: 2.2, unit: 'billion USD' },
}

// --- Helpers ----------------------------------------------------------------

async function fetchCountryInfo(): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(
      'https://restcountries.com/v3.1/name/Myanmar?fullText=true',
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
  toolSlug: 'myanmar-data',
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
  if (args.state) {
    const key = args.state.toLowerCase().replace(/ /g, '_')
    const pop = REGIONS[key]
    if (!pop) {
      throw new Error(`Unknown state. Available: ${Object.keys(REGIONS).join(', ')}`)
    }
    return { country: 'Myanmar', state: args.state, population: pop }
  }
  return {
    country: 'Myanmar',
    population: 54179306,
    year: 2023,
    median_age: 29.2,
    states: Object.keys(REGIONS),
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
  return { country: 'Myanmar', year: 2023, indicator: args.indicator, ...data }
}, { method: 'get_economy' })

const getCountryInfo = sg.wrap(async (_args: Record<string, never>) => {
  try {
    const info = await fetchCountryInfo()
    const name = info.name as Record<string, unknown> | undefined
    const flags = info.flags as Record<string, string> | undefined
    const currencies = info.currencies as Record<string, Record<string, string>> | undefined
    const languages = info.languages as Record<string, string> | undefined
    return {
      name: (name?.common as string) ?? 'Myanmar',
      official_name: (name?.official as string) ?? 'Myanmar',
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
    return { name: 'Myanmar', population: 54179306, note: 'Live data unavailable' }
  }
}, { method: 'get_country_info' })

// --- Exports ----------------------------------------------------------------

export { getDemographics, getEconomy, getCountryInfo }

console.log('settlegrid-myanmar-data MCP server ready')
console.log('Methods: get_demographics, get_economy, get_country_info')
console.log('Pricing: 2c per call | Powered by SettleGrid')
