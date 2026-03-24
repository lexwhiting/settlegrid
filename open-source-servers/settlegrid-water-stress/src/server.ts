/**
 * settlegrid-water-stress — Water Stress Index MCP Server
 *
 * Provides water stress levels, freshwater withdrawal, and water risk data.
 * Uses World Bank indicators. No API key needed.
 *
 * Methods:
 *   get_water_stress(country_code)        (1¢)
 *   get_freshwater_withdrawal(country_code) (1¢)
 *   get_water_risk_ranking(limit)         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CountryInput { country_code: string }
interface RankingInput { limit?: number }

const API_BASE = 'https://api.worldbank.org/v2'
const USER_AGENT = 'settlegrid-water-stress/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}&format=json`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`World Bank API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'water-stress',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_water_stress: { costCents: 1, displayName: 'Get water stress level' },
      get_freshwater_withdrawal: { costCents: 1, displayName: 'Get freshwater withdrawal' },
      get_water_risk_ranking: { costCents: 1, displayName: 'Get water risk ranking' },
    },
  },
})

const getWaterStress = sg.wrap(async (args: CountryInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/ER.H2O.FWTL.ZS?date=2010:2024&per_page=15`
  )
  return { country_code: code, indicator: 'freshwater_withdrawal_pct', data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_water_stress' })

const getFreshwaterWithdrawal = sg.wrap(async (args: CountryInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/ER.H2O.FWTL.K3?date=2010:2024&per_page=15`
  )
  return { country_code: code, indicator: 'freshwater_withdrawal_billion_m3', data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_freshwater_withdrawal' })

const getWaterRiskRanking = sg.wrap(async (args: RankingInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
  const data = await apiFetch<unknown[]>(
    `/country/all/indicator/ER.H2O.FWTL.ZS?date=2020&per_page=300`
  )
  const items = (Array.isArray(data) && data[1] ? data[1] as Record<string, unknown>[] : [])
    .filter(d => d.value !== null)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, limit)
  return { limit, count: items.length, results: items }
}, { method: 'get_water_risk_ranking' })

export { getWaterStress, getFreshwaterWithdrawal, getWaterRiskRanking }

console.log('settlegrid-water-stress MCP server ready')
console.log('Methods: get_water_stress, get_freshwater_withdrawal, get_water_risk_ranking')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
