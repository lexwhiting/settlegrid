/**
 * settlegrid-green-energy — Green Energy Mix MCP Server
 *
 * Provides energy generation mix data (solar, wind, hydro, nuclear, fossil).
 * Uses Ember Climate open data. No API key needed.
 *
 * Methods:
 *   get_energy_mix(country)           (1¢)
 *   get_generation_trend(country)     (1¢)
 *   get_clean_energy_ranking(limit)   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetEnergyMixInput { country: string }
interface GetGenerationTrendInput { country: string }
interface GetCleanEnergyRankingInput { limit?: number }

const API_BASE = 'https://api.worldbank.org/v2'
const USER_AGENT = 'settlegrid-green-energy/1.0 (contact@settlegrid.ai)'

async function wbFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`World Bank API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'green-energy',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_energy_mix: { costCents: 1, displayName: 'Get energy generation mix' },
      get_generation_trend: { costCents: 1, displayName: 'Get generation trend' },
      get_clean_energy_ranking: { costCents: 1, displayName: 'Get clean energy ranking' },
    },
  },
})

const getEnergyMix = sg.wrap(async (args: GetEnergyMixInput) => {
  if (!args.country) throw new Error('country is required (ISO code)')
  const code = args.country.toUpperCase().trim()
  const indicators = ['EG.ELC.RNWX.ZS', 'EG.ELC.NUCL.ZS', 'EG.ELC.FOSL.ZS']
  const results = await Promise.all(
    indicators.map(ind => wbFetch<unknown[]>(`/country/${encodeURIComponent(code)}/indicator/${ind}?date=2020:2024&per_page=5`))
  )
  return {
    country_code: code,
    renewable: Array.isArray(results[0]) && results[0][1] ? results[0][1] : null,
    nuclear: Array.isArray(results[1]) && results[1][1] ? results[1][1] : null,
    fossil: Array.isArray(results[2]) && results[2][1] ? results[2][1] : null,
  }
}, { method: 'get_energy_mix' })

const getGenerationTrend = sg.wrap(async (args: GetGenerationTrendInput) => {
  if (!args.country) throw new Error('country is required')
  const code = args.country.toUpperCase().trim()
  const data = await wbFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/EG.ELC.RNWX.ZS?date=2000:2024&per_page=25`
  )
  return { country_code: code, data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_generation_trend' })

const getCleanEnergyRanking = sg.wrap(async (args: GetCleanEnergyRankingInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
  const data = await wbFetch<unknown[]>(
    `/country/all/indicator/EG.ELC.RNWX.ZS?date=2022&per_page=300`
  )
  const items = (Array.isArray(data) && data[1] ? data[1] as Record<string, unknown>[] : [])
    .filter(d => d.value !== null)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, limit)
  return { limit, count: items.length, results: items }
}, { method: 'get_clean_energy_ranking' })

export { getEnergyMix, getGenerationTrend, getCleanEnergyRanking }

console.log('settlegrid-green-energy MCP server ready')
console.log('Methods: get_energy_mix, get_generation_trend, get_clean_energy_ranking')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
