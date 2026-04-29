/**
 * settlegrid-uruguay-data — Uruguay Country Data MCP Server
 *
 * Provides demographic, economic, and general data about Uruguay.
 * Uses REST Countries API for live data with local enrichment.
 *
 * Methods:
 *   get_demographics(department?)   — Population and demographic data  (2c)
 *   get_economy(indicator)        — Economic indicators              (2c)
 *   get_country_info()            — General country information      (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface GetDemographicsInput {
  department?: string
}

interface GetEconomyInput {
  indicator: string
}

// --- Data -------------------------------------------------------------------

const REGIONS: Record<string, number> = {
  montevideo: 1382405, canelones: 520187, maldonado: 164300, salto: 124878,
  paysandu: 113244, rivera: 103493, colonia: 123203, san_jose: 108309,
}

const ECONOMY: Record<string, { value: number; unit: string }> = {
  gdp: { value: 77.2, unit: 'billion USD' },
  gdp_per_capita: { value: 22420, unit: 'USD' },
  beef_exports: { value: 2.8, unit: 'billion USD' },
  soy_exports: { value: 1.2, unit: 'billion USD' },
  tourism_revenue: { value: 2.5, unit: 'billion USD' },
  inflation: { value: 5.9, unit: 'percent' },
  unemployment: { value: 7.9, unit: 'percent' },
  renewable_energy: { value: 97, unit: 'percent of electricity' },
}

// --- Helpers ----------------------------------------------------------------

async function fetchCountryInfo(): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(
      'https://restcountries.com/v3.1/name/Uruguay?fullText=true',
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
  toolSlug: 'uruguay-data',
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
  if (args.department) {
    const key = args.department.toLowerCase().replace(/ /g, '_')
    const pop = REGIONS[key]
    if (!pop) {
      throw new Error(`Unknown department. Available: ${Object.keys(REGIONS).join(', ')}`)
    }
    return { country: 'Uruguay', department: args.department, population: pop }
  }
  return {
    country: 'Uruguay',
    population: 3444263,
    year: 2023,
    median_age: 35.8, life_expectancy: 77.9,
    departments: Object.keys(REGIONS),
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
  return { country: 'Uruguay', year: 2023, indicator: args.indicator, ...data }
}, { method: 'get_economy' })

const getCountryInfo = sg.wrap(async (_args: Record<string, never>) => {
  try {
    const info = await fetchCountryInfo()
    const name = info.name as Record<string, unknown> | undefined
    const flags = info.flags as Record<string, string> | undefined
    const currencies = info.currencies as Record<string, Record<string, string>> | undefined
    const languages = info.languages as Record<string, string> | undefined
    return {
      name: (name?.common as string) ?? 'Uruguay',
      official_name: (name?.official as string) ?? 'Uruguay',
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
    return { name: 'Uruguay', population: 3444263, note: 'Live data unavailable' }
  }
}, { method: 'get_country_info' })

// --- Exports ----------------------------------------------------------------

export { getDemographics, getEconomy, getCountryInfo }

console.log('settlegrid-uruguay-data MCP server ready')
console.log('Methods: get_demographics, get_economy, get_country_info')
console.log('Pricing: 2c per call | Powered by SettleGrid')
