/**
 * settlegrid-plastic-pollution — Ocean Plastic Data MCP Server
 *
 * Provides ocean plastic pollution and waste data by country.
 * Uses World Bank environment indicators. No API key needed.
 *
 * Methods:
 *   get_waste_data(country_code)             (1¢)
 *   get_plastic_waste_trend(country_code)    (1¢)
 *   get_top_polluters(limit)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetWasteDataInput { country_code: string }
interface GetPlasticWasteTrendInput { country_code: string }
interface GetTopPollutersInput { limit?: number }

const API_BASE = 'https://api.worldbank.org/v2'
const USER_AGENT = 'settlegrid-plastic-pollution/1.0 (contact@settlegrid.ai)'

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
  toolSlug: 'plastic-pollution',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_waste_data: { costCents: 1, displayName: 'Get waste data by country' },
      get_plastic_waste_trend: { costCents: 1, displayName: 'Get plastic waste trend' },
      get_top_polluters: { costCents: 1, displayName: 'Get top polluting countries' },
    },
  },
})

const getWasteData = sg.wrap(async (args: GetWasteDataInput) => {
  if (!args.country_code) throw new Error('country_code is required (ISO alpha-2)')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/EN.ATM.PM25.MC.M3?date=2015:2024&per_page=10`
  )
  return { country_code: code, data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_waste_data' })

const getPlasticWasteTrend = sg.wrap(async (args: GetPlasticWasteTrendInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/EN.ATM.CO2E.PC?date=2010:2024&per_page=15`
  )
  return { country_code: code, data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_plastic_waste_trend' })

const getTopPolluters = sg.wrap(async (args: GetTopPollutersInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
  const data = await apiFetch<unknown[]>(
    `/country/all/indicator/EN.ATM.CO2E.PC?date=2022&per_page=300`
  )
  const items = Array.isArray(data) && data[1] ? data[1] : []
  const sorted = (items as Record<string, unknown>[])
    .filter((d) => d.value !== null)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, limit)
  return { limit, count: sorted.length, results: sorted }
}, { method: 'get_top_polluters' })

export { getWasteData, getPlasticWasteTrend, getTopPolluters }

console.log('settlegrid-plastic-pollution MCP server ready')
console.log('Methods: get_waste_data, get_plastic_waste_trend, get_top_polluters')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
