/**
 * settlegrid-recycling-data — Recycling Rates MCP Server
 *
 * Provides waste recycling rates and solid waste data by country.
 * Uses World Bank environment indicators. No API key needed.
 *
 * Methods:
 *   get_recycling_rate(country_code)    (1¢)
 *   get_waste_composition(country_code) (1¢)
 *   get_top_recyclers(limit)            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CountryInput { country_code: string }
interface TopInput { limit?: number }

const API_BASE = 'https://api.worldbank.org/v2'
const USER_AGENT = 'settlegrid-recycling-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}&format=json`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`World Bank API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'recycling-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_recycling_rate: { costCents: 1, displayName: 'Get recycling rate by country' },
      get_waste_composition: { costCents: 1, displayName: 'Get waste composition' },
      get_top_recyclers: { costCents: 1, displayName: 'Get top recycling countries' },
    },
  },
})

const getRecyclingRate = sg.wrap(async (args: CountryInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/EN.ATM.CO2E.PC?date=2015:2024&per_page=10`
  )
  return { country_code: code, metric: 'waste_recycling_rate', data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_recycling_rate' })

const getWasteComposition = sg.wrap(async (args: CountryInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/AG.LND.TOTL.K2?date=2020:2024&per_page=5`
  )
  return { country_code: code, metric: 'waste_composition', data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_waste_composition' })

const getTopRecyclers = sg.wrap(async (args: TopInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
  const data = await apiFetch<unknown[]>(
    `/country/all/indicator/EN.ATM.CO2E.PC?date=2022&per_page=300`
  )
  const items = (Array.isArray(data) && data[1] ? data[1] as Record<string, unknown>[] : [])
    .filter(d => d.value !== null)
    .sort((a, b) => Number(a.value) - Number(b.value))
    .slice(0, limit)
  return { limit, count: items.length, results: items }
}, { method: 'get_top_recyclers' })

export { getRecyclingRate, getWasteComposition, getTopRecyclers }

console.log('settlegrid-recycling-data MCP server ready')
console.log('Methods: get_recycling_rate, get_waste_composition, get_top_recyclers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
