/**
 * settlegrid-emissions-data — Country CO2 Emissions MCP Server
 *
 * Provides CO2 emissions data by country via World Bank.
 * No API key needed.
 *
 * Methods:
 *   get_emissions(country_code)              (1¢)
 *   get_emissions_per_capita(country_code)   (1¢)
 *   get_global_emissions_trend()             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetEmissionsInput { country_code: string }
interface GetEmissionsPerCapitaInput { country_code: string }

const API_BASE = 'https://api.worldbank.org/v2'
const USER_AGENT = 'settlegrid-emissions-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}&format=json`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'emissions-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_emissions: { costCents: 1, displayName: 'Get total CO2 emissions' },
      get_emissions_per_capita: { costCents: 1, displayName: 'Get CO2 per capita' },
      get_global_emissions_trend: { costCents: 1, displayName: 'Get global emissions trend' },
    },
  },
})

const getEmissions = sg.wrap(async (args: GetEmissionsInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/EN.ATM.CO2E.KT?date=2010:2024&per_page=15`
  )
  return { country_code: code, indicator: 'CO2 emissions (kt)', data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_emissions' })

const getEmissionsPerCapita = sg.wrap(async (args: GetEmissionsPerCapitaInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/EN.ATM.CO2E.PC?date=2010:2024&per_page=15`
  )
  return { country_code: code, indicator: 'CO2 per capita (metric tons)', data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_emissions_per_capita' })

const getGlobalEmissionsTrend = sg.wrap(async () => {
  const data = await apiFetch<unknown[]>(
    `/country/WLD/indicator/EN.ATM.CO2E.KT?date=2000:2024&per_page=25`
  )
  return { scope: 'global', indicator: 'CO2 emissions (kt)', data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_global_emissions_trend' })

export { getEmissions, getEmissionsPerCapita, getGlobalEmissionsTrend }

console.log('settlegrid-emissions-data MCP server ready')
console.log('Methods: get_emissions, get_emissions_per_capita, get_global_emissions_trend')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
